import { ProfileDetailSkeleton } from '@/components/profile/ProfileDetailSkeleton';
export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4">
        <ProfileDetailSkeleton />
      </div>
    </div>
  );
}
