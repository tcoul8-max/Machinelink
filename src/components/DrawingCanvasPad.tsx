import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Eraser, RotateCcw, Check, Palette } from 'lucide-react';

interface DrawingCanvasPadProps {
  onSave: (dataUrl: string) => void;
  initialDataUrl?: string;
  height?: number;
}

export const DrawingCanvasPad: React.FC<DrawingCanvasPadProps> = ({
  onSave,
  initialDataUrl,
  height = 200,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState<string>('#003366'); // Dark Navy default
  const [penLineWidth, setPenLineWidth] = useState<number>(2.5);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [hasDrawing, setHasDrawing] = useState<boolean>(!!initialDataUrl);

  const colors = [
    { name: 'Navy Blue', hex: '#003366' },
    { name: 'Black', hex: '#1e293b' },
    { name: 'Crimson Red', hex: '#dc2626' },
    { name: 'Amber', hex: '#d97706' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? 16 : penLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    setIsDrawing(true);
    setHasDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    setHasDrawing(false);
    onSave('');
  };

  return (
    <div className="space-y-2">
      {/* Drawing Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-amber-500" /> Pen Ink:
          </span>

          <div className="flex items-center gap-1">
            {colors.map(c => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  setPenColor(c.hex);
                  setIsEraser(false);
                }}
                className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                  !isEraser && penColor === c.hex ? 'scale-110 border-slate-900 dark:border-white shadow-md' : 'border-transparent opacity-80'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Stroke Widths */}
          <div className="flex items-center gap-1">
            {[1.5, 3, 6].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setPenLineWidth(w);
                  setIsEraser(false);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  !isEraser && penLineWidth === w ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {w === 1.5 ? 'Fine' : w === 3 ? 'Medium' : 'Thick'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEraser(!isEraser)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              isEraser ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" /> Eraser
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Canvas Area with Lined Notebook Paper Background */}
      <div
        ref={containerRef}
        className="relative rounded-2xl border-2 border-slate-400/60 dark:border-slate-700 touch-none overflow-hidden bg-[#faf8f5] dark:bg-slate-950 shadow-inner"
        style={{ height: `${height}px` }}
      >
        {/* Notebook horizontal rules background effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
          style={{
            backgroundImage: 'linear-gradient(to bottom, transparent 23px, #cbd5e1 24px)',
            backgroundSize: '100% 24px',
          }}
        />

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair block relative z-10"
        />

        {!hasDrawing && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-wider gap-2">
            <Pencil className="w-4 h-4 text-amber-500" />
            Draw or write notes directly on docket sheet using finger / stylus
          </div>
        )}

        {hasDrawing && (
          <div className="absolute top-2 right-2 z-20 bg-emerald-500/90 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md">
            <Check className="w-3 h-3 stroke-[3]" /> Annotation Layer Active
          </div>
        )}
      </div>
    </div>
  );
};
