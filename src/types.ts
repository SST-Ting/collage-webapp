export type TemplateFrame = {
  id: string;
  template_id: string;
  frame_key: string;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  border_radius: number;
  config: Record<string, unknown> | null;
  created_at?: string;
};

export type Template = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  preview_image_url: string | null;
  base_width: number;
  base_height: number;
  status: string | null;
  sort_order: number | null;
  created_at?: string;
  updated_at?: string;
  template_frames?: TemplateFrame[];
};

export type UploadedPhoto = {
  id: string;
  client_session_id: string;
  template_id: string | null;
  frame_id: string | null;
  bucket: string;
  storage_path: string;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type FrameAssignments = Record<string, UploadedPhoto | undefined>;
