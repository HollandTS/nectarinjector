import React, { useRef, useEffect } from 'react';
import { TmpFile, TmpParser, RGB } from '../lib/formats';
import { ShpFile } from '../lib/shp';
import { cn } from '../lib/utils';

interface CanvasSidebarItemProps {
  name: string;
  fileType: 'TMP' | 'SHP';
  content: TmpFile | ShpFile;
  palette: RGB[];
  isActive: boolean;
  onClick: () => void;
  onPlaceClick: () => void;
  onDelete: () => void;
}

export const CanvasSidebarItem: React.FC<CanvasSidebarItemProps> = React.memo(({
  name,
  fileType,
  content,
  palette,
  isActive,
  onClick,
  onPlaceClick,
  onDelete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !palette || palette.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (fileType === 'TMP') {
      const tmp = content as TmpFile;
      TmpParser.renderCompleteToCanvas(canvas, tmp, palette, false);
    } else {
      const shp = content as ShpFile;
      if (shp.frames && shp.frames.length > 0) {
        const frame = shp.frames[0];
        canvas.width = frame.w;
        canvas.height = frame.h;
        
        const imgData = ctx.createImageData(frame.w, frame.h);
        const data32 = new Uint32Array(imgData.data.buffer);
        const p32 = palette.map(c => (255 << 24) | (c.b << 16) | (c.g << 8) | c.r);
        
        for (let i = 0; i < frame.data.length; i++) {
          const idx = frame.data[i];
          data32[i] = idx === 0 ? 0 : p32[idx];
        }
        ctx.putImageData(imgData, 0, 0);
      } else {
        canvas.width = 16;
        canvas.height = 16;
      }
    }

    return () => {
      canvas.width = 1;
      canvas.height = 1;
    };
  }, [content, fileType, palette]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      onClick={onPlaceClick}
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group cursor-grab active:cursor-grabbing p-1.5 rounded-md border select-none transition-all flex flex-col items-center gap-1.5 bg-slate-900/40 hover:bg-slate-900/80 relative text-center",
        isActive
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-slate-850 hover:border-slate-800"
      )}
      title={`Drag onto board or click to select stamp tool: ${name}`}
    >
      {/* Title block */}
      <div className="w-full flex items-center justify-between gap-1 px-0.5 min-w-0">
        <span className="text-[9px] font-extrabold truncate text-slate-400 group-hover:text-slate-200">
          {name}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-[11px] text-slate-500 hover:text-red-400 p-0 leading-none cursor-pointer"
          title="Remove file"
        >
          ×
        </button>
      </div>

      {/* Embedded canvas thumbnail space */}
      <div className="bg-checkered aspect-video w-full rounded border border-slate-950 flex items-center justify-center p-0.5 overflow-hidden bg-slate-950/60 min-h-[44px]">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[44px] image-pixelated pointer-events-none select-none"
        />
      </div>
    </div>
  );
});
