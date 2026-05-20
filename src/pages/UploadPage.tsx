import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AppShell, Button, ErrorCard, LoadingCard } from '../components/Layout';
import { TemplatePreview } from '../components/TemplateCanvas';
import { fetchTemplate, fetchUploadedPhotos, uploadPhoto } from '../lib/api';
import type { Template, UploadedPhoto } from '../types';

export default function UploadPage() {
  const { templateId = '' } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchTemplate(templateId), fetchUploadedPhotos(templateId)])
      .then(([templateData, uploaded]) => {
        if (!alive) return;
        setTemplate(templateData);
        setPhotos(uploaded);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load upload page');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [templateId]);

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

  const requiredPhotos = template?.template_frames?.length ?? 0;

  return (
    <AppShell title="上傳活動相" backTo="/templates">
      <div className="route-content">
        {loading && <LoadingCard message="準備 upload flow…" />}
        {error && <ErrorCard message={error} />}
        {!loading && template && (
          <>
            <section className="selected-template-strip">
              <div className="selected-template-preview">
                <TemplatePreview template={template} compact />
              </div>
              <div>
                <span>TEMPLATE</span>
                <strong>{template.name}</strong>
                <p>需要 {requiredPhotos} 張相</p>
              </div>
              <Link to="/templates">換 →</Link>
            </section>

            <input ref={inputRef} className="hidden-input" type="file" accept="image/*" multiple onChange={handleFiles} />

            <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <span>
                <Icon name="camera" size={30} />
              </span>
              <strong>{uploading ? 'Upload 緊…' : 'Tap 一下，揀幾張相'}</strong>
              <small>會存入 Supabase Storage / user-photos</small>
            </button>

            <div className="section-heading">
              <h2>相薄</h2>
              <span>
                {photos.length}/{requiredPhotos} 張
              </span>
            </div>

            <div className="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className="photo-tile">
                  {photo.public_url && <img src={photo.public_url} alt={photo.file_name ?? 'Uploaded photo'} />}
                </div>
              ))}
              {photos.length === 0 && <p className="empty-copy">未有相，先 upload 啦。</p>}
            </div>

            <div className="sticky-action">
              <div>
                <strong>{photos.length > 0 ? '可以開始拼貼' : '先揀相'}</strong>
                <span>{photos.length > 0 ? '入 editor 填 photo frame' : 'Upload 最少 1 張相'}</span>
              </div>
              <Button
                variant="brand"
                disabled={photos.length === 0}
                icon={<Icon name="arrowRight" />}
                onClick={() => navigate(`/editor/${template.id}`)}
              >
                開始
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
