import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Field } from '../../../components/Field';
import { Button } from '../../../components/Button';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type {
  ProfileContentResponse,
  EducationSection,
  ProfessionSection,
} from '@smartshaadi/types';

interface OnboardingEducationCareerProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingEducationCareer({
  profile,
}: OnboardingEducationCareerProps) {
  const queryClient = useQueryClient();
  const education = profile?.education;
  const profession = profile?.profession;

  const [educationState, setEducationState] = useState<EducationSection>({
    degree: education?.degree || '',
    college: education?.college || '',
    fieldOfStudy: education?.fieldOfStudy || '',
    year: education?.year,
  });

  const [professionState, setProfessionState] = useState<ProfessionSection>({
    occupation: profession?.occupation || '',
    employer: profession?.employer || '',
    incomeRange: profession?.incomeRange || '',
    workLocation: profession?.workLocation || '',
    employerType: profession?.employerType,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateEducationMutation = useMutation({
    mutationFn: (data: EducationSection) =>
      api.profiles.updateContentSection('education', data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ education: message });
    },
  });

  const updateProfessionMutation = useMutation({
    mutationFn: (data: ProfessionSection) =>
      api.profiles.updateContentSection('profession', data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
      setErrors({});
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ profession: message });
    },
  });

  const handleUpdateEducation = (field: string, value: unknown) => {
    setEducationState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdateProfession = (field: string, value: unknown) => {
    setProfessionState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!educationState.degree?.trim()) {
      newErrors.degree = 'Degree is required';
    }
    if (!educationState.college?.trim()) {
      newErrors.college = 'College is required';
    }
    if (!professionState.occupation?.trim()) {
      newErrors.occupation = 'Occupation is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    await Promise.all([
      updateEducationMutation.mutateAsync(educationState),
      updateProfessionMutation.mutateAsync(professionState),
    ]);
  };

  const isLoading =
    updateEducationMutation.isPending || updateProfessionMutation.isPending;

  return (
    <View>
      {/* Education Section */}
      <Field
        label="Degree"
        value={educationState.degree || ''}
        onChangeText={(value) => handleUpdateEducation('degree', value)}
        placeholder="e.g., Bachelor of Technology"
        maxLength={255}
      />
      {errors.degree && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.degree}</View>
        </View>
      )}

      <Field
        label="College"
        value={educationState.college || ''}
        onChangeText={(value) => handleUpdateEducation('college', value)}
        placeholder="e.g., IIT Mumbai"
        maxLength={255}
      />
      {errors.college && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.college}</View>
        </View>
      )}

      <Field
        label="Field of Study"
        value={educationState.fieldOfStudy || ''}
        onChangeText={(value) => handleUpdateEducation('fieldOfStudy', value)}
        placeholder="e.g., Computer Science"
        maxLength={255}
      />

      <Field
        label="Year of Graduation"
        value={educationState.year ? String(educationState.year) : ''}
        onChangeText={(value) =>
          handleUpdateEducation('year', value ? parseInt(value, 10) : undefined)
        }
        placeholder="2020"
        keyboardType="decimal-pad"
      />

      {/* Career Section */}
      <Field
        label="Occupation"
        value={professionState.occupation || ''}
        onChangeText={(value) => handleUpdateProfession('occupation', value)}
        placeholder="e.g., Software Engineer"
        maxLength={255}
      />
      {errors.occupation && (
        <View className="mb-4 -mt-2 px-3 py-2 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.occupation}</View>
        </View>
      )}

      <Field
        label="Employer"
        value={professionState.employer || ''}
        onChangeText={(value) => handleUpdateProfession('employer', value)}
        placeholder="e.g., Tech Company"
        maxLength={255}
      />

      <Field
        label="Income Range"
        value={professionState.incomeRange || ''}
        onChangeText={(value) => handleUpdateProfession('incomeRange', value)}
        placeholder="e.g., 10-20 Lakhs"
        maxLength={50}
      />

      <Field
        label="Work Location"
        value={professionState.workLocation || ''}
        onChangeText={(value) => handleUpdateProfession('workLocation', value)}
        placeholder="e.g., Mumbai"
        maxLength={255}
      />

      <Field
        label="Employer Type"
        value={professionState.employerType || ''}
        onChangeText={(value) => {
          const val = value.toUpperCase();
          if (
            ['PRIVATE', 'GOVERNMENT', 'BUSINESS', 'SELF_EMPLOYED', 'NOT_WORKING'].includes(val)
          ) {
            handleUpdateProfession('employerType', val);
          }
        }}
        placeholder="PRIVATE, GOVERNMENT, BUSINESS, SELF_EMPLOYED, NOT_WORKING"
      />

      {errors.education && (
        <View className="mb-4 p-3 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.education}</View>
        </View>
      )}

      {errors.profession && (
        <View className="mb-4 p-3 bg-destructive/10">
          <View className="text-destructive text-sm">{errors.profession}</View>
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
