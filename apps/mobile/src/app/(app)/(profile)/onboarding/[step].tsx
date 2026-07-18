import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, ScrollView } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen } from '../../../../components/Screen';
import { Button } from '../../../../components/Button';
import { Field } from '../../../../components/Field';
import { LoadingState, ErrorState, EmptyState, describeError } from '../../../../components/States';
import { api } from '../../../../lib/api';
import { useSession } from '../../../../hooks/useSession';
import OnboardingBasics from '../../../../features/profile/onboarding/OnboardingBasics';
import OnboardingLocation from '../../../../features/profile/onboarding/OnboardingLocation';
import OnboardingEducationCareer from '../../../../features/profile/onboarding/OnboardingEducationCareer';
import OnboardingFamily from '../../../../features/profile/onboarding/OnboardingFamily';
import OnboardingLifestyle from '../../../../features/profile/onboarding/OnboardingLifestyle';
import OnboardingCommunity from '../../../../features/profile/onboarding/OnboardingCommunity';
import OnboardingPartnerPrefs from '../../../../features/profile/onboarding/OnboardingPartnerPrefs';
import OnboardingPhotos from '../../../../features/profile/onboarding/OnboardingPhotos';

/** Step definitions: slug -> { title, description, component }. Track A owned. */
const ONBOARDING_STEPS = [
  { slug: 'basics', title: 'Basics', description: 'Name, date of birth, gender, height' },
  { slug: 'location', title: 'Where are you from?', description: 'City, state, country' },
  { slug: 'education-career', title: 'Education & Career', description: 'Education, profession, income' },
  { slug: 'family', title: 'Family', description: 'Family background and values' },
  { slug: 'lifestyle', title: 'Lifestyle', description: 'Diet, interests, hobbies' },
  { slug: 'community', title: 'Community', description: 'Religion, caste, horoscope' },
  { slug: 'preferences', title: 'Partner preferences', description: 'Who are you looking for?' },
  { slug: 'photos', title: 'Photos', description: 'Add your profile photos' },
] as const;

export default function OnboardingStepScreen() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  // Resolve step index and component
  const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.slug === step);
  const isInvalidStep = currentStepIndex === -1;
  const currentStep = isInvalidStep ? ONBOARDING_STEPS[0] : ONBOARDING_STEPS[currentStepIndex];

  // Fetch profile content to pre-fill the form
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile-content'],
    queryFn: () => api.profiles.getContent(),
    enabled: !!session,
  });

  // Track which step component to render
  const renderStepComponent = () => {
    switch (step) {
      case 'basics':
        return <OnboardingBasics profile={profile} />;
      case 'location':
        return <OnboardingLocation profile={profile} />;
      case 'education-career':
        return <OnboardingEducationCareer profile={profile} />;
      case 'family':
        return <OnboardingFamily profile={profile} />;
      case 'lifestyle':
        return <OnboardingLifestyle profile={profile} />;
      case 'community':
        return <OnboardingCommunity profile={profile} />;
      case 'preferences':
        return <OnboardingPartnerPrefs profile={profile} />;
      case 'photos':
        return <OnboardingPhotos profile={profile} />;
      default:
        return <OnboardingBasics profile={profile} />;
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      const nextSlug = ONBOARDING_STEPS[currentStepIndex + 1].slug;
      router.push(`/(app)/(profile)/onboarding/${nextSlug}`);
    } else {
      // Onboarding complete, go to profile view
      router.push('/(app)/(profile)');
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevSlug = ONBOARDING_STEPS[currentStepIndex - 1].slug;
      router.push(`/(app)/(profile)/onboarding/${prevSlug}`);
    }
  };

  if (isInvalidStep) {
    return (
      <Screen>
        <EmptyState
          title="Step not found"
          message="This onboarding step doesn't exist."
          actionLabel="Start from beginning"
          onAction={() => router.push(`/(app)/(profile)/onboarding/basics`)}
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <EmptyState
          title="Please sign in"
          message="You need to be signed in to set up your profile."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <LoadingState label="Loading your profile..." />;
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {/* Header with progress */}
      <View className="mb-6">
        <Text className="text-sm text-muted mb-2">
          Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
        </Text>
        <Text className="font-heading text-2xl text-primary mb-2">
          {currentStep.title}
        </Text>
        <Text className="text-muted">
          {currentStep.description}
        </Text>
      </View>

      {/* Progress bar */}
      <View className="h-1 bg-gold/20 rounded-full mb-8 overflow-hidden">
        <View
          className="h-full bg-gold"
          style={{
            width: `${((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100}%`,
          }}
        />
      </View>

      {/* Step component */}
      {renderStepComponent()}

      {/* Navigation */}
      <View className="mt-8 gap-3">
        <Button
          title={currentStepIndex === ONBOARDING_STEPS.length - 1 ? 'Complete' : 'Next'}
          variant="primary"
          onPress={handleNextStep}
        />
        {currentStepIndex > 0 && (
          <Button
            title="Back"
            variant="secondary"
            onPress={handlePrevStep}
          />
        )}
      </View>
    </Screen>
  );
}
