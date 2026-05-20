import { supabase } from './supabase';
import { getClientSessionId } from './session';
import { sanitizeFileName } from './image';
import type { Template, TemplateFrame, UploadedPhoto } from '../types';

const USER_PHOTOS_BUCKET = 'user-photos';

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
  return (data ?? []) as UploadedPhoto[];
}

export async function uploadPhoto(file: File, templateId: string) {
  const clientSessionId = getClientSessionId();
  const safeName = sanitizeFileName(file.name) || 'photo';
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const storagePath = `${clientSessionId}/${templateId}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${ext}`;
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
  return data as UploadedPhoto;
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
  return data as UploadedPhoto;
}
