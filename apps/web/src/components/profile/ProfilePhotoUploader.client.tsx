'use client';

import React, { useState, useRef, useCallback } from 'react';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

interface Photo {
  id: string;
  r2Key: string;
  url?: string;
  isPrimary: boolean;
  displayOrder: number;
  progress?: number;
  error?: string;
}

interface Props {
  initialPhotos?: Photo[];
  onUploadComplete?: (photo: Photo) => void;
  onDelete?: (photoId: string) => void;
  onReorder?: (photos: Photo[]) => void;
  onSetPrimary?: (photoId: string) => void;
  maxPhotos?: number;
}

export function ProfilePhotoUploader({
  initialPhotos = [],
  onUploadComplete,
  onDelete,
  onReorder,
  onSetPrimary,
  maxPhotos = 8,
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Trigger hidden file input click
   */
  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Validate and handle file selection
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      setError(null);

      // Validate total count
      if (photos.length + files.length > maxPhotos) {
        setError(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      // Start uploads
      Array.from(files).forEach((file, index) => {
        uploadFile(file, index);
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [photos.length, maxPhotos]
  );

  /**
   * 3-step upload flow: presign → R2 PUT → register
   */
  const uploadFile = async (file: File, index: number) => {
    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB');
      return;
    }

    const tempId = `temp-${Date.now()}-${index}`;

    // Add to state with progress=0
    const newPhoto: Photo = {
      id: tempId,
      r2Key: '',
      isPrimary: photos.length === 0,
      displayOrder: photos.length,
      progress: 0,
    };
    setPhotos((prev) => [...prev, newPhoto]);

    try {
      // Step 1: POST /api/v1/storage/presign
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === tempId ? { ...p, progress: 10 } : p
        )
      );

      const presignRes = await fetch(`${API_BASE}/api/v1/storage/presign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          folder: 'profiles',
        }),
      });

      if (!presignRes.ok) {
        const data = await presignRes.json();
        throw new Error(data.error?.message || 'Failed to get presigned URL');
      }

      const { uploadUrl, r2Key } = await presignRes.json();

      // Step 2: PUT file to presigned URL
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === tempId ? { ...p, progress: 30, r2Key } : p
        )
      );

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to R2 failed');
      }

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === tempId ? { ...p, progress: 70 } : p
        )
      );

      // Step 3: POST /api/v1/profiles/me/photos
      const isPrimaryPhoto = photos.length === 0;
      const registerRes = await fetch(`${API_BASE}/api/v1/profiles/me/photos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2Key,
          fileSize: file.size,
          mimeType: file.type,
          isPrimary: isPrimaryPhoto,
        }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.error?.message || 'Failed to register photo');
      }

      const photoData = await registerRes.json();

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...(photoData.data ?? { id: tempId, r2Key, isPrimary: false, displayOrder: 0 }),
                progress: 100,
              }
            : p
        )
      );

      if (onUploadComplete) {
        onUploadComplete(photoData.data ?? { id: tempId, r2Key, isPrimary: false, displayOrder: 0 });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setPhotos((prev) => prev.filter((p) => p.id !== tempId));
      setError(errorMessage);
    }
  };

  /**
   * Delete a photo
   */
  const handleDelete = async (photoId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/profiles/me/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete photo');
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));

      if (onDelete) {
        onDelete(photoId);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Delete failed. Please try again.';
      setError(errorMessage);
    }
  };

  /**
   * Set a photo as primary
   */
  const handleSetPrimary = async (photoId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/profiles/me/photos/primary`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to set primary photo');
      }

      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          isPrimary: p.id === photoId,
        }))
      );

      if (onSetPrimary) {
        onSetPrimary(photoId);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update photo.';
      setError(errorMessage);
    }
  };

  /**
   * Drag-to-reorder: move dragged photo before target photo
   */
  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = photos.findIndex((p) => p.id === draggedId);
    const targetIndex = photos.findIndex((p) => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // Reorder in state
    const newPhotos = [...photos];
    const [movedPhoto] = newPhotos.splice(draggedIndex, 1);
    if (!movedPhoto) {
      setDraggedId(null);
      return;
    }
    newPhotos.splice(targetIndex, 0, movedPhoto);

    // Update displayOrder
    const reorderedPhotos = newPhotos.map((p, idx) => ({
      ...p,
      displayOrder: idx,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/profiles/me/photos/reorder`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          reorderedPhotos.map((p) => ({
            id: p.id,
            displayOrder: p.displayOrder,
          }))
        ),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to reorder photos');
      }

      setPhotos(reorderedPhotos);

      if (onReorder) {
        onReorder(reorderedPhotos);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Reorder failed. Please try again.';
      setError(errorMessage);
    } finally {
      setDraggedId(null);
    }
  };

  /**
   * OS file drop handler
   */
  const handleDropZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Simulate file input change
    const dataTransfer = new DataTransfer();
    Array.from(files).forEach((file) => {
      dataTransfer.items.add(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
      const event = new Event('change', { bubbles: true });
      fileInputRef.current.dispatchEvent(event);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-[#DC2626]/5 border border-[#DC2626]/20 p-3 flex items-center justify-between">
          <span className="text-sm text-[#DC2626]">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#DC2626] hover:bg-[#DC2626]/10 rounded transition"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Drop zone or photo grid */}
      {photos.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDropZone}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            isDraggingOver
              ? 'border-[#0E7C7B] bg-[#0E7C7B]/5'
              : 'border-[#C5A47E] bg-[#FEFAF6]'
          } min-h-[200px] flex flex-col items-center justify-center gap-3`}
        >
          <div className="text-4xl">📷</div>
          <p className="font-['Playfair_Display'] text-lg text-[#7B2D42]">
            Add Your Best Photo First
          </p>
          <p className="text-sm text-[#6B6B76]">
            Drag & drop or tap to select · Max {maxPhotos} photos · 10MB each
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-3 sm:grid-cols-4 gap-2"
          onDragOver={(e) => e.preventDefault()}
        >
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => setDraggedId(photo.id)}
              onDrop={() => handleDrop(photo.id)}
              onDragOver={(e) => e.preventDefault()}
              className={`relative aspect-square rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition border-2 ${
                photo.isPrimary ? 'border-[#C5A47E]' : 'border-[#E8E0D8]'
              }`}
            >
              {/* Photo image or skeleton */}
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#E8E0D8] animate-pulse" />
              )}

              {/* Progress overlay */}
              {photo.progress != null && photo.progress < 100 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {photo.progress}%
                  </span>
                </div>
              )}

              {/* Primary badge */}
              {photo.isPrimary && (
                <div className="absolute top-1 left-1 bg-[#C5A47E] text-white text-xs font-semibold rounded-full px-2 py-0.5">
                  ★ Main
                </div>
              )}

              {/* Action buttons */}
              <div className="absolute bottom-0 right-0 flex">
                {!photo.isPrimary && photo.progress == null && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(photo.id);
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/40 text-yellow-300 text-sm hover:bg-black/60 transition"
                    title="Set as main photo"
                    aria-label="Set as main photo"
                  >
                    ★
                  </button>
                )}
                {photo.progress == null && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/40 text-white text-sm hover:bg-[#DC2626]/70 transition"
                    title="Delete photo"
                    aria-label="Delete photo"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add more button */}
          {photos.length < maxPhotos && (
            <div
              onClick={triggerFileInput}
              className="aspect-square rounded-xl border-2 border-dashed border-[#C5A47E] flex items-center justify-center cursor-pointer hover:bg-[#C5A47E]/5 transition min-h-[44px]"
            >
              <span className="text-[#C5A47E] text-2xl">+</span>
            </div>
          )}
        </div>
      )}

      {/* Tips card */}
      <div className="rounded-xl bg-[#7B2D42]/5 border border-[#7B2D42]/10 p-4">
        <p className="text-xs font-semibold text-[#7B2D42] mb-2">Photo Tips</p>
        <ul className="text-xs text-[#6B6B76] space-y-1">
          <li>• Use a recent, clear photo of just yourself</li>
          <li>• Natural lighting gives the best results</li>
          <li>• Avoid sunglasses, filters, or group photos as your main photo</li>
          <li>• Traditional attire works very well for Indian matrimonial profiles</li>
        </ul>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
