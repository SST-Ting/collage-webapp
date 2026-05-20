import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTemplates } from '../lib/api';
import type { Template } from '../types';
import { AppShell, ErrorCard, LoadingCard } from '../components/Layout';
import { TemplatePreview } from '../components/TemplateCanvas';
import Icon from '../components/Icon';

export default function TemplateListPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeCategory, setActiveCategory] = useState('全部');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTemplates()
      .then((items) => {
        if (!alive) return;
        setTemplates(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const list = templates.map((template) => template.category).filter(Boolean) as string[];
    return ['全部', ...Array.from(new Set(list))];
  }, [templates]);

  const filteredTemplates = templates.filter(
    (template) => activeCategory === '全部' || template.category === activeCategory,
  );

  return (
    <AppShell title="揀一個 Template" backTo="/">
      <div className="route-content">
        {loading && <LoadingCard message="讀緊 Supabase templates…" />}
        {error && (
          <ErrorCard
            title="未讀到 Template"
            message={`請先在 Supabase SQL Editor 跑 supabase/schema.sql。錯誤：${error}`}
          />
        )}
        {!loading && !error && (
          <>
            <div className="chip-row">
              {categories.map((category) => (
                <button
                  key={category}
                  className={category === activeCategory ? 'chip chip-active' : 'chip'}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="template-grid">
              {filteredTemplates.map((template) => (
                <Link key={template.id} className="template-card" to={`/editor/${template.id}`}>
                  <div className="template-card-preview">
                    <TemplatePreview template={template} compact />
                  </div>
                  <div className="template-card-body">
                    <strong>{template.name}</strong>
                    <span>
                      {(template.template_frames ?? []).length} photos · {template.category ?? 'Template'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div className="state-card">
                <Icon name="layout" />
                <p>呢個分類暫時未有 template。</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
