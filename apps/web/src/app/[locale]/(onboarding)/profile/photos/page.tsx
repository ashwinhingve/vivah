import { cookies } from 'next/headers';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProfileProgress } from '@/components/profile/ProfileProgress';
import { PhotosClient } from './PhotosClient.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const STEPS = [
  { label: 'Personal',    done: true,  active: false },
  { label: 'Family',      done: true,  active: false },
  { label: 'Career',      done: true,  active: false },
  { label: 'Lifestyle',   done: true,  active: false },
  { label: 'Horoscope',   done: true,  active: false },
  { label: 'Community',   done: true,  active: false },
  { label: 'Preferences', done: true,  active: false },
  { label: 'Photos',      done: false, active: true  },
];

async function getPhotos() {
  const cookieStore = await cookies();
  const token = cookieStore.get('better-auth.session_token')?.value;
  if (!token) return [];

  const res = await fetch(`${API_URL}/api/v1/profiles/me`, {
    headers: { Cookie: `better-auth.session_token=${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return [];
  const json = await res.json() as { success: boolean; data: { photos: Array<{ id: string; r2Key: string; url?: string; isPrimary: boolean; displayOrder: number }> } };
  return json.success ? (json.data.photos ?? []) : [];
}

export default async function PhotosPage() {
  const photos = await getPhotos();

  return (
    <div>
      <ProfileProgress steps={STEPS} />

      <div className="bg-surface rounded-2xl shadow-card border border-gold/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-gold/10">
          <PageHeader
            title="Add Your Photos"
            subtitle="Your main photo is the first thing a potential match sees"
            className="mb-0"
          />
        </div>

        <div className="p-5">
          <PhotosClient initialPhotos={photos} />
        </div>
      </div>
    </div>
  );
}
