import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Sites from './pages/Sites.jsx';
import SiteDetail from './pages/SiteDetail.jsx';
import AuditSession from './pages/AuditSession.jsx';
import Rapports from './pages/Rapports.jsx';
import ImportLegacy from './pages/ImportLegacy.jsx';
import QrSheet from './pages/QrSheet.jsx';
import Devis from './pages/Devis.jsx';
import Historique from './pages/Historique.jsx';

// DEV: auth bypass le temps du test UI local. Remettre <Protected> autour
// de <AppLayout /> quand Supabase sera configure.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
        <Route path="import" element={<ImportLegacy />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
