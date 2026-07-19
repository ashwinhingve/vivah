import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '../../../components/Input';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type {
  ProfileContentResponse,
  PartnerPreferencesSection,
} from '@smartshaadi/types';

interface OnboardingPartnerPrefsProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingPartnerPrefs({
  profile,
}: OnboardingPartnerPrefsProps) {
  const queryClient = useQueryClient();
  const prefs = profile?.partnerPreferences;

  const [formState, setFormState] = useState<PartnerPreferencesSection>({
    ageRange: prefs?.ageRange || { min: 18, max: 40 },
    heightRange: prefs?.heightRange || { min: 150, max: 200 },
    religion: prefs?.religion || [],
    diet: prefs?.diet || [],
    location: prefs?.location || [],
    openToInterfaith: prefs?.openToInterfaith,
    openToInterCaste: prefs?.openToInterCaste,
    manglik: prefs?.manglik || 'ANY',
    partnerDescription: prefs?.partnerDescription || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: (data: PartnerPreferencesSection) =>
      api.profiles.updateContentSection('partnerPreferences', data as Record<string, unknown>),
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

    if (!formState.ageRange || formState.ageRange.min > formState.ageRange.max) {
      newErrors.ageRange = 'Invalid age range';
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
        label="Age Range (min)"
        value={String(formState.ageRange?.min || 18)}
        onChangeText={(value) =>
          handleUpdateField('ageRange', {
            ...formState.ageRange,
            min: parseInt(value, 10) || 18,
          })
        }
        placeholder="18"
        keyboardType="decimal-pad"
      />

      <Input containerClassName="mb-4"
        label="Age Range (max)"
        value={String(formState.ageRange?.max || 40)}
        onChangeText={(value) =>
          handleUpdateField('ageRange', {
            ...formState.ageRange,
            max: parseInt(value, 10) || 40,
          })
        }
        placeholder="40"
        keyboardType="decimal-pad"
      />
      {errors.ageRange && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.ageRange}</Text>
        </View>
      )}

      <Input containerClassName="mb-4"
        label="Height Range (min cm)"
        value={String(formState.heightRange?.min || 150)}
        onChangeText={(value) =>
          handleUpdateField('heightRange', {
            ...formState.heightRange,
            min: parseInt(value, 10) || 150,
          })
        }
        placeholder="150"
        keyboardType="decimal-pad"
      />

      <Input containerClassName="mb-4"
        label="Height Range (max cm)"
        value={String(formState.heightRange?.max || 200)}
        onChangeText={(value) =>
          handleUpdateField('heightRange', {
            ...formState.heightRange,
            max: parseInt(value, 10) || 200,
          })
        }
        placeholder="200"
        keyboardType="decimal-pad"
      />

      <Input containerClassName="mb-4"
        label="Religion (comma-separated, optional)"
        value={formState.religion?.join(', ') || ''}
        onChangeText={(value) =>
          handleUpdateField('religion', value.split(',').map((r) => r.trim()).filter(Boolean))
        }
        placeholder="e.g., Hindu, Sikh"
      />

      <Input containerClassName="mb-4"
        label="Diet (comma-separated, optional)"
        value={formState.diet?.join(', ') || ''}
        onChangeText={(value) =>
          handleUpdateField('diet', value.split(',').map((d) => d.trim()).filter(Boolean))
        }
        placeholder="e.g., VEG, NON_VEG"
      />

      <Input containerClassName="mb-4"
        label="Location (comma-separated, optional)"
        value={formState.location?.join(', ') || ''}
        onChangeText={(value) =>
          handleUpdateField('location', value.split(',').map((l) => l.trim()).filter(Boolean))
        }
        placeholder="e.g., Mumbai, Pune"
      />

      <Input containerClassName="mb-4"
        label="Manglik Preference"
        value={formState.manglik || 'ANY'}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['ANY', 'ONLY_MANGLIK', 'NON_MANGLIK'].includes(val)) {
            handleUpdateField('manglik', val);
          }
        }}
        placeholder="ANY, ONLY_MANGLIK, NON_MANGLIK"
      />

      <Input containerClassName="mb-4"
        label="Open to Interfaith (true/false)"
        value={
          formState.openToInterfaith !== undefined
            ? formState.openToInterfaith
              ? 'true'
              : 'false'
            : ''
        }
        onChangeText={(value) => {
          const val = value.toLowerCase();
          if (val === 'true' || val === 'false') {
            handleUpdateField('openToInterfaith', val === 'true');
          }
        }}
        placeholder="true or false"
      />

      <Input containerClassName="mb-4"
        label="Open to Intercaste (true/false)"
        value={
          formState.openToInterCaste !== undefined
            ? formState.openToInterCaste
              ? 'true'
              : 'false'
            : ''
        }
        onChangeText={(value) => {
          const val = value.toLowerCase();
          if (val === 'true' || val === 'false') {
            handleUpdateField('openToInterCaste', val === 'true');
          }
        }}
        placeholder="true or false"
      />

      <Input containerClassName="mb-4"
        label="Partner Description (optional)"
        value={formState.partnerDescription || ''}
        onChangeText={(value) => handleUpdateField('partnerDescription', value)}
        placeholder="Tell us about your ideal partner..."
        maxLength={1000}
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
