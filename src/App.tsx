import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import TemplateListPage from './pages/TemplateListPage';
import EditorPage from './pages/EditorPage';

export default function App() {
  useMobileViewportVars();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/templates" element={<TemplateListPage />} />
      <Route path="/upload/:templateId" element={<UploadRedirect />} />
      <Route path="/editor/:templateId" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function UploadRedirect() {
  const { templateId = '' } = useParams();
  return <Navigate to={`/editor/${templateId}`} replace />;
}

function useMobileViewportVars() {
  useEffect(() => {
    const root = document.documentElement;

    function updateViewportVars() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const bottomInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);

      root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
      root.style.setProperty('--browser-bottom-inset', `${bottomInset}px`);
    }

    updateViewportVars();

    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', updateViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);

    return () => {
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', updateViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
    };
  }, []);
}
