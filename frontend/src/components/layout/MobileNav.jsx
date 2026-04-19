import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, FileText, Upload } from 'lucide-react';

const items = [
  { to: '/',         label: 'Accueil',  icon: LayoutDashboard, end: true },
  { to: '/sites',    label: 'Sites',    icon: Building2 },
  { to: '/rapports', label: 'Rapports', icon: FileText },
  { to: '/import',   label: 'Import',   icon: Upload },
];

export default function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card/95 backdrop-blur border-t border-border">
      <div className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 text-xs ${
                isActive ? 'text-accent' : 'text-muted'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
