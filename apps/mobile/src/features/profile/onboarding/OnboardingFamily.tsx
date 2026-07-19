import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse, FamilySection } from '@smartshaadi/types';

interface OnboardingFamilyProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingFamily({ profile }: OnboardingFamilyProps) {
  const queryClient = useQueryClient();
  const family = profile?.family;

  const [formState, setFormState] = useState<FamilySection>({
    fatherName: family?.fatherName || '',
    motherName: family?.motherName || '',
    fatherOccupation: family?.fatherOccupation || '',
    motherOccupation: family?.motherOccupation || '',
    familyType: family?.familyType,
    familyValues: family?.familyValues,
    familyStatus: family?.familyStatus,
    nativePlace: family?.nativePlace || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: FamilySection) =>
      api.profiles.updateContentSection('family', data as Record<string, unknown>),
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

    if (!formState.fatherName?.trim()) {
      newErrors.fatherName = 'Father name is required';
    }
    if (!formState.motherName?.trim()) {
      newErrors.motherName = 'Mother name is required';
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
        label="Father's Name"
        value={formState.fatherName || ''}
        onChangeText={(value) => handleUpdateField('fatherName', value)}
        placeholder="Enter father's name"
        maxLength={255}
      />
      {errors.fatherName && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.fatherName}</Text>
        </View>
      )}

      <Input containerClassName="mb-4"
        label="Father's Occupation (optional)"
        value={formState.fatherOccupation || ''}
        onChangeText={(value) => handleUpdateField('fatherOccupation', value)}
        placeholder="e.g., Engineer"
        maxLength={255}
      />

      <Input containerClassName="mb-4"
        label="Mother's Name"
        value={formState.motherName || ''}
        onChangeText={(value) => handleUpdateField('motherName', value)}
        placeholder="Enter mother's name"
        maxLength={255}
      />
      {errors.motherName && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.motherName}</Text>
        </View>
      )}

      <Input containerClassName="mb-4"
        label="Mother's Occupation (optional)"
        value={formState.motherOccupation || ''}
        onChangeText={(value) => handleUpdateField('motherOccupation', value)}
        placeholder="e.g., Doctor"
        maxLength={255}
      />

      <Input containerClassName="mb-4"
        label="Family Type"
        value={formState.familyType || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['JOINT', 'NUCLEAR', 'EXTENDED'].includes(val)) {
            handleUpdateField('familyType', val);
          }
        }}
        placeholder="JOINT, NUCLEAR, EXTENDED"
      />

      <Input containerClassName="mb-4"
        label="Family Values"
        value={formState.familyValues || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['TRADITIONAL', 'MODERATE', 'LIBERAL'].includes(val)) {
            handleUpdateField('familyValues', val);
          }
        }}
        placeholder="TRADITIONAL, MODERATE, LIBERAL"
      />

      <Input containerClassName="mb-4"
        label="Family Status"
        value={formState.familyStatus || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['MIDDLE_CLASS', 'UPPER_MIDDLE', 'AFFLUENT'].includes(val)) {
            handleUpdateField('familyStatus', val);
          }
        }}
        placeholder="MIDDLE_CLASS, UPPER_MIDDLE, AFFLUENT"
      />

      <Input containerClassName="mb-4"
        label="Native Place (optional)"
        value={formState.nativePlace || ''}
        onChangeText={(value) => handleUpdateField('nativePlace', value)}
        placeholder="e.g., Pune"
        maxLength={100}
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
