import { useState } from 'react';
import { View, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Field } from '../../../components/Field';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type {
  ProfileContentResponse,
  PersonalSection,
  HoroscopeSection,
} from '@smartshaadi/types';

interface OnboardingCommunityProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingCommunity({ profile }: OnboardingCommunityProps) {
  const queryClient = useQueryClient();
  const personal = profile?.personal;
  const horoscope = profile?.horoscope;

  const [personalState, setPersonalState] = useState<PersonalSection>({
    religion: personal?.religion || '',
    caste: personal?.caste || '',
    gotra: personal?.gotra || '',
    manglik: personal?.manglik,
  });

  const [horoscopeState, setHoroscopeState] = useState<HoroscopeSection>({
    rashi: horoscope?.rashi,
    nakshatra: horoscope?.nakshatra,
    manglik: horoscope?.manglik,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updatePersonalMutation = useMutation({
    mutationFn: (data: PersonalSection) =>
      api.profiles.updateContentSection('personal', data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ personal: message });
    },
  });

  const updateHoroscopeMutation = useMutation({
    mutationFn: (data: HoroscopeSection) =>
      api.profiles.updateContentSection('horoscope', data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
      setErrors({});
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ horoscope: message });
    },
  });

  const handleUpdatePersonal = (field: string, value: unknown) => {
    setPersonalState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdateHoroscope = (field: string, value: unknown) => {
    setHoroscopeState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!personalState.religion?.trim()) {
      newErrors.religion = 'Religion is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await Promise.all([
      updatePersonalMutation.mutateAsync(personalState),
      updateHoroscopeMutation.mutateAsync(horoscopeState),
    ]);
  };

  const isLoading =
    updatePersonalMutation.isPending || updateHoroscopeMutation.isPending;

  return (
    <View>
      {/* Personal / Community */}
      <Field
        label="Religion"
        value={personalState.religion || ''}
        onChangeText={(value) => handleUpdatePersonal('religion', value)}
        placeholder="e.g., Hindu"
        maxLength={100}
      />
      {errors.religion && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.religion}</Text>
        </View>
      )}

      <Field
        label="Caste (optional)"
        value={personalState.caste || ''}
        onChangeText={(value) => handleUpdatePersonal('caste', value)}
        placeholder="e.g., Brahmin"
        maxLength={100}
      />

      <Field
        label="Gotra (optional)"
        value={personalState.gotra || ''}
        onChangeText={(value) => handleUpdatePersonal('gotra', value)}
        placeholder="Enter gotra"
        maxLength={100}
      />

      <Field
        label="Manglik (true/false)"
        value={personalState.manglik !== undefined ? (personalState.manglik ? 'true' : 'false') : ''}
        onChangeText={(value) => {
          const val = value.toLowerCase();
          if (val === 'true' || val === 'false') {
            handleUpdatePersonal('manglik', val === 'true');
          }
        }}
        placeholder="true or false"
      />

      {/* Horoscope */}
      <Field
        label="Rashi (optional)"
        value={horoscopeState.rashi || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (val === '') {
            handleUpdateHoroscope('rashi', undefined);
          } else {
            handleUpdateHoroscope('rashi', val);
          }
        }}
        placeholder="e.g., MESH"
      />

      <Field
        label="Nakshatra (optional)"
        value={horoscopeState.nakshatra || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (val === '') {
            handleUpdateHoroscope('nakshatra', undefined);
          } else {
            handleUpdateHoroscope('nakshatra', val);
          }
        }}
        placeholder="e.g., ASHWINI"
      />

      <Field
        label="Manglik Status (optional)"
        value={horoscopeState.manglik || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (['YES', 'NO', 'PARTIAL', ''].includes(val)) {
            handleUpdateHoroscope('manglik', val || undefined);
          }
        }}
        placeholder="YES, NO, PARTIAL"
      />

      {errors.personal && (
        <View className="mb-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.personal}</Text>
        </View>
      )}

      {errors.horoscope && (
        <View className="mb-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.horoscope}</Text>
        </View>
      )}

      <Button
        title={isLoading ? 'Saving...' : 'Save & Continue'}
        loading={isLoading}
        onPress={handleSave}
        variant="primary"
      />
    </View>
  );
}
