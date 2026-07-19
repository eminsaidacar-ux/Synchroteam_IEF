import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '../../hooks/useSyncStatus.js';
import { flush } from '../../lib/outbox.js';

// Indicateur d'état de synchronisation (header). Quatre états :
//   offline  → hors ligne, N écritures en attente dans l'outbox
//   syncing  → rejeu de la file en cours
//   pending  → en ligne mais file non vide (clic = relancer la sync)
//   ok       → tout est synchronisé
export default function SyncBadge() {
  const { offline, pending, syncing, lastError } = useSyncStatus();

  const state = offline ? 'offline' : syncing ? 'syncing' : pending > 0 ? 'pending' : 'ok';

  const label =
    state === 'offline' ? (pending > 0 ? `Hors ligne · ${pending} en attente` : 'Hors ligne')
    : state === 'syncing' ? 'Synchronisation…'
    : state === 'pending' ? `${pending} en attente`
    : 'Synchronisé';

  const Icon = state === 'offline' ? CloudOff : state === 'syncing' ? RefreshCw : Cloud;

  const tone =
    state === 'offline' ? 'text-bad border-bad/40'
    : state === 'pending' ? 'text-accent border-accent/40'
    : 'text-muted border-white/[0.06]';

  return (
    <button
      type="button"
      data-testid="sync-badge"
      data-state={state}
      title={lastError ? `Dernière erreur de sync : ${lastError}` : label}
      onClick={() => flush()}
      className={`hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-lg border bg-white/[0.03] text-[11px] transition ${tone}`}
    >
      <Icon size={12} className={state === 'syncing' ? 'animate-spin' : ''} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
