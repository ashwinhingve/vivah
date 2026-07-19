import type {
  ProfileContentResponse,
  ProfileMetaResponse,
  ProfilePhotoItem,
} from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

/**
 * Response of the storage presign call. The upload then goes *directly* to R2 —
 * never through the API (CLAUDE.md architecture rule 6).
 */
export interface PresignedUpload {
  uploadUrl: string;
  r2Key: string;
}

/**
 * The API rejects anything outside this allowlist at the edge (see
 * ALLOWED_MIME_TYPES in apps/api/src/storage/router.ts) so clients cannot upload
 * HTML/JS/SVG and get stored XSS via the R2 CDN. Mirrored here so the picker can
 * filter *before* burning a round-trip on a file that will be refused.
 */
export type UploadMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

export type UploadFolder =
  | 'photos'
  | 'documents'
  | 'portfolios'
  | 'avatars'
  | 'products';

/**
 * Profile surface — Track A's endpoints, under '/api/v1/profiles'.
 *
 * The photo flow is deliberately three calls, not one: presign → PUT to R2 →
 * register. `uploadPhoto` in the mobile app composes them, because the middle
 * step must not carry the session cookie (R2 rejects unexpected headers on a
 * presigned PUT) and so cannot go through `ApiClient`.
 */
export class ProfileEndpoints {
  constructor(private readonly client: ApiClient) {}

  getMe(): Promise<ProfileMetaResponse> {
    return this.client.get<ProfileMetaResponse>('/api/v1/profiles/me');
  }

  updateMe(input: Record<string, unknown>): Promise<ProfileMetaResponse> {
    return this.client.put<ProfileMetaResponse>('/api/v1/profiles/me', input);
  }

  getContent(): Promise<ProfileContentResponse> {
    return this.client.get<ProfileContentResponse>('/api/v1/profiles/me/content');
  }

  updateContentSection(
    section: string,
    input: Record<string, unknown>,
  ): Promise<ProfileContentResponse> {
    return this.client.put<ProfileContentResponse>(
      `/api/v1/profiles/me/content/${section}`,
      input,
    );
  }

  getPhotos(): Promise<ProfilePhotoItem[]> {
    return this.client.get<ProfilePhotoItem[]>('/api/v1/profiles/me/photos');
  }

  /** Step 1 of the photo flow: ask the API for a presigned R2 PUT URL. */
  presignPhotoUpload(input: {
    fileName: string;
    mimeType: UploadMimeType;
    folder: UploadFolder;
  }): Promise<PresignedUpload> {
    return this.client.post<PresignedUpload>(
      '/api/v1/storage/upload-url',
      input,
    );
  }

  /**
   * Step 3 of the photo flow: register the uploaded object against the profile.
   *
   * The field is `r2Key`, matching PhotoUploadSchema in @smartshaadi/schemas —
   * not `key`. Getting this wrong yields a 400 VALIDATION_ERROR *after* the
   * object is already in R2, which is exactly the orphan case the mobile
   * uploader has to clean up.
   */
  registerPhoto(input: {
    r2Key: string;
    mimeType: string;
    fileSize: number;
    isPrimary?: boolean;
    displayOrder?: number;
  }): Promise<ProfilePhotoItem> {
    return this.client.post<ProfilePhotoItem>(
      '/api/v1/profiles/me/photos',
      input,
    );
  }

  deletePhoto(photoId: string): Promise<void> {
    return this.client.delete<void>(`/api/v1/profiles/me/photos/${photoId}`);
  }

  getStrengthTips(): Promise<{ tips: string[]; score: number }> {
    return this.client.get<{ tips: string[]; score: number }>(
      '/api/v1/profiles/me/strength-tips',
    );
  }
}
