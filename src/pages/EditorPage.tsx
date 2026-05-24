import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AppShell, Button, ErrorCard, LoadingCard } from '../components/Layout';
import { EditorCanvas } from '../components/TemplateCanvas';
import { deleteUploadedPhotos, fetchTemplate, fetchUploadedPhotos, uploadPhoto } from '../lib/api';
import type { FrameAssignments, Template, TemplateFrame, UploadedPhoto } from '../types';

export default function EditorPage() {
  const { templateId = '' } = useParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetDragStartRef = useRef<number | null>(null);
  const sheetDragOffsetRef = useRef(0);
  const sheetDragPointerRef = useRef<number | null>(null);
  const ignoreNextPhotoClickRef = useRef(false);
  const photoLongPressTimerRef = useRef<number | null>(null);
  const photoPointerStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const localPreviewUrlsRef = useRef<Set<string>>(new Set());
  const [template, setTemplate] = useState<Template | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<TemplateFrame | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const [assignments, setAssignments] = useState<FrameAssignments>({});
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const [downloadSvg, setDownloadSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [horizontalMode, setHorizontalMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deletingPhotos, setDeletingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([fetchTemplate(templateId), fetchUploadedPhotos(templateId)])
      .then(([templateData, uploaded]) => {
        if (!alive) return;
        setTemplate(templateData);
        setHorizontalMode(false);
        setPhotos(uploaded);
        setAssignments(loadStoredAssignments(templateId, uploaded));
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

  useEffect(() => {
    if (selectedFrame) return;

    sheetDragStartRef.current = null;
    sheetDragOffsetRef.current = 0;
    sheetDragPointerRef.current = null;
    setSheetDragOffset(0);
    setIsSheetDragging(false);
    setSelectedPhotoIds(new Set());
  }, [selectedFrame]);

  useEffect(() => () => {
    clearPhotoLongPressTimer();
    localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localPreviewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!selectedFrame) return undefined;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const previousPosition = bodyStyle.position;
    const previousTop = bodyStyle.top;
    const previousWidth = bodyStyle.width;
    const previousOverflow = bodyStyle.overflow;

    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';

    return () => {
      bodyStyle.position = previousPosition;
      bodyStyle.top = previousTop;
      bodyStyle.width = previousWidth;
      bodyStyle.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [selectedFrame]);

  const selectedPhotoId = selectedFrame ? assignments[selectedFrame.id]?.id : undefined;
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.has(photo.id)),
    [photos, selectedPhotoIds],
  );

  const filledCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );
  const hasPendingAssignedUploads = useMemo(
    () => Object.values(assignments).some((photo) => Boolean(photo && !photo.public_url)),
    [assignments],
  );
  const canDownload = Boolean(downloadSvg && !hasPendingAssignedUploads);
  const progressLabel = template
    ? `${filledCount}/${template.template_frames?.length ?? 0} filled`
    : '';
  const editorPageClassName = [
    selectedFrame ? 'editor-page editor-page-sheet-open' : 'editor-page editor-page-sheet-closed',
    horizontalMode ? 'editor-page-horizontal' : '',
  ].filter(Boolean).join(' ');

  function resetSheetDragState() {
    sheetDragStartRef.current = null;
    sheetDragOffsetRef.current = 0;
    sheetDragPointerRef.current = null;
    ignoreNextPhotoClickRef.current = false;
    setSheetDragOffset(0);
    setIsSheetDragging(false);
  }

  function clearPhotoLongPressTimer() {
    if (photoLongPressTimerRef.current === null) return;
    window.clearTimeout(photoLongPressTimerRef.current);
    photoLongPressTimerRef.current = null;
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    event.target.value = '';

    const localPhotos = files.map((file) => createLocalPreviewPhoto(file, templateId));
    localPhotos.forEach((photo) => {
      if (photo.local_preview_url) localPreviewUrlsRef.current.add(photo.local_preview_url);
    });
    setPhotos((current) => [...current, ...localPhotos]);

    const results = await Promise.all(localPhotos.map(async (localPhoto, index) => {
      try {
        const uploadedPhoto = await uploadPhoto(files[index], templateId);
        replaceLocalPhoto(localPhoto, uploadedPhoto);
        return null;
      } catch (err) {
        setPhotos((current) => current.map((photo) => (
          photo.id === localPhoto.id ? { ...photo, upload_status: 'error' } : photo
        )));
        return err;
      }
    }));

    const failedUpload = results.find(Boolean);
    if (failedUpload) {
      setError(failedUpload instanceof Error ? failedUpload.message : 'Upload failed');
    }
    setUploading(false);
  }

  function replaceLocalPhoto(localPhoto: UploadedPhoto, uploadedPhoto: UploadedPhoto) {
    const readyPhoto: UploadedPhoto = {
      ...uploadedPhoto,
      local_preview_url: localPhoto.local_preview_url,
      upload_status: 'ready',
    };

    setPhotos((current) => current.map((photo) => (photo.id === localPhoto.id ? readyPhoto : photo)));
    setSelectedPhotoIds((current) => {
      if (!current.has(localPhoto.id)) return current;
      const next = new Set(current);
      next.delete(localPhoto.id);
      next.add(readyPhoto.id);
      return next;
    });
    setAssignments((current) => {
      const next = Object.entries(current).reduce<FrameAssignments>((acc, [frameId, photo]) => {
        acc[frameId] = photo?.id === localPhoto.id ? readyPhoto : photo;
        return acc;
      }, {});
      persistAssignments(templateId, next);
      return next;
    });
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
    setSelectedFrame(null);
    window.setTimeout(() => setSaving(false), 120);
  }

  function clearFramePhoto(frameId: string) {
    const nextAssignments = { ...assignments };
    delete nextAssignments[frameId];
    setAssignments(nextAssignments);
    persistAssignments(templateId, nextAssignments);
  }

  function randomFill(sourcePhotos = photos) {
    if (!template || sourcePhotos.length === 0) return;
    const shuffled = [...sourcePhotos].sort(() => Math.random() - 0.5);
    const next: FrameAssignments = {};
    for (const [index, frame] of (template.template_frames ?? []).entries()) {
      next[frame.id] = shuffled[index % shuffled.length];
    }
    setAssignments(next);
    persistAssignments(templateId, next);
  }

  function randomFillSelectedPhotos() {
    randomFill(selectedPhotos);
  }

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function startPhotoLongPress(photo: UploadedPhoto, event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    clearPhotoLongPressTimer();
    photoPointerStartRef.current = {
      id: photo.id,
      x: event.clientX,
      y: event.clientY,
    };

    photoLongPressTimerRef.current = window.setTimeout(() => {
      ignoreNextPhotoClickRef.current = true;
      photoLongPressTimerRef.current = null;
      togglePhotoSelection(photo.id);
    }, 420);
  }

  function movePhotoLongPress(event: PointerEvent<HTMLButtonElement>) {
    const start = photoPointerStartRef.current;
    if (!start) return;

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > 8) clearPhotoLongPressTimer();
  }

  function stopPhotoLongPress() {
    clearPhotoLongPressTimer();
    photoPointerStartRef.current = null;
  }

  async function deleteSelectedPhotos() {
    if (selectedPhotos.length === 0) return;

    setDeletingPhotos(true);
    setError(null);
    try {
      const remotePhotos = selectedPhotos.filter((photo) => photo.bucket && photo.storage_path);
      if (remotePhotos.length > 0) {
        await deleteUploadedPhotos(remotePhotos);
      }
      const deletedIds = new Set(selectedPhotos.map((photo) => photo.id));
      const nextAssignments = Object.entries(assignments).reduce<FrameAssignments>((acc, [frameId, photo]) => {
        if (photo && !deletedIds.has(photo.id)) acc[frameId] = photo;
        return acc;
      }, {});

      selectedPhotos.forEach((photo) => {
        if (!photo.local_preview_url) return;
        URL.revokeObjectURL(photo.local_preview_url);
        localPreviewUrlsRef.current.delete(photo.local_preview_url);
      });
      setPhotos((current) => current.filter((photo) => !deletedIds.has(photo.id)));
      setAssignments(nextAssignments);
      persistAssignments(templateId, nextAssignments);
      setSelectedPhotoIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingPhotos(false);
    }
  }

  function selectFrame(frame: TemplateFrame) {
    setSelectedFrame((current) => (current?.id === frame.id ? null : frame));
  }

  function startSheetDrag(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    sheetDragStartRef.current = event.clientY;
    sheetDragOffsetRef.current = 0;
    sheetDragPointerRef.current = event.pointerId;
    ignoreNextPhotoClickRef.current = false;
    setIsSheetDragging(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheetDrag(event: PointerEvent<HTMLElement>) {
    if (sheetDragPointerRef.current !== event.pointerId) return;

    const startY = sheetDragStartRef.current;
    if (startY === null) return;

    const offset = Math.max(0, event.clientY - startY);
    sheetDragOffsetRef.current = offset;
    setSheetDragOffset(offset);

    if (offset > 6) {
      ignoreNextPhotoClickRef.current = true;
      setIsSheetDragging(true);
    }
  }

  function finishSheetDrag(event: PointerEvent<HTMLElement>) {
    if (sheetDragPointerRef.current !== event.pointerId) return;

    const offset = sheetDragOffsetRef.current;
    sheetDragStartRef.current = null;
    sheetDragOffsetRef.current = 0;
    sheetDragPointerRef.current = null;
    ignoreNextPhotoClickRef.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsSheetDragging(false);

    if (offset > 72) {
      resetSheetDragState();
      setSelectedFrame(null);
      return;
    }

    resetSheetDragState();
  }

  function cancelSheetDrag(event: PointerEvent<HTMLElement>) {
    if (sheetDragPointerRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resetSheetDragState();
  }

  async function downloadCollage() {
    if (!template || !downloadSvg) {
      setError('The collage is still loading. Please try again in a moment.');
      return;
    }
    if (hasPendingAssignedUploads) {
      setError('Some selected photos are still uploading. Please try again in a moment.');
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

  function openPreview() {
    if (!canDownload) {
      setError('The collage is still loading. Please try again in a moment.');
      return;
    }

    setPreviewOpen(true);
  }

  async function toggleHorizontalMode() {
    const nextHorizontalMode = !horizontalMode;
    resetSheetDragState();
    clearPhotoLongPressTimer();
    setSelectedFrame(null);
    setSelectedPhotoIds(new Set());
    setHorizontalMode(nextHorizontalMode);
    syncViewportAfterLayoutChange();

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
        unlock?: () => void;
      };

      if (nextHorizontalMode) {
        if (document.fullscreenEnabled && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        await orientation.lock?.('landscape');
      } else {
        orientation.unlock?.();
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Some mobile browsers, especially iOS Safari, do not allow orientation lock.
    } finally {
      syncViewportAfterLayoutChange();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }

  return (
    <AppShell
      title="Photo Editor"
      backTo="/templates"
      dark
      className={horizontalMode ? 'app-shell-editor-horizontal' : ''}
      rightAction={(
        <div className="editor-header-actions">
          <button
            type="button"
            className={horizontalMode ? 'icon-button icon-button-active' : 'icon-button'}
            onClick={toggleHorizontalMode}
            aria-label={horizontalMode ? 'Use standard editor layout' : 'Use horizontal editor layout'}
            title={horizontalMode ? 'Standard layout' : 'Horizontal layout'}
          >
            <Icon name="layout" size={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={openPreview}
            disabled={!canDownload}
            aria-label="Preview collage"
            title="Preview collage"
          >
            <Icon name="eye" size={20} />
          </button>
        </div>
      )}
    >
      <div className={editorPageClassName}>
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
              progressLabel={saving ? 'Saving...' : progressLabel}
              onFrameClick={selectFrame}
              onCanvasClick={() => setSelectedFrame(null)}
              onRenderedSvgChange={setDownloadSvg}
            />

            <div className="editor-actions">
              <button className="quick-chip quick-chip-sun" onClick={() => randomFill()} disabled={photos.length === 0}>
                <Icon name="shuffle" size={16} />
                Random
              </button>
              <button className="quick-chip" onClick={() => inputRef.current?.click()} disabled={uploading}>
                <Icon name="upload" size={16} />
                {uploading ? 'Uploading' : 'Upload'}
              </button>
              <button className="quick-chip" onClick={downloadCollage} disabled={!canDownload || downloading}>
                <Icon name="download" size={16} />
                {downloading ? 'Downloading' : 'Download'}
              </button>
            </div>

            {selectedFrame && (
              <section
                className={isSheetDragging ? 'photo-picker-sheet photo-picker-sheet-dragging' : 'photo-picker-sheet'}
                style={{ transform: `translateY(${sheetDragOffset}px)` }}
                onPointerDown={startSheetDrag}
                onPointerMove={moveSheetDrag}
                onPointerUp={finishSheetDrag}
                onPointerCancel={cancelSheetDrag}
              >
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <strong>{formatFrameLabel(selectedFrame)}</strong>
                  </div>
                  <div className="sheet-actions" onPointerDown={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="sheet-icon-button sheet-icon-button-sun"
                      onClick={randomFillSelectedPhotos}
                      disabled={selectedPhotos.length === 0}
                      aria-label="Random fill selected photos"
                      title={selectedPhotos.length === 0 ? 'Select photos first' : 'Random fill selected photos'}
                    >
                      <Icon name="shuffle" size={17} />
                    </button>
                    <button
                      type="button"
                      className="sheet-icon-button"
                      onClick={() => inputRef.current?.click()}
                      disabled={uploading}
                      aria-label="Upload photos"
                      title="Upload photos"
                    >
                      <Icon name="upload" size={17} />
                    </button>
                    <button
                      type="button"
                      className="sheet-icon-button"
                      onClick={downloadCollage}
                      disabled={!canDownload || downloading}
                      aria-label="Download PNG"
                      title="Download PNG"
                    >
                      <Icon name="download" size={17} />
                    </button>
                    <button
                      type="button"
                      className="sheet-icon-button sheet-icon-button-danger"
                      onClick={deleteSelectedPhotos}
                      disabled={selectedPhotos.length === 0 || deletingPhotos}
                      aria-label="Delete selected photos"
                      title={selectedPhotos.length === 0 ? 'Select photos first' : 'Delete selected photos'}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>

                <div
                  className="photo-strip"
                  onPointerDown={(event) => {
                    ignoreNextPhotoClickRef.current = false;
                    event.stopPropagation();
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {photos.map((photo) => {
                    const isAssignedToCurrentFrame = selectedPhotoId === photo.id;
                    const selectedIndex = selectedPhotos.findIndex((selectedPhoto) => selectedPhoto.id === photo.id);
                    const isSelectedForAction = selectedIndex >= 0;
                    const photoDisplayUrl = getPhotoDisplayUrl(photo);

                    return (
                      <button
                        key={photo.id}
                        className={[
                          'photo-choice',
                          isAssignedToCurrentFrame ? 'photo-choice-active' : '',
                          isSelectedForAction ? 'photo-choice-selected' : '',
                        ].filter(Boolean).join(' ')}
                        onPointerDown={(event) => startPhotoLongPress(photo, event)}
                        onPointerMove={movePhotoLongPress}
                        onPointerUp={stopPhotoLongPress}
                        onPointerCancel={stopPhotoLongPress}
                        onPointerLeave={stopPhotoLongPress}
                        onContextMenu={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (ignoreNextPhotoClickRef.current) {
                            ignoreNextPhotoClickRef.current = false;
                            return;
                          }
                          if (selectedPhotoIds.size > 0) {
                            togglePhotoSelection(photo.id);
                            return;
                          }
                          choosePhoto(photo);
                        }}
                        disabled={saving || deletingPhotos}
                      >
                        {photoDisplayUrl && <img src={photoDisplayUrl} alt={photo.file_name ?? 'Uploaded photo'} />}
                        {photo.upload_status === 'uploading' && (
                          <span className="photo-choice-status">Uploading...</span>
                        )}
                        {photo.upload_status === 'error' && (
                          <span className="photo-choice-status photo-choice-status-error">Failed</span>
                        )}
                        {isSelectedForAction && (
                          <span className="photo-choice-select-badge">{selectedIndex + 1}</span>
                        )}
                        {isAssignedToCurrentFrame && selectedFrame && (
                          <span
                            className="photo-choice-clear"
                            role="button"
                            tabIndex={0}
                            aria-label="Remove photo from selected frame"
                            title="Remove photo from selected frame"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearFramePhoto(selectedFrame.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                clearFramePhoto(selectedFrame.id);
                              }
                            }}
                          >
                            <Icon name="x" size={14} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
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

            {previewOpen && downloadSvg && (
              <div className="preview-modal" role="dialog" aria-modal="true" aria-label="Preview collage">
                <div className="preview-modal-panel">
                  <div className="preview-modal-bar">
                    <strong>Preview</strong>
                    <div className="preview-modal-actions">
                      <button
                        type="button"
                        className="sheet-icon-button"
                        onClick={downloadCollage}
                        disabled={downloading}
                        aria-label="Download PNG"
                        title="Download PNG"
                      >
                        <Icon name="download" size={17} />
                      </button>
                      <button
                        type="button"
                        className="sheet-icon-button"
                        onClick={() => setPreviewOpen(false)}
                        aria-label="Close preview"
                        title="Close preview"
                      >
                        <Icon name="x" size={17} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="preview-modal-canvas"
                    dangerouslySetInnerHTML={{ __html: downloadSvg }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
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

function createLocalPreviewPhoto(file: File, templateId: string): UploadedPhoto {
  return {
    id: `local-${createLocalId()}`,
    client_session_id: 'local',
    template_id: templateId,
    frame_id: null,
    bucket: '',
    storage_path: '',
    public_url: null,
    local_preview_url: URL.createObjectURL(file),
    upload_status: 'uploading',
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    created_at: new Date().toISOString(),
  };
}

function getPhotoDisplayUrl(photo?: UploadedPhoto) {
  return photo?.local_preview_url || photo?.public_url || null;
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function persistAssignments(templateId: string, assignments: FrameAssignments) {
  const serializable = Object.entries(assignments).reduce<Record<string, string>>((acc, [frameId, photo]) => {
    if (photo?.id) acc[frameId] = photo.id;
    return acc;
  }, {});

  window.localStorage.setItem(assignmentStorageKey(templateId), JSON.stringify(serializable));
}

function syncViewportAfterLayoutChange() {
  const update = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
  };

  update();
  window.requestAnimationFrame(update);
  window.setTimeout(update, 180);
  window.setTimeout(update, 420);
}

function assignmentStorageKey(templateId: string) {
  return `event-collage-assignments:${templateId}`;
}

function formatFrameLabel(frame: TemplateFrame) {
  const label = frame.name?.trim() || frame.frame_key || 'Selected frame';
  return /^#/.test(label) ? label : `#${label}`;
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
