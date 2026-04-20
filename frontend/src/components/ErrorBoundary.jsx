import { Component } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

// ErrorBoundary global : intercepte toute exception React dans la sous-
// arborescence et affiche un écran d'erreur propre plutôt qu'un écran blanc.
// Les données locales (localStorage) restent intactes — le bouton "Réessayer"
// réinitialise juste le state React.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[IEF ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  reset = () => this.setState({ hasError: false, error: null, errorInfo: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message ?? 'Erreur inconnue';
    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="card w-full max-w-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-bad" size={28} />
            <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
          </div>
          <p className="text-sm text-muted">
            L'application a rencontré un problème. Tes données locales sont intactes
            (rien n'est perdu).
          </p>
          <pre className="text-xs text-bad bg-bg border border-border rounded p-3 overflow-x-auto">
            {msg}
          </pre>
          <div className="flex gap-2">
            <button className="btn" onClick={this.reset}>
              <RotateCcw size={14} /> Réessayer
            </button>
            <a className="btn" href="/">
              <Home size={14} /> Retour accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
