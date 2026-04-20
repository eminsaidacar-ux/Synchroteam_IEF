import { useEffect, useRef, useState } from 'react';
import { Pen, Circle, ArrowUpRight, Eraser, Trash2 } from 'lucide-react';

// Canvas d'annotation superposé à une image figée. Outils : stylo libre,
// cercle, flèche, gomme. Toutes les lignes sont redessinées à chaque
// render pour permettre undo (non implémenté) + export propre.

const TOOLS = [
  { key: 'pen',    icon: Pen,          label: 'Stylo' },
  { key: 'circle', icon: Circle,       label: 'Cercle' },
  { key: 'arrow',  icon: ArrowUpRight, label: 'Flèche' },
];
const COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#0a84ff', '#ffffff'];

export default function AnnotationCanvas({ imageUrl, onExport, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [tool,  setTool]  = useState('pen');
  const [color, setColor] = useState('#ff453a');
  const [strokes, setStrokes] = useState([]);
  const [current, setCurrent] = useState(null);

  // Redessine tout.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of [...strokes, current].filter(Boolean)) drawStroke(ctx, s);
  }, [strokes, current, imageUrl]);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  const onDown = (e) => {
    e.preventDefault();
    const p = pos(e);
    setCurrent({ tool, color, points: [p] });
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!current) return;
    const p = pos(e);
    setCurrent((c) => ({ ...c, points: [...c.points, p] }));
  };
  const onUp = () => {
    if (!current) return;
    setStrokes((s) => [...s, current]);
    setCurrent(null);
  };

  function drawStroke(ctx, s) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle   = s.color;
    ctx.lineWidth   = 6;
    const pts = s.points;
    if (pts.length === 0) return;
    if (s.tool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (s.tool === 'circle') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.tool === 'arrow') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      // Pointe de flèche
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const len = 20;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - len * Math.cos(angle - Math.PI / 6), b.y - len * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(b.x - len * Math.cos(angle + Math.PI / 6), b.y - len * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }

  const clearAll = () => { setStrokes([]); setCurrent(null); };

  const exportImage = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => onExport?.(blob), 'image/jpeg', 0.85);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex flex-col animate-fade-in">
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <div className="text-sm font-medium">Annoter la capture</div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        <button className="btn btn-primary btn-sm" onClick={exportImage}>Enregistrer</button>
      </div>

      <div className="flex-1 overflow-auto p-4 grid place-items-center">
        <div className="relative max-w-full max-h-full">
          <img ref={imgRef} src={imageUrl} alt="" style={{ display: 'none' }} onLoad={() => setStrokes((s) => [...s])} />
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[80vh] rounded-lg border border-white/10 touch-none bg-black"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          />
        </div>
      </div>

      <div className="p-3 border-t border-white/10 flex items-center justify-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTool(t.key)}
              title={t.label}
              className={`btn btn-sm ${tool === t.key ? 'btn-primary' : ''}`}
            >
              <t.icon size={14} />
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full border-2 transition"
              style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent' }}
            />
          ))}
        </div>
        <button className="btn btn-sm ml-2" onClick={clearAll}>
          <Trash2 size={14} /> Tout effacer
        </button>
      </div>
    </div>
  );
}
