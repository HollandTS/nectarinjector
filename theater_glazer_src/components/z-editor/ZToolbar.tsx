import React from 'react';
import { 
  Eye, 
  Paintbrush, 
  Columns3, 
  Sparkles, 
  SlidersHorizontal, 
  RotateCcw, 
  Undo2, 
  Redo2, 
  Layers,
  Grid,
  Wrench
} from 'lucide-react';
import { ZToolMode, ZDisplayMode, ZTargetLayer, ZViewScope } from './types';
import { cn } from '../../lib/utils';

interface ZToolbarProps {
  viewScope: ZViewScope;
  onSelectViewScope: (scope: ZViewScope) => void;
  toolMode: ZToolMode;
  onSelectToolMode: (mode: ZToolMode) => void;
  displayMode: ZDisplayMode;
  onSelectDisplayMode: (mode: ZDisplayMode) => void;
  targetLayer: ZTargetLayer;
  onSelectTargetLayer: (layer: ZTargetLayer) => void;
  hasExtraData: boolean;
  targetZValue: number;
  onChangeTargetZValue: (val: number) => void;
  brushSize: number;
  onChangeBrushSize: (size: number) => void;
  maxEngineZ: number;
  onApplyStandardFill: () => void;
  onApplyClamp: () => void;
  onClearLayer: () => void;
  onAutoFixAllTiles: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const ZToolbar: React.FC<ZToolbarProps> = ({
  viewScope,
  onSelectViewScope,
  toolMode,
  onSelectToolMode,
  displayMode,
  onSelectDisplayMode,
  targetLayer,
  onSelectTargetLayer,
  hasExtraData,
  targetZValue,
  onChangeTargetZValue,
  brushSize,
  onChangeBrushSize,
  maxEngineZ,
  onApplyStandardFill,
  onApplyClamp,
  onClearLayer,
  onAutoFixAllTiles,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Left: View Scope Toggle + Layer Selector + Tool Modes */}
      <div className="flex items-center gap-3">
        {/* Scope Toggle: Single Tile vs Complete (All Tiles) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => onSelectViewScope('single')}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5",
              viewScope === 'single'
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
            title="Inspect and edit single tile"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Single Tile</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectViewScope('complete')}
            className={cn(
              "px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5",
              viewScope === 'complete'
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
            title="View complete multi-tile assembled object with all tiles"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Complete Object (All Tiles)</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-800" />

        {viewScope === 'single' ? (
          <>
            {/* Layer Selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => onSelectTargetLayer('base')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5",
                  targetLayer === 'base'
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Diamond Base</span>
              </button>
              <button
                type="button"
                disabled={!hasExtraData}
                onClick={() => onSelectTargetLayer('extra')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5",
                  !hasExtraData
                    ? "text-slate-600 cursor-not-allowed opacity-50"
                    : targetLayer === 'extra'
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "text-slate-400 hover:text-white"
                )}
                title={!hasExtraData ? "Tile has no extra cliff data" : "Edit cliff/extra image Z-data"}
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Extra (Cliffs)</span>
              </button>
            </div>

            {/* Tools */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectToolMode('inspect')}
                className={cn(
                  "p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-xs font-medium",
                  toolMode === 'inspect'
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                title="Inspect (Sample depth under cursor)"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Inspect</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectToolMode('brush')}
                className={cn(
                  "p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-xs font-medium",
                  toolMode === 'brush'
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                title="Pencil / Stamp (Draw integer depth values)"
              >
                <Paintbrush className="w-4 h-4" />
                <span className="hidden sm:inline">Pencil</span>
              </button>

              {targetLayer === 'extra' && (
                <button
                  type="button"
                  onClick={() => onSelectToolMode('column')}
                  className={cn(
                    "p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-xs font-medium",
                    toolMode === 'column'
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                  title="Column Extruder (Apply uniform depth to entire cliff column)"
                >
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Column Tool</span>
                </button>
              )}

              <button
                type="button"
                onClick={onApplyStandardFill}
                className="p-2 rounded-lg cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                title="Fill with standard Westwood isometric slope formula (cy - 1 - y)"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Standard Fill</span>
              </button>

              <button
                type="button"
                onClick={onApplyClamp}
                className="p-2 rounded-lg cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                title={`Clamp non-zero values to current value (${targetZValue})`}
              >
                <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Clamp</span>
              </button>

              <button
                type="button"
                onClick={onClearLayer}
                className="p-2 rounded-lg cursor-pointer text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs font-medium"
                title="Clear all Z-data on this layer to 0"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Viewing all assembled tiles. Hover to inspect depth across terrain.</span>
          </div>
        )}

        {/* Global Auto-Repair All Tiles Button */}
        <button
          type="button"
          onClick={onAutoFixAllTiles}
          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm active:scale-95"
          title="Clean transparent pixels, clamp depths, and align cliff columns for ALL tiles in file"
        >
          <Wrench className="w-3.5 h-3.5 text-emerald-400" />
          <span>Auto-Repair All Tiles</span>
        </button>
      </div>

      {/* Middle: Integer Value Slider + Brush Size */}
      <div className="flex items-center gap-4">
        {/* Integer Depth Slider */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Value (Z):</span>
          <input
            type="number"
            min={0}
            max={maxEngineZ}
            value={targetZValue}
            onChange={(e) => onChangeTargetZValue(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
            className="w-14 bg-slate-900 border border-slate-700 text-center text-xs font-mono text-white rounded px-1.5 py-0.5"
          />
          <input
            type="range"
            min={0}
            max={maxEngineZ}
            value={targetZValue}
            onChange={(e) => onChangeTargetZValue(parseInt(e.target.value))}
            className="w-24 accent-sky-500 cursor-pointer"
          />
          {/* Quick presets */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChangeTargetZValue(1)}
              className="px-1.5 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              title="Minimum depth"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => onChangeTargetZValue(Math.round(maxEngineZ / 2))}
              className="px-1.5 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              title="Mid depth"
            >
              {Math.round(maxEngineZ / 2)}
            </button>
            <button
              type="button"
              onClick={() => onChangeTargetZValue(maxEngineZ)}
              className="px-1.5 py-0.5 text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
              title="Max engine depth"
            >
              {maxEngineZ}
            </button>
          </div>
        </div>

        {/* Brush Size */}
        {toolMode === 'brush' && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 px-1">Size:</span>
            {[1, 2, 4].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onChangeBrushSize(sz)}
                className={cn(
                  "w-6 h-6 rounded text-xs font-bold cursor-pointer transition-colors",
                  brushSize === sz
                    ? "bg-sky-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {sz}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Display Mode + Undo / Redo */}
      <div className="flex items-center gap-3">
        {/* Display Mode */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['heatmap', 'grayscale', 'overlay'] as ZDisplayMode[]).map((dm) => (
            <button
              key={dm}
              type="button"
              onClick={() => onSelectDisplayMode(dm)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold capitalize rounded cursor-pointer transition-colors",
                displayMode === dm
                  ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {dm}
            </button>
          ))}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className={cn(
              "p-2 rounded-lg transition-colors",
              canUndo ? "text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer" : "text-slate-600 cursor-not-allowed"
            )}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className={cn(
              "p-2 rounded-lg transition-colors",
              canRedo ? "text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer" : "text-slate-600 cursor-not-allowed"
            )}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
