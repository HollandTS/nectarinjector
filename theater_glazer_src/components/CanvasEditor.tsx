import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { TmpFile, Tile, RGB, TmpParser } from '../lib/formats';
import { ShpFile } from '../lib/shp';
import { cn } from '../lib/utils';
import { 
  Grid, Trash2, ArrowLeftRight, Download, MousePointer, 
  Sparkles, Check, HelpCircle, LayoutGrid, Layers, RefreshCw 
} from 'lucide-react';
import { CanvasSidebarItem } from './CanvasSidebarItem';
import { CanvasToolMode, CanvasDrawingToolbar } from './CanvasDrawingToolbar';
import { findPixelInElement, paintBrushOnData } from '../lib/canvasPaintHelper';
import { drawElementSelectionOutline } from '../lib/canvasDiamondHelper';
import { MissingFilesAlert } from './MissingFilesAlert';
import { CustomBrushEditor } from './CustomBrushEditor';

// Re-export tool mode type for clean imports
export type { CanvasToolMode };

import { LoadedFile, PlacedElement } from '../types';

interface CanvasEditorProps {
  loadedFiles: LoadedFile[];
  palette: RGB[];
  onRemoveFile: (index: number) => void;
  
  // Lifted state to prevent data loss on tab switches
  placedElements: PlacedElement[];
  setPlacedElements: React.Dispatch<React.SetStateAction<PlacedElement[]>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  gridSize: number;
  setGridSize: (size: number) => void;
  gridEngine: 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96';
  setGridEngine: (engine: 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96') => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  toolMode: CanvasToolMode;
  setToolMode: (mode: CanvasToolMode) => void;
  activeStampIndex: number | null;
  setActiveStampIndex: (idx: number | null) => void;

  // Custom brush states and setters
  customBrush: { width: number; height: number; pixels: (number | null)[] } | null;
  setCustomBrush: React.Dispatch<React.SetStateAction<{ width: number; height: number; pixels: (number | null)[] } | null>>;
  customBrushSelectMode: 'box' | 'lasso';
  setCustomBrushSelectMode: (mode: 'box' | 'lasso') => void;
  customBrushSubMode: 'select' | 'paint';
  setCustomBrushSubMode: (mode: 'select' | 'paint') => void;
  customBrushVerticalLine: boolean;
  setCustomBrushVerticalLine: (val: boolean) => void;
  customBrushSnap: boolean;
  setCustomBrushSnap: (val: boolean) => void;

  // Global application history
  history: LoadedFile[][];
  setHistory: React.Dispatch<React.SetStateAction<LoadedFile[][]>>;
  redoHistory: LoadedFile[][];
  setRedoHistory: React.Dispatch<React.SetStateAction<LoadedFile[][]>>;
  triggerRootUpdate: () => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  loadedFiles,
  palette,
  onRemoveFile,
  placedElements,
  setPlacedElements,
  selectedIds,
  setSelectedIds,
  gridSize,
  setGridSize,
  gridEngine,
  setGridEngine,
  zoom,
  setZoom,
  toolMode,
  setToolMode,
  activeStampIndex,
  setActiveStampIndex,
  customBrush,
  setCustomBrush,
  customBrushSelectMode,
  setCustomBrushSelectMode,
  customBrushSubMode,
  setCustomBrushSubMode,
  customBrushVerticalLine,
  setCustomBrushVerticalLine,
  customBrushSnap,
  setCustomBrushSnap,
  history,
  setHistory,
  redoHistory,
  setRedoHistory,
  triggerRootUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing States
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(1);
  const [brushSize, setBrushSize] = useState<number>(1);
  const [lockColorZero, setLockColorZero] = useState<boolean>(false);
  const [isBrushEditorOpen, setIsBrushEditorOpen] = useState<boolean>(false);

  // Undo/Redo tracking for tile placement/deletions
  const [deletedPlacedElementsHistory, setDeletedPlacedElementsHistory] = useState<PlacedElement[][]>([]);
  const [deletedPlacedElementsRedoHistory, setDeletedPlacedElementsRedoHistory] = useState<PlacedElement[][]>([]);
  const [actionHistory, setActionHistory] = useState<('paint' | 'delete')[]>([]);
  const [actionRedoHistory, setActionRedoHistory] = useState<('paint' | 'delete')[]>([]);
  
  // Sidebar tab state
  const [sidebarTab, setSidebarTab] = useState<'files' | 'palette'>('files');

  // Track Alt Key State for Clone Stamp Source Set
  const [isAltPressed, setIsAltPressed] = useState<boolean>(false);
  const [strokeStartCoordinate, setStrokeStartCoordinate] = useState<{ px: number; py: number; } | null>(null);

  // Clone Stamp Source tracking
  const [cloneSource, setCloneSource] = useState<{
    fileName: string;
    fileType: 'TMP' | 'SHP';
    tileIndex?: number;
    cellType?: 'base' | 'extra';
    px: number;
    py: number;
    pixelIndex: number;
    canvasX?: number;
    canvasY?: number;
  } | null>(null);

  // Permanent Offscreen Pre-rendered Cache Ref to achieve 60 FPS drawing speed
  const offscreenCacheCoords = useRef<Record<string, HTMLCanvasElement>>({});
  
  // Hover mouse coordinate trackers
  const hoveredCanvasMouseRef = useRef<{ x: number; y: number } | null>(null);

  const getCachedCanvas = useCallback((fileName: string): HTMLCanvasElement => {
    if (offscreenCacheCoords.current[fileName]) {
      return offscreenCacheCoords.current[fileName];
    }
    
    // Not found in cache. Let's find it in loadedFiles
    const file = loadedFiles.find(f => f.name === fileName);
    if (file) {
      const canvas = document.createElement('canvas');
      if (file.fileType === 'TMP') {
        TmpParser.renderCompleteToCanvas(canvas, file.content as TmpFile, palette, false);
      } else {
        const shp = file.content as ShpFile;
        if (shp.frames && shp.frames.length > 0) {
          const frame = shp.frames[0];
          canvas.width = frame.w;
          canvas.height = frame.h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imgData = ctx.createImageData(frame.w, frame.h);
            const data32 = new Uint32Array(imgData.data.buffer);
            const p32 = palette.map(c => (255 << 24) | (c.b << 16) | (c.g << 8) | c.r);
            for (let i = 0; i < frame.data.length; i++) {
              const idx = frame.data[i];
              data32[i] = idx === 0 ? 0 : p32[idx];
            }
            ctx.putImageData(imgData, 0, 0);
          }
        }
      }
      offscreenCacheCoords.current[fileName] = canvas;
      return canvas;
    }

    // It is a missing file placeholder
    const dummy = document.createElement('canvas');
    dummy.width = 48;
    dummy.height = 24;
    const ctx = dummy.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(1, 1, 46, 22);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fillRect(2, 2, 44, 20);
    }
    offscreenCacheCoords.current[fileName] = dummy;
    return dummy;
  }, [loadedFiles, palette]);

  const invalidateCache = useCallback((fileName: string) => {
    delete offscreenCacheCoords.current[fileName];
  }, []);

  // Flush cache completely if base files list or palette is loaded/changed
  useEffect(() => {
    offscreenCacheCoords.current = {};
  }, [loadedFiles, palette]);

  // Restrict drawing tools to have at least one selection: back to select mode if no elements selected
  useEffect(() => {
    if (['draw', 'eraser', 'picker', 'clone', 'customBrush'].includes(toolMode) && selectedIds.size === 0) {
      setToolMode('select');
    }
  }, [selectedIds, toolMode, setToolMode]);

  // Lock Transparent #0 is automatically enabled when customBrush mode is selected
  useEffect(() => {
    if (toolMode === 'customBrush') {
      setLockColorZero(true);
    }
  }, [toolMode]);



  // Drag states for box selection & tile movement
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);

  // Custom Brush Capture and Draw states (with state lifted to parent App to prevent loss on Tab Switch)
  const [isCustomBrushSelecting, setIsCustomBrushSelecting] = useState(false);
  const [customBrushBoxStart, setCustomBrushBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [customBrushBoxEnd, setCustomBrushBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [customBrushLassoPoints, setCustomBrushLassoPoints] = useState<{ x: number; y: number }[]>([]);

  const [isDraggingTiles, setIsDraggingTiles] = useState(false);
  const [dragStartMouseGrid, setDragStartMouseGrid] = useState<{ gx: number; gy: number } | null>(null);
  const [dragStartPositionMap, setDragStartPositionMap] = useState<Record<string, { gx: number; gy: number }>>({});

  const [hoverGrid, setHoverGrid] = useState<{ gx: number; gy: number } | null>(null);
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false);

  // Missing files from loading maps
  const [missingFiles, setMissingFiles] = useState<string[]>([]);

  // Dimensions based on engine
  const cellW = gridEngine === 'TS' ? 48 : gridEngine === 'OpenTS_48x96' ? 96 : gridEngine === 'OpenTS' ? 120 : 60;
  const cellH = gridEngine === 'TS' ? 24 : gridEngine === 'OpenTS_48x96' ? 48 : gridEngine === 'OpenTS' ? 60 : 30;

  // Board dimensions
  const canvasWidth = 2400;
  const canvasHeight = 1600;
  const mapCenterX = canvasWidth / 2;
  const mapCenterY = 160;

  // Offscreen Pre-rendered Cache is handled by getCachedCanvas and offscreenCacheCoords ref for maximum FPS

  // Deep clone helper for 100% stable Undo/Redo edits
  const pushHistoryAndCommit = () => {
    const cloned = loadedFiles.map(file => {
      if (file.fileType === 'TMP') {
        const tmp = file.content as TmpFile;
        return {
          ...file,
          content: {
            ...tmp,
            tiles: tmp.tiles.map(t => {
              if (!t) return null;
              return {
                ...t,
                data: new Uint8Array(t.data),
                zData: t.zData ? new Uint8Array(t.zData) : null,
                extraImageData: t.extraImageData ? new Uint8Array(t.extraImageData) : null,
                extraZData: t.extraZData ? new Uint8Array(t.extraZData) : null,
              };
            })
          }
        };
      } else {
        const shp = file.content as ShpFile;
        return {
          ...file,
          content: {
            ...shp,
            frames: shp.frames.map(f => ({
              ...f,
              data: new Uint8Array(f.data),
            }))
          }
        };
      }
    });

    setHistory(prev => [cloned, ...prev].slice(0, 30));
    setRedoHistory([]);
    setActionHistory(prev => ['paint', ...prev]);
    setActionRedoHistory([]);
    triggerRootUpdate();
  };

  // Safe undo
  const handleUndo = useCallback(() => {
    if (actionHistory.length === 0) {
      if (history.length > 0) {
        // Fallback to paint undo
        const previous = history[0];
        const rest = history.slice(1);

        const currentCloned = loadedFiles.map(file => {
          if (file.fileType === 'TMP') {
            const tmp = file.content as TmpFile;
            return {
              ...file,
              content: {
                ...tmp,
                tiles: tmp.tiles.map(t => {
                  if (!t) return null;
                  return {
                    ...t,
                    data: new Uint8Array(t.data),
                    extraImageData: t.extraImageData ? new Uint8Array(t.extraImageData) : null,
                  };
                })
              }
            };
          } else {
            const shp = file.content as ShpFile;
            return {
              ...file,
              content: {
                ...shp,
                frames: shp.frames.map(f => ({
                  ...f,
                  data: new Uint8Array(f.data),
                }))
              }
            };
          }
        });

        setRedoHistory(prev => [currentCloned, ...prev]);
        setHistory(rest);

        previous.forEach((pf, i) => {
          const parent = loadedFiles[i];
          if (parent && parent.name === pf.name) {
            if (pf.fileType === 'TMP') {
              const pt = pf.content as TmpFile;
              const ct = parent.content as TmpFile;
              pt.tiles.forEach((t, slot) => {
                if (t && ct.tiles[slot]) {
                  ct.tiles[slot]!.data.set(t.data);
                  if (t.extraImageData && ct.tiles[slot]!.extraImageData) {
                    ct.tiles[slot]!.extraImageData!.set(t.extraImageData);
                  }
                }
              });
            } else {
              const ps = pf.content as ShpFile;
              const cs = parent.content as ShpFile;
              ps.frames.forEach((f, fIdx) => {
                if (cs.frames[fIdx]) {
                  cs.frames[fIdx].data.set(f.data);
                }
              });
            }
          }
        });

        triggerRootUpdate();
      }
      return;
    }

    const currentAction = actionHistory[0];
    const restActions = actionHistory.slice(1);

    if (currentAction === 'delete') {
      if (deletedPlacedElementsHistory.length === 0) return;
      const previousPlaced = deletedPlacedElementsHistory[0];
      const restPlaced = deletedPlacedElementsHistory.slice(1);

      setDeletedPlacedElementsRedoHistory(prev => [placedElements, ...prev]);
      setDeletedPlacedElementsHistory(restPlaced);

      setPlacedElements(previousPlaced);
      setSelectedIds(new Set());

      setActionHistory(restActions);
      setActionRedoHistory(prev => ['delete', ...prev]);
    } else {
      // It is paint type
      if (history.length === 0) return;
      const previous = history[0];
      const rest = history.slice(1);

      const currentCloned = loadedFiles.map(file => {
        if (file.fileType === 'TMP') {
          const tmp = file.content as TmpFile;
          return {
            ...file,
            content: {
              ...tmp,
              tiles: tmp.tiles.map(t => {
                if (!t) return null;
                return {
                  ...t,
                  data: new Uint8Array(t.data),
                  extraImageData: t.extraImageData ? new Uint8Array(t.extraImageData) : null,
                };
              })
            }
          };
        } else {
          const shp = file.content as ShpFile;
          return {
            ...file,
            content: {
              ...shp,
              frames: shp.frames.map(f => ({
                ...f,
                data: new Uint8Array(f.data),
              }))
            }
          };
        }
      });

      setRedoHistory(prev => [currentCloned, ...prev]);
      setHistory(rest);

      previous.forEach((pf, i) => {
        const parent = loadedFiles[i];
        if (parent && parent.name === pf.name) {
          if (pf.fileType === 'TMP') {
            const pt = pf.content as TmpFile;
            const ct = parent.content as TmpFile;
            pt.tiles.forEach((t, slot) => {
              if (t && ct.tiles[slot]) {
                ct.tiles[slot]!.data.set(t.data);
                if (t.extraImageData && ct.tiles[slot]!.extraImageData) {
                  ct.tiles[slot]!.extraImageData!.set(t.extraImageData);
                }
              }
            });
          } else {
            const ps = pf.content as ShpFile;
            const cs = parent.content as ShpFile;
            ps.frames.forEach((f, fIdx) => {
              if (cs.frames[fIdx]) {
                cs.frames[fIdx].data.set(f.data);
              }
            });
          }
        }
      });

      setActionHistory(restActions);
      setActionRedoHistory(prev => ['paint', ...prev]);
      triggerRootUpdate();
    }
  }, [
    actionHistory,
    history,
    deletedPlacedElementsHistory,
    placedElements,
    loadedFiles,
    triggerRootUpdate,
    setPlacedElements,
    setSelectedIds,
    setHistory,
    setRedoHistory
  ]);

  const handleRedo = useCallback(() => {
    if (actionRedoHistory.length === 0) {
      if (redoHistory.length > 0) {
        // Fallback to paint redo
        const next = redoHistory[0];
        const rest = redoHistory.slice(1);

        const currentCloned = loadedFiles.map(file => {
          if (file.fileType === 'TMP') {
            const tmp = file.content as TmpFile;
            return {
              ...file,
              content: {
                ...tmp,
                tiles: tmp.tiles.map(t => {
                  if (!t) return null;
                  return {
                    ...t,
                    data: new Uint8Array(t.data),
                    extraImageData: t.extraImageData ? new Uint8Array(t.extraImageData) : null,
                  };
                })
              }
            };
          } else {
            const shp = file.content as ShpFile;
            return {
              ...file,
              content: {
                ...shp,
                frames: shp.frames.map(f => ({
                  ...f,
                  data: new Uint8Array(f.data),
                }))
              }
            };
          }
        });

        setHistory(prev => [currentCloned, ...prev]);
        setRedoHistory(rest);

        next.forEach((nf, i) => {
          const parent = loadedFiles[i];
          if (parent && parent.name === nf.name) {
            if (nf.fileType === 'TMP') {
              const nt = nf.content as TmpFile;
              const ct = parent.content as TmpFile;
              nt.tiles.forEach((t, slot) => {
                if (t && ct.tiles[slot]) {
                  ct.tiles[slot]!.data.set(t.data);
                  if (t.extraImageData && ct.tiles[slot]!.extraImageData) {
                    ct.tiles[slot]!.extraImageData!.set(t.extraImageData);
                  }
                }
              });
            } else {
              const ns = nf.content as ShpFile;
              const cs = parent.content as ShpFile;
              ns.frames.forEach((f, fIdx) => {
                if (cs.frames[fIdx]) {
                  cs.frames[fIdx].data.set(f.data);
                }
              });
            }
          }
        });

        triggerRootUpdate();
      }
      return;
    }

    const currentRedoAction = actionRedoHistory[0];
    const restRedoActions = actionRedoHistory.slice(1);

    if (currentRedoAction === 'delete') {
      if (deletedPlacedElementsRedoHistory.length === 0) return;
      const nextPlaced = deletedPlacedElementsRedoHistory[0];
      const restPlaced = deletedPlacedElementsRedoHistory.slice(1);

      setDeletedPlacedElementsHistory(prev => [placedElements, ...prev]);
      setDeletedPlacedElementsRedoHistory(restPlaced);

      setPlacedElements(nextPlaced);
      setSelectedIds(new Set());

      setActionRedoHistory(restRedoActions);
      setActionHistory(prev => ['delete', ...prev]);
    } else {
      // Paint redo
      if (redoHistory.length === 0) return;
      const next = redoHistory[0];
      const rest = redoHistory.slice(1);

      const currentCloned = loadedFiles.map(file => {
        if (file.fileType === 'TMP') {
          const tmp = file.content as TmpFile;
          return {
            ...file,
            content: {
              ...tmp,
              tiles: tmp.tiles.map(t => {
                if (!t) return null;
                return {
                  ...t,
                  data: new Uint8Array(t.data),
                  extraImageData: t.extraImageData ? new Uint8Array(t.extraImageData) : null,
                };
              })
            }
          };
        } else {
          const shp = file.content as ShpFile;
          return {
            ...file,
            content: {
              ...shp,
              frames: shp.frames.map(f => ({
                ...f,
                data: new Uint8Array(f.data),
              }))
            }
          };
        }
      });

      setHistory(prev => [currentCloned, ...prev]);
      setRedoHistory(rest);

      next.forEach((nf, i) => {
        const parent = loadedFiles[i];
        if (parent && parent.name === nf.name) {
          if (nf.fileType === 'TMP') {
            const nt = nf.content as TmpFile;
            const ct = parent.content as TmpFile;
            nt.tiles.forEach((t, slot) => {
              if (t && ct.tiles[slot]) {
                ct.tiles[slot]!.data.set(t.data);
                if (t.extraImageData && ct.tiles[slot]!.extraImageData) {
                  ct.tiles[slot]!.extraImageData!.set(t.extraImageData);
                }
              }
            });
          } else {
            const ns = nf.content as ShpFile;
            const cs = parent.content as ShpFile;
            ns.frames.forEach((f, fIdx) => {
              if (cs.frames[fIdx]) {
                cs.frames[fIdx].data.set(f.data);
              }
            });
          }
        }
      });

      setActionRedoHistory(restRedoActions);
      setActionHistory(prev => ['paint', ...prev]);
      triggerRootUpdate();
    }
  }, [
    actionRedoHistory,
    redoHistory,
    deletedPlacedElementsRedoHistory,
    placedElements,
    loadedFiles,
    triggerRootUpdate,
    setPlacedElements,
    setSelectedIds,
    setHistory,
    setRedoHistory
  ]);

  // Track Alt Key State and Tool Hotkeys (placed here to avoid block-scoped declaration order error)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when focusing input elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Undo shortcut (Ctrl/Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo shortcuts (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
      if (((e.ctrlKey || e.metaKey) && key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'Alt') {
        setIsAltPressed(true);
        return;
      }

      if (key === 'd') {
        setToolMode('draw');
        e.preventDefault();
      } else if (key === 'e') {
        setToolMode('eraser');
        e.preventDefault();
      } else if (key === 'w') {
        setToolMode('picker');
        e.preventDefault();
      } else if (key === 's') {
        setToolMode('clone');
        e.preventDefault();
      } else if (key === 'g') {
        setToolMode('select');
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };
    const handleBlur = () => {
      setIsAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setToolMode, handleUndo, handleRedo]);

  // Smooth mousewheel zooming effect (active event capturing)
  useEffect(() => {
    const container = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!container || !canvasEl) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();

      const rectContainer = container.getBoundingClientRect();
      const rectCanvas = canvasEl.getBoundingClientRect();

      const scrollLeftBefore = container.scrollLeft;
      const scrollTopBefore = container.scrollTop;

      // Distance from container bounds to canvas bounds plus current scroll
      const canvasLeftInContainer = rectCanvas.left - rectContainer.left + scrollLeftBefore;
      const canvasTopInContainer = rectCanvas.top - rectContainer.top + scrollTopBefore;

      const mouseXOnCanvas = e.clientX - rectCanvas.left;
      const mouseYOnCanvas = e.clientY - rectCanvas.top;

      const zoomBefore = zoom;
      const delta = e.deltaY;
      
      // Compute new zoom targeting range 0.2x up to 6.0x
      const step = delta < 0 ? 0.15 : -0.15;
      let zoomAfter = zoomBefore + step;
      
      // Enforce snapping exactly to 1.0 if the zoom crosses the 1.0 threshold
      if ((zoomBefore < 1.0 && zoomAfter > 1.0) || (zoomBefore > 1.0 && zoomAfter < 1.0)) {
        zoomAfter = 1.0;
      }

      zoomAfter = Math.max(0.2, Math.min(6.0, zoomAfter));
      const zoomAfterFixed = parseFloat(zoomAfter.toFixed(2));

      if (zoomAfterFixed === zoomBefore) return;

      // Unscaled coordinates of hover point on original canvas resolution
      const unscaledX = mouseXOnCanvas / zoomBefore;
      const unscaledY = mouseYOnCanvas / zoomBefore;

      // Scale origin calculations assuming "top center" origin settings
      const newCanvasTopInContainer = canvasTopInContainer;
      const newCanvasLeftInContainer = canvasLeftInContainer - (canvasWidth * (zoomAfterFixed - zoomBefore)) / 2;

      // Mouse client position relative to view arena
      const mouseViewportX = e.clientX - rectContainer.left;
      const mouseViewportY = e.clientY - rectContainer.top;

      const scrollLeftAfter = newCanvasLeftInContainer + (unscaledX * zoomAfterFixed) - mouseViewportX;
      const scrollTopAfter = newCanvasTopInContainer + (unscaledY * zoomAfterFixed) - mouseViewportY;

      setZoom(zoomAfterFixed);
      
      // Smoothly update scrolling positions on next animation frame
      requestAnimationFrame(() => {
        container.scrollLeft = scrollLeftAfter;
        container.scrollTop = scrollTopAfter;
      });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, [zoom, setZoom]);

  // Translate coordinates helper
  const gridToScreen = useCallback((gx: number, gy: number) => {
    const dx = (gx - gy) * (cellW / 2);
    const dy = (gx + gy) * (cellH / 2);
    return {
      x: mapCenterX + dx,
      y: mapCenterY + dy
    };
  }, [cellW, cellH, mapCenterX, mapCenterY]);

  const screenToGrid = useCallback((sx: number, sy: number) => {
    const relX = sx - mapCenterX;
    const relY = sy - mapCenterY;
    const u = relX / (cellW / 2);
    const v = relY / (cellH / 2);
    const gx = Math.floor((v + u) / 2);
    const gy = Math.floor((v - u) / 2);
    return { gx, gy };
  }, [cellW, cellH, mapCenterX, mapCenterY]);

  // Save map state as a custom serialized JSON (.sugarmap file layout)
  const handleSaveMap = () => {
    const list = placedElements.map(el => ({
      fileName: el.fileName,
      fileType: el.fileType,
      gx: el.gx,
      gy: el.gy
    }));

    const output = {
      appletId: 'westwood-map',
      gridSize,
      gridEngine,
      elements: list
    };

    const str = JSON.stringify(output, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theater_map.sugarmap';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load custom map layout (.sugarmap file)
  const handleLoadMap = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sugarmap';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = event.target?.result as string;
          const parsed = JSON.parse(raw);

          if (!parsed.elements || !Array.isArray(parsed.elements)) {
            alert('Invalid .sugarmap layout file');
            return;
          }

          if (parsed.gridSize) setGridSize(Number(parsed.gridSize));
          if (parsed.gridEngine) setGridEngine(parsed.gridEngine);

          // Track which files are loaded, flag missing files
          const missedSet = new Set<string>();
          const matchingElements: PlacedElement[] = parsed.elements.map((el: any) => {
            const matchedFile = loadedFiles.find(f => f.name === el.fileName);
            if (!matchedFile) {
              missedSet.add(el.fileName);
            }

            return {
              id: `loaded-${Date.now()}-${Math.random()}`,
              fileName: el.fileName,
              fileType: el.fileType,
              content: matchedFile ? matchedFile.content : null,
              gx: Number(el.gx),
              gy: Number(el.gy),
              width: getCachedCanvas(el.fileName).width,
              height: getCachedCanvas(el.fileName).height
            } as PlacedElement;
          });

          setPlacedElements(matchingElements);
          setMissingFiles(Array.from(missedSet));
          setSelectedIds(new Set());
          setToolMode('select');
        } catch (err) {
          alert('Failed to parse .sugarmap file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Visual redraw render loop on HTML Canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid board backdrop
    ctx.fillStyle = '#0b0f19'; 
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. Render active diamond isometric grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gridSize; x++) {
      const pTop = gridToScreen(x, 0);
      const pBottom = gridToScreen(x, gridSize);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBottom.x, pBottom.y);
      ctx.stroke();
    }
    for (let y = 0; y <= gridSize; y++) {
      const pTop = gridToScreen(0, y);
      const pBottom = gridToScreen(gridSize, y);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBottom.x, pBottom.y);
      ctx.stroke();
    }

    // 2. Draw elements back-to-front sorting
    const sortedElements = [...placedElements].sort((a, b) => {
      const offsetA = a.gx + a.gy;
      const offsetB = b.gx + b.gy;
      if (offsetA !== offsetB) return offsetA - offsetB;
      return a.gx - b.gx;
    });

    sortedElements.forEach(item => {
      const cached = getCachedCanvas(item.fileName);

      const dx = (item.gx - item.gy) * (cellW / 2);
      const dy = (item.gx + item.gy) * (cellH / 2);

      let minX = 0;
      let minY = 0;

      if (item.fileType === 'TMP') {
        const tmp = item.content as TmpFile;
        if (tmp) {
          let fileMinX = Infinity;
          let fileMinY = Infinity;
          const activeTiles = tmp.tiles.filter(t => t);
          if (activeTiles.length > 0) {
            const mult = tmp.cy / 2;
            activeTiles.forEach(tile => {
              const h = tile.header;
              const elev = h.height * mult;
              fileMinX = Math.min(fileMinX, h.x);
              fileMinY = Math.min(fileMinY, h.y - elev);
              if (h.has_extra_data) {
                fileMinX = Math.min(fileMinX, h.x_extra);
                fileMinY = Math.min(fileMinY, h.y_extra - elev);
              }
            });
            minX = fileMinX;
            minY = fileMinY;
          }
        } else {
          // Placeholder offsets
          minX = -cached.width / 2;
          minY = -cached.height / 2;
        }
      } else {
        minX = -cached.width / 2;
        minY = -cached.height / 2;
      }

      const drawX = mapCenterX + dx + minX;
      const drawY = mapCenterY + dy + minY;

      ctx.drawImage(cached, drawX, drawY);

      // Selected diamond/box outlines (only visible in select mode so editing view remains clean and unobstructed)
      if (toolMode === 'select' && selectedIds.has(item.id)) {
        drawElementSelectionOutline(ctx, item, drawX, drawY, cached.width, cached.height);
      }
    });

    // 3. Stamp Placement Ghost Frame
    if (toolMode === 'stamp' && activeStampIndex !== null && hoverGrid) {
      const file = loadedFiles[activeStampIndex];
      const cached = getCachedCanvas(file.name);
      if (cached) {
        ctx.save();
        ctx.globalAlpha = 0.55;

        const dx = (hoverGrid.gx - hoverGrid.gy) * (cellW / 2);
        const dy = (hoverGrid.gx + hoverGrid.gy) * (cellH / 2);

        let minX = 0;
        let minY = 0;

        if (file.fileType === 'TMP') {
          const tmp = file.content as TmpFile;
          let fileMinX = Infinity;
          let fileMinY = Infinity;
          const activeTiles = tmp.tiles.filter(t => t);
          if (activeTiles.length > 0) {
            const mult = tmp.cy / 2;
            activeTiles.forEach(tile => {
              const h = tile.header;
              const elev = h.height * mult;
              fileMinX = Math.min(fileMinX, h.x);
              fileMinY = Math.min(fileMinY, h.y - elev);
              if (h.has_extra_data) {
                fileMinX = Math.min(fileMinX, h.x_extra);
                fileMinY = Math.min(fileMinY, h.y_extra - elev);
              }
            });
            minX = fileMinX;
            minY = fileMinY;
          }
        } else {
          minX = -cached.width / 2;
          minY = -cached.height / 2;
        }

        const drawX = mapCenterX + dx + minX;
        const drawY = mapCenterY + dy + minY;

        ctx.drawImage(cached, drawX, drawY);

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(drawX - 1, drawY - 1, cached.width + 2, cached.height + 2);
        ctx.restore();
      }
    }

    // 4. Drag Select box
    if (isBoxSelecting && boxStart && boxEnd) {
      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);

      const rx = Math.min(boxStart.x, boxEnd.x);
      const ry = Math.min(boxStart.y, boxEnd.y);
      const rw = Math.abs(boxStart.x - boxEnd.x);
      const rh = Math.abs(boxStart.y - boxEnd.y);

      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    // 4a. Custom Brush Drag Select Box
    if (toolMode === 'customBrush' && isCustomBrushSelecting && customBrushSelectMode === 'box' && customBrushBoxStart && customBrushBoxEnd) {
      ctx.save();
      ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);

      const rx = Math.min(customBrushBoxStart.x, customBrushBoxEnd.x);
      const ry = Math.min(customBrushBoxStart.y, customBrushBoxEnd.y);
      const rw = Math.abs(customBrushBoxStart.x - customBrushBoxEnd.x);
      const rh = Math.abs(customBrushBoxStart.y - customBrushBoxEnd.y);

      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

    // 4b. Custom Brush Drag Select Lasso
    if (toolMode === 'customBrush' && isCustomBrushSelecting && customBrushSelectMode === 'lasso' && customBrushLassoPoints.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(217, 70, 239, 0.08)';
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);

      ctx.beginPath();
      ctx.moveTo(customBrushLassoPoints[0].x, customBrushLassoPoints[0].y);
      for (let i = 1; i < customBrushLassoPoints.length; i++) {
        ctx.lineTo(customBrushLassoPoints[i].x, customBrushLassoPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Drawing Cursor / Pixel Hover Highlighter
    let cursorDrawn = false;
    if (['draw', 'eraser', 'picker', 'clone'].includes(toolMode) && hoveredCanvasMouseRef.current) {
      const mouseX = hoveredCanvasMouseRef.current.x;
      const mouseY = hoveredCanvasMouseRef.current.y;
      ctx.save();

      const radius = Math.floor(brushSize / 2);
      for (let bdy = -radius; bdy <= radius; bdy++) {
        for (let bdx = -radius; bdx <= radius; bdx++) {
          if (bdx * bdx + bdy * bdy > radius * radius + 0.5) continue;
          
          const currentCavX = Math.floor(mouseX) + bdx;
          const currentCavY = Math.floor(mouseY) + bdy;

          const hitBlock = findElementAtCoords(currentCavX, currentCavY);
          if (!hitBlock) continue;

          const { item: activeEditElement, rx: targetRx, ry: targetRy } = hitBlock;
          if (selectedIds.size > 0 && !selectedIds.has(activeEditElement.id)) continue;

          const bHit = findPixelInElement(activeEditElement.fileType, activeEditElement.content, targetRx, targetRy);
          if (!bHit) continue;

          // Westwood diamond shape constraint check for base tile edits
          let isInside = true;
          if (bHit.fileType === 'TMP' && bHit.cellType === 'base') {
            const tmp = activeEditElement.content as TmpFile;
            const tile = tmp.tiles[bHit.tileIndex!];
            if (tile) {
              const lx = bHit.pixelIndex % tile.cx;
              const ly = Math.floor(bHit.pixelIndex / tile.cx);
              if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
                isInside = false;
              }
            }
          }

          if (isInside) {
            cursorDrawn = true;
            let previewColor = palette[selectedColorIndex];
            let hasColor = toolMode !== 'eraser';

            if (toolMode === 'clone') {
              if (cloneSource) {
                const anchorX = strokeStartCoordinate ? strokeStartCoordinate.px : Math.floor(mouseX);
                const anchorY = strokeStartCoordinate ? strokeStartCoordinate.py : Math.floor(mouseY);
                
                const diffX = currentCavX - anchorX;
                const diffY = currentCavY - anchorY;

                const sampleCavX = cloneSource.canvasX! + diffX;
                const sampleCavY = cloneSource.canvasY! + diffY;

                const sampleBlock = findElementAtCoords(sampleCavX, sampleCavY);
                if (sampleBlock) {
                  const { item: sItem, rx: sRx, ry: sRy } = sampleBlock;
                  const sHit = findPixelInElement(sItem.fileType, sItem.content, sRx, sRy);
                  if (sHit) {
                    let srcVal = 0;
                    if (sHit.fileType === 'TMP' && sHit.tileIndex !== undefined) {
                      const sTmp = sItem.content as TmpFile;
                      const sTile = sTmp.tiles[sHit.tileIndex];
                      if (sTile) {
                        const sData = sHit.cellType === 'base' ? sTile.data : sTile.extraImageData;
                        if (sData) {
                          srcVal = sData[sHit.pixelIndex];
                        }
                      }
                    } else {
                      const sShp = sItem.content as ShpFile;
                      if (sShp.frames && sShp.frames[0]) {
                        srcVal = sShp.frames[0].data[sHit.pixelIndex];
                      }
                    }
                    previewColor = palette[srcVal];
                    hasColor = true;
                  } else {
                    hasColor = false;
                  }
                } else {
                  hasColor = false;
                }
              } else {
                hasColor = false;
              }
            }

            // Check Lock index 0 check
            if (lockColorZero) {
              let currentVal = 0;
              if (bHit.fileType === 'TMP' && bHit.tileIndex !== undefined) {
                const tmp = activeEditElement.content as TmpFile;
                const tile = tmp.tiles[bHit.tileIndex];
                if (tile) {
                  const data = bHit.cellType === 'base' ? tile.data : tile.extraImageData;
                  if (data) currentVal = data[bHit.pixelIndex];
                }
              } else {
                const shp = activeEditElement.content as ShpFile;
                if (shp.frames && shp.frames[0]) {
                  currentVal = shp.frames[0].data[bHit.pixelIndex];
                }
              }
              if (currentVal === 0 || (hasColor && previewColor && selectedColorIndex === 0)) {
                continue;
              }
            }

            if (hasColor && previewColor) {
              ctx.fillStyle = `rgb(${previewColor.r}, ${previewColor.g}, ${previewColor.b})`;
              ctx.fillRect(currentCavX, currentCavY, 1, 1);
            } else if (toolMode === 'eraser') {
              ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
              ctx.fillRect(currentCavX, currentCavY, 1, 1);
            }

            ctx.save();
            // Outer dark outline for clear visibility on bright elements
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 1.0;
            ctx.strokeRect(currentCavX - 0.15, currentCavY - 0.15, 1.3, 1.3);

            // Inner light outline for clear visibility on dark elements (handling clone tool warnings as yellow/orange)
            ctx.strokeStyle = (toolMode === 'clone' && !cloneSource) ? '#f59e0b' : '#ffffff';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(currentCavX - 0.05, currentCavY - 0.05, 1.1, 1.1);
            ctx.restore();
          }
        }
      }
      ctx.restore();

      if (!cursorDrawn && hoveredCanvasMouseRef.current) {
        // Draw the fallback floating brush size indicator centered at current mouse pixel
        const mouseX = hoveredCanvasMouseRef.current.x;
        const mouseY = hoveredCanvasMouseRef.current.y;
        const radius = Math.floor(brushSize / 2);
        const cursorX = Math.floor(mouseX) - radius;
        const cursorY = Math.floor(mouseY) - radius;
        const size = brushSize;

        ctx.save();
        // Outer dark outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(cursorX - 0.15, cursorY - 0.15, size + 0.3, size + 0.3);

        // Inner white / warning outline
        ctx.strokeStyle = (toolMode === 'clone' && !cloneSource) ? '#f59e0b' : '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(cursorX - 0.05, cursorY - 0.05, size + 0.1, size + 0.1);
        ctx.restore();
      }
    }

    // 5b. Custom Brush Floating Cursor stamp preview
    if (toolMode === 'customBrush' && customBrushSubMode === 'paint' && customBrush && hoveredCanvasMouseRef.current) {
      ctx.save();
      const mouseX = hoveredCanvasMouseRef.current.x;
      const mouseY = hoveredCanvasMouseRef.current.y;
      
      let activeX = mouseX;
      let activeY = mouseY;

      if (customBrushSnap) {
        ctx.save();
        const anchors = getAnchorPoints();
        ctx.fillStyle = 'rgba(236, 72, 153, 0.6)'; // pink/magenta
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 0.5;
        anchors.forEach(pt => {
          const dx = pt.x - mouseX;
          const dy = pt.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) { // show anchors within 150px of cursor
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }
        });
        ctx.restore();

        // snap to closest anchor
        let bestDist = 15; // 15 pixel snap threshold
        let bestAnchor = null;
        const anchorsList = getAnchorPoints();
        for (const pt of anchorsList) {
          const dx = pt.x - mouseX;
          const dy = pt.y - mouseY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestDist) {
            bestDist = d;
            bestAnchor = pt;
          }
        }
        if (bestAnchor) {
          activeX = bestAnchor.x;
          activeY = bestAnchor.y;
        }
      }

      const W = customBrush.width;
      const H = customBrush.height;
      const brushCenterX = Math.floor(activeX - W / 2);
      const brushCenterY = Math.floor(activeY - H / 2);

      // Render overlay pixel colors
      for (let bdy = 0; bdy < H; bdy++) {
        for (let bdx = 0; bdx < W; bdx++) {
          const brushColorIdx = customBrush.pixels[bdy * W + bdx];
          if (brushColorIdx === null) continue;

          const cx = brushCenterX + bdx;
          const cy = brushCenterY + bdy;

          const previewColor = palette[brushColorIdx];
          if (previewColor) {
            ctx.fillStyle = `rgba(${previewColor.r}, ${previewColor.g}, ${previewColor.b}, 0.75)`;
            ctx.fillRect(cx, cy, 1, 1);
          }
        }
      }

      if (customBrushVerticalLine) {
        ctx.save();
        ctx.strokeStyle = '#f472b6'; // pink
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        const lineX = brushCenterX + Math.floor(W / 2) + 0.5;
        ctx.moveTo(lineX, brushCenterY - 1000);
        ctx.lineTo(lineX, brushCenterY + H + 1000);
        ctx.stroke();
        ctx.restore();
      }

      ctx.strokeStyle = '#f472b6'; // bubblegum pink
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(brushCenterX - 0.5, brushCenterY - 0.5, W + 1, H + 1);
      ctx.restore();
    }

    // 5c. Static Clone Stamp Source Outline Anchor
    if (toolMode === 'clone' && cloneSource && cloneSource.canvasX !== undefined && cloneSource.canvasY !== undefined) {
      ctx.save();
      // Outer dark shadow outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(cloneSource.canvasX - 0.15, cloneSource.canvasY - 0.15, 1.3, 1.3);

      // Inner bright orange / gold outline for visibility
      ctx.strokeStyle = '#f59e0b'; // Amber-orange
      ctx.lineWidth = 0.6;
      ctx.strokeRect(cloneSource.canvasX - 0.05, cloneSource.canvasY - 0.05, 1.1, 1.1);
      ctx.restore();
    }
  }, [
    placedElements,
    hoverGrid,
    toolMode,
    activeStampIndex,
    loadedFiles,
    getCachedCanvas,
    selectedIds,
    isBoxSelecting,
    boxStart,
    boxEnd,
    gridSize,
    gridToScreen,
    cellW,
    cellH,
    brushSize,
    selectedColorIndex,
    cloneSource,
    strokeStartCoordinate,
    palette,
    customBrush,
    customBrushSelectMode,
    customBrushSubMode,
    isCustomBrushSelecting,
    customBrushBoxStart,
    customBrushBoxEnd,
    customBrushLassoPoints,
    customBrushVerticalLine,
    customBrushSnap
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Click handler to select placing stamp
  const handleSelectStamp = (idx: number) => {
    setActiveStampIndex(idx);
    setToolMode('stamp');
  };

  // Edge helper types for isometric puzzle solver
  const getEdgeMetrics = (el: PlacedElement) => {
    const result = { nw: [] as number[], ne: [] as number[], sw: [] as number[], se: [] as number[] };
    
    let data: Uint8Array | null = null;
    let cx = 48;
    let cy = 24;
    
    if (el.fileType === 'TMP') {
      const tmp = el.content as TmpFile;
      const tile = tmp?.tiles?.[0];
      if (tile) {
        data = tile.data;
        cx = tile.cx;
        cy = tile.cy;
      }
    } else {
      const shp = el.content as ShpFile;
      const frame = shp?.frames?.[0];
      if (frame) {
        data = frame.data;
        cx = frame.w;
        cy = frame.h;
      }
    }
    
    if (!data) {
      const blank = new Array(12).fill(0);
      return { nw: blank, ne: blank, sw: blank, se: blank };
    }

    const samples = 12;
    const hX = cx / 2;
    const hY = cy / 2;

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);

      // 1. NW: from Left (0, hY) to Top (hX, 0)
      const nwX = Math.round(0 * (1 - t) + hX * t);
      const nwY = Math.round(hY * (1 - t) + 0 * t);
      result.nw.push(data[nwY * cx + nwX] || 0);

      // 2. NE: from Top (hX, 0) to Right (cx - 1, hY)
      const neX = Math.round(hX * (1 - t) + (cx - 1) * t);
      const neY = Math.round(0 * (1 - t) + hY * t);
      result.ne.push(data[neY * cx + neX] || 0);

      // 3. SW: from Left (0, hY) to Bottom (hX, cy - 1)
      const swX = Math.round(0 * (1 - t) + hX * t);
      const swY = Math.round(hY * (1 - t) + (cy - 1) * t);
      result.sw.push(data[swY * cx + swX] || 0);

      // 4. SE: from Right (cx - 1, hY) to Bottom (hX, cy - 1)
      const seX = Math.round((cx - 1) * (1 - t) + hX * t);
      const seY = Math.round(hY * (1 - t) + (cy - 1) * t);
      result.se.push(data[seY * cx + seX] || 0);
    }

    return result;
  };

  const getMatchError = (edge1: number[], edge2: number[]): number => {
    let error = 0;
    const len = Math.min(edge1.length, edge2.length);
    for (let i = 0; i < len; i++) {
      if (edge1[i] !== edge2[i]) {
        error += 1;
      }
    }
    return error;
  };

  // Solving isometric tiles placements aligning edges matching textures
  const solveSelectedIsometricPuzzle = () => {
    const selectedElements = placedElements.filter(el => selectedIds.has(el.id));
    const targetElements = selectedElements.length > 0 ? selectedElements : placedElements;
    if (targetElements.length === 0) return;

    // Track on undo list
    setDeletedPlacedElementsHistory(prev => [placedElements, ...prev]);
    setDeletedPlacedElementsRedoHistory([]);
    setActionHistory(prev => ['delete', ...prev]);
    setActionRedoHistory([]);

    const N = targetElements.length;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);

    const elementMetrics = targetElements.map(el => ({
      el,
      metrics: getEdgeMetrics(el),
    }));

    let totalGx = 0;
    let totalGy = 0;
    targetElements.forEach(el => {
      totalGx += el.gx;
      totalGy += el.gy;
    });
    const avgGx = Math.round(totalGx / N);
    const avgGy = Math.round(totalGy / N);

    const startGx = Math.max(1, avgGx - Math.round(cols / 2));
    const startGy = Math.max(1, avgGy - Math.round(rows / 2));

    const grid = Array.from(
      { length: cols },
      () => new Array(rows).fill(null) as (typeof elementMetrics[0] | null)[]
    );

    const placedIndices = new Set<number>();

    // Seed the first element in the center of board
    const startC = Math.floor(cols / 2);
    const startR = Math.floor(rows / 2);
    grid[startC][startR] = elementMetrics[0];
    placedIndices.add(0);

    while (placedIndices.size < N) {
      let bestScore = Infinity;
      let bestItemIdx = -1;
      let bestC = -1;
      let bestR = -1;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (grid[c][r] !== null) continue;

          const neighbors: { dir: 'NW' | 'SE' | 'NE' | 'SW'; tile: { el: PlacedElement; metrics: any } }[] = [];
          if (c > 0 && grid[c - 1][r]) neighbors.push({ dir: 'NW', tile: grid[c - 1][r]! });
          if (c < cols - 1 && grid[c + 1][r]) neighbors.push({ dir: 'SE', tile: grid[c + 1][r]! });
          if (r > 0 && grid[c][r - 1]) neighbors.push({ dir: 'NE', tile: grid[c][r - 1]! });
          if (r < rows - 1 && grid[c][r + 1]) neighbors.push({ dir: 'SW', tile: grid[c][r + 1]! });

          if (neighbors.length === 0) continue;

          for (let i = 0; i < N; i++) {
            if (placedIndices.has(i)) continue;

            const candidate = elementMetrics[i];
            let error = 0;

            for (const nb of neighbors) {
              if (nb.dir === 'NW') {
                error += getMatchError(nb.tile.metrics.se, candidate.metrics.nw);
              } else if (nb.dir === 'SE') {
                error += getMatchError(candidate.metrics.se, nb.tile.metrics.nw);
              } else if (nb.dir === 'NE') {
                error += getMatchError(nb.tile.metrics.sw, candidate.metrics.ne);
              } else if (nb.dir === 'SW') {
                error += getMatchError(candidate.metrics.sw, nb.tile.metrics.ne);
              }
            }

            // Filename prefix match bonus (LATSxxx, CLIFFxxx, etc.)
            const prefixMatches = neighbors.some(nb => {
              const name1 = nb.tile.el.fileName.slice(0, 4).toLowerCase();
              const name2 = candidate.el.fileName.slice(0, 4).toLowerCase();
              return name1 === name2;
            });

            const totalScore = error + (prefixMatches ? -5 : 0);

            if (totalScore < bestScore) {
              bestScore = totalScore;
              bestItemIdx = i;
              bestC = c;
              bestR = r;
            }
          }
        }
      }

      if (bestItemIdx !== -1) {
        grid[bestC][bestR] = elementMetrics[bestItemIdx];
        placedIndices.add(bestItemIdx);
      } else {
        // Fallback grid filler
        let forcedC = -1;
        let forcedR = -1;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (grid[c][r] === null) {
              forcedC = c;
              forcedR = r;
              break;
            }
          }
          if (forcedC !== -1) break;
        }

        let forcedItemIdx = -1;
        for (let i = 0; i < N; i++) {
          if (!placedIndices.has(i)) {
            forcedItemIdx = i;
            break;
          }
        }

        if (forcedC !== -1 && forcedItemIdx !== -1) {
          grid[forcedC][forcedR] = elementMetrics[forcedItemIdx];
          placedIndices.add(forcedItemIdx);
        } else {
          break;
        }
      }
    }

    // Precalculate column widths and row heights for full isometric tiles of any size to avoid overlapping.
    const colWidths = new Array(cols).fill(1);
    const rowHeights = new Array(rows).fill(1);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const item = grid[c][r];
        if (item) {
          let cw = 1;
          let ch = 1;
          if (item.el.fileType === 'TMP') {
            const tmp = item.el.content as TmpFile;
            cw = tmp.cblocks_x || 1;
            ch = tmp.cblocks_y || 1;
          }
          if (cw > colWidths[c]) colWidths[c] = cw;
          if (ch > rowHeights[r]) rowHeights[r] = ch;
        }
      }
    }

    setPlacedElements(prev => {
      return prev.map(el => {
        const matchedIndex = targetElements.findIndex(t => t.id === el.id);
        if (matchedIndex === -1) return el;

        let targetC = 0;
        let targetR = 0;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (grid[c][r]?.el.id === el.id) {
              targetC = c;
              targetR = r;
              break;
            }
          }
        }

        // Compute accumulated offset for this targetC and targetR
        let colOffset = 0;
        for (let i = 0; i < targetC; i++) {
          colOffset += colWidths[i];
        }

        let rowOffset = 0;
        for (let j = 0; j < targetR; j++) {
          rowOffset += rowHeights[j];
        }

        return {
          ...el,
          gx: startGx + colOffset,
          gy: startGy + rowOffset,
        };
      });
    });

    setToolMode('select');
  };

  const placeAllFilesOnCanvas = () => {
    if (loadedFiles.length === 0) return;

    let currentGx = 2;
    let currentGy = 2;
    const newlyPlaced: PlacedElement[] = [];

    loadedFiles.forEach((f, i) => {
      let cw = 1;
      let ch = 1;
      if (f.fileType === 'TMP') {
        cw = (f.content as TmpFile).cblocks_x;
        ch = (f.content as TmpFile).cblocks_y;
      }

      newlyPlaced.push({
        id: `all-${Date.now()}-${i}`,
        fileName: f.name,
        fileType: f.fileType,
        content: f.content,
        gx: currentGx,
        gy: currentGy,
        width: getCachedCanvas(f.name).width,
        height: getCachedCanvas(f.name).height,
      });

      currentGx += cw + 1;
      if (currentGx > gridSize - 10) {
        currentGx = 2;
        currentGy += ch + 2;
      }
    });

    setPlacedElements(newlyPlaced);
    setSelectedIds(new Set());
    setToolMode('select');
  };

  // Frontmost Element Helper targeted at mouse coordinate
  const findElementAtCoords = (mouseX: number, mouseY: number) => {
    let matchedItem: PlacedElement | null = null;
    let matchedOffset = { rx: 0, ry: 0 };
    
    // Reverse sort for front-to-back click detection
    const reverseSorted = [...placedElements].sort((a, b) => {
      const offsetA = a.gx + a.gy;
      const offsetB = b.gx + b.gy;
      if (offsetA !== offsetB) return offsetB - offsetA;
      return b.gx - a.gx;
    });

    for (const item of reverseSorted) {
      if (!item.content) continue; // Skip placeholders
      const cached = getCachedCanvas(item.fileName);
      
      const dx = (item.gx - item.gy) * (cellW / 2);
      const dy = (item.gx + item.gy) * (cellH / 2);
      
      let minX = 0; let minY = 0;
      if (item.fileType === 'TMP') {
        const tmp = item.content as TmpFile;
        let fileMinX = Infinity;
        let fileMinY = Infinity;
        const activeTiles = tmp.tiles.filter(t => t);
        if (activeTiles.length > 0) {
          const mult = tmp.cy / 2;
          activeTiles.forEach(tile => {
            const h = tile.header;
            const elev = h.height * mult;
            fileMinX = Math.min(fileMinX, h.x);
            fileMinY = Math.min(fileMinY, h.y - elev);
            if (h.has_extra_data) {
              fileMinX = Math.min(fileMinX, h.x_extra);
              fileMinY = Math.min(fileMinY, h.y_extra - elev);
            }
          });
          minX = fileMinX;
          minY = fileMinY;
        }
      } else {
        minX = -cached.width / 2;
        minY = -cached.height / 2;
      }

      const screenLeft = mapCenterX + dx + minX;
      const screenTop = mapCenterY + dy + minY;

      const rx = mouseX - screenLeft;
      const ry = mouseY - screenTop;

      if (
        rx >= 0 && 
        rx <= cached.width && 
        ry >= 0 && 
        ry <= cached.height
      ) {
        const hit = findPixelInElement(item.fileType, item.content, rx, ry);
        if (hit) {
          matchedItem = item;
          matchedOffset = { rx, ry };
          break;
        }
      }
    }

    return matchedItem ? { item: matchedItem, ...matchedOffset } : null;
  };

  const getAnchorPoints = (): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];

    placedElements.forEach(item => {
      if (!item.content) return;
      const cached = getCachedCanvas(item.fileName);
      const dx = (item.gx - item.gy) * (cellW / 2);
      const dy = (item.gx + item.gy) * (cellH / 2);

      let minX = 0; let minY = 0;
      if (item.fileType === 'TMP') {
        const tmp = item.content as TmpFile;
        let fileMinX = Infinity;
        let fileMinY = Infinity;
        const activeTiles = tmp.tiles.filter((t): t is Tile => t !== null);
        if (activeTiles.length === 0) return;
        const mult = tmp.cy / 2;
        activeTiles.forEach(tile => {
          const h = tile.header;
          const elev = h.height * mult;
          fileMinX = Math.min(fileMinX, h.x);
          fileMinY = Math.min(fileMinY, h.y - elev);
          if (h.has_extra_data) {
            fileMinX = Math.min(fileMinX, h.x_extra);
            fileMinY = Math.min(fileMinY, h.y_extra - elev);
          }
        });
        minX = fileMinX;
        minY = fileMinY;

        const screenLeft = mapCenterX + dx + minX;
        const screenTop = mapCenterY + dy + minY;

        tmp.tiles.forEach(tile => {
          if (!tile) return;
          const h = tile.header;
          const elev = h.height * mult;

          // Base tile anchor points (8 points)
          const bx = h.x - minX;
          const by = h.y - elev - minY;
          const tx = screenLeft + bx;
          const ty = screenTop + by;
          const tcx = tile.cx;
          const tcy = tile.cy;

          points.push({ x: tx, y: ty });
          points.push({ x: tx + tcx, y: ty });
          points.push({ x: tx, y: ty + tcy });
          points.push({ x: tx + tcx, y: ty + tcy });
          points.push({ x: tx + tcx / 2, y: ty });
          points.push({ x: tx + tcx / 2, y: ty + tcy });
          points.push({ x: tx, y: ty + tcy / 2 });
          points.push({ x: tx + tcx, y: ty + tcy / 2 });

          // Height extra tile anchor points (8 points)
          if (h.has_extra_data && tile.extraImageData) {
            const ex = h.x_extra - minX;
            const ey = h.y_extra - elev - minY;
            const etx = screenLeft + ex;
            const ety = screenTop + ey;
            const ewidth = h.cx_extra;
            const eheight = h.cy_extra;

            points.push({ x: etx, y: ety });
            points.push({ x: etx + ewidth, y: ety });
            points.push({ x: etx, y: ety + eheight });
            points.push({ x: etx + ewidth, y: ety + eheight });
            points.push({ x: etx + ewidth / 2, y: ety });
            points.push({ x: etx + ewidth / 2, y: ety + eheight });
            points.push({ x: etx, y: ety + eheight / 2 });
            points.push({ x: etx + ewidth, y: ety + eheight / 2 });
          }
        });

      } else {
        // SHP File
        minX = -cached.width / 2;
        minY = -cached.height / 2;
        const screenLeft = mapCenterX + dx + minX;
        const screenTop = mapCenterY + dy + minY;
        const w = cached.width;
        const h = cached.height;

        points.push({ x: screenLeft, y: screenTop });
        points.push({ x: screenLeft + w, y: screenTop });
        points.push({ x: screenLeft, y: screenTop + h });
        points.push({ x: screenLeft + w, y: screenTop + h });
        points.push({ x: screenLeft + w / 2, y: screenTop });
        points.push({ x: screenLeft + w / 2, y: screenTop + h });
        points.push({ x: screenLeft, y: screenTop + h / 2 });
        points.push({ x: screenLeft + w, y: screenTop + h / 2 });
      }
    });

    return points;
  };

  // Perform Custom Brush Paint stroke helper
  const executeCustomBrushPaint = (mouseX: number, mouseY: number, isStartingStroke: boolean = false) => {
    if (!customBrush) return;
    
    let activeX = mouseX;
    let activeY = mouseY;

    if (customBrushSnap) {
      const anchors = getAnchorPoints();
      let bestDist = 15; // 15 pixel snap threshold
      let bestAnchor = null;
      for (const pt of anchors) {
        const dx = pt.x - mouseX;
        const dy = pt.y - mouseY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          bestAnchor = pt;
        }
      }
      if (bestAnchor) {
        activeX = bestAnchor.x;
        activeY = bestAnchor.y;
      }
    }

    if (isStartingStroke) {
      pushHistoryAndCommit();
    }

    const W = customBrush.width;
    const H = customBrush.height;
    const brushCenterX = Math.floor(activeX - W / 2);
    const brushCenterY = Math.floor(activeY - H / 2);

    let changed = false;
    const changedFiles = new Set<string>();

    for (let bdy = 0; bdy < H; bdy++) {
      for (let bdx = 0; bdx < W; bdx++) {
        const brushColor = customBrush.pixels[bdy * W + bdx];
        if (brushColor === null) continue; // transparent pixel in pattern

        const targetCanvasX = brushCenterX + bdx;
        const targetCanvasY = brushCenterY + bdy;

        const hitBlock = findElementAtCoords(targetCanvasX, targetCanvasY);
        if (!hitBlock) continue;

        const { item: activeEditElement, rx: targetRx, ry: targetRy } = hitBlock;
        if (selectedIds.size > 0 && !selectedIds.has(activeEditElement.id)) continue;

        const tHit = findPixelInElement(activeEditElement.fileType, activeEditElement.content, targetRx, targetRy);
        if (tHit) {
          if (tHit.fileType === 'TMP' && tHit.tileIndex !== undefined) {
            const tmp = activeEditElement.content as TmpFile;
            const tile = tmp.tiles[tHit.tileIndex];
            if (tile) {
              if (tHit.cellType === 'base') {
                paintBrushOnData(tile.data, tile.cx, tile.cy, tHit.pixelIndex, 1, brushColor, true, true, tile.cx, tile.cy);
                changedFiles.add(activeEditElement.fileName);
                changed = true;
              } else if (tile.extraImageData && tHit.cellType === 'extra') {
                const h = tile.header;
                paintBrushOnData(tile.extraImageData, h.cx_extra, h.cy_extra, tHit.pixelIndex, 1, brushColor, true);
                changedFiles.add(activeEditElement.fileName);
                changed = true;
              }
            }
          } else {
            const shp = activeEditElement.content as ShpFile;
            if (shp.frames && shp.frames[0]) {
              const frame = shp.frames[0];
              paintBrushOnData(frame.data, frame.w, frame.h, tHit.pixelIndex, 1, brushColor, true);
              changedFiles.add(activeEditElement.fileName);
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      changedFiles.forEach(fName => invalidateCache(fName));
      render();
    }
  };

  // Perform Paint stroke helper
  const executePaintAtScreenCoords = (mouseX: number, mouseY: number, isStartingStroke: boolean = false) => {
    // 1. Pipette Color Picker tool trigger
    if (toolMode === 'picker') {
      const elementUnderCursor = findElementAtCoords(mouseX, mouseY);
      if (!elementUnderCursor) return;
      const { item: activeEditElement, rx, ry } = elementUnderCursor;
      const hit = findPixelInElement(activeEditElement.fileType, activeEditElement.content, rx, ry);
      if (!hit) return;

      let value = 0;
      if (hit.fileType === 'TMP' && hit.tileIndex !== undefined) {
        const tmp = activeEditElement.content as TmpFile;
        const tile = tmp.tiles[hit.tileIndex];
        if (tile) {
          value = hit.cellType === 'base' ? tile.data[hit.pixelIndex] : (tile.extraImageData ? tile.extraImageData[hit.pixelIndex] : 0);
        }
      } else {
        const shp = activeEditElement.content as ShpFile;
        if (shp.frames && shp.frames[0]) {
          value = shp.frames[0].data[hit.pixelIndex];
        }
      }

      setSelectedColorIndex(value);
      setToolMode('draw'); // Revert back to drawing immediately
      return;
    }

    // Capture stroke history point
    if (isStartingStroke) {
      pushHistoryAndCommit();
    }

    const radius = Math.floor(brushSize / 2);
    let mainChanged = false;
    const changedFiles = new Set<string>();

    const anchorX = strokeStartCoordinate ? strokeStartCoordinate.px : Math.floor(mouseX);
    const anchorY = strokeStartCoordinate ? strokeStartCoordinate.py : Math.floor(mouseY);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + 0.5) continue;

        const targetCanvasX = Math.floor(mouseX) + dx;
        const targetCanvasY = Math.floor(mouseY) + dy;

        const hitBlock = findElementAtCoords(targetCanvasX, targetCanvasY);
        if (!hitBlock) continue;

        const { item: activeEditElement, rx: targetRx, ry: targetRy } = hitBlock;
        if (selectedIds.size > 0 && !selectedIds.has(activeEditElement.id)) continue;

        const tHit = findPixelInElement(activeEditElement.fileType, activeEditElement.content, targetRx, targetRy);
        if (!tHit) continue;

        if (toolMode === 'clone') {
          if (!cloneSource) continue;

          let targetWidth = 1;
          let targetData: Uint8Array | null = null;
          let cx: number | undefined;
          let cy: number | undefined;

          if (tHit.fileType === 'TMP' && tHit.tileIndex !== undefined) {
            const tmp = activeEditElement.content as TmpFile;
            const tile = tmp.tiles[tHit.tileIndex];
            if (tile) {
              targetWidth = tHit.cellType === 'base' ? tile.cx : tile.header.cx_extra;
              targetData = tHit.cellType === 'base' ? tile.data : tile.extraImageData;
              cx = tile.cx;
              cy = tile.cy;
            }
          } else {
            const shp = activeEditElement.content as ShpFile;
            if (shp.frames && shp.frames[0]) {
              targetWidth = shp.frames[0].w;
              targetData = shp.frames[0].data;
            }
          }

          if (!targetData) continue;

          const targetXLocal = tHit.pixelIndex % targetWidth;
          const targetYLocal = Math.floor(tHit.pixelIndex / targetWidth);

          if (tHit.fileType === 'TMP' && tHit.cellType === 'base' && cx && cy) {
            if (!TmpParser.isInsideWestwoodDiamond(targetXLocal, targetYLocal, cx, cy)) {
              continue;
            }
          }

          if (lockColorZero && targetData[tHit.pixelIndex] === 0) {
            continue;
          }

          const diffX = targetCanvasX - anchorX;
          const diffY = targetCanvasY - anchorY;

          const sampleCavX = cloneSource.canvasX! + diffX;
          const sampleCavY = cloneSource.canvasY! + diffY;

          let srcValue = 0;
          const sampleBlock = findElementAtCoords(sampleCavX, sampleCavY);
          if (sampleBlock) {
            const { item: sItem, rx: sRx, ry: sRy } = sampleBlock;
            const sHit = findPixelInElement(sItem.fileType, sItem.content, sRx, sRy);
            if (sHit) {
              if (sHit.fileType === 'TMP' && sHit.tileIndex !== undefined) {
                const sTmp = sItem.content as TmpFile;
                const sTile = sTmp.tiles[sHit.tileIndex];
                if (sTile) {
                  const sData = sHit.cellType === 'base' ? sTile.data : sTile.extraImageData;
                  if (sData) {
                    srcValue = sData[sHit.pixelIndex];
                  }
                }
              } else {
                const sShp = sItem.content as ShpFile;
                if (sShp.frames && sShp.frames[0]) {
                  srcValue = sShp.frames[0].data[sHit.pixelIndex];
                }
              }
            }
          }

          if (lockColorZero && srcValue === 0) {
            continue;
          }

          if (targetData[tHit.pixelIndex] !== srcValue) {
            targetData[tHit.pixelIndex] = srcValue;
            changedFiles.add(activeEditElement.fileName);
            mainChanged = true;
          }
        } else {
          // Drawing / Eraser Paint Brush
          const colorValue = toolMode === 'eraser' ? 0 : selectedColorIndex;

          if (tHit.fileType === 'TMP' && tHit.tileIndex !== undefined) {
            const tmp = activeEditElement.content as TmpFile;
            const tile = tmp.tiles[tHit.tileIndex];
            if (tile) {
              if (tHit.cellType === 'base') {
                paintBrushOnData(tile.data, tile.cx, tile.cy, tHit.pixelIndex, 1, colorValue, lockColorZero, true, tile.cx, tile.cy);
                changedFiles.add(activeEditElement.fileName);
                mainChanged = true;
              } else if (tile.extraImageData && tHit.cellType === 'extra') {
                const h = tile.header;
                paintBrushOnData(tile.extraImageData, h.cx_extra, h.cy_extra, tHit.pixelIndex, 1, colorValue, lockColorZero);
                changedFiles.add(activeEditElement.fileName);
                mainChanged = true;
              }
            }
          } else {
            const shp = activeEditElement.content as ShpFile;
            if (shp.frames && shp.frames[0]) {
              const frame = shp.frames[0];
              paintBrushOnData(frame.data, frame.w, frame.h, tHit.pixelIndex, 1, colorValue, lockColorZero);
              changedFiles.add(activeEditElement.fileName);
              mainChanged = true;
            }
          }
        }
      }
    }

    if (mainChanged) {
      changedFiles.forEach(fName => invalidateCache(fName));
      render();
    }
  };

  // Mouse Down Click Handler
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Custom Brush Mode MouseDown Handling
    if (toolMode === 'customBrush') {
      if (e.button !== 0) return; // Left click only for custom brush action
      if (customBrushSubMode === 'select') {
        setIsCustomBrushSelecting(true);
        if (customBrushSelectMode === 'box') {
          setCustomBrushBoxStart({ x: mouseX, y: mouseY });
          setCustomBrushBoxEnd({ x: mouseX, y: mouseY });
        } else {
          setCustomBrushLassoPoints([{ x: mouseX, y: mouseY }]);
        }
      } else {
        // Paint brush mode
        setIsCurrentlyDrawing(true);
        executeCustomBrushPaint(mouseX, mouseY, true);
      }
      return;
    }

    // 1. Drawing painting modes trigger directly
    if (['draw', 'eraser', 'picker', 'clone'].includes(toolMode)) {
      if (e.button !== 0) return; // Left mouse click drawing only
      
      const elementUnderCursor = findElementAtCoords(mouseX, mouseY);
      let activeEditElement: PlacedElement | null = null;
      if (elementUnderCursor && selectedIds.has(elementUnderCursor.item.id)) {
        activeEditElement = elementUnderCursor.item;
      } else if (selectedIds.size > 0) {
        activeEditElement = placedElements.find(el => selectedIds.has(el.id)) || null;
      }
      if (activeEditElement) {
        const cached = getCachedCanvas(activeEditElement.fileName);
        const dx = (activeEditElement.gx - activeEditElement.gy) * (cellW / 2);
        const dy = (activeEditElement.gx + activeEditElement.gy) * (cellH / 2);
        
        let minX = 0; let minY = 0;
        let fileMinX = Infinity;
        let fileMinY = Infinity;

        if (activeEditElement.fileType === 'TMP') {
          const tmp = activeEditElement.content as TmpFile;
          const activeTiles = tmp.tiles.filter(t => t);
          if (activeTiles.length > 0) {
            const mult = tmp.cy / 2;
            activeTiles.forEach(tile => {
              const h = tile.header;
              const elev = h.height * mult;
              fileMinX = Math.min(fileMinX, h.x);
              fileMinY = Math.min(fileMinY, h.y - elev);
              if (h.has_extra_data) {
                fileMinX = Math.min(fileMinX, h.x_extra);
                fileMinY = Math.min(fileMinY, h.y_extra - elev);
              }
            });
            minX = fileMinX;
            minY = fileMinY;
          }
        } else {
          minX = -cached.width / 2;
          minY = -cached.height / 2;
        }

        const screenLeft = mapCenterX + dx + minX;
        const screenTop = mapCenterY + dy + minY;

        const rx = mouseX - screenLeft;
        const ry = mouseY - screenTop;

        const hit = findPixelInElement(activeEditElement.fileType, activeEditElement.content, rx, ry);
        if (hit) {
          // Calculate local (px, py) coords for hit start
          let px = 0; let py = 0;
          if (hit.fileType === 'TMP' && hit.tileIndex !== undefined) {
            const tmp = activeEditElement.content as TmpFile;
            const tile = tmp.tiles[hit.tileIndex];
            if (tile) {
              const width = hit.cellType === 'base' ? tile.cx : tile.header.cx_extra;
              px = hit.pixelIndex % width;
              py = Math.floor(hit.pixelIndex / width);
            }
          } else {
            const shp = activeEditElement.content as ShpFile;
            if (shp.frames && shp.frames[0]) {
              const w = shp.frames[0].w;
              px = hit.pixelIndex % w;
              py = Math.floor(hit.pixelIndex / w);
            }
          }

          // Hotkey / Alt modifier check for setting Clone stamp source anchor
          if (toolMode === 'clone' && (e.altKey || isAltPressed)) {
            e.preventDefault();
            setCloneSource({
              fileName: activeEditElement.fileName,
              fileType: activeEditElement.fileType,
              tileIndex: hit.tileIndex,
              cellType: hit.cellType,
              px,
              py,
              pixelIndex: hit.pixelIndex,
              canvasX: Math.floor(mouseX),
              canvasY: Math.floor(mouseY)
            });
            return;
          }

          if (toolMode === 'clone') {
            setStrokeStartCoordinate({ 
              px: Math.floor(mouseX), 
              py: Math.floor(mouseY) 
            });
          }
        }
      }

      if (toolMode === 'clone' && (e.altKey || isAltPressed)) {
        return; // strictly stop and never start painting on Alt+Click clone-source setup
      }

      setIsCurrentlyDrawing(true);
      executePaintAtScreenCoords(mouseX, mouseY, true);
      return;
    }

    const { gx, gy } = screenToGrid(mouseX, mouseY);

    // 2. Tile Stamp Placement mode triggers
    if (toolMode === 'stamp' && activeStampIndex !== null) {
      if (e.button !== 0) {
        setToolMode('select');
        return;
      }
      const file = loadedFiles[activeStampIndex];
      const newPlaced: PlacedElement = {
        id: `element-${Date.now()}-${Math.random()}`,
        fileName: file.name,
        fileType: file.fileType,
        content: file.content,
        gx,
        gy,
        width: getCachedCanvas(file.name).width,
        height: getCachedCanvas(file.name).height,
      };
      setPlacedElements(prev => [...prev, newPlaced]);
      if (!e.shiftKey) {
        setToolMode('select');
        setSelectedIds(new Set([newPlaced.id]));
      }
      return;
    }

    // 3. Selection pointer tool click triggers
    if (e.button === 0) {
      const target = findElementAtCoords(mouseX, mouseY);

      if (target) {
        const clickedItem = target.item;

        // If Alt Key is held down, clone/duplicate the tile(s) and drag the duplicates
        if (e.altKey || isAltPressed) {
          let activeSelection = new Set(selectedIds);
          if (!activeSelection.has(clickedItem.id)) {
            activeSelection = new Set([clickedItem.id]);
          }

          // Push to undo history before duplicating
          setDeletedPlacedElementsHistory(prev => [placedElements, ...prev]);
          setDeletedPlacedElementsRedoHistory([]);
          setActionHistory(prev => ['duplicate', ...prev]);

          const duplicatedElements: PlacedElement[] = [];
          const duplicatedIds = new Set<string>();

          placedElements.forEach(el => {
            if (activeSelection.has(el.id)) {
              const dupId = `element-${Date.now()}-${Math.random()}`;
              const dupEl: PlacedElement = {
                ...el,
                id: dupId,
              };
              duplicatedElements.push(dupEl);
              duplicatedIds.add(dupId);
            }
          });

          setPlacedElements(prev => [...prev, ...duplicatedElements]);
          setSelectedIds(duplicatedIds);

          setIsDraggingTiles(true);
          setDragStartMouseGrid({ gx, gy });

          const initialPositions: Record<string, { gx: number; gy: number }> = {};
          duplicatedElements.forEach(el => {
            initialPositions[el.id] = { gx: el.gx, gy: el.gy };
          });
          setDragStartPositionMap(initialPositions);
          return;
        }

        const isAlreadySelected = selectedIds.has(clickedItem.id);
        
        let nextSelected = new Set(selectedIds);
        if (e.shiftKey) {
          if (isAlreadySelected) nextSelected.delete(clickedItem.id);
          else nextSelected.add(clickedItem.id);
        } else if (!isAlreadySelected) {
          nextSelected = new Set([clickedItem.id]);
        }
        
        setSelectedIds(nextSelected);

        setIsDraggingTiles(true);
        setDragStartMouseGrid({ gx, gy });
        
        const initialPositions: Record<string, { gx: number; gy: number }> = {};
        placedElements.forEach(el => {
          if (nextSelected.has(el.id)) {
            initialPositions[el.id] = { gx: el.gx, gy: el.gy };
          }
        });
        setDragStartPositionMap(initialPositions);

      } else {
        if (!e.shiftKey) {
          setSelectedIds(new Set());
        }
        setIsBoxSelecting(true);
        setBoxStart({ x: mouseX, y: mouseY });
        setBoxEnd({ x: mouseX, y: mouseY });
      }
    }
  };

  // Mouse Move dragging handler
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Track real-time hover coordinate for cursor drawings
    hoveredCanvasMouseRef.current = { x: mouseX, y: mouseY };

    const currentCell = screenToGrid(mouseX, mouseY);
    setHoverGrid(currentCell);

    // Custom Brush Mode MouseMove Handling
    if (toolMode === 'customBrush') {
      if (isCustomBrushSelecting) {
        if (customBrushSelectMode === 'box') {
          setCustomBrushBoxEnd({ x: mouseX, y: mouseY });
        } else {
          setCustomBrushLassoPoints(prev => [...prev, { x: mouseX, y: mouseY }]);
        }
      } else if (isCurrentlyDrawing) {
        executeCustomBrushPaint(mouseX, mouseY, false);
      }
      render();
      return;
    }

    // Brush drawing movements continuous
    if (isCurrentlyDrawing) {
      executePaintAtScreenCoords(mouseX, mouseY, false);
      render(); // Redraw cursor and board during actively painting motion
    } else {
      // Direct fast render redraw to show the pixel highlighter instantly (0 setState overhead!)
      render();
    }

    // Drag Select movements
    if (isBoxSelecting && boxStart) {
      setBoxEnd({ x: mouseX, y: mouseY });
    }

    // Grid Tile translate drag movement
    if (isDraggingTiles && dragStartMouseGrid && dragStartPositionMap) {
      const dgx = currentCell.gx - dragStartMouseGrid.gx;
      const dgy = currentCell.gy - dragStartMouseGrid.gy;

      setPlacedElements(prev => prev.map(el => {
        const startPos = dragStartPositionMap[el.id];
        if (startPos) {
          return {
            ...el,
            gx: Math.max(0, Math.min(gridSize - 1, startPos.gx + dgx)),
            gy: Math.max(0, Math.min(gridSize - 1, startPos.gy + dgy))
          };
        }
        return el;
      }));
    }
  };

  const handleCanvasMouseLeave = () => {
    hoveredCanvasMouseRef.current = null;
    render();
  };

  // Mouse Up stop operations
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Custom Brush Mode MouseUp Handling
    if (toolMode === 'customBrush') {
      if (isCurrentlyDrawing) {
        setIsCurrentlyDrawing(false);
        triggerRootUpdate();
      }

      if (isCustomBrushSelecting) {
        let x1 = 0; let x2 = 0;
        let y1 = 0; let y2 = 0;
        let valid = false;

        if (customBrushSelectMode === 'box') {
          if (customBrushBoxStart && customBrushBoxEnd) {
            x1 = Math.min(customBrushBoxStart.x, customBrushBoxEnd.x);
            x2 = Math.max(customBrushBoxStart.x, customBrushBoxEnd.x);
            y1 = Math.min(customBrushBoxStart.y, customBrushBoxEnd.y);
            y2 = Math.max(customBrushBoxStart.y, customBrushBoxEnd.y);
            valid = (x2 - x1) > 2 && (y2 - y1) > 2;
          }
        } else {
          if (customBrushLassoPoints.length >= 3) {
            const xs = customBrushLassoPoints.map(p => p.x);
            const ys = customBrushLassoPoints.map(p => p.y);
            x1 = Math.min(...xs);
            x2 = Math.max(...xs);
            y1 = Math.min(...ys);
            y2 = Math.max(...ys);
            valid = (x2 - x1) > 2 && (y2 - y1) > 2;
          }
        }

        if (valid) {
          const rx1 = Math.floor(x1);
          const rx2 = Math.ceil(x2);
          const ry1 = Math.floor(y1);
          const ry2 = Math.ceil(y2);
          const W = rx2 - rx1;
          const H = ry2 - ry1;

          if (W > 0 && H > 0) {
            const pixels: (number | null)[] = new Array(W * H).fill(null);
            for (let bdy = 0; bdy < H; bdy++) {
              for (let bdx = 0; bdx < W; bdx++) {
                const cx = rx1 + bdx;
                const cy = ry1 + bdy;

                if (customBrushSelectMode === 'lasso') {
                  if (!isPointInPolygon(cx, cy, customBrushLassoPoints)) {
                    continue;
                  }
                }

                let block = null;
                let sHit = null;

                // 1. Sort selected elements by reverse rendering order (front to back)
                const reverseSelected = [...placedElements]
                  .filter(item => selectedIds.has(item.id))
                  .sort((a, b) => {
                    const offsetA = a.gx + a.gy;
                    const offsetB = b.gx + b.gy;
                    if (offsetA !== offsetB) return offsetB - offsetA;
                    return b.gx - a.gx;
                  });

                for (const item of reverseSelected) {
                  if (!item.content) continue;
                  const cached = getCachedCanvas(item.fileName);
                  const dx = (item.gx - item.gy) * (cellW / 2);
                  const dy = (item.gx + item.gy) * (cellH / 2);

                  let minX = 0; let minY = 0;
                  if (item.fileType === 'TMP') {
                    const tmp = item.content as TmpFile;
                    let fileMinX = Infinity;
                    let fileMinY = Infinity;
                    const activeTiles = tmp.tiles.filter(t => t);
                    if (activeTiles.length > 0) {
                      const mult = tmp.cy / 2;
                      activeTiles.forEach(tile => {
                        const h = tile.header;
                        const elev = h.height * mult;
                        fileMinX = Math.min(fileMinX, h.x);
                        fileMinY = Math.min(fileMinY, h.y - elev);
                        if (h.has_extra_data) {
                          fileMinX = Math.min(fileMinX, h.x_extra);
                          fileMinY = Math.min(fileMinY, h.y_extra - elev);
                        }
                      });
                      minX = fileMinX;
                      minY = fileMinY;
                    }
                  } else {
                    minX = -cached.width / 2;
                    minY = -cached.height / 2;
                  }

                  const screenLeft = mapCenterX + dx + minX;
                  const screenTop = mapCenterY + dy + minY;

                  if (
                    cx >= screenLeft && 
                    cx <= screenLeft + cached.width && 
                    cy >= screenTop && 
                    cy <= screenTop + cached.height
                  ) {
                    const rx = cx - screenLeft;
                    const ry = cy - screenTop;
                    const hit = findPixelInElement(item.fileType, item.content, rx, ry, true);
                    if (hit) {
                      block = { item, rx, ry };
                      sHit = hit;
                      break;
                    }
                  }
                }

                // 2. If not found in selected, check any other elements in reverse rendering order (front to back)
                if (!block) {
                  const reverseAll = [...placedElements].sort((a, b) => {
                    const offsetA = a.gx + a.gy;
                    const offsetB = b.gx + b.gy;
                    if (offsetA !== offsetB) return offsetB - offsetA;
                    return b.gx - a.gx;
                  });

                  for (const item of reverseAll) {
                    if (selectedIds.has(item.id)) continue;
                    if (!item.content) continue;
                    const cached = getCachedCanvas(item.fileName);
                    const dx = (item.gx - item.gy) * (cellW / 2);
                    const dy = (item.gx + item.gy) * (cellH / 2);

                    let minX = 0; let minY = 0;
                    if (item.fileType === 'TMP') {
                      const tmp = item.content as TmpFile;
                      let fileMinX = Infinity;
                      let fileMinY = Infinity;
                      const activeTiles = tmp.tiles.filter(t => t);
                      if (activeTiles.length > 0) {
                        const mult = tmp.cy / 2;
                        activeTiles.forEach(tile => {
                          const h = tile.header;
                          const elev = h.height * mult;
                          fileMinX = Math.min(fileMinX, h.x);
                          fileMinY = Math.min(fileMinY, h.y - elev);
                          if (h.has_extra_data) {
                            fileMinX = Math.min(fileMinX, h.x_extra);
                            fileMinY = Math.min(fileMinY, h.y_extra - elev);
                          }
                        });
                        minX = fileMinX;
                        minY = fileMinY;
                      }
                    } else {
                      minX = -cached.width / 2;
                      minY = -cached.height / 2;
                    }

                    const screenLeft = mapCenterX + dx + minX;
                    const screenTop = mapCenterY + dy + minY;

                    if (
                      cx >= screenLeft && 
                      cx <= screenLeft + cached.width && 
                      cy >= screenTop && 
                      cy <= screenTop + cached.height
                    ) {
                      const rx = cx - screenLeft;
                      const ry = cy - screenTop;
                      const hit = findPixelInElement(item.fileType, item.content, rx, ry, true);
                      if (hit) {
                        block = { item, rx, ry };
                        sHit = hit;
                        break;
                      }
                    }
                  }
                }

                // 3. Extract the pixel from sHit
                if (block && sHit) {
                  const { item: sItem } = block;
                  let val = null;
                  if (sHit.fileType === 'TMP' && sHit.tileIndex !== undefined) {
                    const sTmp = sItem.content as TmpFile;
                    const sTile = sTmp.tiles[sHit.tileIndex];
                    if (sTile) {
                      const sData = sHit.cellType === 'base' ? sTile.data : sTile.extraImageData;
                      if (sData) val = sData[sHit.pixelIndex];
                    }
                  } else {
                    const sShp = sItem.content as ShpFile;
                    if (sShp.frames && sShp.frames[0]) val = sShp.frames[0].data[sHit.pixelIndex];
                  }
                  if (val === 0) {
                    val = null; // Do not capture color zero
                  }
                  pixels[bdy * W + bdx] = val;
                }
              }
            }
            setCustomBrush({ width: W, height: H, pixels });
            setCustomBrushSubMode('paint');
          }
        }

        setIsCustomBrushSelecting(false);
        setCustomBrushBoxStart(null);
        setCustomBrushBoxEnd(null);
        setCustomBrushLassoPoints([]);
        render();
      }
      return;
    }

    if (isCurrentlyDrawing) {
      setIsCurrentlyDrawing(false);
      triggerRootUpdate();
    }

    if (isBoxSelecting && boxStart && boxEnd) {
      const left = Math.min(boxStart.x, boxEnd.x);
      const right = Math.max(boxStart.x, boxEnd.x);
      const top = Math.min(boxStart.y, boxEnd.y);
      const bottom = Math.max(boxStart.y, boxEnd.y);

      const selectedSet = new Set<string>(e.shiftKey ? selectedIds : []);

      placedElements.forEach(item => {
        const cached = getCachedCanvas(item.fileName);

        const dx = (item.gx - item.gy) * (cellW / 2);
        const dy = (item.gx + item.gy) * (cellH / 2);

        let minX = 0; let minY = 0;
        if (item.fileType === 'TMP') {
          const tmp = item.content as TmpFile;
          if (tmp) {
            let fileMinX = Infinity;
            let fileMinY = Infinity;
            const activeTiles = tmp.tiles.filter(t => t);
            if (activeTiles.length > 0) {
              const mult = tmp.cy / 2;
              activeTiles.forEach(tile => {
                const h = tile.header;
                const elev = h.height * mult;
                fileMinX = Math.min(fileMinX, h.x);
                fileMinY = Math.min(fileMinY, h.y - elev);
                if (h.has_extra_data) {
                  fileMinX = Math.min(fileMinX, h.x_extra);
                  fileMinY = Math.min(fileMinY, h.y_extra - elev);
                }
              });
              minX = fileMinX;
              minY = fileMinY;
            }
          } else {
            minX = -cached.width / 2;
            minY = -cached.height / 2;
          }
        } else {
          minX = -cached.width / 2;
          minY = -cached.height / 2;
        }

        const elX = mapCenterX + dx + minX;
        const elY = mapCenterY + dy + minY;

        const inX = elX < right && elX + cached.width > left;
        const inY = elY < bottom && elY + cached.height > top;

        if (inX && inY) {
          selectedSet.add(item.id);
        }
      });

      setSelectedIds(selectedSet);
    }

    setIsBoxSelecting(false);
    setBoxStart(null);
    setBoxEnd(null);
    setIsDraggingTiles(false);
    setDragStartMouseGrid(null);
    setDragStartPositionMap({});
  };

  // Keyboard Delete items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          // Push current placed elements to history for undo
          setDeletedPlacedElementsHistory(prev => [placedElements, ...prev]);
          setDeletedPlacedElementsRedoHistory([]);
          setActionHistory(prev => ['delete', ...prev]);
          setActionRedoHistory([]);

          setPlacedElements(prev => prev.filter(el => !selectedIds.has(el.id)));
          setSelectedIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, placedElements, setPlacedElements, setSelectedIds]);

  // Handle Drag & Drop sidebar icons placement
  const handleDragOverCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const fileName = e.dataTransfer.getData('text/plain');
    const matchedIdx = loadedFiles.findIndex(f => f.name === fileName);
    if (matchedIdx === -1) return;

    const file = loadedFiles[matchedIdx];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const { gx, gy } = screenToGrid(mouseX, mouseY);

    const newPlaced: PlacedElement = {
      id: `element-${Date.now()}-${Math.random()}`,
      fileName: file.name,
      fileType: file.fileType,
      content: file.content,
      gx,
      gy,
      width: getCachedCanvas(file.name).width,
      height: getCachedCanvas(file.name).height,
    };

    setPlacedElements(prev => [...prev, newPlaced]);
    setSelectedIds(new Set([newPlaced.id]));
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* 1. Left Sidebar Assets List */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col overflow-hidden shrink-0">
        {/* Sidebar Tabs */}
        <div className="flex border-b border-slate-800 bg-black/45 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setSidebarTab('files')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer",
              sidebarTab === 'files'
                ? "border-emerald-500 text-emerald-450 bg-emerald-500/5"
                : "border-transparent text-slate-500 hover:text-slate-350 hover:bg-slate-900/60"
            )}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('palette')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer",
              sidebarTab === 'palette'
                ? "border-purple-500 text-purple-450 bg-purple-500/5"
                : "border-transparent text-slate-500 hover:text-slate-350 hover:bg-slate-900/60"
            )}
          >
            Palette
          </button>
        </div>

        {sidebarTab === 'files' ? (
          <>
            <div className="p-4 border-b border-slate-900 bg-black/20 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Palette Assets
                </h2>
                <span className="text-[8px] font-mono text-emerald-400 uppercase font-black px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  Drag on Board
                </span>
              </div>
              <p className="text-[9.5px] text-slate-500 leading-tight">
                Click Stamp, or Drag items onto the center diamond grid coordinate space.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 pr-1.5 custom-scrollbar">
              {loadedFiles.length === 0 ? (
                <div className="py-12 px-4 text-center border border-slate-850 border-dashed rounded-xl">
                  <Grid className="w-8 h-8 mx-auto text-slate-800 mb-2 opacity-15" />
                  <p className="text-[10px] text-slate-500 italic font-bold">No active tiles loaded</p>
                  <p className="text-[9px] text-slate-600 mt-1">Go to Converter Tab first to upload sheets!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {loadedFiles.map((file, i) => (
                    <CanvasSidebarItem
                      key={`${file.name}-${i}`}
                      name={file.name}
                      fileType={file.fileType}
                      content={file.content}
                      palette={palette}
                      isActive={toolMode === 'stamp' && activeStampIndex === i}
                      onClick={() => handleSelectStamp(i)}
                      onPlaceClick={() => handleSelectStamp(i)}
                      onDelete={() => onRemoveFile(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-3.5">
            <div className="mb-3 shrink-0 select-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 block mb-1">
                256 Colors Swatches
              </span>
              <p className="text-[9.5px] text-slate-500 leading-tight">
                Click color index slot to use to paint. Selected:
                <span className="font-mono text-emerald-400 font-bold ml-1">#{selectedColorIndex}</span>
              </p>
            </div>

            <div 
              className="grid gap-[2.5px] bg-slate-950 p-2.5 rounded-lg overflow-y-auto max-h-[440px] custom-scrollbar border border-slate-900"
              style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
            >
              {Array.from({ length: 256 }).map((_, idx) => {
                const isSelected = selectedColorIndex === idx;
                const c = palette[idx];
                const hexColor = idx === 0 ? 'transparent' : (c ? `rgb(${c.r}, ${c.g}, ${c.b})` : '#000000');
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedColorIndex(idx);
                      // Switch automatically to drawing mode if user picks a color
                      if (['select', 'stamp'].includes(toolMode)) {
                        setToolMode('draw');
                      }
                    }}
                    className={cn(
                      "aspect-square w-full rounded border cursor-pointer hover:border-white focus:outline-none transition-all relative flex items-center justify-center",
                      isSelected 
                        ? "border-white ring-1 ring-emerald-400 scale-110 z-10" 
                        : "border-slate-950 hover:scale-110"
                    )}
                    style={{ backgroundColor: hexColor }}
                    title={`Palette Index #${idx}`}
                  >
                    {idx === 0 && (
                      <span className="text-[7.5px] text-red-500 font-extrabold leading-none select-none">T</span>
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-auto pt-3 border-t border-slate-900 select-none">
              <div className="text-[9px] text-slate-500 bg-slate-900/40 border border-slate-850 p-2.5 rounded-lg flex items-start gap-1 p-2">
                <span className="text-red-500 font-bold">★</span>
                <p className="leading-relaxed">
                  Index <span className="font-bold text-red-500">0 (T)</span> is transparent empty space in TS / RA2 engines.
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Interactive Map Arena */}
      <section className="flex-1 bg-slate-900 flex flex-col min-w-0 relative h-full">
        {/* Draw settings toolbar component */}
        <CanvasDrawingToolbar
          toolMode={toolMode}
          setToolMode={setToolMode}
          selectedColorIndex={selectedColorIndex}
          setSelectedColorIndex={setSelectedColorIndex}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          lockColorZero={lockColorZero}
          setLockColorZero={setLockColorZero}
          palette={palette}
          loadedFilesCount={loadedFiles.length}
          isSingleSelected={selectedIds.size > 0}
          onSelectStampMode={() => {
            if (activeStampIndex === null && loadedFiles.length > 0) {
              handleSelectStamp(0);
            } else {
              setToolMode('stamp');
            }
          }}
          cloneSrcName={cloneSource ? cloneSource.fileName : null}
          cloneSrcPx={cloneSource ? cloneSource.pixelIndex : null}
          onClearCloneSrc={() => setCloneSource(null)}
          customBrush={customBrush}
          customBrushSelectMode={customBrushSelectMode}
          setCustomBrushSelectMode={setCustomBrushSelectMode}
          customBrushSubMode={customBrushSubMode}
          setCustomBrushSubMode={setCustomBrushSubMode}
          customBrushVerticalLine={customBrushVerticalLine}
          setCustomBrushVerticalLine={setCustomBrushVerticalLine}
          customBrushSnap={customBrushSnap}
          setCustomBrushSnap={setCustomBrushSnap}
          onClearCustomBrush={() => {
            setCustomBrush(null);
            setCustomBrushSubMode('select');
            render();
          }}
          onOpenBrushEditor={() => setIsBrushEditorOpen(true)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={actionHistory.length > 0 || history.length > 0}
          canRedo={actionRedoHistory.length > 0 || redoHistory.length > 0}
          onSaveMap={handleSaveMap}
          onLoadMap={handleLoadMap}
        />

        {/* Board controls subheader action bar */}
        <header className="flex items-center justify-between px-6 py-2 bg-slate-950/40 border-b border-slate-800 select-none shrink-0 z-10 flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Grid</span>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 text-[10px] font-bold py-1 px-1.5 rounded outline-none text-slate-300 cursor-pointer"
              >
                <option value="30">30×30</option>
                <option value="50">50×50</option>
                <option value="60">60×60 (Default)</option>
                <option value="80">80×80</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
              <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Engine</span>
              <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setGridEngine('TS')}
                  className={cn(
                    "px-2 py-0.5 rounded leading-normal cursor-pointer",
                    gridEngine === 'TS' ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "text-slate-500 hover:text-slate-350"
                  )}
                >
                  TS (48×24)
                </button>
                <button
                  type="button"
                  onClick={() => setGridEngine('RA2')}
                  className={cn(
                    "px-2 py-0.5 rounded leading-normal cursor-pointer",
                    gridEngine === 'RA2' ? "bg-red-500/15 text-red-500 border border-red-500/20" : "text-slate-500 hover:text-slate-350"
                  )}
                >
                  RA2 (60×30)
                </button>
                <button
                  type="button"
                  onClick={() => setGridEngine('OpenTS')}
                  className={cn(
                    "px-2 py-0.5 rounded leading-normal cursor-pointer",
                    gridEngine === 'OpenTS' ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "text-slate-500 hover:text-slate-350"
                  )}
                >
                  OpenTS (120×60)
                </button>
                <button
                  type="button"
                  onClick={() => setGridEngine('OpenTS_48x96')}
                  className={cn(
                    "px-2 py-0.5 rounded leading-normal cursor-pointer",
                    gridEngine === 'OpenTS_48x96' ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "text-slate-500 hover:text-slate-350"
                  )}
                >
                  OpenTS (48×96)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap text-middle" title="Scroll with mousewheel over map to zoom easily">Scroll zoom</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{zoom.toFixed(1)}x</span>
              <button
                type="button"
                onClick={() => setZoom(1.0)}
                className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-705 text-slate-300 hover:text-white border border-slate-750 text-[9px] font-bold uppercase cursor-pointer transition-all active:scale-95"
                title="Reset zoom to 1.0x"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={placeAllFilesOnCanvas}
              disabled={loadedFiles.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/80 rounded-md text-[9.5px] uppercase font-black cursor-pointer transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
              title="Spread all loaded files cleanly across the canvas grid row-by-row"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>Place All Tiles</span>
            </button>

            <button
              onClick={solveSelectedIsometricPuzzle}
              disabled={placedElements.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 hover:brightness-110 text-amber-300 rounded-md text-[9.5px] uppercase font-black cursor-pointer transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
              title="Automatically organize selected tiles isometrically by aligning touching pixel textures like transitions or cliffs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Solve Isometric Puzzle</span>
            </button>

            {placedElements.length > 0 && (
              <button
                onClick={() => {
                  setDeletedPlacedElementsHistory(prev => [placedElements, ...prev]);
                  setDeletedPlacedElementsRedoHistory([]);
                  setActionHistory(prev => ['delete', ...prev]);
                  setActionRedoHistory([]);

                  setPlacedElements([]);
                  setSelectedIds(new Set());
                }}
                className="p-1 px-1.5 bg-red-950/20 border border-red-900/40 text-red-400 hover:bg-red-900/30 rounded text-[9.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1"
                title="Wipe map board configuration (Undoable)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Canvas</span>
              </button>
            )}
          </div>
        </header>

        {/* Central Scroll Arena container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#070b12] custom-scrollbar flex items-start justify-center p-6 relative cursor-default"
        >
          {/* Main Visual grid stage with dynamic CSS transform scaling */}
          <div 
            style={{ 
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              width: canvasWidth,
              height: canvasHeight
            }}
            className="transition-transform duration-75 relative drop-shadow-[0_20px_40px_rgba(0,0,0,0.65)] rounded-2xl border border-slate-950 shadow-2xl shrink-0"
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              onMouseUp={handleCanvasMouseUp}
              onDragOver={handleDragOverCanvas}
              onDrop={handleDropCanvas}
              className={cn(
                "w-full h-full rounded-2xl block image-pixelated bg-[#0c1220]",
                ['draw', 'clone', 'eraser', 'picker'].includes(toolMode) ? "cursor-none" : "cursor-crosshair"
              )}
            />

            {/* Empty board overlay help instructions */}
            {placedElements.length === 0 && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                <div className="bg-slate-950/90 border border-slate-800 p-8 rounded-2xl max-w-sm text-center shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200 select-none">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto border border-emerald-500/25">
                    <Grid className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-white text-xs font-black uppercase tracking-wider">Isometric Map Board</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      Assemble templates and draw directly onto tiles!
                    </p>
                  </div>
                  <div className="text-[9.5px] text-slate-500 space-y-2 border-t border-slate-900 pt-3 text-left leading-normal">
                    <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Drag assets from sidebar directly onto grid cells</p>
                    <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Use Draw tools to paint pixels on layout</p>
                    <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Scroll mousewheel anywhere on map to Zoom (0.2x-6.0x)</p>
                    <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Save and re-load `.sugarmap` theaters anytime</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Missing companion assets warning alert box */}
          <MissingFilesAlert
            missingFiles={missingFiles}
            onDismiss={() => setMissingFiles([])}
          />
          
          {/* Custom Brush interactive modal pixel editor */}
          <CustomBrushEditor
            customBrush={customBrush}
            setCustomBrush={setCustomBrush}
            palette={palette}
            selectedColorIndex={selectedColorIndex}
            setSelectedColorIndex={setSelectedColorIndex}
            isOpen={isBrushEditorOpen}
            onClose={() => setIsBrushEditorOpen(false)}
          />
        </div>
      </section>
    </div>
  );
};

function isPointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
