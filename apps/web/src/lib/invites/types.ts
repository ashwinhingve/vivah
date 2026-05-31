/**
 * Shared shape of the public invite payload returned by
 * GET /api/v1/invites/:slug — mirrors PublicInviteView in
 * apps/api/src/weddings/invite.service.ts. No owner PII.
 */
export interface PublicInviteView {
  templateId: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string | null;
  message: string | null;
  rsvpEnabled: boolean;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  hashtag: string | null;
  primaryColor: string | null;
  muhuratName: string | null;
  muhuratTithi: string | null;
  ceremonies: Array<{
    id: string;
    type: string;
    date: string | null;
    startTime: string | null;
    venue: string | null;
  }>;
  assetUrl: string | null;
}

/** Owner-side invite record from GET/PUT /api/v1/weddings/:id/invite. */
export interface InviteRecord {
  id: string;
  weddingId: string;
  slug: string;
  templateId: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string | null;
  message: string | null;
  rsvpEnabled: boolean;
  assetKey: string | null;
  publishedAt: string | null;
}
