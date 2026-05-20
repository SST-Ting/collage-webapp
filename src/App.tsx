import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TemplateListPage from './pages/TemplateListPage';
import EditorPage from './pages/EditorPage';

export default function App() {
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
