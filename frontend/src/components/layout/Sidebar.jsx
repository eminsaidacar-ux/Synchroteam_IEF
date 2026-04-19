import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, FileText, Upload, Calculator } from 'lucide-react';

const items = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sites',    label: 'Sites',     icon: Building2 },
  { to: '/rapports', label: 'Rapports',  icon: FileText },
  { to: '/devis',    label: 'Pré-devis', icon: Calculator },
  { to: '/import',   label: 'Import',    icon: Upload },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:block w-56 border-r border-border min-h-[calc(100vh-3.5rem)] p-4">
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-text hover:bg-card'
              }`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
