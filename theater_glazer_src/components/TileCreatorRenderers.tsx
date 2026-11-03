import React, { useRef, useEffect, useMemo, useState } from 'react';
import { TmpParser, Tile, RGB } from '../lib/formats';
import { cn } from '../lib/utils';

/* Dynamic sub-elements for fast pixel canvas updates */
interface TilePixelsRendererProps {
  tile: Tile;
  palette: RGB[];
  width: number;
  height: number;
}
export function TilePixelsRenderer({ tile, palette, width, height }: TilePixelsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(width, height);
    const data32 = new Uint32Array(imgData.data.buffer);

    const maxPixels = Math.min(tile.data.length, data32.length);
    for (let i = 0; i < maxPixels; i++) {
      const idx = tile.data[i];
      if (idx === 0) {
        data32[i] = 0; // Transparent
      } else {
        const c = palette[idx] || { r: 128, g: 128, b: 128 };
        data32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);

  }, [tile.data, palette, width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="absolute inset-0 w-full h-full image-render-pixelated bg-emerald-500/2 animate-in fade-in duration-200" 
    />
  );
}

interface ExtraPixelsRendererProps {
  pixels: Uint8Array;
  palette: RGB[];
  w: number;
  h: number;
}
export function ExtraPixelsRenderer({ pixels, palette, w, h }: ExtraPixelsRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(w, h);
    const data32 = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < pixels.length; i++) {
      const idx = pixels[i];
      if (idx === 0) {
        data32[i] = 0; // transparent
      } else {
        const c = palette[idx] || { r: 200, g: 100, b: 100 };
        data32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
      }
    }

    ctx.putImageData(imgData, 0, 0);

  }, [pixels, palette, w, h]);

  return (
    <canvas 
      ref={canvasRef} 
      width={w} 
      height={h} 
      className="w-full h-full image-render-pixelated animate-in fade-in duration-200" 
    />
  );
}

/* Embedded Micro Interactive paint canvas */
interface MiniPixelPainterProps {
  tile: Tile;
  layer: 'base' | 'extra';
  drawMode: 'color' | 'z-depth';
  palette: RGB[];
  colorValue: number;
  depthValue: number;
  brush: number;
  onPaint: (x: number, y: number, erase?: boolean) => void;
  onStartPaint?: () => void;
}
export function MiniPixelPainter({ 
  tile, 
  layer, 
  drawMode, 
  palette, 
  colorValue, 
  depthValue, 
  brush, 
  onPaint,
  onStartPaint
}: MiniPixelPainterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const tileW = Math.max(1, layer === 'base' ? tile.cx : (tile.header.cx_extra || 1));
  const tileH = Math.max(1, layer === 'base' ? tile.cy : (tile.header.cy_extra || 1));

  const dataToUse = useMemo(() => {
    if (layer === 'base') {
      return drawMode === 'color' ? tile.data : (tile.zData || new Uint8Array(tileW * tileH));
    } else {
      const extraSize = tileW * tileH;
      return drawMode === 'color' 
        ? (tile.extraImageData || new Uint8Array(extraSize)) 
        : (tile.extraZData || new Uint8Array(extraSize));
    }
  }, [tile, layer, drawMode, tileW, tileH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (tileW <= 0 || tileH <= 0 || isNaN(tileW) || isNaN(tileH)) return;
    const imgData = ctx.createImageData(tileW, tileH);
    const data32 = new Uint32Array(imgData.data.buffer);

    for (let i = 0; i < Math.min(data32.length, dataToUse.length); i++) {
      const idx = dataToUse[i];
      if (layer === 'base') {
        const ly = Math.floor(i / tileW);
        const lx = i % tileW;
        const inside = TmpParser.isInsideWestwoodDiamond(lx, ly, tileW, tileH);
        if (!inside) {
          data32[i] = 0; // stay transparent
          continue;
        }
      }

      if (idx === 0) {
        data32[i] = 0; // Transparent mask overlay
      } else if (drawMode === 'z-depth') {
        const value = Math.min(255, idx);
        // Amber depth level visual mapping
        data32[i] = (255 << 24) | (20 << 16) | (value << 8) | (value);
      } else {
        const c = palette[idx] || { r: 120, g: 120, b: 120 };
        data32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
      }
    }

    ctx.putImageData(imgData, 0, 0);

  }, [dataToUse, palette, tileW, tileH, drawMode, layer]);

  const handleInteract = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = tileW / rect.width;
    const scaleY = tileH / rect.height;

    const pxX = Math.floor((e.clientX - rect.left) * scaleX);
    const pxY = Math.floor((e.clientY - rect.top) * scaleY);

    if (pxX >= 0 && pxX < tileW && pxY >= 0 && pxY < tileH) {
      onPaint(pxX, pxY, e.shiftKey); // shift-click to Erase color from diamond
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas 
        ref={canvasRef}
        width={tileW}
        height={tileH}
        onMouseDown={(e) => {
          if (onStartPaint) {
            onStartPaint();
          }
          setIsMouseDown(true);
          handleInteract(e);
        }}
        onMouseMove={(e) => {
          if (isMouseDown) handleInteract(e);
        }}
        onMouseUp={() => setIsMouseDown(false)}
        onMouseLeave={() => setIsMouseDown(false)}
        className="max-w-full max-h-full aspect-auto image-render-pixelated border border-slate-700 bg-slate-950 cursor-pencil shadow-md shadow-black/30"
        style={{
          width: tileW > tileH ? '100%' : 'auto',
          height: tileH >= tileW ? '100%' : 'auto'
        }}
      />
      <div className="absolute top-1.5 right-1.5 pointer-events-none text-[8px] font-black text-slate-400 bg-black/80 px-1.5 py-0.5 hover:text-white rounded uppercase tracking-wider font-mono shadow-sm transition-colors border border-slate-800">
        Shift-click: Erase
      </div>
    </div>
  );
}
