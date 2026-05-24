import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import TemplateListPage from './pages/TemplateListPage';
import EditorPage from './pages/EditorPage';
import SharedImagesPage from './pages/SharedImagesPage';

export default function App() {
  useMobileViewportVars();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/templates" element={<TemplateListPage />} />
      <Route path="/shared" element={<SharedImagesPage />} />
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
    let lockedBottomInset = 0;

    function lockViewportHeight() {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
    }

    function updateBottomInset() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportOffsetTop = viewport?.offsetTop ?? 0;
      const bottomInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);
      lockedBottomInset = Math.max(lockedBottomInset, bottomInset);

      root.style.setProperty('--browser-bottom-inset', `${lockedBottomInset}px`);
    }

    function resetViewportVars() {
      lockedBottomInset = 0;
      lockViewportHeight();
      updateBottomInset();
    }

    lockViewportHeight();
    updateBottomInset();

    window.addEventListener('resize', resetViewportVars);
    window.addEventListener('orientationchange', resetViewportVars);
    window.visualViewport?.addEventListener('resize', resetViewportVars);

    return () => {
      window.removeEventListener('resize', resetViewportVars);
      window.removeEventListener('orientationchange', resetViewportVars);
      window.visualViewport?.removeEventListener('resize', resetViewportVars);
    };
  }, []);
}
