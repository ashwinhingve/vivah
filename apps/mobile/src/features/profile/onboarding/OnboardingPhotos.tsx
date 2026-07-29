import { useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionSheet } from '../../../components/ActionSheet';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { InfoNote } from '../../../components/InfoNote';
import { Skeleton } from '../../../components/Skeleton';
import { describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse } from '@smartshaadi/types';

interface OnboardingPhotosProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingPhotos({ profile: _profile }: OnboardingPhotosProps) {
  const queryClient = useQueryClient();

  const [uploadingPhotoIds, setUploadingPhotoIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch current photos
  const {
    data: photos = [],
    isLoading,
    refetch: refetchPhotos,
  } = useQuery({
    queryKey: ['profile-photos'],
    queryFn: () => api.profiles.getPhotos(),
  });

  // Mutation for presigning upload
  const presignMutation = useMutation({
    mutationFn: async (input: {
      fileName: string;
      mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    }) =>
      api.profiles.presignPhotoUpload({
        ...input,
        folder: 'photos',
      }),
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ presign: message });
    },
  });

  // Mutation for registering photo after upload
  const registerMutation = useMutation({
    mutationFn: async (input: {
      r2Key: string;
      mimeType: string;
      fileSize: number;
      isPrimary?: boolean;
    }) => api.profiles.registerPhoto(input),
    onSuccess: async () => {
      await refetchPhotos();
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
      setErrors({});
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ register: message });
    },
  });

  // Mutation for deleting photo
  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => api.profiles.deletePhoto(photoId),
    onSuccess: async () => {
      await refetchPhotos();
      queryClient.invalidateQueries({ queryKey: ['profile-content'] });
    },
    onError: (error) => {
      const { message } = describeError(error);
      setErrors({ delete: message });
    },
  });

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to pick image';
      setErrors({ picker: msg });
    }
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    const tempId = `upload-${Date.now()}`;
    try {
      setUploadingPhotoIds((prev) => [...prev, tempId]);

      // Step 1: Get presigned URL
      const fileName = asset.fileName || `photo-${Date.now()}.jpg`;
      const mimeType = 'image/jpeg' as const;

      const uploadArgs = {
        fileName,
        mimeType,
        folder: 'photos' as const,
      };

      const { uploadUrl, r2Key } = await presignMutation.mutateAsync(uploadArgs);

      // Step 2: Upload to R2 directly (not through API client to avoid session cookie)
      // Convert file URI to blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Register the photo with the API
      const isPrimary = photos.length === 0;
      await registerMutation.mutateAsync({
        r2Key,
        mimeType: mimeType as unknown as string,
        fileSize: asset.fileSize || blob.size,
        isPrimary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      setErrors({ upload: msg });
    } finally {
      setUploadingPhotoIds((prev) => prev.filter((id) => id !== tempId));
    }
  };

  const isUploading = uploadingPhotoIds.length > 0 || presignMutation.isPending ||
                      registerMutation.isPending;

  if (isLoading) {
    return (
      <View className="flex-row flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={100} width={100} radius={16} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView>
      {/* Current photos */}
      {photos.length > 0 && (
        <View className="mb-6">
          <Text className="font-semibold text-ink mb-3">Your Photos</Text>
          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo) => (
              <View
                key={photo.id}
                className="relative"
              >
                {photo.url && (
                  <View className="rounded-2xl border-2 border-gold overflow-hidden">
                    <Image
                      source={{ uri: photo.url }}
                      style={{ width: 100, height: 100 }}
                    />
                  </View>
                )}
                {photo.isPrimary && (
                  <Badge
                    label="Primary"
                    variant="goldSolid"
                    size="sm"
                    className="absolute top-1.5 right-1.5"
                  />
                )}
                <Button
                  title="Delete"
                  variant="secondary"
                  onPress={() => setConfirmDeleteId(photo.id)}
                  disabled={deleteMutation.isPending}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Upload button */}
      <Button
        title={isUploading ? 'Uploading...' : 'Add Photo'}
        loading={isUploading}
        onPress={handlePickPhoto}
        disabled={isUploading}
        variant="primary"
      />

      {/* Errors */}
      {errors.picker && <ErrorBanner message={errors.picker} className="mt-4" />}
      {errors.presign && <ErrorBanner message={errors.presign} className="mt-4" />}
      {errors.upload && <ErrorBanner message={errors.upload} className="mt-4" />}
      {errors.register && <ErrorBanner message={errors.register} className="mt-4" />}
      {errors.delete && <ErrorBanner message={errors.delete} className="mt-4" />}

      {/* Info text */}
      <InfoNote className="mt-6">
        Add at least one clear photo. The first photo will be your primary profile picture.
      </InfoNote>

      <ActionSheet
        visible={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Photo"
        message="Are you sure you want to delete this photo?"
        actions={[
          {
            label: 'Delete',
            destructive: true,
            onPress: () => {
              if (confirmDeleteId) {
                deleteMutation.mutate(confirmDeleteId);
              }
            },
          },
        ]}
      />
    </ScrollView>
  );
}
