import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LoadedFile } from '../../types';
import { TmpFile, Tile, RGB } from '../../lib/formats';
import { ZToolMode, ZDisplayMode, ZTargetLayer, ZViewScope } from './types';
import { ZToolbar } from './ZToolbar';
import { ZCanvas } from './ZCanvas';
import { ZCompleteCanvas } from './ZCompleteCanvas';
import { ZValidatorPanel } from './ZValidatorPanel';
import { 
  fillStandardBaseZ, 
  applyColumnZ, 
  clampZBuffer, 
  stampZValue, 
  validateZData, 
  autoFixZData 
} from './zOperations';
import { autoFixAllTiles } from './zBatchOperations';
import { ChevronLeft, ChevronRight, FileCode, Layers, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ZDataEditorProps {
  loadedFiles: LoadedFile[];
  palette: RGB[] | null;
  onUpdateFile: (fileIndex: number, updatedTmp: TmpFile) => void;
  activeFileIndex: number | null;
}

export const ZDataEditor: React.FC<ZDataEditorProps> = ({
  loadedFiles,
  palette,
  onUpdateFile,
  activeFileIndex
}) => {
  // Filter all TMP files in workspace
  const tmpFiles = useMemo(() => {
    return loadedFiles
      .map((f, originalIndex) => ({ file: f, originalIndex }))
      .filter((item) => item.file.fileType === 'TMP' && item.file.content);
  }, [loadedFiles]);

  const [selectedTmpFileIndex, setSelectedTmpFileIndex] = useState<number>(0);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number>(0);
  const [viewScope, setViewScope] = useState<ZViewScope>('single');
  const [targetLayer, setTargetLayer] = useState<ZTargetLayer>('base');
  const [toolMode, setToolMode] = useState<ZToolMode>('inspect');
  const [displayMode, setDisplayMode] = useState<ZDisplayMode>('heatmap');
  const [targetZValue, setTargetZValue] = useState<number>(12);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Auto-dismiss batch notice after 4s
  useEffect(() => {
    if (!batchNotice) return;
    const t = setTimeout(() => setBatchNotice(null), 4000);
    return () => clearTimeout(t);
  }, [batchNotice]);

  // Undo / Redo history for Z operations
  const [history, setHistory] = useState<Uint8Array[]>([]);
  const [redoHistory, setRedoHistory] = useState<Uint8Array[]>([]);

  // Sync with activeFileIndex if valid TMP
  React.useEffect(() => {
    if (activeFileIndex !== null && loadedFiles[activeFileIndex]?.fileType === 'TMP') {
      const matchIdx = tmpFiles.findIndex(item => item.originalIndex === activeFileIndex);
      if (matchIdx !== -1) {
        setSelectedTmpFileIndex(matchIdx);
      }
    }
  }, [activeFileIndex, loadedFiles, tmpFiles]);

  const currentItem = tmpFiles[selectedTmpFileIndex];
  const currentTmp = currentItem?.file.content as TmpFile | undefined;
  const currentOriginalIndex = currentItem?.originalIndex;

  const validTiles = useMemo(() => {
    if (!currentTmp || !currentTmp.tiles) return [];
    return currentTmp.tiles
      .map((t, idx) => ({ tile: t, index: idx }))
      .filter((item): item is { tile: Tile; index: number } => item.tile !== null);
  }, [currentTmp]);

  // Ensure selected tile index is in bounds
  const currentTileEntry = validTiles[selectedTileIndex] || validTiles[0] || null;
  const currentTile = currentTileEntry?.tile || null;

  const engine = currentTmp?.type || 'TS';
  const maxEngineZ = (currentTmp?.cy || 24) - 1;

  // Active layer dimensions and buffers
  const isExtra = targetLayer === 'extra';
  const width = isExtra ? (currentTile?.header.cx_extra || 0) : (currentTile?.cx || currentTmp?.cx || 48);
  const height = isExtra ? (currentTile?.header.cy_extra || 0) : (currentTile?.cy || currentTmp?.cy || 24);

  const activeZData = useMemo(() => {
    if (!currentTile) return null;
    return isExtra ? currentTile.extraZData : currentTile.zData;
  }, [currentTile, isExtra]);

  const activePixelData = useMemo(() => {
    if (!currentTile) return null;
    return isExtra ? currentTile.extraImageData : currentTile.data;
  }, [currentTile, isExtra]);

  const hasExtraData = Boolean(
    currentTile && 
    currentTile.extraImageData && 
    currentTile.header.cx_extra > 0 && 
    currentTile.header.cy_extra > 0
  );

  // Auto-switch to base if selected tile lacks extra data
  React.useEffect(() => {
    if (!hasExtraData && targetLayer === 'extra') {
      setTargetLayer('base');
    }
  }, [hasExtraData, targetLayer]);

  // Validation report
  const validationReport = useMemo(() => {
    return validateZData(
      activeZData,
      width,
      height,
      isExtra,
      currentTmp?.cy || 24,
      activePixelData
    );
  }, [activeZData, width, height, isExtra, currentTmp?.cy, activePixelData]);

  // Save new Z buffer to state and workspace file
  const commitZData = useCallback((newBuffer: Uint8Array) => {
    if (!currentTmp || !currentTile || currentOriginalIndex === undefined) return;

    // Record undo
    if (activeZData) {
      setHistory((prev) => [...prev.slice(-30), new Uint8Array(activeZData)]);
      setRedoHistory([]);
    }

    const updatedTiles = currentTmp.tiles.map((t) => {
      if (t !== currentTile) return t;

      const updatedHeader = {
        ...t.header,
        has_z_data: true
      };

      if (isExtra) {
        return {
          ...t,
          header: updatedHeader,
          extraZData: newBuffer
        };
      } else {
        return {
          ...t,
          header: updatedHeader,
          zData: newBuffer
        };
      }
    });

    const updatedTmp: TmpFile = {
      ...currentTmp,
      tiles: updatedTiles
    };

    onUpdateFile(currentOriginalIndex, updatedTmp);
  }, [currentTmp, currentTile, currentOriginalIndex, activeZData, isExtra, onUpdateFile]);

  // Undo / Redo
  const handleUndo = () => {
    if (history.length === 0 || !activeZData) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRedoHistory((prev) => [...prev, new Uint8Array(activeZData)]);
    commitZData(previous);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0 || !activeZData) return;
    const next = redoHistory[redoHistory.length - 1];
    setRedoHistory((prev) => prev.slice(0, prev.length - 1));
    setHistory((prev) => [...prev, new Uint8Array(activeZData)]);
    commitZData(next);
  };

  // Canvas Actions
  const handleModifyPixel = (x: number, y: number) => {
    const baseBuffer = activeZData || new Uint8Array(width * height);
    const updated = stampZValue(
      baseBuffer,
      width,
      height,
      x,
      y,
      targetZValue,
      brushSize,
      activePixelData || undefined
    );
    commitZData(updated);
  };

  const handleModifyColumn = (colX: number) => {
    if (!activePixelData) return;
    const baseBuffer = activeZData || new Uint8Array(width * height);
    const updated = applyColumnZ(
      baseBuffer,
      width,
      height,
      activePixelData,
      colX,
      targetZValue
    );
    commitZData(updated);
  };

  const handleApplyStandardFill = () => {
    if (!currentTmp) return;
    if (isExtra) {
      // Extra default is column procedural fallback
      return;
    }
    const pixelData = activePixelData || new Uint8Array(width * height);
    const updated = fillStandardBaseZ(width, height, pixelData);
    commitZData(updated);
  };

  const handleApplyClamp = () => {
    if (!activeZData) return;
    const updated = clampZBuffer(activeZData, targetZValue);
    commitZData(updated);
  };

  const handleClearLayer = () => {
    commitZData(new Uint8Array(width * height));
  };

  const handleAutoFix = () => {
    if (!activeZData || !currentTmp) return;
    const fixed = autoFixZData(
      activeZData,
      width,
      height,
      isExtra,
      currentTmp.cy,
      activePixelData
    );
    commitZData(fixed);
  };

  const handleAutoFixAllTiles = () => {
    if (!currentTmp || currentOriginalIndex === undefined) return;
    const { updatedTmp, summary } = autoFixAllTiles(currentTmp);
    onUpdateFile(currentOriginalIndex, updatedTmp);
    setHistory([]);
    setRedoHistory([]);
    setBatchNotice(
      `Auto-repaired all ${summary.repairedTileCount} tiles: cleared ${summary.clearedZeroPixels} invalid pixels, aligned ${summary.alignedCliffColumns} cliff columns, clamped ${summary.clampedMaxPixels} values.`
    );
  };

  if (tmpFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-500">
        <Layers className="w-12 h-12 mb-3 text-slate-700 animate-pulse" />
        <h3 className="text-base font-bold text-slate-300 mb-1">No Terrain Tiles Loaded</h3>
        <p className="text-xs text-slate-500 max-w-sm text-center">
          Load a TMP or TEM terrain file in the Converter tab or File workspace to inspect and edit its Z-buffer depth values.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Top Navigation Bar: File & Tile Selection */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* File Selector Dropdown */}
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-sky-400" />
            <select
              value={selectedTmpFileIndex}
              onChange={(e) => {
                setSelectedTmpFileIndex(parseInt(e.target.value));
                setSelectedTileIndex(0);
              }}
              className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {tmpFiles.map((item, idx) => (
                <option key={idx} value={idx}>
                  {item.file.name} ({(item.file.content as TmpFile).type})
                </option>
              ))}
            </select>
          </div>

          {/* Tile Index Selector (Only shown in single tile view) */}
          {viewScope === 'single' && validTiles.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tile:</span>
              <button
                type="button"
                disabled={selectedTileIndex <= 0}
                onClick={() => setSelectedTileIndex(prev => Math.max(0, prev - 1))}
                className="p-1 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent rounded text-slate-300 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-white px-1">
                {selectedTileIndex + 1} / {validTiles.length}
              </span>
              <button
                type="button"
                disabled={selectedTileIndex >= validTiles.length - 1}
                onClick={() => setSelectedTileIndex(prev => Math.min(validTiles.length - 1, prev + 1))}
                className="p-1 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent rounded text-slate-300 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Engine Badge & Batch Notice */}
        <div className="flex items-center gap-3">
          {batchNotice && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 rounded-lg text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{batchNotice}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Total Tiles: <strong className="text-slate-200">{validTiles.length}</strong>
            </span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400">
              Grid: <strong className="text-slate-200">{currentTmp?.cx}×{currentTmp?.cy}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <ZToolbar
        viewScope={viewScope}
        onSelectViewScope={setViewScope}
        toolMode={toolMode}
        onSelectToolMode={setToolMode}
        displayMode={displayMode}
        onSelectDisplayMode={setDisplayMode}
        targetLayer={targetLayer}
        onSelectTargetLayer={setTargetLayer}
        hasExtraData={hasExtraData}
        targetZValue={targetZValue}
        onChangeTargetZValue={setTargetZValue}
        brushSize={brushSize}
        onChangeBrushSize={setBrushSize}
        maxEngineZ={maxEngineZ}
        onApplyStandardFill={handleApplyStandardFill}
        onApplyClamp={handleApplyClamp}
        onClearLayer={handleClearLayer}
        onAutoFixAllTiles={handleAutoFixAllTiles}
        canUndo={history.length > 0}
        canRedo={redoHistory.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Main Workspace Area: Single Canvas vs Complete Object Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {viewScope === 'single' ? (
          <>
            <ZCanvas
              width={width}
              height={height}
              zData={activeZData}
              pixelData={activePixelData}
              palette={palette}
              maxEngineZ={maxEngineZ}
              toolMode={toolMode}
              displayMode={displayMode}
              brushSize={brushSize}
              targetZValue={targetZValue}
              onSampleZ={setTargetZValue}
              onModifyPixel={handleModifyPixel}
              onModifyColumn={handleModifyColumn}
            />

            <ZValidatorPanel
              report={validationReport}
              engine={engine}
              width={width}
              height={height}
              targetLayer={targetLayer}
              onAutoFix={handleAutoFix}
            />
          </>
        ) : currentTmp ? (
          <ZCompleteCanvas
            tmpFile={currentTmp}
            palette={palette}
            displayMode={displayMode}
            onSelectTileSlot={(slot) => {
              const tileIdx = validTiles.findIndex((t) => t.tile.slot === slot);
              if (tileIdx !== -1) {
                setSelectedTileIndex(tileIdx);
                setViewScope('single');
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
