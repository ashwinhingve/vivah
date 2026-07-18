import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Field } from '../../../components/Field';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse, LifestyleSection } from '@smartshaadi/types';

interface OnboardingLifestyleProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingLifestyle({ profile }: OnboardingLifestyleProps) {
  const queryClient = useQueryClient();
  const lifestyle = profile?.lifestyle;

  const [formState, setFormState] = useState<LifestyleSection>({
    diet: lifestyle?.diet,
    smoking: lifestyle?.smoking,
    drinking: lifestyle?.drinking,
    hobbies: lifestyle?.hobbies || [],
    interests: lifestyle?.interests || [],
    fitnessLevel: lifestyle?.fitnessLevel,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: LifestyleSection) =>
      api.profiles.updateContentSection('lifestyle', data as Record<string, unknown>),
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

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!formState.diet) {
      newErrors.diet = 'Diet preference is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await updateMutation.mutateAsync(formState);
  };

  return (
    <View>
      <Field
        label="Diet"
        value={formState.diet || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['VEG', 'NON_VEG', 'JAIN', 'VEGAN', 'EGGETARIAN'].includes(val)) {
            handleUpdateField('diet', val);
          }
        }}
        placeholder="VEG, NON_VEG, JAIN, VEGAN, EGGETARIAN"
      />
      {errors.diet && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.diet}</Text>
        </View>
      )}

      <Field
        label="Smoking"
        value={formState.smoking || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['NEVER', 'OCCASIONALLY', 'REGULARLY'].includes(val)) {
            handleUpdateField('smoking', val);
          }
        }}
        placeholder="NEVER, OCCASIONALLY, REGULARLY"
      />

      <Field
        label="Drinking"
        value={formState.drinking || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['NEVER', 'OCCASIONALLY', 'REGULARLY'].includes(val)) {
            handleUpdateField('drinking', val);
          }
        }}
        placeholder="NEVER, OCCASIONALLY, REGULARLY"
      />

      <Field
        label="Hobbies (comma-separated)"
        value={formState.hobbies?.join(', ') || ''}
        onChangeText={(value) =>
          handleUpdateField('hobbies', value.split(',').map((h) => h.trim()).filter(Boolean))
        }
        placeholder="e.g., Reading, Traveling, Sports"
      />

      <Field
        label="Interests (comma-separated)"
        value={formState.interests?.join(', ') || ''}
        onChangeText={(value) =>
          handleUpdateField('interests', value.split(',').map((i) => i.trim()).filter(Boolean))
        }
        placeholder="e.g., Music, Art, Technology"
      />

      <Field
        label="Fitness Level"
        value={formState.fitnessLevel || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['ACTIVE', 'MODERATE', 'SEDENTARY'].includes(val)) {
            handleUpdateField('fitnessLevel', val);
          }
        }}
        placeholder="ACTIVE, MODERATE, SEDENTARY"
      />

      {errors.submit && (
        <View className="mb-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.submit}</Text>
        </View>
      )}

      <Button
        title={updateMutation.isPending ? 'Saving...' : 'Save & Continue'}
        loading={updateMutation.isPending}
        onPress={handleSave}
        variant="primary"
      />
    </View>
  );
}
