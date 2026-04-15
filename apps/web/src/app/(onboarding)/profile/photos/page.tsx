import { cookies } from 'next/headers';
import Link from 'next/link';
import { ProfilePhotoUploader } from '@/components/profile/ProfilePhotoUploader.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

async function getPhotos() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return [];
  const json = await res.json() as { success: boolean; data: { photos: Array<{ id: string; r2Key: string; url?: string; isPrimary: boolean; displayOrder: number }> } };
  return json.success ? (json.data.photos ?? []) : [];
}

export default async function PhotosPage() {
  const photos = await getPhotos();

  return (
    <div className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/profile/lifestyle"
            className="inline-flex items-center text-sm text-[#6B6B76] hover:text-[#7B2D42] mb-4 min-h-[44px] px-2"
          >
            ← Back
          </Link>
          <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-[#7B2D42]">
            Add Your Photos
          </h1>
          <p className="mt-1 text-sm text-[#6B6B76]">
            Your main photo is the first thing a potential match sees
          </p>
        </div>

        {/* Uploader */}
        <ProfilePhotoUploader initialPhotos={photos} />

        {/* Continue */}
        <div className="mt-6">
          <Link
            href="/profile/complete"
            className="block w-full bg-[#0E7C7B] text-white font-semibold rounded-lg py-3 text-sm text-center min-h-[48px] flex items-center justify-center active:scale-[0.97] transition-transform hover:bg-[#0D6B6A]"
          >
            Continue →
          </Link>
        </div>
      </div>
    </div>
  );
}
