import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RGB } from '../../lib/formats';
import { ZToolMode, ZDisplayMode } from './types';
import { getZColor, blendOverlay } from './zColorMap';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZCanvasProps {
  width: number;
  height: number;
  zData: Uint8Array | null;
  pixelData: Uint8Array | null;
  palette: RGB[] | null;
  maxEngineZ: number;
  toolMode: ZToolMode;
  displayMode: ZDisplayMode;
  brushSize: number;
  targetZValue: number;
  onSampleZ: (val: number) => void;
  onModifyPixel: (x: number, y: number) => void;
  onModifyColumn: (colX: number) => void;
}

export const ZCanvas: React.FC<ZCanvasProps> = ({
  width,
  height,
  zData,
  pixelData,
  palette,
  maxEngineZ,
  toolMode,
  displayMode,
  brushSize,
  targetZValue,
  onSampleZ,
  onModifyPixel,
  onModifyColumn
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(8);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number; z: number; colorIdx: number } | null>(null);

  // Center the image initially or on dimension change
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (rect.width - width * zoom) / 2;
    const cy = (rect.height - height * zoom) / 2;
    setPan({ x: Math.round(cx), y: Math.round(cy) });
  }, [width, height]);

  // Render pixels onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(width, height);
    const d32 = new Uint32Array(imgData.data.buffer);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        const z = zData ? zData[idx] : 0;
        const pIdx = pixelData ? pixelData[idx] : 0;
        const color = (palette && pIdx !== 0) ? palette[pIdx] : null;

        let r = 0, g = 0, b = 0, a = 0;

        if (displayMode === 'overlay') {
          [r, g, b, a] = blendOverlay(color, z, maxEngineZ);
        } else {
          [r, g, b, a] = getZColor(z, maxEngineZ, displayMode);
          // If no Z and no pixel, show dark checker
          if (z === 0 && pIdx === 0) {
            a = 0;
          } else if (z === 0 && pIdx > 0) {
            // Pixel exists but has 0 Z (draw subtle dark gray)
            r = 30; g = 30; b = 30; a = 200;
          }
        }

        d32[idx] = (a << 24) | (b << 16) | (g << 8) | r;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [width, height, zData, pixelData, palette, maxEngineZ, displayMode]);

  // Mouse to Canvas Pixel coordinates
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - pan.x;
    const mouseY = e.clientY - rect.top - pan.y;

    const px = Math.floor(mouseX / zoom);
    const py = Math.floor(mouseY / zoom);

    if (px < 0 || px >= width || py < 0 || py >= height) {
      return null;
    }
    return { px, py };
  }, [pan, zoom, width, height]);

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Middle click or space+click for panning
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    const { px, py } = coords;
    const idx = py * width + px;
    const currentZ = zData ? zData[idx] : 0;

    if (toolMode === 'inspect') {
      onSampleZ(currentZ);
    } else if (toolMode === 'column') {
      onModifyColumn(px);
      setIsDrawing(true);
    } else if (toolMode === 'brush') {
      onModifyPixel(px, py);
      setIsDrawing(true);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
      return;
    }

    const coords = getCanvasCoords(e);
    if (coords) {
      const { px, py } = coords;
      const idx = py * width + px;
      const z = zData ? zData[idx] : 0;
      const colorIdx = pixelData ? pixelData[idx] : 0;
      setHoverPixel({ x: px, y: py, z, colorIdx });

      if (isDrawing) {
        if (toolMode === 'brush') {
          onModifyPixel(px, py);
        } else if (toolMode === 'column') {
          onModifyColumn(px);
        }
      }
    } else {
      setHoverPixel(null);
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setIsDrawing(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    setZoom((prev) => Math.min(32, Math.max(2, prev + delta)));
  };

  const resetView = () => {
    setZoom(8);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: Math.round((rect.width - width * 8) / 2),
        y: Math.round((rect.height - height * 8) / 2)
      });
    }
  };

  return (
    <div className="relative flex-1 bg-slate-950 overflow-hidden flex flex-col select-none">
      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-crosshair"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => {
          handlePointerUp();
          setHoverPixel(null);
        }}
        onWheel={handleWheel}
      >
        {/* Checkerboard Background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #334155 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
        />

        {/* Scaled Canvas Container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            width: `${width * zoom}px`,
            height: `${height * zoom}px`,
            imageRendering: 'pixelated'
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full shadow-2xl border border-slate-800"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Hover highlight box */}
          {hoverPixel && (
            <div
              className="absolute border border-white/80 pointer-events-none"
              style={{
                left: `${hoverPixel.x * zoom}px`,
                top: `${hoverPixel.y * zoom}px`,
                width: `${zoom}px`,
                height: `${zoom}px`,
                boxShadow: '0 0 4px rgba(255,255,255,0.8)'
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Info & Zoom Controls */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-4 text-xs shadow-lg">
        {hoverPixel ? (
          <div className="flex items-center gap-3 font-mono">
            <span className="text-slate-400">X: <strong className="text-white">{hoverPixel.x}</strong></span>
            <span className="text-slate-400">Y: <strong className="text-white">{hoverPixel.y}</strong></span>
            <span className="text-sky-400">Z: <strong className="text-sky-300">{hoverPixel.z}</strong></span>
            <span className="text-slate-400">PAL: <strong className="text-amber-300">{hoverPixel.colorIdx}</strong></span>
          </div>
        ) : (
          <span className="text-slate-500 italic">Hover pixel to inspect Z</span>
        )}
      </div>

      {/* Bottom Right Zoom controls */}
      <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 flex items-center gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(2, z - 2))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-slate-400 px-1">{zoom}x</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(32, z + 2))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
