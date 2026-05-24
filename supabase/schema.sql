create extension if not exists pgcrypto;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  description text,
  preview_image_url text,
  base_width numeric not null,
  base_height numeric not null,
  status text default 'active',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.template_frames (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.templates(id) on delete cascade,
  frame_key text not null,
  name text,
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  rotation numeric default 0,
  z_index int default 10,
  border_radius numeric default 0,
  config jsonb default '{}',
  created_at timestamptz default now(),
  unique(template_id, frame_key)
);

create table if not exists public.uploaded_photos (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null,
  template_id uuid references public.templates(id),
  frame_id uuid references public.template_frames(id),
  bucket text not null default 'user-photos',
  storage_path text not null,
  public_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz default now()
);

create table if not exists public.shared_images (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null,
  template_id uuid references public.templates(id),
  bucket text not null default 'shared-images',
  storage_path text not null,
  public_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  width int,
  height int,
  created_at timestamptz default now()
);

create table if not exists public.shared_image_favorites (
  id uuid primary key default gen_random_uuid(),
  shared_image_id uuid references public.shared_images(id) on delete cascade,
  client_session_id text not null,
  created_at timestamptz default now(),
  unique(shared_image_id, client_session_id)
);

create index if not exists idx_template_frames_template_id
  on public.template_frames(template_id);

create index if not exists idx_uploaded_photos_session_template
  on public.uploaded_photos(client_session_id, template_id);

create index if not exists idx_shared_images_created_at
  on public.shared_images(created_at desc);

create index if not exists idx_shared_image_favorites_image_id
  on public.shared_image_favorites(shared_image_id);

alter table public.templates enable row level security;
alter table public.template_frames enable row level security;
alter table public.uploaded_photos enable row level security;
alter table public.shared_images enable row level security;
alter table public.shared_image_favorites enable row level security;

drop policy if exists "prototype read templates" on public.templates;
create policy "prototype read templates"
  on public.templates for select
  to anon
  using (status = 'active');

drop policy if exists "prototype read template frames" on public.template_frames;
create policy "prototype read template frames"
  on public.template_frames for select
  to anon
  using (true);

drop policy if exists "prototype read uploaded photos" on public.uploaded_photos;
create policy "prototype read uploaded photos"
  on public.uploaded_photos for select
  to anon
  using (true);

drop policy if exists "prototype insert uploaded photos" on public.uploaded_photos;
create policy "prototype insert uploaded photos"
  on public.uploaded_photos for insert
  to anon
  with check (true);

drop policy if exists "prototype update uploaded photos" on public.uploaded_photos;
create policy "prototype update uploaded photos"
  on public.uploaded_photos for update
  to anon
  using (true)
  with check (true);

drop policy if exists "prototype delete uploaded photos" on public.uploaded_photos;
create policy "prototype delete uploaded photos"
  on public.uploaded_photos for delete
  to anon
  using (true);

drop policy if exists "prototype read shared images" on public.shared_images;
create policy "prototype read shared images"
  on public.shared_images for select
  to anon
  using (true);

drop policy if exists "prototype insert shared images" on public.shared_images;
create policy "prototype insert shared images"
  on public.shared_images for insert
  to anon
  with check (true);

drop policy if exists "prototype read shared image favorites" on public.shared_image_favorites;
create policy "prototype read shared image favorites"
  on public.shared_image_favorites for select
  to anon
  using (true);

drop policy if exists "prototype insert shared image favorites" on public.shared_image_favorites;
create policy "prototype insert shared image favorites"
  on public.shared_image_favorites for insert
  to anon
  with check (true);

drop policy if exists "prototype delete shared image favorites" on public.shared_image_favorites;
create policy "prototype delete shared image favorites"
  on public.shared_image_favorites for delete
  to anon
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-photos',
  'user-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shared-images',
  'shared-images',
  true,
  15728640,
  array['image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "prototype read user photos" on storage.objects;
create policy "prototype read user photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'user-photos');

drop policy if exists "prototype upload user photos" on storage.objects;
create policy "prototype upload user photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'user-photos');

drop policy if exists "prototype update user photos" on storage.objects;
create policy "prototype update user photos"
  on storage.objects for update
  to anon
  using (bucket_id = 'user-photos')
  with check (bucket_id = 'user-photos');

drop policy if exists "prototype delete user photos" on storage.objects;
create policy "prototype delete user photos"
  on storage.objects for delete
  to anon
  using (bucket_id = 'user-photos');

drop policy if exists "prototype read shared images bucket" on storage.objects;
create policy "prototype read shared images bucket"
  on storage.objects for select
  to anon
  using (bucket_id = 'shared-images');

drop policy if exists "prototype upload shared images bucket" on storage.objects;
create policy "prototype upload shared images bucket"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'shared-images');

with upsert_template as (
  insert into public.templates
    (slug, name, category, description, base_width, base_height, status, sort_order)
  values
    ('film-4-ocean', '菲林 4 格', '菲林', '適合快速放 4 張活動相', 1080, 1350, 'active', 1)
  on conflict (slug) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    base_width = excluded.base_width,
    base_height = excluded.base_height,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id
)
insert into public.template_frames
  (template_id, frame_key, name, x, y, width, height, rotation, z_index, border_radius)
select id, frame_key, name, x, y, width, height, rotation, z_index, border_radius
from upsert_template,
(values
  ('frame-1', 'Photo 1', 90, 120, 420, 500, -2, 10, 18),
  ('frame-2', 'Photo 2', 570, 120, 420, 500, 2, 10, 18),
  ('frame-3', 'Photo 3', 90, 720, 420, 500, 2, 10, 18),
  ('frame-4', 'Photo 4', 570, 720, 420, 500, -2, 10, 18)
) as frames(frame_key, name, x, y, width, height, rotation, z_index, border_radius)
on conflict (template_id, frame_key) do update
set
  name = excluded.name,
  x = excluded.x,
  y = excluded.y,
  width = excluded.width,
  height = excluded.height,
  rotation = excluded.rotation,
  z_index = excluded.z_index,
  border_radius = excluded.border_radius;

with upsert_template as (
  insert into public.templates
    (slug, name, category, description, base_width, base_height, status, sort_order)
  values
    ('scrapbook-3-polaroid', '拍立得 3 張', '手帳', '手帳風三張相拼貼', 1080, 1350, 'active', 2)
  on conflict (slug) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    base_width = excluded.base_width,
    base_height = excluded.base_height,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id
)
insert into public.template_frames
  (template_id, frame_key, name, x, y, width, height, rotation, z_index, border_radius)
select id, frame_key, name, x, y, width, height, rotation, z_index, border_radius
from upsert_template,
(values
  ('frame-1', 'Main photo', 110, 130, 520, 620, -7, 10, 12),
  ('frame-2', 'Side photo', 540, 360, 420, 500, 6, 11, 12),
  ('frame-3', 'Bottom photo', 180, 810, 620, 380, -3, 12, 12)
) as frames(frame_key, name, x, y, width, height, rotation, z_index, border_radius)
on conflict (template_id, frame_key) do update
set
  name = excluded.name,
  x = excluded.x,
  y = excluded.y,
  width = excluded.width,
  height = excluded.height,
  rotation = excluded.rotation,
  z_index = excluded.z_index,
  border_radius = excluded.border_radius;

with upsert_template as (
  insert into public.templates
    (slug, name, category, description, base_width, base_height, status, sort_order)
  values
    ('island-poster-1', '海島 Poster', '海島', '一張主相做活動紀念 poster', 1080, 1350, 'active', 3)
  on conflict (slug) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    base_width = excluded.base_width,
    base_height = excluded.base_height,
    status = excluded.status,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id
)
insert into public.template_frames
  (template_id, frame_key, name, x, y, width, height, rotation, z_index, border_radius)
select id, frame_key, name, x, y, width, height, rotation, z_index, border_radius
from upsert_template,
(values
  ('frame-1', 'Hero photo', 80, 100, 920, 1060, 0, 10, 28)
) as frames(frame_key, name, x, y, width, height, rotation, z_index, border_radius)
on conflict (template_id, frame_key) do update
set
  name = excluded.name,
  x = excluded.x,
  y = excluded.y,
  width = excluded.width,
  height = excluded.height,
  rotation = excluded.rotation,
  z_index = excluded.z_index,
  border_radius = excluded.border_radius;
