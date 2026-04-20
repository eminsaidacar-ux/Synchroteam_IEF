import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';

// Pages chargées paresseusement : chaque route devient un chunk séparé,
// ce qui réduit le bundle initial (react-pdf/qrcode/leaflet ne sont
// chargés que quand on ouvre Rapports / QrSheet / Carte).
const Login        = lazy(() => import('./pages/Login.jsx'));
const Dashboard    = lazy(() => import('./pages/Dashboard.jsx'));
const Sites        = lazy(() => import('./pages/Sites.jsx'));
const SiteDetail   = lazy(() => import('./pages/SiteDetail.jsx'));
const AuditSession = lazy(() => import('./pages/AuditSession.jsx'));
const Rapports     = lazy(() => import('./pages/Rapports.jsx'));
const ImportLegacy = lazy(() => import('./pages/ImportLegacy.jsx'));
const QrSheet      = lazy(() => import('./pages/QrSheet.jsx'));
const Devis        = lazy(() => import('./pages/Devis.jsx'));
const Historique   = lazy(() => import('./pages/Historique.jsx'));
const ScanQr       = lazy(() => import('./pages/ScanQr.jsx'));
const Parametres   = lazy(() => import('./pages/Parametres.jsx'));
const Carte        = lazy(() => import('./pages/Carte.jsx'));

function Fallback() {
  return (
    <div className="h-full grid place-items-center p-12">
      <div className="animate-pulse text-muted text-sm">Chargement…</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        {/* En mode local, /login redirige vers l'app (pas de flow d'auth). */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/sites/:siteId/qr-sheet" element={<QrSheet />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sites" element={<Sites />} />
          <Route path="sites/:siteId" element={<SiteDetail />} />
          <Route path="sites/:siteId/audit" element={<AuditSession />} />
          <Route path="sites/:siteId/audit/:equipId" element={<AuditSession />} />
          <Route path="rapports" element={<Rapports />} />
          <Route path="devis" element={<Devis />} />
          <Route path="historique" element={<Historique />} />
          <Route path="scan" element={<ScanQr />} />
          <Route path="carte" element={<Carte />} />
          <Route path="parametres" element={<Parametres />} />
          <Route path="import" element={<ImportLegacy />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// Export Login pour que ES module keep tree shake it if dev reaches /login manually.
export { Login };
