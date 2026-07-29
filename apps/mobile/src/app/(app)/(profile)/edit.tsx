import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState, EmptyState, describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import { useSession } from '../../../hooks/useSession';

const TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'location', label: 'Location' },
  { id: 'education', label: 'Education' },
  { id: 'profession', label: 'Career' },
  { id: 'lifestyle', label: 'Lifestyle' },
] as const;

const HEADER = <AppHeader title="Edit Profile" showBack />;

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Fetch profile content
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

  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('personal');

  const updateMutation = useMutation({
    mutationFn: async (payload: { section: string; data: Record<string, unknown> }) =>
      api.profiles.updateContentSection(payload.section, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
      setErrors({});
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ submit: message });
    },
  });

  const handleUpdateField = (field: string, value: unknown) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSection = async () => {
    if (Object.keys(formState).length === 0) {
      setErrors({ submit: 'No changes to save' });
      return;
    }
    await updateMutation.mutateAsync({ section: activeTab, data: formState });
    setFormState({});
  };

  if (!session) {
    return (
      <Screen>
        <EmptyState
          title="Please sign in"
          message="You need to be signed in to edit your profile."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        {HEADER}
        <View className="flex-row gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={40} width={96} radius={20} />
          ))}
        </View>
        <Card testID="edit-profile-loading">
          <Skeleton height={14} width="30%" radius={6} />
          <Skeleton height={44} radius={8} className="mt-2" />
          <Skeleton height={14} width="30%" radius={6} className="mt-4" />
          <Skeleton height={44} radius={8} className="mt-2" />
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {HEADER}
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        {HEADER}
        <EmptyState
          title="Profile not found"
          message="We couldn't load your profile to edit."
        />
      </Screen>
    );
  }

  // Render form fields based on selected tab
  const renderFormFields = () => {
    const personal = profile.personal || {};
    const location = profile.location || {};
    const education = profile.education || {};
    const profession = profile.profession || {};
    const lifestyle = profile.lifestyle || {};

    switch (activeTab) {
      case 'personal':
        return (
          <View>
            <Input containerClassName="mb-4"
              label="Full Name"
              value={
                (formState.fullName as string) ||
                personal.fullName ||
                ''
              }
              onChangeText={(value) => handleUpdateField('fullName', value)}
              placeholder="Enter your name"
            />
            <Input
              label="Height (cm)"
              value={
                formState.height
                  ? String(formState.height)
                  : personal.height
                    ? String(personal.height)
                    : ''
              }
              onChangeText={(value) =>
                handleUpdateField('height', value ? parseInt(value, 10) : undefined)
              }
              placeholder="170"
              keyboardType="decimal-pad"
            />
          </View>
        );

      case 'location':
        return (
          <View>
            <Input containerClassName="mb-4"
              label="City"
              value={
                (formState.city as string) ||
                location.city ||
                ''
              }
              onChangeText={(value) => handleUpdateField('city', value)}
              placeholder="Enter city"
            />
            <Input containerClassName="mb-4"
              label="State"
              value={
                (formState.state as string) ||
                location.state ||
                ''
              }
              onChangeText={(value) => handleUpdateField('state', value)}
              placeholder="Enter state"
            />
            <Input
              label="Country"
              value={
                (formState.country as string) ||
                location.country ||
                ''
              }
              onChangeText={(value) => handleUpdateField('country', value)}
              placeholder="Enter country"
            />
          </View>
        );

      case 'education':
        return (
          <View>
            <Input containerClassName="mb-4"
              label="Degree"
              value={
                (formState.degree as string) ||
                education.degree ||
                ''
              }
              onChangeText={(value) => handleUpdateField('degree', value)}
              placeholder="Enter degree"
            />
            <Input
              label="College"
              value={
                (formState.college as string) ||
                education.college ||
                ''
              }
              onChangeText={(value) => handleUpdateField('college', value)}
              placeholder="Enter college"
            />
          </View>
        );

      case 'profession':
        return (
          <View>
            <Input containerClassName="mb-4"
              label="Occupation"
              value={
                (formState.occupation as string) ||
                profession.occupation ||
                ''
              }
              onChangeText={(value) => handleUpdateField('occupation', value)}
              placeholder="Enter occupation"
            />
            <Input containerClassName="mb-4"
              label="Employer"
              value={
                (formState.employer as string) ||
                profession.employer ||
                ''
              }
              onChangeText={(value) => handleUpdateField('employer', value)}
              placeholder="Enter employer"
            />
            <Input
              label="Income Range"
              value={
                (formState.incomeRange as string) ||
                profession.incomeRange ||
                ''
              }
              onChangeText={(value) => handleUpdateField('incomeRange', value)}
              placeholder="e.g., 10-20 Lakhs"
            />
          </View>
        );

      case 'lifestyle':
        return (
          <View>
            <Input containerClassName="mb-4"
              label="Diet"
              value={
                (formState.diet as string) ||
                lifestyle.diet ||
                ''
              }
              onChangeText={(value) => handleUpdateField('diet', value)}
              placeholder="VEG, NON_VEG, JAIN, VEGAN"
            />
            <Input
              label="Hobbies (comma-separated)"
              value={
                Array.isArray(formState.hobbies)
                  ? (formState.hobbies as string[]).join(', ')
                  : lifestyle.hobbies?.join(', ') || ''
              }
              onChangeText={(value) =>
                handleUpdateField(
                  'hobbies',
                  value
                    .split(',')
                    .map((h) => h.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Reading, Traveling, Sports"
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Screen scroll keyboardAvoiding>
      {HEADER}

      {/* Tab pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setActiveTab(tab.id);
                setFormState({});
                setErrors({});
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className={`mr-2 min-h-11 items-center justify-center px-4 rounded-full border ${
                isActive ? 'bg-primary border-primary' : 'bg-surface border-gold/40'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-on-primary' : 'text-ink'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Form fields — re-animate when the tab changes */}
      <Animated.View key={activeTab} entering={FadeInUp.duration(250)} className="mb-6">
        <Card>{renderFormFields()}</Card>
      </Animated.View>

      {/* Errors */}
      {errors.submit && <ErrorBanner message={errors.submit} className="mb-4" />}

      {/* Action buttons */}
      <View className="gap-3 mb-8">
        <Button
          title={updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          loading={updateMutation.isPending}
          onPress={handleSaveSection}
          variant="primary"
        />
        <Button
          title="Back to Profile"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
