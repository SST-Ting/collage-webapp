-- Test seed for the exported Canva SVG.
-- The preview URL points to the file copied into Vite public assets:
-- public/assets/templates/beige-scrapbook-couple-photo-collage.svg
--
-- Note: the provided SVG does not contain id="g320" / id="g393" etc.
-- These frame coordinates are a practical first-pass mapping based on the
-- visible image regions in the SVG coordinate system.

with upsert_template as (
  insert into public.templates
    (slug, name, category, description, preview_image_url, base_width, base_height, status, sort_order)
  values
    (
      'beige-scrapbook-couple-svg',
      'Beige Scrapbook SVG Test',
      '手帳',
      'Canva SVG import workflow test',
      '/assets/templates/beige-scrapbook-couple-photo-collage.svg',
      567,
      850.499975,
      'active',
      10
    )
  on conflict (slug) do update
  set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    preview_image_url = excluded.preview_image_url,
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
  ('frame-1', 'Top left', 38, 47, 267, 219, -3, 10, 4),
  ('frame-2', 'Top right', 290, 77, 279, 230, 8, 11, 4),
  ('frame-3', 'Middle left', 0, 284, 266, 219, -5, 12, 4),
  ('frame-4', 'Middle right', 258, 292, 274, 225, 3, 13, 4),
  ('frame-5', 'Bottom left', 0, 509, 318, 261, -5, 14, 4),
  ('frame-6', 'Bottom right', 266, 538, 253, 208, 6, 15, 4)
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
