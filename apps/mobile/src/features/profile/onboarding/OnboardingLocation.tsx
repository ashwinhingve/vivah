import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse, LocationSection } from '@smartshaadi/types';

interface OnboardingLocationProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingLocation({ profile }: OnboardingLocationProps) {
  const queryClient = useQueryClient();
  const location = profile?.location;

  const [formState, setFormState] = useState<LocationSection>({
    city: location?.city || '',
    state: location?.state || '',
    country: location?.country || '',
    pincode: location?.pincode || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: LocationSection) =>
      api.profiles.updateContentSection('location', data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
      setErrors({});
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ submit: message });
    },
  });

  const handleUpdateField = (field: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!formState.city?.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formState.state?.trim()) {
      newErrors.state = 'State is required';
    }
    if (!formState.country?.trim()) {
      newErrors.country = 'Country is required';
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
        label="City"
        value={formState.city || ''}
        onChangeText={(value) => handleUpdateField('city', value)}
        placeholder="e.g., Mumbai"
        maxLength={100}
        error={errors.city}
      />

      <Input containerClassName="mb-4"
        label="State"
        value={formState.state || ''}
        onChangeText={(value) => handleUpdateField('state', value)}
        placeholder="e.g., Maharashtra"
        maxLength={100}
        error={errors.state}
      />

      <Input containerClassName="mb-4"
        label="Country"
        value={formState.country || ''}
        onChangeText={(value) => handleUpdateField('country', value)}
        placeholder="e.g., India"
        maxLength={100}
        error={errors.country}
      />

      <Input containerClassName="mb-4"
        label="Pincode (optional)"
        value={formState.pincode || ''}
        onChangeText={(value) => handleUpdateField('pincode', value)}
        placeholder="e.g., 400001"
        maxLength={10}
      />

      {errors.submit && <ErrorBanner message={errors.submit} className="mb-4" />}

      <Button
        title={updateMutation.isPending ? 'Saving...' : 'Save & Continue'}
        loading={updateMutation.isPending}
        onPress={handleSave}
        variant="primary"
      />
    </View>
  );
}
