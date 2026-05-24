import { supabase } from './supabase';
import { getClientSessionId } from './session';
import { sanitizeFileName } from './image';
import type { SharedImage, Template, TemplateFrame, UploadedPhoto } from '../types';

const USER_PHOTOS_BUCKET = 'user-photos';
const SHARED_IMAGES_BUCKET = 'shared-images';

function normalizeFrame(frame: TemplateFrame): TemplateFrame {
  return {
    ...frame,
    x: Number(frame.x),
    y: Number(frame.y),
    width: Number(frame.width),
    height: Number(frame.height),
    rotation: Number(frame.rotation ?? 0),
    z_index: Number(frame.z_index ?? 10),
    border_radius: Number(frame.border_radius ?? 0),
  };
}

function normalizeTemplate(template: Template): Template {
  return {
    ...template,
    base_width: Number(template.base_width),
    base_height: Number(template.base_height),
    sort_order: template.sort_order === null ? null : Number(template.sort_order),
    template_frames: (template.template_frames ?? [])
      .map(normalizeFrame)
      .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)),
  };
}

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_frames(*)')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('frame_key', { referencedTable: 'template_frames', ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => normalizeTemplate(row as Template));
}

export async function fetchTemplate(templateId: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*, template_frames(*)')
    .eq('id', templateId)
    .single();

  if (error) throw error;
  return normalizeTemplate(data as Template);
}

export async function fetchUploadedPhotos(templateId: string) {
  const clientSessionId = getClientSessionId();
  const { data, error } = await supabase
    .from('uploaded_photos')
    .select('*')
    .eq('client_session_id', clientSessionId)
    .eq('template_id', templateId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const photos = (data ?? []).map((photo) => normalizeUploadedPhoto(photo as UploadedPhoto));
  return filterExistingUploadedPhotos(photos, clientSessionId, templateId);
}

export async function uploadPhoto(file: File, templateId: string) {
  const clientSessionId = getClientSessionId();
  const safeName = sanitizeFileName(file.name) || 'photo';
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const storagePath = `${clientSessionId}/${templateId}/${Date.now()}-${createUploadId()}-${safeName}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(USER_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(USER_PHOTOS_BUCKET)
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('uploaded_photos')
    .insert({
      client_session_id: clientSessionId,
      template_id: templateId,
      bucket: USER_PHOTOS_BUCKET,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeUploadedPhoto(data as UploadedPhoto);
}

export async function deleteUploadedPhotos(photos: UploadedPhoto[]) {
  if (photos.length === 0) return;

  const buckets = Array.from(new Set(photos.map((photo) => photo.bucket)));
  await Promise.all(buckets.map(async (bucket) => {
    const paths = photos
      .filter((photo) => photo.bucket === bucket)
      .map((photo) => photo.storage_path)
      .filter(Boolean);

    if (paths.length === 0) return;

    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }));

  const { error } = await supabase
    .from('uploaded_photos')
    .delete()
    .in('id', photos.map((photo) => photo.id));

  if (error) throw error;
}

function normalizeUploadedPhoto(photo: UploadedPhoto): UploadedPhoto {
  if (photo.public_url || !photo.bucket || !photo.storage_path) return photo;

  const { data } = supabase.storage
    .from(photo.bucket)
    .getPublicUrl(photo.storage_path);

  return {
    ...photo,
    public_url: data.publicUrl,
  };
}

async function filterExistingUploadedPhotos(
  photos: UploadedPhoto[],
  clientSessionId: string,
  templateId: string,
) {
  if (photos.length === 0) return photos;

  const existingPaths = new Set<string>();
  const buckets = Array.from(new Set(photos.map((photo) => photo.bucket)));
  let checkedStorage = false;

  await Promise.all(buckets.map(async (bucket) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(`${clientSessionId}/${templateId}`, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) return;
    checkedStorage = true;

    for (const item of data ?? []) {
      existingPaths.add(`${clientSessionId}/${templateId}/${item.name}`);
    }
  }));

  if (existingPaths.size === 0) return checkedStorage ? [] : photos;
  return photos.filter((photo) => existingPaths.has(photo.storage_path));
}

function createUploadId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function assignPhotoToFrame(photo: UploadedPhoto, frameId: string, templateId: string) {
  const clientSessionId = getClientSessionId();

  const { error: clearFrameError } = await supabase
    .from('uploaded_photos')
    .update({ frame_id: null })
    .eq('client_session_id', clientSessionId)
    .eq('template_id', templateId)
    .eq('frame_id', frameId);

  if (clearFrameError) throw clearFrameError;

  const { data, error } = await supabase
    .from('uploaded_photos')
    .update({ frame_id: frameId })
    .eq('id', photo.id)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeUploadedPhoto(data as UploadedPhoto);
}

export async function fetchSharedImages() {
  const clientSessionId = getClientSessionId();
  const { data, error } = await supabase
    .from('shared_images')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const images = (data ?? []).map((image) => normalizeSharedImage(image as SharedImage));
  if (images.length === 0) return images;

  const imageIds = images.map((image) => image.id);
  const { data: favorites, error: favoritesError } = await supabase
    .from('shared_image_favorites')
    .select('shared_image_id, client_session_id')
    .in('shared_image_id', imageIds);

  if (favoritesError) {
    return images.map((image) => ({
      ...image,
      favorite_count: 0,
      is_favorited: false,
    }));
  }

  const favoriteCounts = new Map<string, number>();
  const favoritedImageIds = new Set<string>();
  for (const favorite of favorites ?? []) {
    const imageId = String(favorite.shared_image_id);
    favoriteCounts.set(imageId, (favoriteCounts.get(imageId) ?? 0) + 1);
    if (favorite.client_session_id === clientSessionId) favoritedImageIds.add(imageId);
  }

  return images.map((image) => ({
    ...image,
    favorite_count: favoriteCounts.get(image.id) ?? 0,
    is_favorited: favoritedImageIds.has(image.id),
  }));
}

export async function uploadSharedImage(
  blob: Blob,
  options: {
    templateId: string;
    templateName: string;
    width: number;
    height: number;
  },
) {
  const clientSessionId = getClientSessionId();
  const fileName = `${sanitizeFileName(options.templateName) || 'collage'}-${Date.now()}.png`;
  const storagePath = `${clientSessionId}/${options.templateId}/${Date.now()}-${createUploadId()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(SHARED_IMAGES_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: '31536000',
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(SHARED_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('shared_images')
    .insert({
      client_session_id: clientSessionId,
      template_id: options.templateId,
      bucket: SHARED_IMAGES_BUCKET,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      file_name: fileName,
      mime_type: 'image/png',
      file_size: blob.size,
      width: options.width,
      height: options.height,
    })
    .select('*')
    .single();

  if (error) throw error;
  return normalizeSharedImage(data as SharedImage);
}

function normalizeSharedImage(image: SharedImage): SharedImage {
  if (image.public_url || !image.bucket || !image.storage_path) return image;

  const { data } = supabase.storage
    .from(image.bucket)
    .getPublicUrl(image.storage_path);

  return {
    ...image,
    public_url: data.publicUrl,
  };
}

export async function setSharedImageFavorite(image: SharedImage, favorited: boolean) {
  const clientSessionId = getClientSessionId();

  if (favorited) {
    const { error } = await supabase
      .from('shared_image_favorites')
      .upsert({
        shared_image_id: image.id,
        client_session_id: clientSessionId,
      }, {
        onConflict: 'shared_image_id,client_session_id',
      });

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('shared_image_favorites')
    .delete()
    .eq('shared_image_id', image.id)
    .eq('client_session_id', clientSessionId);

  if (error) throw error;
}
