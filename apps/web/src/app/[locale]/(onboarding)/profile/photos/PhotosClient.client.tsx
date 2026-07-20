'use client';

import { ProfilePhotoUploader } from '@/components/profile/ProfilePhotoUploader.client';
import { OnboardingNav } from '@/components/onboarding/OnboardingNav';

interface Photo {
  id: string;
  r2Key: string;
  url?: string;
  isPrimary: boolean;
  displayOrder: number;
}

interface PhotosClientProps {
  initialPhotos: Photo[];
}

export function PhotosClient({ initialPhotos }: PhotosClientProps) {
  return (
    <>
      <ProfilePhotoUploader initialPhotos={initialPhotos} />
      <OnboardingNav
        currentStep={8}
        totalSteps={8}
        backHref="/profile/preferences"
        saveLabel="Continue to Complete"
      />
    </>
  );
}
