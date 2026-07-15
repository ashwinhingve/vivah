import { cookies } from 'next/headers';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProfilePhotoUploader } from '@/components/profile/ProfilePhotoUploader.client';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Step 8 of 8</span>
              <span className="text-xs text-muted-foreground">100%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-teal rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          <Link
            href="/profile/preferences"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover mb-4 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <PageHeader
            title="Add Your Photos"
            subtitle="Your main photo is the first thing a potential match sees"
            className="mb-0"
          />
        </div>

        <ProfilePhotoUploader initialPhotos={photos} />

        <div className="mt-6">
          <Link
            href="/profile/complete"
            className="block w-full bg-teal hover:bg-teal-hover text-white font-semibold rounded-lg py-3 text-sm text-center min-h-[48px] flex items-center justify-center gap-1 transition-colors"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
