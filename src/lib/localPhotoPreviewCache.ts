import type { UploadedPhoto } from '../types';

const previewByPhotoId = new Map<string, string>();
const previewByStoragePath = new Map<string, string>();

export function rememberLocalPhotoPreview(photo: UploadedPhoto, previewUrl: string) {
  previewByPhotoId.set(photo.id, previewUrl);
  if (photo.storage_path) previewByStoragePath.set(photo.storage_path, previewUrl);
}

export function applyLocalPhotoPreview(photo: UploadedPhoto): UploadedPhoto {
  const localPreviewUrl = previewByPhotoId.get(photo.id) || previewByStoragePath.get(photo.storage_path);
  if (!localPreviewUrl) return photo;

  return {
    ...photo,
    local_preview_url: localPreviewUrl,
    upload_status: 'ready',
  };
}

export function forgetLocalPhotoPreview(photo: UploadedPhoto) {
  previewByPhotoId.delete(photo.id);
  if (photo.storage_path) previewByStoragePath.delete(photo.storage_path);
}
