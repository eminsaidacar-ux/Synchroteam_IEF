import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sites from './pages/Sites.jsx';
import SiteDetail from './pages/SiteDetail.jsx';
import AuditSession from './pages/AuditSession.jsx';
import Rapports from './pages/Rapports.jsx';
import ImportLegacy from './pages/ImportLegacy.jsx';

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <FullscreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function FullscreenSpinner() {
  return (
    <div className="h-full grid place-items-center">
      <div className="animate-pulse text-muted">Chargement…</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/:siteId" element={<SiteDetail />} />
        <Route path="sites/:siteId/audit" element={<AuditSession />} />
        <Route path="sites/:siteId/audit/:equipId" element={<AuditSession />} />
        <Route path="rapports" element={<Rapports />} />
        <Route path="import" element={<ImportLegacy />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
