import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TmpFile, Tile, RGB, TmpParser } from '../../lib/formats';
import { isPixelOverlappingBaseTile } from '../../lib/tmpRenderer';
import { ZDisplayMode } from './types';
import { getZColor, blendOverlay } from './zColorMap';
import { ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react';

interface ZCompleteCanvasProps {
  tmpFile: TmpFile;
  palette: RGB[] | null;
  displayMode: ZDisplayMode;
  onSelectTileSlot?: (slot: number) => void;
}

interface HoverInfo {
  x: number;
  y: number;
  z: number;
  tileSlot: number | null;
  layer: 'base' | 'extra' | null;
}

export const ZCompleteCanvas: React.FC<ZCompleteCanvasProps> = ({
  tmpFile,
  palette,
  displayMode,
  onSelectTileSlot
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number>(4);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Map to store lookup info for hovered pixels
  const pixelMapRef = useRef<{
    w: number;
    h: number;
    zBuffer: Uint8Array;
    slotBuffer: Int16Array;
    layerBuffer: Uint8Array; // 1 = base, 2 = extra
  }>({
    w: 0,
    h: 0,
    zBuffer: new Uint8Array(0),
    slotBuffer: new Int16Array(0),
    layerBuffer: new Uint8Array(0)
  });

  const maxEngineZ = Math.max(1, tmpFile.cy - 1);

  // Render the complete composite onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);
    if (activeTiles.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const mult = tmpFile.cy / 2;

    activeTiles.forEach((tile) => {
      const h = tile.header;
      const elev = h.height * mult;

      minX = Math.min(minX, h.x);
      minY = Math.min(minY, h.y - elev);
      maxX = Math.max(maxX, h.x + tile.cx);
      maxY = Math.max(maxY, h.y - elev + tile.cy);

      if (h.has_extra_data) {
        minX = Math.min(minX, h.x_extra);
        minY = Math.min(minY, h.y_extra - elev);
        maxX = Math.max(maxX, h.x_extra + h.cx_extra);
        maxY = Math.max(maxY, h.y_extra - elev + h.cy_extra);
      }
    });

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0 || width > 8000 || height > 8000) return;

    canvas.width = width;
    canvas.height = height;
    setDimensions({ w: width, h: height });

    const totalPixels = width * height;
    const zMap = new Uint8Array(totalPixels);
    const slotMap = new Int16Array(totalPixels).fill(-1);
    const layerMap = new Uint8Array(totalPixels);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Draw each tile's base diamond
    activeTiles.forEach((tile) => {
      const h = tile.header;
      const elev = h.height * mult;
      const bx = h.x - minX;
      const by = h.y - elev - minY;

      const bImg = ctx.createImageData(tile.cx, tile.cy);
      const bD32 = new Uint32Array(bImg.data.buffer);

      for (let ly = 0; ly < tile.cy; ly++) {
        const rowOffset = ly * tile.cx;
        for (let lx = 0; lx < tile.cx; lx++) {
          const lIdx = rowOffset + lx;
          const pIdx = tile.data[lIdx];
          const isInside = TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy);

          if (!isInside || pIdx === 0) continue;

          const z = tile.zData ? tile.zData[lIdx] : 0;
          const color = palette && palette[pIdx] ? palette[pIdx] : null;

          let r = 0, g = 0, b = 0, a = 255;
          if (displayMode === 'overlay') {
            [r, g, b, a] = blendOverlay(color, z, maxEngineZ);
          } else {
            [r, g, b, a] = getZColor(z, maxEngineZ, displayMode);
            if (z === 0) {
              r = 30; g = 30; b = 30; a = 200;
            }
          }

          bD32[lIdx] = (a << 24) | (b << 16) | (g << 8) | r;

          // Record in hover map
          const compX = bx + lx;
          const compY = by + ly;
          if (compX >= 0 && compX < width && compY >= 0 && compY < height) {
            const compIdx = compY * width + compX;
            zMap[compIdx] = z;
            slotMap[compIdx] = tile.slot;
            layerMap[compIdx] = 1; // base
          }
        }
      }

      const temp = document.createElement('canvas');
      temp.width = tile.cx;
      temp.height = tile.cy;
      temp.getContext('2d')!.putImageData(bImg, 0, 0);
      ctx.drawImage(temp, bx, by);
    });

    // 2. Draw each tile's extra cliff layer
    activeTiles.forEach((tile) => {
      const h = tile.header;
      if (!h.has_extra_data || !tile.extraImageData) return;

      const elev = h.height * mult;
      const ex = h.x_extra - minX;
      const ey = h.y_extra - elev - minY;
      const ew = h.cx_extra;
      const eh = h.cy_extra;

      if (ew <= 0 || eh <= 0) return;

      const eImg = ctx.createImageData(ew, eh);
      const eD32 = new Uint32Array(eImg.data.buffer);

      for (let ly = 0; ly < eh; ly++) {
        for (let lx = 0; lx < ew; lx++) {
          const lIdx = ly * ew + lx;
          const pIdx = tile.extraImageData[lIdx];
          if (pIdx === 0) continue;

          // Check if pixel overlaps any base tile diamond
          const compX = ex + lx;
          const compY = ey + ly;
          if (isPixelOverlappingBaseTile(compX, compY, activeTiles, minX, minY, mult)) {
            continue;
          }

          const rawZ = tile.extraZData ? tile.extraZData[lIdx] : 0;
          const z = rawZ === 255 ? 0 : rawZ;
          const color = palette && palette[pIdx] ? palette[pIdx] : null;

          let r = 0, g = 0, b = 0, a = 255;
          if (displayMode === 'overlay') {
            [r, g, b, a] = blendOverlay(color, z, maxEngineZ);
          } else {
            [r, g, b, a] = getZColor(z, maxEngineZ, displayMode);
            if (z === 0) {
              r = 30; g = 30; b = 30; a = 200;
            }
          }

          eD32[lIdx] = (a << 24) | (b << 16) | (g << 8) | r;

          if (compX >= 0 && compX < width && compY >= 0 && compY < height) {
            const compIdx = compY * width + compX;
            zMap[compIdx] = z;
            slotMap[compIdx] = tile.slot;
            layerMap[compIdx] = 2; // extra
          }
        }
      }

      const temp = document.createElement('canvas');
      temp.width = ew;
      temp.height = eh;
      temp.getContext('2d')!.putImageData(eImg, 0, 0);
      ctx.drawImage(temp, ex, ey);
    });

    pixelMapRef.current = {
      w: width,
      h: height,
      zBuffer: zMap,
      slotBuffer: slotMap,
      layerBuffer: layerMap
    };
  }, [tmpFile, palette, displayMode, maxEngineZ]);

  // Center the image initially
  useEffect(() => {
    if (!containerRef.current || dimensions.w <= 0 || dimensions.h <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (rect.width - dimensions.w * zoom) / 2;
    const cy = (rect.height - dimensions.h * zoom) / 2;
    setPan({ x: Math.round(cx), y: Math.round(cy) });
  }, [dimensions.w, dimensions.h]);

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || dimensions.w <= 0) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - pan.x;
    const mouseY = e.clientY - rect.top - pan.y;

    const px = Math.floor(mouseX / zoom);
    const py = Math.floor(mouseY / zoom);

    if (px < 0 || px >= dimensions.w || py < 0 || py >= dimensions.h) {
      return null;
    }
    return { px, py };
  }, [pan, zoom, dimensions]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });

    // If click on a tile, optionally notify parent to select that tile
    const coords = getCanvasCoords(e);
    if (coords && onSelectTileSlot) {
      const idx = coords.py * dimensions.w + coords.px;
      const slot = pixelMapRef.current.slotBuffer[idx];
      if (slot >= 0) {
        onSelectTileSlot(slot);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
      return;
    }

    const coords = getCanvasCoords(e);
    if (coords) {
      const idx = coords.py * dimensions.w + coords.px;
      const z = pixelMapRef.current.zBuffer[idx] || 0;
      const slot = pixelMapRef.current.slotBuffer[idx];
      const l = pixelMapRef.current.layerBuffer[idx];

      if (slot >= 0) {
        setHoverInfo({
          x: coords.px,
          y: coords.py,
          z,
          tileSlot: slot,
          layer: l === 2 ? 'extra' : 'base'
        });
      } else {
        setHoverInfo(null);
      }
    } else {
      setHoverInfo(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    setZoom((prev) => Math.min(24, Math.max(1, prev + delta)));
  };

  const resetView = () => {
    setZoom(4);
    if (containerRef.current && dimensions.w > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: Math.round((rect.width - dimensions.w * 4) / 2),
        y: Math.round((rect.height - dimensions.h * 4) / 2)
      });
    }
  };

  return (
    <div className="relative flex-1 bg-slate-950 overflow-hidden flex flex-col select-none">
      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => {
          setIsPanning(false);
          setHoverInfo(null);
        }}
        onWheel={handleWheel}
      >
        {/* Grid dots background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #334155 1px, transparent 1px)`,
            backgroundSize: '16px 16px'
          }}
        />

        {/* Canvas */}
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            width: `${dimensions.w * zoom}px`,
            height: `${dimensions.h * zoom}px`,
            imageRendering: 'pixelated'
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full shadow-2xl border border-slate-800"
            style={{ imageRendering: 'pixelated' }}
          />

          {hoverInfo && (
            <div
              className="absolute border border-white/80 pointer-events-none"
              style={{
                left: `${hoverInfo.x * zoom}px`,
                top: `${hoverInfo.y * zoom}px`,
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
        {hoverInfo ? (
          <div className="flex items-center gap-3 font-mono">
            <span className="text-slate-400">Pos: <strong className="text-white">{hoverInfo.x},{hoverInfo.y}</strong></span>
            <span className="text-sky-400">Depth Z: <strong className="text-sky-300">{hoverInfo.z}</strong></span>
            <span className="text-amber-400">Tile: <strong className="text-amber-300">#{hoverInfo.tileSlot}</strong></span>
            <span className="text-slate-400">Layer: <strong className="text-slate-200 capitalize">{hoverInfo.layer}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Complete Assembled Object ({dimensions.w}×{dimensions.h} px) — Pan to explore, click to inspect tile</span>
          </div>
        )}
      </div>

      {/* Bottom Right Zoom controls */}
      <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 flex items-center gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 1))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-slate-400 px-1">{zoom}x</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(24, z + 1))}
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
