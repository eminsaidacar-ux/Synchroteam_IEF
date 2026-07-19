import { useSyncExternalStore } from 'react';
import { subscribe, getStatus } from '../lib/outbox.js';

// État de synchronisation de l'outbox offline (voir lib/outbox.js).
// Retourne { offline, pending, syncing, lastError }.
export function useSyncStatus() {
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}
