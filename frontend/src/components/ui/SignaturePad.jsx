import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

// Zone de signature tactile. Expose onSign(dataUrl) quand la signature est
// confirmée, et onClear() pour repartir. Utilise pointer events pour
// supporter souris + touch + stylet sans différence.
export default function SignaturePad({ onSign, onClear, width = 480, height = 180 }) {
  const canvasRef = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f1117';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  let drawing = false;
  const onDown = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.target.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const onUp = () => { drawing = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onClear?.();
  };

  const confirm = () => {
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSign?.(dataUrl);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none block"
          style={{ aspectRatio: `${width} / ${height}` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn btn-ghost" onClick={clear}>
          <RotateCcw size={14} /> Effacer
        </button>
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={!hasInk}>
          Valider la signature
        </button>
      </div>
    </div>
  );
}
