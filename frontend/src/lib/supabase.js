import { createClient } from '@supabase/supabase-js';
import { localSupabase } from './localClient.js';

const url  = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Bascule automatique : placeholder ou URL manquante → client local (localStorage).
// Dès qu'une vraie URL Supabase est renseignée, on utilise le vrai client.
const useLocal = !url || !anon || /placeholder|example/i.test(url);

if (useLocal) {
  // eslint-disable-next-line no-console
  console.info('[IEF] Mode local actif (localStorage). Renseigner VITE_SUPABASE_URL dans .env.local pour basculer sur Supabase.');
}

export const supabase = useLocal
  ? localSupabase
  : createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });

export const PHOTOS_BUCKET = 'photos';
