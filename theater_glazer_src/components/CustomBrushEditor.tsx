import React, { useState, useEffect, useRef } from 'react';
import { 
  Pencil, Eraser, Pipette, Copy, X, 
  ZoomIn, ZoomOut, Trash2, PaintBucket, RefreshCw 
} from 'lucide-react';
import { RGB } from '../lib/formats';
import { cn } from '../lib/utils';

interface CustomBrushEditorProps {
  customBrush: { width: number; height: number; pixels: (number | null)[] } | null;
  setCustomBrush: React.Dispatch<React.SetStateAction<{ width: number; height: number; pixels: (number | null)[] } | null>>;
  palette: RGB[];
  selectedColorIndex: number;
  setSelectedColorIndex: (index: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomBrushEditor: React.FC<CustomBrushEditorProps> = ({
  customBrush,
  setCustomBrush,
  palette,
  selectedColorIndex,
  setSelectedColorIndex,
  isOpen,
  onClose,
}) => {
  const [tool, setTool] = useState<'pencil' | 'eraser' | 'picker' | 'clone'>('pencil');
  const [zoom, setZoom] = useState<number>(16);
  const [thickness, setThickness] = useState<number>(1);
  const [cloneSrc, setCloneSrc] = useState<{ x: number; y: number } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState<boolean>(false);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Monitor alt-key to assist clone stamping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleGlobalMouseUp = () => {
    setIsMouseDown(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isMouseDown]);

  if (!isOpen || !customBrush) return null;

  const { width, height, pixels } = customBrush;

  const getHexColor = (idx: number | null) => {
    if (idx === null || idx === undefined) return 'transparent';
    const c = palette[idx];
    if (!c) return 'transparent';
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  };

  // Perform single pixel edit at grid index (x, y)
  const applyPaint = (x: number, y: number, isStart: boolean) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    if (tool === 'picker') {
      const idx = pixels[y * width + x];
      if (idx !== null && idx !== undefined) {
        setSelectedColorIndex(idx);
      }
      return;
    }

    if (tool === 'clone' && (isAltPressed || isStart === false && !cloneSrc)) {
      setCloneSrc({ x, y });
      return;
    }

    const nextPixels = [...pixels];
    const radius = Math.floor(thickness / 2);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Circle constraint check
        if (dx * dx + dy * dy > radius * radius + 0.5) continue;

        const targetX = x + dx;
        const targetY = y + dy;

        if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
          const paintIdx = targetY * width + targetX;

          if (tool === 'pencil') {
            nextPixels[paintIdx] = selectedColorIndex;
          } else if (tool === 'eraser') {
            nextPixels[paintIdx] = null;
          } else if (tool === 'clone' && cloneSrc && dragStart) {
            // Relational offset stamping
            const relDx = targetX - dragStart.x;
            const relDy = targetY - dragStart.y;
            const srcX = cloneSrc.x + relDx;
            const srcY = cloneSrc.y + relDy;

            if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
              const srcIdx = srcY * width + srcX;
              nextPixels[paintIdx] = pixels[srcIdx];
            }
          }
        }
      }
    }

    setCustomBrush({ ...customBrush, pixels: nextPixels });
  };

  const handleCellMouseDown = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    setIsMouseDown(true);
    setDragStart({ x, y });
    applyPaint(x, y, true);
  };

  const handleCellMouseEnter = (x: number, y: number) => {
    if (isMouseDown) {
      applyPaint(x, y, false);
    }
  };

  // Transform actions
  const flipHorizontal = () => {
    const next = [...pixels];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < Math.floor(width / 2); x++) {
        const leftIdx = y * width + x;
        const rightIdx = y * width + (width - 1 - x);
        const temp = next[leftIdx];
        next[leftIdx] = next[rightIdx];
        next[rightIdx] = temp;
      }
    }
    setCustomBrush({ ...customBrush, pixels: next });
    if (cloneSrc) setCloneSrc({ x: width - 1 - cloneSrc.x, y: cloneSrc.y });
  };

  const flipVertical = () => {
    const next = [...pixels];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < Math.floor(height / 2); y++) {
        const topIdx = y * width + x;
        const bottomIdx = (height - 1 - y) * width + x;
        const temp = next[topIdx];
        next[topIdx] = next[bottomIdx];
        next[bottomIdx] = temp;
      }
    }
    setCustomBrush({ ...customBrush, pixels: next });
    if (cloneSrc) setCloneSrc({ x: cloneSrc.x, y: height - 1 - cloneSrc.y });
  };

  const rotate90 = () => {
    const nextWidth = height;
    const nextHeight = width;
    const nextPixels = Array(nextWidth * nextHeight).fill(null);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const oldIdx = r * width + c;
        const nextR = c;
        const nextC = height - 1 - r;
        const newIdx = nextR * nextWidth + nextC;
        nextPixels[newIdx] = pixels[oldIdx];
      }
    }
    setCustomBrush({
      width: nextWidth,
      height: nextHeight,
      pixels: nextPixels
    });
    setCloneSrc(null);
  };

  const clearAll = () => {
    if (confirm('Wipe this brush template back to fully transparent (alpha channels)?')) {
      const next = Array(width * height).fill(null);
      setCustomBrush({ ...customBrush, pixels: next });
      setCloneSrc(null);
    }
  };

  const fillAll = () => {
    const next = Array(width * height).fill(selectedColorIndex);
    setCustomBrush({ ...customBrush, pixels: next });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        ref={containerRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh]"
        id="c-brush-editor-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20 text-fuchsia-400">
              <Pencil className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-200 text-sm">Custom Brush Pixel Editor</h3>
              <p className="text-slate-400 font-mono text-[11px]">Dimensions: {width} x {height} px • {pixels.filter(p => p !== null).length} animated colors</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Panels */}
        <div className="flex flex-1 overflow-hidden">
          {/* 1. Left Toolbar */}
          <div className="w-44 border-r border-slate-800 p-3 flex flex-col gap-4 overflow-y-auto bg-slate-900/50">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Drawing Tools</span>
              
              <button
                type="button"
                onClick={() => setTool('pencil')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer",
                  tool === 'pencil'
                    ? "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/10 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
                title="Pencil: click and drag to paint indices"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Pencil</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer",
                  tool === 'eraser'
                    ? "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/10 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
                title="Eraser: wipe pixels back to transparent"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Eraser</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('picker')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer",
                  tool === 'picker'
                    ? "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/10 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
                title="Pipette Picker: select color under mouse"
              >
                <Pipette className="w-3.5 h-3.5" />
                <span>Eyedropper</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('clone')}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg transition-all text-xs font-semibold flex flex-col gap-1 cursor-pointer",
                  tool === 'clone'
                    ? "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/10 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
                title="Clone stamp: Alt+Click sets copy source"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone Stamp</span>
                </div>
                {tool === 'clone' && (
                  <span className="text-[9px] text-slate-500 font-medium italic mt-0.5">
                    {cloneSrc ? `Anchor: ${cloneSrc.x}, ${cloneSrc.y}` : "Alt-Click coordinates"}
                  </span>
                )}
              </button>
            </div>

            {/* Thickness selector */}
            <div className="border-t border-slate-800/60 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 block mb-1">Grid Size Width</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg">
                {[1, 3, 5].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setThickness(t)}
                    className={cn(
                      "py-1 rounded text-[10px] font-bold cursor-pointer transition-all",
                      thickness === t
                        ? "bg-slate-800 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {t}px
                  </button>
                ))}
              </div>
            </div>

            {/* Operations */}
            <div className="border-t border-slate-800/60 pt-3 space-y-1.5 mt-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">Transforms</span>
              
              <button
                type="button"
                onClick={flipHorizontal}
                className="w-full text-slate-300 hover:bg-slate-800 text-left px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Flip Horizontal</span>
              </button>

              <button
                type="button"
                onClick={flipVertical}
                className="w-full text-slate-300 hover:bg-slate-800 text-left px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400 rotate-90" />
                <span>Flip Vertical</span>
              </button>

              <button
                type="button"
                onClick={rotate90}
                className="w-full text-slate-300 hover:bg-slate-800 text-left px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-amber-500" />
                <span>Rotate 90° CW</span>
              </button>

              <button
                type="button"
                onClick={fillAll}
                className="w-full text-slate-300 hover:bg-slate-800 text-left px-2.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-2 transition-all cursor-pointer"
              >
                <PaintBucket className="w-3 h-3 text-fuchsia-400" />
                <span>Fill Brush Grid</span>
              </button>

              <button
                type="button"
                onClick={clearAll}
                className="w-full text-rose-400 hover:bg-rose-500/15 text-left px-2.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>Wipe Alpha #0</span>
              </button>
            </div>
          </div>

          {/* 2. Center Grid Viewport */}
          <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
            {/* Viewport bar options */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/30">
              <span className="text-[10px] font-mono text-slate-500">Left-click and Draw over cells. Space bar toggles pan.</span>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(4, zoom - 2))}
                  className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer rounded"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[10px] text-slate-300 w-10 text-center font-bold">{zoom * 10}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(48, zoom + 2))}
                  className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer rounded"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-6 checkerboard-bg">
              <div 
                className="border-2 border-slate-750 shadow-2xl relative"
                style={{
                  gridTemplateColumns: `repeat(${width}, 1fr)`,
                  display: 'grid',
                  width: `${width * zoom}px`,
                  height: `${height * zoom}px`,
                  backgroundColor: '#090d16'
                }}
              >
                {Array.from({ length: height }).map((_, y) => 
                  Array.from({ length: width }).map((__, x) => {
                    const idx = y * width + x;
                    const val = pixels[idx];
                    const color = getHexColor(val);
                    const isAnchor = cloneSrc && cloneSrc.x === x && cloneSrc.y === y;

                    return (
                      <div
                        key={`${x}-${y}`}
                        onMouseDown={(e) => handleCellMouseDown(e, x, y)}
                        onMouseEnter={() => handleCellMouseEnter(x, y)}
                        className={cn(
                          "relative group transition-colors duration-75 select-none border-[0.5px] border-slate-800/45 text-transparent text-[8px] font-mono text-center flex items-center justify-center cursor-crosshair hover:border-fuchsia-500/60"
                        )}
                        style={{
                          backgroundColor: val === null ? 'transparent' : color,
                          width: `${zoom}px`,
                          height: `${zoom}px`
                        }}
                      >
                        {/* Chess Checkered pattern fallback for transparent pixel */}
                        {val === null && (
                          <div className={cn(
                            "absolute inset-0 opacity-15",
                            (x + y) % 2 === 0 ? "bg-slate-300" : "bg-transparent"
                          )}/>
                        )}

                        {/* Clone stamp target selection identifier */}
                        {isAnchor && (
                          <div className="absolute inset-0 border-2 border-dashed border-amber-500 flex items-center justify-center">
                            <span className="bg-amber-500 text-slate-950 font-black text-[9px] font-sans px-0.5 rounded leading-none scale-[0.85]">C</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. Right Color Palette Swatch Selector */}
          <div className="w-64 border-l border-slate-800 p-4 bg-slate-900/40 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">256 Base Color Swatches</span>
            
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-16 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-850">
                {palette.map((color, idx) => {
                  const isSelected = selectedColorIndex === idx;
                  const rgbString = `rgb(${color.r}, ${color.g}, ${color.b})`;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedColorIndex(idx)}
                      className={cn(
                        "w-4 h-4 rounded cursor-pointer transition-transform relative hover:scale-125 focus:outline-none z-10",
                        isSelected 
                          ? "ring-2 ring-fuchsia-500 scale-110 z-20 border border-white" 
                          : "border border-slate-900/60"
                      )}
                      style={{ backgroundColor: rgbString }}
                      title={`Palette Index #${idx} (RGB: ${color.r}, ${color.g}, ${color.b})`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Selected stats info */}
            <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 mt-4">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide block">Active Color</span>
              <div className="flex items-center gap-3 mt-1.5">
                <div 
                  className="w-8 h-8 rounded border-2 border-slate-800 shadow"
                  style={{ backgroundColor: `rgb(${palette[selectedColorIndex]?.r || 0}, ${palette[selectedColorIndex]?.g || 0}, ${palette[selectedColorIndex]?.b || 0})` }}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-extrabold text-slate-200 font-mono">Index #{selectedColorIndex}</span>
                  <span className="text-[10px] font-semibold text-slate-500 font-mono">
                    RGB: {palette[selectedColorIndex]?.r || 0}, {palette[selectedColorIndex]?.g || 0}, {palette[selectedColorIndex]?.b || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
