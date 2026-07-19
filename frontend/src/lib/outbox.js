// Outbox offline — file d'écritures persistée en IndexedDB, rejouée
// automatiquement au retour du réseau (ordre de mission n°2, chantier 3.2).
//
// Principe :
//   - quand navigator.onLine === false, les mutations (équipements, photos,
//     rapports, snapshots) sont mises en file ici au lieu de partir vers
//     Supabase ; l'UI reçoit une ligne optimiste marquée `sync_pending: true`
//     (marqueur purement client, retiré du payload avant rejeu) ;
//   - au retour du réseau (événement `online`) ou au retour de l'app au
//     premier plan (`visibilitychange`), la file est rejouée dans l'ordre
//     d'enfilement (FIFO).
//
// Stratégie de conflit (documentée, volontairement simple) :
//   LAST-WRITE-WINS — les écritures rejouées écrasent l'état serveur, y
//   compris si une autre session a modifié la même ligne entre-temps.
//   Le rejeu conserve l'ordre chronologique local (queued_at) ; en cas
//   d'échec d'une opération, le flush s'arrête pour préserver l'ordre et
//   retentera au prochain déclencheur. Pas de merge champ à champ : le
//   dernier écrivain gagne, ce qui est acceptable pour un usage terrain
//   mono-technicien par équipement.
//
// Types d'opérations :
//   { kind: 'db',           table, op: 'insert'|'update'|'delete', payload, match }
//   { kind: 'photo-upload', path, contentType, row }   (blob dans le store 'fichiers')
//   { kind: 'storage-remove', path }

import { supabase, PHOTOS_BUCKET } from './supabase.js';
import { idbPut, idbGet, idbGetAll, idbCount, idbDelete } from './idb.js';

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// ============================================================
// État observable (pour useSyncStatus / SyncBadge)
// ============================================================
let status = { offline: isOffline(), pending: 0, syncing: false, lastError: null };
const listeners = new Set();

export function getStatus() { return status; }
export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function setStatus(patch) {
  status = { ...status, ...patch };
  for (const cb of listeners) cb(status);
}
async function refreshPending() {
  try {
    const pending = await idbCount('outbox');
    setStatus({ pending, offline: isOffline() });
  } catch { /* IndexedDB indisponible : on reste silencieux */ }
}

// ============================================================
// Enfilement
// ============================================================
export async function enqueue(op) {
  const entry = { id: uuid(), queued_at: new Date().toISOString(), attempts: 0, ...op };
  await idbPut('outbox', entry);
  await refreshPending();
  return entry;
}

// Enfile un upload photo complet : le blob est persisté en IndexedDB
// (clé = storage_path), l'insert de la ligne `photos` suit l'upload au rejeu.
export async function enqueuePhotoUpload({ path, blob, row }) {
  await idbPut('fichiers', blob, path);
  return enqueue({ kind: 'photo-upload', path, contentType: blob.type || 'image/jpeg', row });
}

function stripClientFlags(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const rest = { ...payload };
  delete rest.sync_pending; // marqueur purement client, jamais envoyé au serveur
  return rest;
}

// ============================================================
// Rejeu
// ============================================================
async function applyOp(op) {
  if (op.kind === 'db') {
    let q = supabase.from(op.table);
    if (op.op === 'insert') {
      q = q.insert(stripClientFlags(op.payload));
    } else if (op.op === 'update') {
      q = q.update(stripClientFlags(op.payload));
      for (const [col, val] of Object.entries(op.match ?? {})) q = q.eq(col, val);
    } else if (op.op === 'delete') {
      q = q.delete();
      for (const [col, val] of Object.entries(op.match ?? {})) q = q.eq(col, val);
    } else {
      throw new Error(`Opération inconnue : ${op.op}`);
    }
    const { error } = await q;
    if (error) throw new Error(error.message);
    return;
  }

  if (op.kind === 'photo-upload') {
    const blob = await idbGet('fichiers', op.path);
    if (blob) {
      const up = await supabase.storage.from(PHOTOS_BUCKET).upload(op.path, blob, {
        cacheControl: '3600',
        contentType: op.contentType,
      });
      // "already exists" = rejeu partiel précédent : l'upload a déjà réussi.
      if (up.error && !/exist/i.test(up.error.message ?? '')) throw new Error(up.error.message);
    }
    const { error } = await supabase.from('photos').insert(stripClientFlags(op.row));
    if (error && !/duplicate|already exists/i.test(error.message ?? '')) throw new Error(error.message);
    await idbDelete('fichiers', op.path);
    return;
  }

  if (op.kind === 'storage-remove') {
    const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove([op.path]);
    if (error) throw new Error(error.message);
    return;
  }

  throw new Error(`Type d'opération inconnu : ${op.kind}`);
}

let flushing = false;

export async function flush() {
  if (flushing || isOffline()) { setStatus({ offline: isOffline() }); return; }
  flushing = true;
  setStatus({ syncing: true, offline: false });
  try {
    const ops = (await idbGetAll('outbox'))
      .sort((a, b) => (a.queued_at < b.queued_at ? -1 : a.queued_at > b.queued_at ? 1 : 0));
    for (const op of ops) {
      try {
        await applyOp(op);
        await idbDelete('outbox', op.id);
        setStatus({ lastError: null });
      } catch (e) {
        // Échec : on garde l'opération et on ARRÊTE pour préserver l'ordre.
        op.attempts = (op.attempts ?? 0) + 1;
        op.last_error = e.message ?? String(e);
        await idbPut('outbox', op);
        setStatus({ lastError: op.last_error });
        break;
      }
    }
  } finally {
    flushing = false;
    setStatus({ syncing: false });
    await refreshPending();
  }
}

// ============================================================
// Initialisation (appelée une fois depuis main.jsx)
// ============================================================
let initialized = false;

export function initOutbox() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online',  () => { setStatus({ offline: false }); flush(); });
  window.addEventListener('offline', () => setStatus({ offline: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
  refreshPending().then(() => flush());
}
