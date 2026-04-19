// Drop-in local pour Supabase : backed par localStorage.
// Actif automatiquement quand VITE_SUPABASE_URL est absent ou placeholder.
//
// Persistance : localStorage sous le prefix "ief:". Les photos sont stockées
// sous forme de data URLs (~5 MB total de localStorage → ~15-30 photos).
//
// Reset complet : ouvrir la console et taper __ief_reset()

const PREFIX    = 'ief:';
const TABLES    = ['organisations', 'users', 'sites', 'equipements', 'photos', 'rapports'];
const PHOTOS_K  = PREFIX + 'storage:photos';
const CURRENT_U = PREFIX + 'currentUserId';

function load(table) {
  const raw = localStorage.getItem(PREFIX + table);
  return raw ? JSON.parse(raw) : [];
}
function save(table, rows) {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows));
}
function now() { return new Date().toISOString(); }
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ============================================================
// Bootstrap : crée org + user par défaut si premier démarrage
// ============================================================
function bootstrap() {
  if (load('organisations').length > 0) return;
  const orgId  = uuid();
  const userId = uuid();
  save('organisations', [{ id: orgId, name: 'IEF & CO (dev local)', created_at: now() }]);
  save('users', [{
    id: userId,
    email: 'dev@local',
    role: 'admin',
    organisation_id: orgId,
    created_at: now(),
  }]);
  localStorage.setItem(CURRENT_U, userId);
}
bootstrap();

if (typeof window !== 'undefined') {
  window.__ief_reset = () => {
    TABLES.forEach((t) => localStorage.removeItem(PREFIX + t));
    localStorage.removeItem(PHOTOS_K);
    localStorage.removeItem(CURRENT_U);
    bootstrap();
    // eslint-disable-next-line no-console
    console.log('[IEF] Données locales remises à zéro. Recharge la page.');
  };
}

// ============================================================
// Query builder (sélections, insertions, mises à jour)
// ============================================================

function parseRelations(cols) {
  const out = [];
  const re = /(\w+)\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(cols)) !== null) {
    out.push({ table: m[1], cols: m[2].split(',').map((s) => s.trim()) });
  }
  return out;
}

function expandRelations(row, relations, parentTable) {
  const out = { ...row };
  for (const { table, cols } of relations) {
    if (table === 'equipements' && parentTable === 'sites') {
      const children = load('equipements').filter((e) => e.site_id === row.id);
      if (cols.length === 1 && cols[0] === 'count') {
        out[table] = [{ count: children.length }];
      } else {
        out[table] = children;
      }
    } else if (table === 'photos') {
      out[table] = load('photos').filter((p) => p.equipement_id === row.id);
    } else if (table === 'organisations') {
      const org = load('organisations').find((o) => o.id === row.organisation_id);
      out[table] = org ? { name: org.name } : null;
    }
  }
  return out;
}

function from(table) {
  const q = {
    table,
    filters: [],
    orderSpec: null,
    relations: [],
    isCount: false,
    isHead: false,
    mode: 'select',
    insertRows: null,
    updatePatch: null,
  };
  return makeBuilder(q);
}

function makeBuilder(q) {
  const run = () => Promise.resolve(execute(q));
  return {
    select(cols = '*', opts = {}) {
      if (q.mode === 'select') {
        if (opts.count === 'exact') q.isCount = true;
        if (opts.head === true)     q.isHead  = true;
        q.relations = parseRelations(cols);
      }
      return makeBuilder(q);
    },
    insert(payload) {
      q.mode = 'insert';
      q.insertRows = Array.isArray(payload) ? payload : [payload];
      return makeBuilder(q);
    },
    update(patch) {
      q.mode = 'update';
      q.updatePatch = patch;
      return makeBuilder(q);
    },
    delete() {
      q.mode = 'delete';
      return makeBuilder(q);
    },
    eq(col, val) {
      q.filters.push((r) => r[col] === val);
      return makeBuilder(q);
    },
    order(col, { ascending = true } = {}) {
      q.orderSpec = { col, ascending };
      return makeBuilder(q);
    },
    single() {
      return run().then((res) => {
        if (!Array.isArray(res.data)) return res;
        return {
          data: res.data[0] ?? null,
          error: res.data[0] ? null : { message: 'PGRST116: No rows found' },
        };
      });
    },
    maybeSingle() {
      return run().then((res) => {
        if (!Array.isArray(res.data)) return res;
        return { data: res.data[0] ?? null, error: null };
      });
    },
    then(onFulfilled, onRejected) {
      return run().then(onFulfilled, onRejected);
    },
  };
}

function execute(q) {
  switch (q.mode) {
    case 'select': return runSelect(q);
    case 'insert': return runInsert(q);
    case 'update': return runUpdate(q);
    case 'delete': return runDelete(q);
    default: return { data: null, error: { message: 'mode inconnu' } };
  }
}

function runSelect(q) {
  let rows = load(q.table);
  for (const f of q.filters) rows = rows.filter(f);
  if (q.orderSpec) {
    const { col, ascending } = q.orderSpec;
    rows = rows.slice().sort((a, b) => {
      const x = a[col] ?? ''; const y = b[col] ?? '';
      return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
    });
  }
  if (q.relations.length && !q.isHead) {
    rows = rows.map((r) => expandRelations(r, q.relations, q.table));
  }
  if (q.isHead)  return { data: null, count: rows.length, error: null };
  if (q.isCount) return { data: rows, count: rows.length, error: null };
  return { data: rows, error: null };
}

function runInsert(q) {
  const current = load(q.table);
  const rows = q.insertRows.map((r) => {
    const base = { id: r.id ?? uuid(), created_at: r.created_at ?? now(), ...r };
    if (q.table === 'sites' || q.table === 'equipements') {
      base.updated_at = r.updated_at ?? now();
    }
    // Ne pas écraser id si déjà défini dans payload
    if (!r.id) base.id = base.id || uuid();
    return base;
  });
  save(q.table, [...current, ...rows]);
  return { data: rows, error: null };
}

function runUpdate(q) {
  const current = load(q.table);
  const updated = [];
  const next = current.map((r) => {
    if (q.filters.every((f) => f(r))) {
      const u = { ...r, ...q.updatePatch, updated_at: now() };
      updated.push(u);
      return u;
    }
    return r;
  });
  save(q.table, next);
  return { data: updated, error: null };
}

function runDelete(q) {
  const current = load(q.table);
  const kept = current.filter((r) => !q.filters.every((f) => f(r)));
  save(q.table, kept);
  return { data: null, error: null };
}

// ============================================================
// Auth (mock : une seule session, jamais déconnecté)
// ============================================================
const auth = {
  async getSession() {
    const userId = localStorage.getItem(CURRENT_U);
    if (!userId) return { data: { session: null }, error: null };
    const user = load('users').find((u) => u.id === userId);
    if (!user) return { data: { session: null }, error: null };
    return { data: { session: { user: { id: user.id, email: user.email } } }, error: null };
  },
  onAuthStateChange() {
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signInWithPassword() {
    return { data: { session: null, user: null }, error: { message: 'Mode local — auth inactive.' } };
  },
  async signUp() {
    return { data: { session: null, user: null }, error: { message: 'Mode local — auth inactive.' } };
  },
  async signOut() {
    return { error: null };
  },
};

// ============================================================
// Storage (photos stockées en data URL dans localStorage)
// ============================================================
function loadPhotoStore() {
  const raw = localStorage.getItem(PHOTOS_K);
  return raw ? JSON.parse(raw) : {};
}
function savePhotoStore(store) {
  localStorage.setItem(PHOTOS_K, JSON.stringify(store));
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function bucket(_name) {
  return {
    async upload(path, blob) {
      try {
        const dataUrl = await blobToDataUrl(blob);
        const store = loadPhotoStore();
        store[path] = dataUrl;
        savePhotoStore(store);
        return { data: { path }, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message || 'Upload échoué' } };
      }
    },
    async createSignedUrl(path) {
      const store = loadPhotoStore();
      const url = store[path];
      if (!url) return { data: null, error: { message: 'Photo introuvable en local' } };
      return { data: { signedUrl: url }, error: null };
    },
    async remove(paths) {
      const store = loadPhotoStore();
      for (const p of paths) delete store[p];
      savePhotoStore(store);
      return { data: null, error: null };
    },
  };
}

// ============================================================
// Export
// ============================================================
export const localSupabase = {
  auth,
  from,
  storage: { from: bucket },
};
