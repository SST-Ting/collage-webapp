import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { fetchSharedImages, setSharedImageFavorite } from '../lib/api';
import type { SharedImage } from '../types';
import { AppShell, ErrorCard, LoadingCard } from '../components/Layout';

export default function SharedImagesPage() {
  const [images, setImages] = useState<SharedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<SharedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    fetchSharedImages()
      .then((items) => {
        if (!alive) return;
        setImages(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load shared images');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppShell title="Shared Images" backTo="/templates">
      <div className="route-content">
        {loading && <LoadingCard message="Loading shared images..." />}
        {error && <ErrorCard title="Cannot load shared images" message={error} />}
        {!loading && !error && (
          <>
            <div className="shared-page-heading">
              <strong>{images.length} shared image{images.length === 1 ? '' : 's'}</strong>
              <span>Tap an image to open the full PNG.</span>
            </div>

            <div className="shared-image-grid">
              {images.map((image) => {
                const favoriteCount = image.favorite_count ?? 0;
                const isFavorited = Boolean(image.is_favorited);

                return (
                  <article key={image.id} className="shared-image-card">
                    {image.public_url && (
                      <button
                        type="button"
                        className="shared-image-preview-button"
                        onClick={() => setViewerImage(image)}
                        aria-label="Open image fullscreen"
                      >
                        <img src={image.public_url} alt={image.file_name ?? 'Shared collage'} />
                      </button>
                    )}
                    <div className="shared-image-favorite">
                      {image.public_url && (
                        <a
                          className="shared-download-button"
                          href={image.public_url}
                          download={image.file_name ?? 'shared-collage.png'}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Download shared image"
                          title="Download"
                        >
                          <Icon name="download" size={14} strokeWidth={2.5} />
                        </a>
                      )}
                      <button
                        type="button"
                        className={isFavorited ? 'favorite-button favorite-button-active' : 'favorite-button'}
                        onClick={() => toggleFavorite(image)}
                        disabled={favoriteBusyId === image.id}
                        aria-label={isFavorited ? 'Remove favorite' : 'Add favorite'}
                        title={isFavorited ? 'Remove favorite' : 'Add favorite'}
                      >
                        <Icon name="heart" size={16} strokeWidth={2.4} />
                        <strong>{favoriteCount}</strong>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {images.length === 0 && (
              <div className="state-card">
                <p>No shared images yet.</p>
              </div>
            )}

            {viewerImage?.public_url && (
              <div className="shared-viewer" role="dialog" aria-modal="true" aria-label="Shared image preview">
                <div className="shared-viewer-bar">
                  <span>Preview</span>
                  <div className="shared-viewer-actions">
                    <a
                      className="shared-viewer-action"
                      href={viewerImage.public_url}
                      download={viewerImage.file_name ?? 'shared-collage.png'}
                      aria-label="Download shared image"
                      title="Download"
                    >
                      <Icon name="download" size={18} />
                    </a>
                    <button
                      type="button"
                      className="shared-viewer-action"
                      onClick={() => setViewerImage(null)}
                      aria-label="Close image preview"
                      title="Close"
                    >
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                </div>
                <div className="shared-viewer-canvas" onClick={() => setViewerImage(null)}>
                  <img
                    src={viewerImage.public_url}
                    alt={viewerImage.file_name ?? 'Shared collage'}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );

  async function toggleFavorite(image: SharedImage) {
    const nextFavorited = !image.is_favorited;
    setFavoriteBusyId(image.id);
    setError(null);

    setImages((current) => current.map((item) => {
      if (item.id !== image.id) return item;
      const count = item.favorite_count ?? 0;
      return {
        ...item,
        is_favorited: nextFavorited,
        favorite_count: Math.max(0, count + (nextFavorited ? 1 : -1)),
      };
    }));

    try {
      await setSharedImageFavorite(image, nextFavorited);
    } catch (err) {
      setImages((current) => current.map((item) => {
        if (item.id !== image.id) return item;
        const count = item.favorite_count ?? 0;
        return {
          ...item,
          is_favorited: !nextFavorited,
          favorite_count: Math.max(0, count + (nextFavorited ? -1 : 1)),
        };
      }));
      setError(err instanceof Error ? err.message : 'Favorite failed');
    } finally {
      setFavoriteBusyId(null);
    }
  }
}

function formatSharedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
