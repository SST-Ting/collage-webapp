import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AppShell, Button, ErrorCard, LoadingCard } from '../components/Layout';
import { EditorCanvas } from '../components/TemplateCanvas';
import { fetchTemplate, fetchUploadedPhotos, uploadPhoto } from '../lib/api';
import type { FrameAssignments, Template, TemplateFrame, UploadedPhoto } from '../types';

export default function EditorPage() {
  const { templateId = '' } = useParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<TemplateFrame | null>(null);
  const [assignments, setAssignments] = useState<FrameAssignments>({});
  const [downloadSvg, setDownloadSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([fetchTemplate(templateId), fetchUploadedPhotos(templateId)])
      .then(([templateData, uploaded]) => {
        if (!alive) return;
        setTemplate(templateData);
        setPhotos(uploaded);
        setAssignments({
          ...assignmentsFromPhotos(uploaded),
          ...loadStoredAssignments(templateId, uploaded),
        });
        setSelectedFrame(null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load editor');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [templateId]);

  const selectedPhotoId = selectedFrame ? assignments[selectedFrame.id]?.id : undefined;

  const filledCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const file of files) {
        uploaded.push(await uploadPhoto(file, templateId));
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function choosePhoto(photo: UploadedPhoto) {
    if (!selectedFrame) return;

    setSaving(true);
    setError(null);
    const nextAssignments = {
      ...assignments,
      [selectedFrame.id]: photo,
    };
    setAssignments(nextAssignments);
    persistAssignments(templateId, nextAssignments);
    window.setTimeout(() => setSaving(false), 120);
  }

  function randomFill() {
    if (!template || photos.length === 0) return;
    const shuffled = [...photos].sort(() => Math.random() - 0.5);
    const next: FrameAssignments = {};
    for (const [index, frame] of (template.template_frames ?? []).entries()) {
      next[frame.id] = shuffled[index % shuffled.length];
    }
    setAssignments(next);
    persistAssignments(templateId, next);
  }

  function selectFrame(frame: TemplateFrame) {
    setSelectedFrame((current) => (current?.id === frame.id ? null : frame));
  }

  async function downloadCollage() {
    if (!template || !downloadSvg) {
      setError('The collage is still loading. Please try again in a moment.');
      return;
    }

    setDownloading(true);
    setError(null);
    try {
      const width = Math.max(1, Math.round(Number(template.base_width)));
      const height = Math.max(1, Math.round(Number(template.base_height)));
      const svgForPng = await inlineRemoteImages(downloadSvg);
      const pngBlob = await renderSvgToPng(svgForPng, width, height);
      downloadBlob(pngBlob, `${safeFileName(template.name)}.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PNG download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppShell title="Photo Editor" backTo="/templates" dark>
      <div className={selectedFrame ? 'editor-page editor-page-sheet-open' : 'editor-page editor-page-sheet-closed'}>
        {loading && <LoadingCard message="Loading editor..." />}
        {error && <ErrorCard message={error} />}
        {!loading && template && (
          <>
            <input
              ref={inputRef}
              className="hidden-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
            />

            <EditorCanvas
              template={template}
              assignments={assignments}
              selectedFrameId={selectedFrame?.id}
              onFrameClick={selectFrame}
              onCanvasClick={() => setSelectedFrame(null)}
              onRenderedSvgChange={setDownloadSvg}
            />

            <div className="editor-actions">
              <button className="quick-chip quick-chip-sun" onClick={randomFill} disabled={photos.length === 0}>
                <Icon name="shuffle" size={16} />
                Random
              </button>
              <button className="quick-chip" onClick={() => inputRef.current?.click()} disabled={uploading}>
                <Icon name="upload" size={16} />
                {uploading ? 'Uploading' : 'Upload'}
              </button>
              <button className="quick-chip" onClick={downloadCollage} disabled={!downloadSvg || downloading}>
                <Icon name="download" size={16} />
                {downloading ? 'Downloading' : 'Download'}
              </button>
              <span className="save-indicator">
                {saving ? 'Saving...' : `${filledCount}/${template.template_frames?.length ?? 0} filled`}
              </span>
            </div>

            {selectedFrame && (
              <section className="photo-picker-sheet">
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <strong>{selectedFrame.name ?? 'Selected frame'}</strong>
                    <span>Tap a photo to fill this frame</span>
                  </div>
                </div>

                <div className="photo-strip">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      className={selectedPhotoId === photo.id ? 'photo-choice photo-choice-active' : 'photo-choice'}
                      onClick={() => choosePhoto(photo)}
                      disabled={saving}
                    >
                      {photo.public_url && <img src={photo.public_url} alt={photo.file_name ?? 'Uploaded photo'} />}
                    </button>
                  ))}
                  {photos.length === 0 && (
                    <div className="empty-strip">
                      <p>No photos yet.</p>
                      <Button
                        variant="brand"
                        icon={<Icon name="upload" />}
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading' : 'Upload'}
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function assignmentsFromPhotos(photos: UploadedPhoto[]) {
  return photos.reduce<FrameAssignments>((acc, photo) => {
    if (photo.frame_id) acc[photo.frame_id] = photo;
    return acc;
  }, {});
}

function loadStoredAssignments(templateId: string, photos: UploadedPhoto[]) {
  try {
    const stored = window.localStorage.getItem(assignmentStorageKey(templateId));
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Record<string, string>;
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    return Object.entries(parsed).reduce<FrameAssignments>((acc, [frameId, photoId]) => {
      const photo = byId.get(photoId);
      if (photo) acc[frameId] = photo;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function persistAssignments(templateId: string, assignments: FrameAssignments) {
  const serializable = Object.entries(assignments).reduce<Record<string, string>>((acc, [frameId, photo]) => {
    if (photo?.id) acc[frameId] = photo.id;
    return acc;
  }, {});

  window.localStorage.setItem(assignmentStorageKey(templateId), JSON.stringify(serializable));
}

function assignmentStorageKey(templateId: string) {
  return `event-collage-assignments:${templateId}`;
}

function safeFileName(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  return cleaned || 'event-collage';
}

const XLINK_NS = 'http://www.w3.org/1999/xlink';

async function inlineRemoteImages(svgText: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Could not prepare the collage for PNG download.');
  }

  const imageElements = Array.from(document.querySelectorAll('image'));
  const remoteUrls = Array.from(new Set(imageElements.map(readImageHref).filter(isRemoteUrl)));
  const dataUrlPairs = await Promise.all(
    remoteUrls.map(async (url) => [url, await fetchImageAsDataUrl(url)] as const),
  );
  const dataUrls = new Map(dataUrlPairs);

  imageElements.forEach((imageElement) => {
    const href = readImageHref(imageElement);
    if (!href) return;

    const dataUrl = dataUrls.get(href);
    if (!dataUrl) return;

    imageElement.setAttribute('href', dataUrl);
    imageElement.setAttributeNS(XLINK_NS, 'href', dataUrl);
  });

  const root = document.documentElement;
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('xmlns:xlink', XLINK_NS);

  return new XMLSerializer().serializeToString(root);
}

function readImageHref(imageElement: Element) {
  return (
    imageElement.getAttribute('href')
    ?? imageElement.getAttributeNS(XLINK_NS, 'href')
    ?? imageElement.getAttribute('xlink:href')
  );
}

function isRemoteUrl(value: string | null): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error('Could not load one of the photos for PNG download.');
  }

  return blobToDataUrl(await response.blob());
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read one of the photos for PNG download.'));
    reader.readAsDataURL(blob);
  });
}

async function renderSvgToPng(svgText: string, width: number, height: number) {
  const svgBlob = new Blob([prepareSvgForExport(svgText, width, height)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const scale = getExportScale(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create PNG canvas.');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function prepareSvgForExport(svgText: string, width: number, height: number) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  if (document.querySelector('parsererror')) return svgText;

  const root = document.documentElement;
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('xmlns:xlink', XLINK_NS);
  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${width} ${height}`);

  return new XMLSerializer().serializeToString(root);
}

function getExportScale(width: number, height: number) {
  const preferredScale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const maxScale = Math.sqrt(12000000 / (width * height));
  return Math.max(1, Math.min(preferredScale, maxScale));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render the collage as PNG.'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create the PNG file.'));
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
