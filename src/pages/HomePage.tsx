import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Button } from '../components/Layout';

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-sheet">
        <div className="hero-sticker">MAY 2026</div>
        <div className="logo-row">
          <img src="/assets/logo-mark.svg" alt="" />
          <span>Splashbook</span>
        </div>
        <h1>用活動相，砌一張海島回憶</h1>
        <p>揀一個 Template，Upload 幾張相，再 Tap 入 photo frame。第一版先試最核心流程。</p>
        <Link to="/templates">
          <Button variant="primary" icon={<Icon name="layout" />}>
            揀 Template
          </Button>
        </Link>
      </section>

      <section className="quick-notes">
        <div>
          <strong>SPA routes</strong>
          <span>/templates · /upload · /editor</span>
        </div>
        <div>
          <strong>Supabase</strong>
          <span>templates · template_frames · uploaded_photos</span>
        </div>
      </section>
    </main>
  );
}
