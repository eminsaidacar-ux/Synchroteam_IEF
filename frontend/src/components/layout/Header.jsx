import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';

export default function Header() {
  const { profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-6 w-6 rounded bg-accent" />
          <span className="font-semibold tracking-tight">IEF Audit</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {profile && (
            <span className="hidden sm:inline text-muted">
              {profile.organisations?.name ?? '—'} · {profile.email}
            </span>
          )}
          <button className="btn btn-ghost" onClick={signOut} aria-label="Se déconnecter">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
