import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileText, Upload, Calculator,
  Clock, Map, QrCode, Settings, Video, PanelLeftClose, PanelLeft,
} from 'lucide-react';

const items = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/sites',      label: 'Sites',        icon: Building2 },
  { to: '/carte',      label: 'Carte',        icon: Map },
  { to: '/scan',       label: 'Scanner QR',   icon: QrCode },
  { to: '/assistance', label: 'Télé-assistance', icon: Video },
  { to: '/rapports',   label: 'Rapports',     icon: FileText },
  { to: '/devis',      label: 'Pré-devis',    icon: Calculator },
  { to: '/historique', label: 'Historique',   icon: Clock },
  { to: '/import',     label: 'Import',       icon: Upload },
  { to: '/parametres', label: 'Paramètres',   icon: Settings },
];

// Sidebar Apple-like : deux états (icônes seules / expanded) persistés
// dans localStorage. Transition spring 200 ms.
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ief:sidebar') === '1');
  useEffect(() => { localStorage.setItem('ief:sidebar', collapsed ? '1' : '0'); }, [collapsed]);

  return (
    <aside
      className="hidden md:flex flex-col border-r border-border min-h-[calc(100vh-3.5rem)] py-3 px-2 transition-all duration-200 ease-spring"
      style={{ width: collapsed ? 60 : 224 }}
    >
      <nav className="flex-1 space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ease-spring',
                isActive ? 'bg-white/[0.06] text-text' : 'text-muted hover:text-text hover:bg-white/[0.03]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />
                )}
                <Icon size={17} className={isActive ? 'text-accent' : 'text-muted group-hover:text-text'} />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <button
        className="mt-2 flex items-center justify-center py-2 rounded-lg text-muted hover:text-text hover:bg-white/[0.03] transition"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
      >
        {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
      </button>
    </aside>
  );
}
