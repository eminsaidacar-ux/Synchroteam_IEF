import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((opts) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, tone: 'info', duration: 3500, ...(typeof opts === 'string' ? { title: opts } : opts) };
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) setTimeout(() => dismiss(id), t.duration);
    return id;
  }, [dismiss]);

  const api = {
    toast,
    success: (o) => toast({ tone: 'success', ...(typeof o === 'string' ? { title: o } : o) }),
    error:   (o) => toast({ tone: 'error',   duration: 6000, ...(typeof o === 'string' ? { title: o } : o) }),
    info:    (o) => toast({ tone: 'info',    ...(typeof o === 'string' ? { title: o } : o) }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

function Toaster({ toasts, dismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info;
  const color =
    toast.tone === 'success' ? 'text-good' :
    toast.tone === 'error'   ? 'text-bad'  :
    'text-info';
  return (
    <div className="pointer-events-auto card-glass px-3.5 py-3 flex items-start gap-2.5 animate-slide-up min-w-[260px]">
      <Icon size={16} className={`${color} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{toast.title}</div>
        {toast.description && <div className="text-xs text-muted mt-0.5">{toast.description}</div>}
      </div>
      <button onClick={onDismiss} className="text-muted hover:text-text shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
