import React, { useState } from 'react';
import { 
  MousePointer, Layers, Pencil, Eraser, Pipette, 
  Copy, Grid, Undo2, Redo2, Download, Upload, ShieldAlert,
  Brush, Scissors, Paintbrush
} from 'lucide-react';
import { RGB } from '../lib/formats';
import { cn } from '../lib/utils';

export type CanvasToolMode = 'select' | 'stamp' | 'draw' | 'eraser' | 'picker' | 'clone' | 'customBrush';

interface CanvasDrawingToolbarProps {
  toolMode: CanvasToolMode;
  setToolMode: (mode: CanvasToolMode) => void;
  selectedColorIndex: number;
  setSelectedColorIndex: (index: number) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  lockColorZero: boolean;
  setLockColorZero: (lock: boolean) => void;
  palette: RGB[];
  isSingleSelected: boolean;
  
  // Stamp details
  loadedFilesCount: number;
  onSelectStampMode: () => void;

  // Clone stamp status
  cloneSrcName: string | null;
  cloneSrcPx: number | null;
  onClearCloneSrc: () => void;

  // Custom Brush status
  customBrush?: { width: number; height: number; pixels: (number | null)[] } | null;
  customBrushSelectMode?: 'box' | 'lasso';
  setCustomBrushSelectMode?: (mode: 'box' | 'lasso') => void;
  customBrushSubMode?: 'select' | 'paint';
  setCustomBrushSubMode?: (mode: 'select' | 'paint') => void;
  onClearCustomBrush?: () => void;
  onOpenBrushEditor?: () => void;
  customBrushVerticalLine?: boolean;
  setCustomBrushVerticalLine?: (val: boolean) => void;
  customBrushSnap?: boolean;
  setCustomBrushSnap?: (val: boolean) => void;

  // Undo/Redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Save/Load
  onSaveMap: () => void;
  onLoadMap: () => void;
}

export const CanvasDrawingToolbar: React.FC<CanvasDrawingToolbarProps> = ({
  toolMode,
  setToolMode,
  selectedColorIndex,
  setSelectedColorIndex,
  brushSize,
  setBrushSize,
  lockColorZero,
  setLockColorZero,
  palette,
  isSingleSelected,
  loadedFilesCount,
  onSelectStampMode,
  cloneSrcName,
  cloneSrcPx,
  onClearCloneSrc,
  customBrush,
  customBrushSelectMode = 'box',
  setCustomBrushSelectMode,
  customBrushSubMode = 'select',
  setCustomBrushSubMode,
  onClearCustomBrush,
  onOpenBrushEditor,
  customBrushVerticalLine = false,
  setCustomBrushVerticalLine,
  customBrushSnap = false,
  setCustomBrushSnap,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveMap,
  onLoadMap
}) => {
  // Convert RGB to CSS hex color safely or map 0/transparent
  const getHexColor = (idx: number) => {
    if (idx === 0) return 'transparent';
    const c = palette[idx];
    if (!c) return '#000000';
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  };

  return (
    <div className="flex flex-col gap-2.5 bg-slate-950 p-3 border-b border-slate-800 shrink-0 z-20 select-none">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        
        {/* Core Drawing and Canvas Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tool Selector Buttons Group */}
          <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setToolMode('select')}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase text-center",
                toolMode === 'select'
                  ? "bg-slate-800 text-white shadow"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title="Select Tool: Move and selection bounds ([HotKey: G], Del/Backspace delete)"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>

            <button
              type="button"
              onClick={onSelectStampMode}
              disabled={loadedFilesCount === 0}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'stamp'
                  ? "bg-emerald-500/10 text-emerald-400 font-extrabold shadow border border-emerald-500/10"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title="Tile Stamp Tool: Place copies of asset onto diamonds layout"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stamp</span>
            </button>

            <button
              type="button"
              onClick={() => setToolMode('draw')}
              disabled={!isSingleSelected}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'draw'
                  ? "bg-purple-500/10 text-purple-400 font-extrabold shadow border border-purple-500/10"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title={isSingleSelected ? "Draw Brush Tool: Click/Drag to paint directly on board pixels" : "Draw Tool (Requires at least 1 selected tile on canvas)"}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Draw</span>
            </button>
 
            <button
              type="button"
              onClick={() => setToolMode('eraser')}
              disabled={!isSingleSelected}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'eraser'
                  ? "bg-rose-500/10 text-rose-400 font-extrabold shadow border border-rose-500/10"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title={isSingleSelected ? "Eraser Tool: Wipe pixels back to alpha transparent" : "Eraser Tool (Requires at least 1 selected tile on canvas)"}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>
 
            <button
              type="button"
              onClick={() => setToolMode('picker')}
              disabled={!isSingleSelected}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'picker'
                  ? "bg-sky-500/10 text-sky-400 font-extrabold shadow border border-sky-500/10"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title={isSingleSelected ? "Color Pipette Picker: Click pixel on board to assign color brush value" : "Picker Tool (Requires at least 1 selected tile on canvas)"}
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>Picker</span>
            </button>
 
            <button
              type="button"
              onClick={() => setToolMode('clone')}
              disabled={!isSingleSelected}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'clone'
                  ? "bg-amber-500/10 text-amber-500 font-extrabold shadow border border-amber-500/10"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title={isSingleSelected ? "Clone Stamp: Alt+Click to store source pixel anchor point. Click elsewhere to duplicate offsets" : "Clone Stamp (Requires at least 1 selected tile on canvas)"}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clone</span>
            </button>

            <button
              type="button"
              onClick={() => setToolMode('customBrush')}
              disabled={!isSingleSelected}
              className={cn(
                "p-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed",
                toolMode === 'customBrush'
                  ? "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/20 font-extrabold shadow"
                  : "text-slate-500 hover:text-slate-350"
              )}
              title={isSingleSelected ? "Custom Brush: Select any pixel region on canvas and paint with it!" : "Custom Brush (Requires at least 1 selected tile on canvas)"}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>C. Brush</span>
            </button>
          </div>

          {/* Draw Settings Group (Shown when painting tools are active) */}
          {['draw', 'eraser', 'clone'].includes(toolMode) && (
            <div className="flex items-center gap-3.5 pl-3 border-l border-slate-800">
              {/* Brush Width */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Size</span>
                <select
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="bg-slate-900 text-slate-200 text-[10px] font-mono font-bold py-1 px-1.5 rounded border border-slate-800 outline-none cursor-pointer"
                >
                  <option value="1">1px</option>
                  <option value="3">3px</option>
                  <option value="5">5px</option>
                  <option value="7">7px</option>
                </select>
              </div>

              {/* Lock Zero transparent toggle */}
              <label 
                className="flex items-center gap-1.5 cursor-pointer text-[9.5px] font-extrabold text-slate-400 hover:text-slate-200 select-none"
                title="Lock index #0: Avoid painting over transparent empty space margins"
              >
                <input
                  type="checkbox"
                  checked={lockColorZero}
                  onChange={(e) => setLockColorZero(e.target.checked)}
                  className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500/25 bg-slate-900 cursor-pointer"
                />
                <span className="uppercase">Lock #0</span>
              </label>
            </div>
          )}

          {/* Active Palette Color Swatch */}
          {['draw', 'picker', 'clone'].includes(toolMode) && (
            <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
              <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Index</span>
              <div
                className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded border border-slate-800 text-[10px]"
              >
                <span 
                  className="w-3.5 h-3.5 rounded border border-slate-950 block shadow-sm"
                  style={{ backgroundColor: getHexColor(selectedColorIndex) }}
                />
                <span className="font-mono text-slate-300 font-bold">#{selectedColorIndex}</span>
              </div>
            </div>
          )}

          {/* Clone Stamp Status Indicator */}
          {toolMode === 'clone' && (
            <div className="pl-3 border-l border-slate-800 flex items-center gap-2 text-[9px] text-amber-500 font-bold">
              {cloneSrcName ? (
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <span className="animate-pulse">●</span>
                  <span>Anchor: {cloneSrcName} ({cloneSrcPx}px)</span>
                  <button 
                    onClick={onClearCloneSrc}
                    className="ml-1 hover:text-red-400 cursor-pointer text-[11px] font-bold"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="text-slate-500 font-semibold italic">Shift+Click tile to set clone source</span>
              )}
            </div>
          )}

          {/* Custom Brush Option Panel */}
          {toolMode === 'customBrush' && (
            <div className="pl-3 border-l border-slate-800 flex items-center gap-3.5 flex-wrap">
              {/* Box vs Lasso Selection type */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setCustomBrushSelectMode?.('box')}
                  className={cn(
                    "px-2 py-1 rounded cursor-pointer transition-all flex items-center gap-1",
                    customBrushSelectMode === 'box'
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title="Capture region with box marquee selection"
                >
                  <Grid className="w-3 h-3" />
                  <span>Box Capture</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomBrushSelectMode?.('lasso')}
                  className={cn(
                    "px-2 py-1 rounded cursor-pointer transition-all flex items-center gap-1",
                    customBrushSelectMode === 'lasso'
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title="Capture region with hand-drawn/polygon lasso"
                >
                  <Scissors className="w-3 h-3 text-fuchsia-400" />
                  <span>Lasso Capture</span>
                </button>
              </div>

              {/* Sub Mode Selection: Capture vs Draw */}
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setCustomBrushSubMode?.('select')}
                  className={cn(
                    "px-2 py-1 rounded cursor-pointer transition-all flex items-center gap-1",
                    customBrushSubMode === 'select'
                      ? "bg-fuchsia-500/10 text-fuchsia-400 font-semibold border border-fuchsia-500/15"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title="Click and drag on canvas to capture a new pattern"
                >
                  <Scissors className="w-3 h-3" />
                  <span>Select Area</span>
                </button>
                <button
                  type="button"
                  disabled={!customBrush}
                  onClick={() => {
                    if (customBrush) setCustomBrushSubMode?.('paint');
                  }}
                  className={cn(
                    "px-2 py-1 rounded cursor-pointer transition-all flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed",
                    customBrushSubMode === 'paint'
                      ? "bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/15"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title={customBrush ? "Click/Drag on tiles to paint the captured custom brush pattern" : "Capture a custom brush region first to paint!"}
                >
                  <Paintbrush className="w-3 h-3" />
                  <span>Paint Brush</span>
                </button>
              </div>

              {/* Checkbox settings */}
              <div className="flex items-center gap-3 border-l border-slate-800 pl-3">
                <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 select-none cursor-pointer hover:text-slate-250">
                  <input
                    type="checkbox"
                    checked={customBrushVerticalLine}
                    onChange={(e) => setCustomBrushVerticalLine?.(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-fuchsia-500 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                  />
                  <span>Vertical Line</span>
                </label>
                <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 select-none cursor-pointer hover:text-slate-250">
                  <input
                    type="checkbox"
                    checked={customBrushSnap}
                    onChange={(e) => setCustomBrushSnap?.(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-fuchsia-500 focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                  />
                  <span>Auto Snap</span>
                </label>
              </div>

              {/* Current captured brush preview/status */}
              {customBrush ? (
                <div className="flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded text-[9.5px] font-bold text-pink-400">
                  <span className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full animate-pulse" />
                  <span>Stamp: {customBrush.width}x{customBrush.height} px</span>
                  <button
                    type="button"
                    onClick={onOpenBrushEditor}
                    className="ml-1 px-1.5 py-0.5 bg-pink-500/20 hover:bg-pink-500/35 text-pink-300 hover:text-white rounded border border-pink-500/30 transition-all text-[8.5px] uppercase font-bold cursor-pointer"
                    title="Open Paint Editor to modify custom stamp brush pixels"
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={onClearCustomBrush}
                    className="ml-1 text-red-400 hover:text-red-350 cursor-pointer text-[12px] font-extrabold leading-none"
                    title="Clear captured custom stamp"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="text-slate-500 text-[9px] font-medium italic">
                  Drag on tiles/canvas to select region
                </span>
              )}
            </div>
          )}
        </div>

        {/* Global Action Tools: Undo, Redo, Save Map, Load Map */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Paint Undo/Redo */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 px-1.5 rounded cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed text-slate-400 hover:text-white"
              title="Undo custom brush edits"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 px-1.5 rounded cursor-pointer transition-all disabled:opacity-20 disabled:cursor-not-allowed text-slate-400 hover:text-white"
              title="Redo brush painting actions"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Map layout save/load */}
          <button
            onClick={onLoadMap}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-lg text-[9.5px] text-slate-300 hover:text-white uppercase font-black cursor-pointer transition-all"
            title="Import map layout (.sugarmap JSON)"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            <span>Load Map</span>
          </button>

          <button
            onClick={onSaveMap}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded-lg text-[9.5px] text-slate-300 hover:text-white uppercase font-black cursor-pointer transition-all"
            title="Export map layout (.sugarmap JSON)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save Map</span>
          </button>
        </div>
      </div>
    </div>
  );
};
