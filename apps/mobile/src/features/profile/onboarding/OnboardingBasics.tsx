import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse, PersonalSection } from '@smartshaadi/types';

interface OnboardingBasicsProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingBasics({ profile }: OnboardingBasicsProps) {
  const queryClient = useQueryClient();
  const personal = profile?.personal;

  const [formState, setFormState] = useState<PersonalSection>({
    fullName: personal?.fullName || '',
    dob: personal?.dob || '',
    gender: personal?.gender,
    height: personal?.height,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: PersonalSection) =>
      api.profiles.updateContentSection('personal', data as Record<string, unknown>),
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

    if (!formState.fullName?.trim()) {
      newErrors.fullName = 'Name is required';
    }
    if (!formState.dob) {
      newErrors.dob = 'Date of birth is required';
    }
    if (!formState.gender) {
      newErrors.gender = 'Gender is required';
    }
    if (!formState.height) {
      newErrors.height = 'Height is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await updateMutation.mutateAsync(formState);
  };

  return (
    <View>
      <Input containerClassName="mb-4"
        label="Full Name"
        value={formState.fullName || ''}
        onChangeText={(value) => handleUpdateField('fullName', value)}
        placeholder="Enter your full name"
        maxLength={255}
      />
      {errors.fullName && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.fullName}</View>
        </View>
      )}

      <Input containerClassName="mb-4"
        label="Date of Birth (YYYY-MM-DD)"
        value={formState.dob || ''}
        onChangeText={(value) => handleUpdateField('dob', value)}
        placeholder="1995-06-15"
        keyboardType="decimal-pad"
      />
      {errors.dob && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.dob}</View>
        </View>
      )}

      <View className="mb-4">
        <Input containerClassName="mb-4"
          label="Gender"
          value={formState.gender || ''}
          onChangeText={(value) => {
            const val = value.toUpperCase();
            if (['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'].includes(val)) {
              handleUpdateField('gender', val);
            }
          }}
          placeholder="MALE, FEMALE, NON_BINARY, OTHER"
        />
        {errors.gender && (
          <View className="px-3 py-2 bg-destructive/10 rounded">
            <View className="text-destructive text-sm">{errors.gender}</View>
          </View>
        )}
      </View>

      <Input containerClassName="mb-4"
        label="Height (cm)"
        value={formState.height ? String(formState.height) : ''}
        onChangeText={(value) =>
          handleUpdateField('height', value ? parseInt(value, 10) : undefined)
        }
        placeholder="170"
        keyboardType="decimal-pad"
      />
      {errors.height && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.height}</View>
        </View>
      )}

      {errors.submit && (
        <View className="mb-4 p-3 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.submit}</View>
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
