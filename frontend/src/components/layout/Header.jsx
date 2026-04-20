import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import GlobalSearch from '../ui/GlobalSearch.jsx';

// Header minimal Apple-like : glassmorphism, commande de recherche
// centrale prédominante, identité discrète.
export default function Header() {
  const { profile, signOut } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

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
      <header
        className="sticky top-0 z-20 border-b border-border/70"
        style={{ background: 'rgba(10,12,16,0.72)', backdropFilter: 'saturate(180%) blur(14px)' }}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-12 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="h-6 w-6 rounded-md bg-gradient-to-br from-accent to-accent-dim shadow-[0_0_10px_rgba(255,107,0,0.3)]" />
            <span className="font-semibold tracking-tight text-sm">IEF Audit</span>
          </Link>

          <button
            className="flex-1 max-w-xl flex items-center gap-2 h-7 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-muted hover:border-white/[0.12] hover:text-text2 transition group"
            onClick={() => setSearchOpen(true)}
            title="Recherche (Ctrl+K)"
          >
            <Search size={13} className="shrink-0" />
            <span className="text-xs truncate">Rechercher un site, une référence, une zone…</span>
            <kbd className="ml-auto text-[10px] hidden sm:inline-flex">Ctrl K</kbd>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs text-text leading-none">{profile.email}</span>
                <span className="text-[10px] text-muted leading-none mt-0.5">{profile.organisations?.name ?? '—'}</span>
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={signOut} aria-label="Se déconnecter">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
