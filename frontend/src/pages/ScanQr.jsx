import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle, ArrowLeft } from 'lucide-react';

// Scanner QR via la caméra (BarcodeDetector natif). Supporté sur Chrome/Edge
// Android + desktop récent. Fallback : invite à saisir l'URL manuellement
// ou à utiliser l'app caméra du téléphone (qui reconnaît les QR nativement
// depuis iOS 11 / Android 9).
export default function ScanQr() {
  const videoRef  = useRef(null);
  const [state, setState] = useState('idle'); // idle | running | error | unsupported
  const [error, setError] = useState(null);
  const nav = useNavigate();

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) { setState('unsupported'); return; }
    let stream = null;
    let raf = 0;
    let detector = null;

    async function start() {
      try {
        // eslint-disable-next-line no-undef
        detector = new BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState('running');
        tick();
      } catch (e) {
        setError(e.message); setState('error');
      }
    }

    async function tick() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        raf = requestAnimationFrame(tick); return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          const value = codes[0].rawValue;
          handleResult(value);
          return;
        }
      } catch { /* ignore transient detection errors */ }
      raf = requestAnimationFrame(tick);
    }

    function handleResult(value) {
      try {
        const url = new URL(value, window.location.origin);
        // Si c'est un QR produit par cette app, on navigue dans l'app.
        if (url.origin === window.location.origin) {
          nav(url.pathname + url.search);
          return;
        }
        // Sinon on ouvre le lien externe.
        window.location.href = url.toString();
      } catch {
        alert('QR détecté : ' + value);
      }
    }

    start();

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [supported, nav]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" onClick={() => nav(-1)}>
          <ArrowLeft size={16} /> Retour
        </button>
        <h1 className="text-xl font-semibold">Scanner QR équipement</h1>
      </div>

      {state === 'unsupported' && (
        <div className="card p-6 text-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-warn shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Scanner non disponible</div>
              <p className="text-muted mt-1">
                Ton navigateur ne supporte pas la détection native de QR codes
                (BarcodeDetector API). Astuce : sur mobile, ouvre simplement
                l'app caméra du téléphone, pointe-la sur le QR, le lien s'ouvrira
                directement dans le navigateur.
              </p>
            </div>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="card p-6 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-bad shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Accès caméra refusé</div>
              <p className="text-muted mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'running') && supported && (
        <div className="card overflow-hidden">
          <div className="relative bg-black aspect-[3/4] md:aspect-video">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-accent/60 rounded-lg"
                   style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80 flex items-center justify-center gap-1">
              <Camera size={12} /> Cadre un QR pour ouvrir la fiche
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
