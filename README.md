# Event Collage App Prototype

Mobile-first Splashbook prototype for **雙洞火山泳綑 + 橋咀島西浮潛**.

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL. The app is an SPA with these routes:

- `/`
- `/templates`
- `/upload/:templateId`
- `/editor/:templateId`

## Supabase Setup

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Confirm bucket `user-photos` exists and is public for this prototype.

The app reads environment variables from `.env.local`.

## Prototype Scope

- Choose one template.
- Upload photos to Supabase Storage.
- Save upload metadata to `uploaded_photos`.
- Tap a frame to fill it with an uploaded photo.
- Use Random Fill as a frontend-only preview.

No login, export, favorites, drag/zoom/rotate, or project history yet.
