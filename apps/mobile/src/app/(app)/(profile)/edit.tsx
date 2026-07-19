import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../components/Screen';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { LoadingState, ErrorState, EmptyState, describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import { useSession } from '../../../hooks/useSession';
import type { ProfileContentResponse } from '@smartshaadi/types';

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
    return <LoadingState label="Loading your profile..." />;
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
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
            <Input containerClassName="mb-4"
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
            <Input containerClassName="mb-4"
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
            <Input containerClassName="mb-4"
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
            <Input containerClassName="mb-4"
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
            <Input containerClassName="mb-4"
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
    <Screen scroll>
      <Text className="font-heading text-2xl text-primary mb-6">Edit Profile</Text>

      {/* Tab buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
        {[
          { id: 'personal', label: 'Personal' },
          { id: 'location', label: 'Location' },
          { id: 'education', label: 'Education' },
          { id: 'profession', label: 'Career' },
          { id: 'lifestyle', label: 'Lifestyle' },
        ].map((tab) => (
          <View key={tab.id} className="mr-2">
            <Button
              title={tab.label}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
              onPress={() => {
                setActiveTab(tab.id);
                setFormState({});
                setErrors({});
              }}
            />
          </View>
        ))}
      </ScrollView>

      {/* Form fields */}
      <View className="mb-6">
        {renderFormFields()}
      </View>

      {/* Errors */}
      {errors.submit && (
        <View className="mb-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.submit}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View className="gap-3">
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
