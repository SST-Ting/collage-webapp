import { useEffect, useMemo, useState } from 'react';
import type { FrameAssignments, Template, TemplateFrame, UploadedPhoto } from '../types';
import type React from 'react';

type TemplatePreviewProps = {
  template: Template;
  compact?: boolean;
  showFrames?: boolean;
};

export function TemplatePreview({ template, compact, showFrames = false }: TemplatePreviewProps) {
  const frames = template.template_frames ?? [];

  return (
    <div
      className={compact ? 'template-preview template-preview-compact' : 'template-preview'}
      style={{ aspectRatio: `${template.base_width} / ${template.base_height}` }}
    >
      <TemplateBaseImage template={template} />
      {!template.preview_image_url && <div className="preview-paper-grid" />}
      {showFrames && frames.map((frame, index) => (
        <FrameBox
          key={frame.id}
          frame={frame}
          template={template}
          compact={compact}
          label={`${index + 1}`}
        />
      ))}
      {!template.preview_image_url && <div className="preview-caption">{template.category ?? 'Template'}</div>}
    </div>
  );
}

type EditorCanvasProps = {
  template: Template;
  assignments: FrameAssignments;
  selectedFrameId?: string;
  onFrameClick: (frame: TemplateFrame) => void;
  onCanvasClick?: () => void;
  onRenderedSvgChange?: (svg: string | null) => void;
};

export function EditorCanvas({
  template,
  assignments,
  selectedFrameId,
  onFrameClick,
  onCanvasClick,
  onRenderedSvgChange,
}: EditorCanvasProps) {
  const frames = template.template_frames ?? [];
  const usesSvgImageReplacement = frames.some(isSvgImageReplaceFrame);
  const displayCrop: DisplayCrop | null = null;
  const visibleHeight = Number(template.base_height);

  useEffect(() => {
    if (!usesSvgImageReplacement) onRenderedSvgChange?.(null);
  }, [onRenderedSvgChange, usesSvgImageReplacement]);

  return (
    <div className="editor-canvas-wrap">
      <div
        className="editor-canvas"
        onClick={onCanvasClick}
      >
        <div
          className="editor-template-window"
          style={{ aspectRatio: `${template.base_width} / ${visibleHeight}` }}
        >
          <div className="editor-template-content" style={templateContentStyle(template, visibleHeight, displayCrop)}>
            {usesSvgImageReplacement ? (
              <TemplateSvgImage
                template={template}
                frames={frames}
                assignments={assignments}
                onRenderedSvgChange={onRenderedSvgChange}
              />
            ) : (
              <TemplateBaseImage template={template} />
            )}
            {!template.preview_image_url && (
              <>
                <div className="preview-paper-grid" />
                <div className="canvas-title">
                  <span>雙洞火山泳綑</span>
                  <strong>橋咀島西浮潛</strong>
                </div>
              </>
            )}
            {frames.map((frame, index) => (
              <FrameButton
                key={frame.id}
              frame={frame}
              template={template}
              displayCrop={displayCrop}
              index={index}
              photo={assignments[frame.id]}
                selected={selectedFrameId === frame.id}
                onClick={() => onFrameClick(frame)}
              />
            ))}
            {!template.preview_image_url && <div className="canvas-footer">Splashbook · Event memory</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

type DisplayCrop = {
  top: number;
  bottom: number;
};

function TemplateBaseImage({ template }: { template: Template }) {
  if (!template.preview_image_url) return null;

  return (
    <img
      className="template-base-image"
      src={template.preview_image_url}
      alt=""
      aria-hidden="true"
    />
  );
}

function TemplateSvgImage({
  template,
  frames,
  assignments,
  onRenderedSvgChange,
}: {
  template: Template;
  frames: TemplateFrame[];
  assignments: FrameAssignments;
  onRenderedSvgChange?: (svg: string | null) => void;
}) {
  const [svgText, setSvgText] = useState<string | null>(null);

  useEffect(() => {
    if (!template.preview_image_url) {
      setSvgText(null);
      return;
    }

    const controller = new AbortController();

    fetch(template.preview_image_url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load SVG: ${response.status}`);
        return response.text();
      })
      .then(setSvgText)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSvgText(null);
      });

    return () => controller.abort();
  }, [template.preview_image_url]);

  const renderedSvg = useMemo(() => {
    if (!svgText) return null;
    return replaceSvgImageHrefs(svgText, frames, assignments);
  }, [svgText, frames, assignments]);

  useEffect(() => {
    onRenderedSvgChange?.(renderedSvg);
  }, [onRenderedSvgChange, renderedSvg]);

  if (!template.preview_image_url) return null;
  if (!renderedSvg) return <TemplateBaseImage template={template} />;

  return (
    <div
      className="template-svg-image"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: renderedSvg }}
    />
  );
}

function FrameBox({
  frame,
  template,
  compact,
  label,
}: {
  frame: TemplateFrame;
  template: Template;
  compact?: boolean;
  label: string;
}) {
  const style = frameStyle(frame, template);
  const hasClipPolygon = Boolean(getClipPolygon(frame));

  return (
    <div
      className={[
        compact ? 'frame-box frame-box-compact' : 'frame-box',
        hasClipPolygon ? 'frame-polygon' : '',
      ].filter(Boolean).join(' ')}
      style={{ ...style, borderRadius: `${frame.border_radius}px` }}
    >
      <span>{label}</span>
    </div>
  );
}

function FrameButton({
  frame,
  template,
  displayCrop,
  index,
  photo,
  selected,
  onClick,
}: {
  frame: TemplateFrame;
  template: Template;
  displayCrop?: DisplayCrop | null;
  index: number;
  photo?: UploadedPhoto;
  selected: boolean;
  onClick: () => void;
}) {
  const style = frameStyle(frame, template, displayCrop);
  const hasClipPolygon = Boolean(getClipPolygon(frame));
  const isSvgReplace = isSvgImageReplaceFrame(frame);

  return (
    <button
      className={[
        'frame-button',
        selected ? 'frame-button-selected' : '',
        hasClipPolygon ? 'frame-button-polygon' : '',
        isSvgReplace ? 'frame-button-svg-replace' : '',
        photo?.public_url ? 'frame-button-filled' : 'frame-button-empty',
      ].filter(Boolean).join(' ')}
      style={{ ...style, borderRadius: `${frame.border_radius}px` }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`Select ${frame.name ?? `photo frame ${index + 1}`}`}
    >
      {isSvgReplace ? (
        <span className="frame-button-hit-label">Select frame</span>
      ) : photo?.public_url ? (
        <img src={photo.public_url} alt={photo.file_name ?? `Photo ${index + 1}`} />
      ) : (
        <span>
          +<small>Tap 加相</small>
        </span>
      )}
      <em>{index + 1}</em>
    </button>
  );
}

function frameStyle(
  frame: TemplateFrame,
  template: Template,
  displayCrop?: DisplayCrop | null,
): React.CSSProperties {
  const clipPolygon = getClipPolygon(frame);
  const bounds = clipPolygon ? polygonBounds(clipPolygon) : null;
  const frameX = bounds?.x ?? Number(frame.x);
  const frameY = bounds?.y ?? Number(frame.y);
  const frameWidth = bounds?.width ?? Number(frame.width);
  const frameHeight = bounds?.height ?? Number(frame.height);
  const cropTop = displayCrop?.top ?? 0;
  const cropBottom = displayCrop?.bottom ?? 0;
  const visibleHeight = Number(template.base_height) - cropTop - cropBottom;

  const left = (frameX / Number(template.base_width)) * 100;
  const top = ((frameY - cropTop) / visibleHeight) * 100;
  const width = (frameWidth / Number(template.base_width)) * 100;
  const height = (frameHeight / visibleHeight) * 100;
  const cssClipPolygon = clipPolygon && bounds
    ? toCssPolygon(clipPolygon, bounds)
    : undefined;

  const style: React.CSSProperties = {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    transform: clipPolygon ? undefined : `rotate(${Number(frame.rotation ?? 0)}deg)`,
    zIndex: Number(frame.z_index ?? 10),
  };

  if (cssClipPolygon) {
    style.clipPath = cssClipPolygon;
    style.WebkitClipPath = cssClipPolygon;
  }

  return style;
}

function getEditorDisplayCrop(template: Template): DisplayCrop {
  const baseHeight = Number(template.base_height);
  const crop = Math.min(76, Math.max(42, baseHeight * 0.085));

  return {
    top: crop,
    bottom: crop,
  };
}

function templateContentStyle(
  template: Template,
  visibleHeight: number,
  displayCrop?: DisplayCrop | null,
): React.CSSProperties {
  if (!displayCrop) return {};

  const baseHeight = Number(template.base_height);
  return {
    top: `${(-displayCrop.top / visibleHeight) * 100}%`,
    height: `${(baseHeight / visibleHeight) * 100}%`,
  };
}

function replaceSvgImageHrefs(
  svgText: string,
  frames: TemplateFrame[],
  assignments: FrameAssignments,
) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  if (document.querySelector('parsererror')) return svgText;

  frames.forEach((frame) => {
    const imageId = getSvgImageId(frame);
    const photoUrl = assignments[frame.id]?.public_url;
    if (!imageId || !photoUrl) return;

    const imageElement = document.getElementById(imageId);
    if (!imageElement) return;

    imageElement.setAttribute('href', photoUrl);
    imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', photoUrl);
    imageElement.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  });

  return new XMLSerializer().serializeToString(document.documentElement);
}

function isSvgImageReplaceFrame(frame: TemplateFrame) {
  return frame.config?.mode === 'svg_image_replace' && Boolean(getSvgImageId(frame));
}

function getSvgImageId(frame: TemplateFrame) {
  const imageId = frame.config?.svg_image_id;
  return typeof imageId === 'string' && imageId.length > 0 ? imageId : null;
}

type ClipPoint = [number, number];

function getClipPolygon(frame: TemplateFrame): ClipPoint[] | null {
  const rawPolygon = frame.config?.clip_polygon;
  if (!Array.isArray(rawPolygon)) return null;

  const points = rawPolygon
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const x = Number(point[0]);
      const y = Number(point[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [x, y] as ClipPoint;
    })
    .filter((point): point is ClipPoint => Boolean(point));

  return points.length >= 3 ? points : null;
}

function polygonBounds(points: ClipPoint[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function toCssPolygon(points: ClipPoint[], bounds: ReturnType<typeof polygonBounds>) {
  const cssPoints = points.map(([x, y]) => {
    const px = ((x - bounds.x) / bounds.width) * 100;
    const py = ((y - bounds.y) / bounds.height) * 100;
    return `${px.toFixed(3)}% ${py.toFixed(3)}%`;
  });

  return `polygon(${cssPoints.join(', ')})`;
}
