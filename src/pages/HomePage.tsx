import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Button } from '../components/Layout';

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-sheet">
        <div className="logo-row">
          <img src="/assets/logo-mark.svg" alt="" />
          <span>IVELite</span>
        </div>
        <div className="hero-copy">
          <span className="hero-kicker">雙洞火山泳綑 + 橋咀島西浮潛</span>
          <h1>用活動相，砌一張海島回憶</h1>
          <p>揀一個版面，上載相片，再放入相框。幾分鐘就可以做出屬於今次活動的紀念圖。</p>
        </div>
        <div className="hero-actions">
          <Link to="/templates">
            <Button variant="primary" icon={<Icon name="layout" />}>
              開始製作
            </Button>
          </Link>
          <Link to="/shared">
            <Button variant="ghost" icon={<Icon name="image" />}>
              瀏覽分享
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
