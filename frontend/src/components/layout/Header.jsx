import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import GlobalSearch from '../ui/GlobalSearch.jsx';

export default function Header() {
  const { profile, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  // Raccourci global Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-6 w-6 rounded bg-accent" />
            <span className="font-semibold tracking-tight">IEF Audit</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <button
              className="btn btn-ghost flex items-center gap-2 text-muted"
              onClick={() => setSearchOpen(true)}
              title="Recherche globale (Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Rechercher</span>
              <kbd className="hidden md:inline-block text-[10px] border border-border rounded px-1 ml-1">Ctrl+K</kbd>
            </button>
            {profile && (
              <span className="hidden lg:inline text-muted text-xs">
                {profile.organisations?.name ?? '—'} · {profile.email}
              </span>
            )}
            <button className="btn btn-ghost" onClick={signOut} aria-label="Se déconnecter">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
