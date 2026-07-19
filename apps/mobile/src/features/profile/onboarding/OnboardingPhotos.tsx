import { useState } from 'react';
import { View, Text, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/Button';
import { LoadingState, describeError } from '../../../components/States';
import { api } from '../../../lib/api';
import type { ProfileContentResponse } from '@smartshaadi/types';

interface OnboardingPhotosProps {
  profile?: ProfileContentResponse;
}

export default function OnboardingPhotos({ profile }: OnboardingPhotosProps) {
  const queryClient = useQueryClient();

  const [uploadingPhotoIds, setUploadingPhotoIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleDeletePhoto = async (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          onPress: () => deleteMutation.mutate(photoId),
          style: 'destructive',
        },
      ]
    );
  };

  const isUploading = uploadingPhotoIds.length > 0 || presignMutation.isPending ||
                      registerMutation.isPending;

  if (isLoading) {
    return <LoadingState label="Loading photos..." />;
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
                  <Image
                    source={{ uri: photo.url }}
                    style={{ width: 100, height: 100 }}
                    className="rounded-lg"
                  />
                )}
                {photo.isPrimary && (
                  <View className="absolute top-1 right-1 bg-gold px-2 py-1 rounded-full">
                    <Text className="text-xs font-semibold text-primary">Primary</Text>
                  </View>
                )}
                <Button
                  title="Delete"
                  variant="secondary"
                  onPress={() => handleDeletePhoto(photo.id)}
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
      {errors.picker && (
        <View className="mt-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.picker}</Text>
        </View>
      )}
      {errors.presign && (
        <View className="mt-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.presign}</Text>
        </View>
      )}
      {errors.upload && (
        <View className="mt-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.upload}</Text>
        </View>
      )}
      {errors.register && (
        <View className="mt-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.register}</Text>
        </View>
      )}
      {errors.delete && (
        <View className="mt-4 p-3 bg-destructive/10">
          <Text className="text-destructive text-sm">{errors.delete}</Text>
        </View>
      )}

      {/* Info text */}
      <View className="mt-6 p-4 bg-gold/10 rounded-lg">
        <Text className="text-sm text-ink">
          Add at least one clear photo. The first photo will be your primary profile picture.
        </Text>
      </View>
    </ScrollView>
  );
}
