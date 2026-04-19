import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { session, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="h-7 w-7 rounded bg-accent" />
          <h1 className="text-lg font-semibold">IEF Audit</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label>Email</label>
            <input type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1" autoComplete="email" />
          </div>
          <div>
            <label>Mot de passe</label>
            <input type="password" required value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>
          {err && <p className="text-sm text-bad">{err}</p>}
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full mt-4 text-sm text-muted hover:text-text"
        >
          {mode === 'signin' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  );
}
