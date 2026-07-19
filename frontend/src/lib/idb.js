// Encapsulation minimale d'IndexedDB (API native, aucune dépendance).
// Base "ief-offline" avec deux stores :
//   - outbox   : opérations d'écriture en attente de synchronisation (keyPath id)
//   - fichiers : blobs (photos) en attente d'upload, clé = storage_path
//
// Toutes les fonctions retournent des Promises.

const DB_NAME    = 'ief-offline';
const DB_VERSION = 1;

let dbPromise = null;

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fichiers')) {
          db.createObjectStore('fichiers');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export const idbPut    = (store, value, key) => run(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)));
export const idbGet    = (store, key)        => run(store, 'readonly',  (s) => s.get(key));
export const idbGetAll = (store)             => run(store, 'readonly',  (s) => s.getAll());
export const idbCount  = (store)             => run(store, 'readonly',  (s) => s.count());
export const idbDelete = (store, key)        => run(store, 'readwrite', (s) => s.delete(key));
export const idbClear  = (store)             => run(store, 'readwrite', (s) => s.clear());
