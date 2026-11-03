import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, FileText, Settings, Layers, Box, Info, X, Trash2, Download, List, Files, FileCode, Undo2, Redo2, RefreshCw, ArrowLeftRight, Grid, ChevronDown, ChevronUp } from 'lucide-react';
import { TmpParser, TmpFile, Tile, RGB } from './lib/formats';
import type { TargetEngine } from './lib/tileResizer';
import { isPixelOverlappingBaseTile } from './lib/tmpRenderer';
import { ShpParser, ShpFrame, ShpFile, detectFileType } from './lib/shp';
import { ShpFramePreview } from './components/ShpFramePreview';
import { ShpLargePreview } from './components/ShpLargePreview';
import { ShpObjectView } from './components/ShpObjectView';
import { PixelEditor } from './components/PixelEditor';
import { TerrainTileWorkspaceRow } from './components/TerrainTileWorkspaceRow';
import { CompleteObjectDualView } from './components/CompleteObjectDualView';
import { PinkCrystal, SugarVibesText } from './components/BrandLogo';
import { cn } from './lib/utils';
import { tryLoadStockFile, tryLoadStockRa2File, mergeResizedWithStock } from './lib/stockConverter';
import { createPaletteLut, remapTmpColors, remapShpColors } from './lib/paletteConverter';
import { CanvasEditor } from './components/CanvasEditor';
import { ZFilesModal } from './components/ZFilesModal';
import { CanvasToolMode } from './components/CanvasDrawingToolbar';
import { TileCreator } from './components/TileCreator';
import { ZDataEditor } from './components/z-editor/ZDataEditor';
import JSZip from 'jszip';

import { LoadedFile, PlacedElement } from './types';

export default function App() {
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [palette, setPalette] = useState<RGB[] | null>(null);
  const [conversionPalette, setConversionPalette] = useState<RGB[] | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<ShpFrame | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'image' | 'z-data'>('image');
  const [displayMode, setDisplayMode] = useState<'grid' | 'object'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [processProgress, setProcessProgress] = useState<number | null>(null);
  const [history, setHistory] = useState<LoadedFile[][]>([]);
  const [redoHistory, setRedoHistory] = useState<LoadedFile[][]>([]);
  const [zoom, setZoom] = useState(2);
  const [isActiveInfoOpen, setIsActiveInfoOpen] = useState(false);
  const [selectedFileIndices, setSelectedFileIndices] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [customExt, setCustomExt] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(1);
  const [selectedFullObject, setSelectedFullObject] = useState<boolean>(true);
  const [selectedComponent, setSelectedComponent] = useState<'base' | 'extra'>('base');
  const [shpViewMode, setShpViewMode] = useState<'grid' | 'animation'>('grid');
  const [editorPaneWidth, setEditorPaneWidth] = useState<number>(460);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'converter' | 'canvas' | 'tile-creator' | 'z-editor'>('converter');
  const [isZFilesModalOpen, setIsZFilesModalOpen] = useState(false);
  const [useStockTs, setUseStockTs] = useState<boolean>(false);
  const [useStockRa2, setUseStockRa2] = useState<boolean>(false);
  const [imageResizeFilter, setImageResizeFilter] = useState<'quadratic' | 'linear' | 'box' | 'nearest'>('quadratic');
  const [zResizeFilter, setZResizeFilter] = useState<'quadratic' | 'linear' | 'box' | 'nearest'>('quadratic');
  const [smartZData, setSmartZData] = useState<boolean>(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);

  // Lifted Canvas Editor States to prevent data loss on tab switches
  const [placedElements, setPlacedElements] = useState<PlacedElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canvasGridSize, setCanvasGridSize] = useState<number>(60);
  const [canvasGridEngine, setCanvasGridEngine] = useState<'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96'>('TS');
  const [canvasZoom, setCanvasZoom] = useState<number>(1.2);
  const [canvasToolMode, setCanvasToolMode] = useState<CanvasToolMode>('select');
  const [canvasActiveStampIndex, setCanvasActiveStampIndex] = useState<number | null>(null);

  // Lifted Custom Brush states to prevent loss on Tab switches
  const [customBrush, setCustomBrush] = useState<{ width: number; height: number; pixels: (number | null)[] } | null>(null);
  const [customBrushSelectMode, setCustomBrushSelectMode] = useState<'box' | 'lasso'>('box');
  const [customBrushSubMode, setCustomBrushSubMode] = useState<'select' | 'paint'>('select');
  const [customBrushVerticalLine, setCustomBrushVerticalLine] = useState<boolean>(false);
  const [customBrushSnap, setCustomBrushSnap] = useState<boolean>(false);

  const triggerRootUpdate = () => {
    setLoadedFiles([...loadedFiles]);
  };

  const handleFileClick = (index: number, e: React.MouseEvent) => {
    let newSelected: number[] = [];

    if (e.ctrlKey || e.metaKey) {
      if (selectedFileIndices.includes(index)) {
        newSelected = selectedFileIndices.filter(idx => idx !== index);
      } else {
        newSelected = [...selectedFileIndices, index];
      }
    } else if (e.shiftKey) {
      const pivot = activeFileIndex !== null ? activeFileIndex : 0;
      const start = Math.min(pivot, index);
      const end = Math.max(pivot, index);
      for (let idx = start; idx <= end; idx++) {
        newSelected.push(idx);
      }
    } else {
      newSelected = [index];
    }

    setSelectedFileIndices(newSelected);
    setActiveFileIndex(index);

    setSelectedTile(null);
    const f = loadedFiles[index];
    if (f && f.fileType === 'SHP') {
      const shp = f.content as ShpFile;
      if (shp.frames && shp.frames.length > 0) {
        setSelectedFrame(shp.frames[0]);
        setSelectedFrameIndex(0);
      } else {
        setSelectedFrame(null);
        setSelectedFrameIndex(0);
      }
    } else {
      setSelectedFrame(null);
      setSelectedFrameIndex(0);
    }
  };

  useEffect(() => {
    if (activeFileIndex !== null) {
      if (!selectedFileIndices.includes(activeFileIndex)) {
        setSelectedFileIndices([activeFileIndex]);
      }
    } else {
      setSelectedFileIndices([]);
    }
  }, [activeFileIndex]);

  useEffect(() => {
    if (selectedFileIndices.some(idx => idx >= loadedFiles.length)) {
      setSelectedFileIndices(prev => prev.filter(idx => idx < loadedFiles.length));
    }
  }, [loadedFiles.length]);

  // Automatically reset target selections when user switches active file
  useEffect(() => {
    setSelectedFullObject(true);
    setSelectedComponent('base');
    setSelectedTile(null);
  }, [activeFileIndex]);

  const paletteInputRef = useRef<HTMLInputElement>(null);
  const conversionPaletteInputRef = useRef<HTMLInputElement>(null);
  const tmpInputRef = useRef<HTMLInputElement>(null);

  const activeFile = activeFileIndex !== null ? loadedFiles[activeFileIndex] : null;
  const activeTmp = activeFile && activeFile.fileType === 'TMP' ? (activeFile.content as TmpFile) : null;
  const activeShp = activeFile && activeFile.fileType === 'SHP' ? (activeFile.content as ShpFile) : null;

  useEffect(() => {
    // Graceful onboarding fallback: populate standard 256 grayscale values 
    // so user can draw or inspect right out of the box.
    const fallbackPalette: RGB[] = Array.from({ length: 256 }, (_, i) => {
      if (i === 0) return { r: 0, g: 0, b: 0 };
      const v = Math.floor((i / 255) * 255);
      return { r: v, g: v, b: v };
    });
    setPalette(fallbackPalette);
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate right-hand panel width from the viewport right
      const newWidth = window.innerWidth - e.clientX - 32;
      if (newWidth >= 320 && newWidth <= 800) {
        setEditorPaneWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const handleUpdateTilePixels = (slotIndex: number, type: 'base' | 'extra', newPixels: Uint8Array, isZData: boolean = false) => {
    if (activeFileIndex === null || !activeTmp) return;
    
    // Track undo snapshots
    setHistory(prev => [[...loadedFiles], ...prev].slice(0, 10));
    setRedoHistory([]); // Clear redo snapshots on newer action

    const updatedFiles = [...loadedFiles];
    const file = { ...updatedFiles[activeFileIndex] };
    const content = { ...file.content as TmpFile };
    const tiles = [...content.tiles];
    const tile = tiles[slotIndex];

    if (tile) {
        const updatedTile = { ...tile };
        if (type === 'base') {
            if (isZData) {
                updatedTile.zData = newPixels;
            } else {
                updatedTile.data = newPixels;
            }
        } else {
            if (isZData) {
                updatedTile.extraZData = newPixels;
            } else {
                updatedTile.extraImageData = newPixels;
            }
        }
        tiles[slotIndex] = updatedTile;
        content.tiles = tiles;
        file.content = content;
        updatedFiles[activeFileIndex] = file;
        setLoadedFiles(updatedFiles);
        setSelectedTile(updatedTile);
    }
  };

  // HELPER: Reconstruct composite 1D data arrays representing complete object layers
  const getFullObjectComposite = useCallback((tmpFile: TmpFile, showZ: boolean) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const mult = tmpFile.cy / 2;
    const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);
    
    if (activeTiles.length === 0) {
        return { width: 0, height: 0, data: new Uint8Array(0), minX: 0, minY: 0 };
    }

    activeTiles.forEach(tile => {
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

    if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
        return { width: 0, height: 0, data: new Uint8Array(0), minX: 0, minY: 0 };
    }

    const data = new Uint8Array(width * height);

    // Populate pixels from bottom to top layer
    activeTiles.forEach(tile => {
        const h = tile.header;
        const elev = h.height * mult;

        // Base 
        const bx = h.x - minX;
        const by = (h.y - elev) - minY;
        const bPix = showZ ? (tile.zData || new Uint8Array(tile.cx * tile.cy)) : tile.data;

        for (let ly = 0; ly < tile.cy; ly++) {
            for (let lx = 0; lx < tile.cx; lx++) {
                if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
                    continue;
                }
                const lIdx = ly * tile.cx + lx;
                const val = bPix[lIdx];
                if (val !== 0 && (!showZ || val !== 255)) {
                    const compIdx = (by + ly) * width + (bx + lx);
                    data[compIdx] = val;
                }
            }
        }

        // Extra
        if (h.has_extra_data && tile.extraImageData) {
            const ex = h.x_extra - minX;
            const ey = (h.y_extra - elev) - minY;
            const ePix = showZ ? (tile.extraZData || new Uint8Array(h.cx_extra * h.cy_extra)) : tile.extraImageData;

            for (let ly = 0; ly < h.cy_extra; ly++) {
                for (let lx = 0; lx < h.cx_extra; lx++) {
                    const lIdx = ly * h.cx_extra + lx;
                    const val = ePix[lIdx];
                    if (val !== 0) {
                        if (showZ) {
                            if (tile.extraImageData && tile.extraImageData[lIdx] === 0) continue;
                            if (val === 255) continue;
                            const px = ex + lx;
                            const py = ey + ly;
                            if (isPixelOverlappingBaseTile(px, py, activeTiles, minX, minY, mult)) {
                                continue;
                            }
                        }
                        const compIdx = (ey + ly) * width + (ex + lx);
                        data[compIdx] = val;
                    }
                }
            }
        }
    });

    return { width, height, data, minX, minY };
  }, []);

  // Map edits done on the composite canvas back to their source tile structures
  const updateFullObjectFromComposite = useCallback((tmpFile: TmpFile, compositeData: Uint8Array, showZ: boolean) => {
    const { width, height, minX, minY } = getFullObjectComposite(tmpFile, showZ);
    if (width === 0 || height === 0) return tmpFile;

    const mult = tmpFile.cy / 2;
    const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);

    // Clone all tiles to preserve pure immutable states
    const updatedTiles = tmpFile.tiles.map(tile => {
        if (!tile) return null;
        return {
            ...tile,
            header: { ...tile.header },
            data: new Uint8Array(tile.data),
            zData: tile.zData ? new Uint8Array(tile.zData) : undefined,
            extraImageData: tile.extraImageData ? new Uint8Array(tile.extraImageData) : undefined,
            extraZData: tile.extraZData ? new Uint8Array(tile.extraZData) : undefined,
        };
    });

    const topLayerMap = new Array(width * height).fill(null);
    const boundingMap = new Array(width * height).fill(null);

    activeTiles.forEach(tile => {
        const slotIndex = tile.slot;
        const h = tile.header;
        const elev = h.height * mult;

        // Base Diamond Bounding map
        const bx = h.x - minX;
        const by = (h.y - elev) - minY;
        for (let ly = 0; ly < tile.cy; ly++) {
            for (let lx = 0; lx < tile.cx; lx++) {
                if (TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
                    const lIdx = ly * tile.cx + lx;
                    const compIdx = (by + ly) * width + (bx + lx);
                    boundingMap[compIdx] = { slotIndex, component: 'base', localIdx: lIdx };
                    
                    const val = showZ ? (tile.zData ? tile.zData[lIdx] : 0) : tile.data[lIdx];
                    if (val !== 0 && (!showZ || val !== 255)) {
                        topLayerMap[compIdx] = { slotIndex, component: 'base', localIdx: lIdx };
                    }
                }
            }
        }

        // Extra Layout Bounding map
        if (h.has_extra_data && tile.extraImageData) {
            const ex = h.x_extra - minX;
            const ey = (h.y_extra - elev) - minY;
            for (let ly = 0; ly < h.cy_extra; ly++) {
                for (let lx = 0; lx < h.cx_extra; lx++) {
                    const lIdx = ly * h.cx_extra + lx;
                    const compIdx = (ey + ly) * width + (ex + lx);
                    
                    if (showZ) {
                        if (tile.extraImageData && tile.extraImageData[lIdx] === 0) continue;
                        const px = ex + lx;
                        const py = ey + ly;
                        if (isPixelOverlappingBaseTile(px, py, activeTiles, minX, minY, mult)) {
                            continue;
                        }
                    }

                    boundingMap[compIdx] = { slotIndex, component: 'extra', localIdx: lIdx };
                    
                    const val = showZ ? (tile.extraZData ? tile.extraZData[lIdx] : 0) : tile.extraImageData[lIdx];
                    if (val !== 0 && (!showZ || val !== 255)) {
                        topLayerMap[compIdx] = { slotIndex, component: 'extra', localIdx: lIdx };
                    }
                }
            }
        }
    });

    // Remap values back to tiles
    for (let cIdx = 0; cIdx < compositeData.length; cIdx++) {
        const target = topLayerMap[cIdx] || boundingMap[cIdx];
        if (target) {
            const tTile = updatedTiles[target.slotIndex];
            if (tTile) {
                const newVal = compositeData[cIdx];
                if (target.component === 'base') {
                    if (showZ) {
                        if (!tTile.zData) tTile.zData = new Uint8Array(tTile.cx * tTile.cy);
                        tTile.zData[target.localIdx] = newVal;
                    } else {
                        tTile.data[target.localIdx] = newVal;
                    }
                } else {
                    if (showZ) {
                        if (!tTile.extraZData) tTile.extraZData = new Uint8Array(tTile.header.cx_extra * tTile.header.cy_extra);
                        tTile.extraZData[target.localIdx] = newVal;
                    } else {
                        if (tTile.extraImageData) {
                            tTile.extraImageData[target.localIdx] = newVal;
                        }
                    }
                }
            }
        }
    }

    return {
        ...tmpFile,
        tiles: updatedTiles,
    };
  }, [getFullObjectComposite]);

  const handleUpdateFullObjectPixels = useCallback((newCompositePixels: Uint8Array, isZData: boolean = false) => {
    if (activeFileIndex === null || !activeTmp) return;

    // Track undo snapshots
    setHistory(prev => [[...loadedFiles], ...prev].slice(0, 10));
    setRedoHistory([]);

    const updatedFile = updateFullObjectFromComposite(activeTmp, newCompositePixels, isZData);
    const updatedFiles = [...loadedFiles];
    updatedFiles[activeFileIndex] = {
        ...updatedFiles[activeFileIndex],
        content: updatedFile
    };
    setLoadedFiles(updatedFiles);
    
    // Also update selected tile reference in memory to stay in perfect sync
    if (selectedTile) {
        const refreshedTile = updatedFile.tiles[selectedTile.slot];
        if (refreshedTile) {
            setSelectedTile(refreshedTile);
        }
    }
  }, [activeFileIndex, activeTmp, loadedFiles, selectedTile, updateFullObjectFromComposite]);

  const fullColorComposite = useMemo(() => {
    if (!activeTmp) return { width: 0, height: 0, data: new Uint8Array(0), minX: 0, minY: 0 };
    return getFullObjectComposite(activeTmp, false);
  }, [activeTmp, getFullObjectComposite]);

  const fullZComposite = useMemo(() => {
    if (!activeTmp) return { width: 0, height: 0, data: new Uint8Array(0), minX: 0, minY: 0 };
    return getFullObjectComposite(activeTmp, true);
  }, [activeTmp, getFullObjectComposite]);

  const handleUpdateFramePixels = (frameIndex: number, newPixels: Uint8Array) => {
    if (activeFileIndex === null || !activeShp) return;

    // Track undo snapshots
    setHistory(prev => [[...loadedFiles], ...prev].slice(0, 10));
    setRedoHistory([]); // Clear redo snapshots on newer action

    const updatedFiles = [...loadedFiles];
    const file = { ...updatedFiles[activeFileIndex] };
    const content = { ...file.content as ShpFile };
    const frames = [...content.frames];
    const frame = frames[frameIndex];

    if (frame) {
        const updatedFrame = { ...frame, data: newPixels };
        frames[frameIndex] = updatedFrame;
        content.frames = frames;
        file.content = content;
        updatedFiles[activeFileIndex] = file;
        setLoadedFiles(updatedFiles);
        setSelectedFrame(updatedFrame);
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    setIsLoading(true);
    const newLoadedFiles: LoadedFile[] = [...loadedFiles];
    const wasEmpty = loadedFiles.length === 0;
    let detectedEngine: 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96' | null = null;
    
    for (const file of Array.from(files)) {
        try {
            const buffer = await file.arrayBuffer();
            const fType = detectFileType(buffer, file.name);
            if (fType === 'SHP') {
                const parsed = ShpParser.parseShp(buffer, file.name);
                newLoadedFiles.push({
                    name: file.name,
                    content: parsed,
                    fileType: 'SHP'
                });
                if (detectedEngine === null) {
                    detectedEngine = parsed.sourceType || 'TS';
                }
            } else if (fType === 'TMP') {
                const parsed = TmpParser.parseTmp(buffer);
                newLoadedFiles.push({
                    name: file.name,
                    content: parsed,
                    fileType: 'TMP'
                });
                if (detectedEngine === null) {
                    if (parsed.cx === 120 || parsed.cy === 60) {
                        detectedEngine = 'OpenTS';
                    } else if (parsed.cx === 96 || parsed.cy === 48) {
                        detectedEngine = 'OpenTS_48x96';
                    } else if (parsed.cx === 60 || parsed.cy === 30) {
                        detectedEngine = 'RA2';
                    } else if (parsed.cx === 48 || parsed.cy === 24) {
                        detectedEngine = 'TS';
                    }
                }
            } else {
                console.warn(`File ${file.name} is not a valid SHP or TMP file.`);
            }
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
        }
    }

    setLoadedFiles(newLoadedFiles);
    
    if (wasEmpty && detectedEngine) {
        setCanvasGridEngine(detectedEngine);
    }

    if (activeFileIndex === null && newLoadedFiles.length > loadedFiles.length) {
        const addedFirstIdx = loadedFiles.length;
        setActiveFileIndex(addedFirstIdx);
        const firstFile = newLoadedFiles[addedFirstIdx];
        if (firstFile && firstFile.fileType === 'SHP') {
            const shp = firstFile.content as ShpFile;
            if (shp.frames && shp.frames.length > 0) {
                setSelectedFrame(shp.frames[0]);
                setSelectedFrameIndex(0);
            }
        }
    }
    setIsLoading(false);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    
    // Save current to redo snapshots
    setRedoHistory(prev => [[...loadedFiles], ...prev]);

    const [prev, ...rest] = history;
    setLoadedFiles(prev);
    setHistory(rest);

    // Sync selections if we can
    if (activeFileIndex !== null && prev[activeFileIndex]) {
        const restoredFile = prev[activeFileIndex];
        if (restoredFile.fileType === 'TMP' && selectedTile) {
            const tmp = restoredFile.content as TmpFile;
            const restoredTile = tmp.tiles.find(t => t && t.slot === selectedTile.slot);
            if (restoredTile) setSelectedTile(restoredTile);
        } else if (restoredFile.fileType === 'SHP' && selectedFrame) {
            const shpt = restoredFile.content as ShpFile;
            if (shpt.frames[selectedFrameIndex]) {
                const f = shpt.frames[selectedFrameIndex];
                setSelectedFrame(f);
            }
        }
    }
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;

    // Save current to history snapshots
    setHistory(prev => [[...loadedFiles], ...prev]);

    const [next, ...rest] = redoHistory;
    setLoadedFiles(next);
    setRedoHistory(rest);

    // Sync selections if we can
    if (activeFileIndex !== null && next[activeFileIndex]) {
        const restoredFile = next[activeFileIndex];
        if (restoredFile.fileType === 'TMP' && selectedTile) {
            const tmp = restoredFile.content as TmpFile;
            const restoredTile = tmp.tiles.find(t => t && t.slot === selectedTile.slot);
            if (restoredTile) setSelectedTile(restoredTile);
        } else if (restoredFile.fileType === 'SHP' && selectedFrame) {
            const shpt = restoredFile.content as ShpFile;
            if (shpt.frames[selectedFrameIndex]) {
                const f = shpt.frames[selectedFrameIndex];
                setSelectedFrame(f);
            }
        }
    }
  };

  const handleTmpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        await processFiles(e.target.files);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
    }
  }, [loadedFiles, activeFileIndex]);

  const handlePaletteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    try {
      const parsed = TmpParser.parsePalette(buffer);
      setPalette(parsed);
    } catch (err) {
      console.error(err);
      alert('Error parsing Palette file. Expected JASC-PAL or 768-byte binary.');
    }
  };

  const handleConversionPaletteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    try {
      const parsed = TmpParser.parsePalette(buffer);
      setConversionPalette(parsed);
    } catch (err) {
      console.error(err);
      alert('Error parsing Conversion Palette file. Expected JASC-PAL or 768-byte binary.');
    }
  };

  const handleSwapPalettes = () => {
    if (!palette && !conversionPalette) return;
    const tempPal = palette;
    setPalette(conversionPalette);
    setConversionPalette(tempPal);
  };

  const applyPaletteConversion = () => {
    if (loadedFiles.length === 0) {
      alert("No files loaded.");
      return;
    }
    if (!palette || !conversionPalette) {
      alert("Please load both a Base PAL and a Conversion PAL first.");
      return;
    }

    const filesSnapshot = [...loadedFiles];
    setHistory(prev => [filesSnapshot, ...prev].slice(0, 10));

    setIsLoading(true);
    setProcessProgress(0);

    setTimeout(() => {
      try {
        const shpLut = createPaletteLut(palette, conversionPalette, true);
        const tmpLut = createPaletteLut(palette, conversionPalette, false);

        const resultFiles = loadedFiles.map(f => {
          if (f.fileType === 'SHP') {
            const converted = remapShpColors(f.content as ShpFile, shpLut);
            return { ...f, content: converted };
          } else {
            const converted = remapTmpColors(f.content as TmpFile, tmpLut);
            return { ...f, content: converted };
          }
        });

        setLoadedFiles(resultFiles);
        // After conversion, the pixel indexes correspond to the conversion palette
        setPalette(conversionPalette);
        setConversionPalette(palette);

        setSelectedTile(null);
        setSelectedFrame(null);
      } catch (err) {
        console.error("Error during color conversion:", err);
        alert("Failed to convert colors.");
      } finally {
        setIsLoading(false);
        setProcessProgress(null);
      }
    }, 100);
  };

  const resetAll = () => {
    setLoadedFiles([]);
    setActiveFileIndex(null);
    setPalette(null);
    setConversionPalette(null);
    setSelectedTile(null);
    setSelectedFrame(null);
    setHistory([]);
    setIsRenaming(false);
    if (paletteInputRef.current) paletteInputRef.current.value = "";
    if (conversionPaletteInputRef.current) conversionPaletteInputRef.current.value = "";
    if (tmpInputRef.current) tmpInputRef.current.value = "";
    // Force garbage collection of internal buffers if possible
    console.log("[App] Session cleared.");
  };

  const handleRenameExtensions = () => {
    if (loadedFiles.length === 0) return;
    const firstExt = loadedFiles[0].name.split('.').pop() || 'tmp';
    setCustomExt(firstExt);
    setIsRenaming(true);
  };

  const applyRename = () => {
    if (!customExt) {
        setIsRenaming(false);
        return;
    }
    const ext = customExt.replace(/^\./, '').toLowerCase();
    setHistory(prev => [[...loadedFiles], ...prev].slice(0, 10));
    setLoadedFiles(prev => prev.map(f => {
       const base = f.name.replace(/\.[^/.]+$/, "");
       return { ...f, name: `${base}.${ext}` };
    }));
    setIsRenaming(false);
  };

  const convertFiles = async (target: TargetEngine, fileIndices?: number[]) => {
    if (loadedFiles.length === 0) return;
    
    // Capture the state at the moment of click
    const filesSnapshot = [...loadedFiles];
    const indicesToProcess = fileIndices ?? filesSnapshot.map((_, i) => i);
    const totalToProcess = indicesToProcess.length;

    if (totalToProcess === 0) return;

    // 1. Enter loading state immediately
    setIsLoading(true);
    setProcessProgress(0);
    
    // 2. Yield to browser to show the overlay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 3. Process files
    const resultFiles = [...filesSnapshot];
    
    // Save to history before applying changes
    setHistory(prev => [filesSnapshot, ...prev].slice(0, 10));
    
    try {
        for (let i = 0; i < totalToProcess; i++) {
            const idx = indicesToProcess[i];
            const file = resultFiles[idx];
            
            if (file) {
                try {
                    if (file.fileType === 'SHP') {
                        const converted = ShpParser.scaleShp(file.content as ShpFile, target);
                        resultFiles[idx] = { ...file, content: converted };
                    } else {
                        // Actual conversion
                        const n = file.name.toLowerCase();
                        const isRamp = n.includes('slope') || n.includes('rmp') || n.includes('ramp') || n.includes('cliff');
                        let converted = TmpParser.convertEngine(file.content as TmpFile, target, { 
                            isRamp, 
                            imageFilter: imageResizeFilter, 
                            zFilter: zResizeFilter,
                            smartZData: smartZData
                        });
                        
                        const baseName = file.name.replace(/\.[^/.]+$/, "").toLowerCase();
                        if (target === 'TS' && useStockTs) {
                            try {
                                const stockTmp = await tryLoadStockFile(baseName);
                                if (stockTmp) {
                                    converted = mergeResizedWithStock(converted, stockTmp);
                                    console.log(`[Stock Mode] Successfully merged stock file for ${baseName}`);
                                } else {
                                    console.warn(`[Stock Mode] No stock file matching template found for: ${baseName}`);
                                }
                            } catch (stockErr) {
                                console.warn(`[Stock Mode] Stock merge failed for: ${baseName}`, stockErr);
                            }
                        } else if (target === 'RA2' && useStockRa2) {
                            try {
                                const stockTmp = await tryLoadStockRa2File(baseName);
                                if (stockTmp) {
                                    converted = mergeResizedWithStock(converted, stockTmp);
                                    console.log(`[Stock Mode RA2] Successfully merged stock RA2 file for ${baseName}`);
                                } else {
                                    console.warn(`[Stock Mode RA2] No stock RA2 file matching template found for: ${baseName}`);
                                }
                            } catch (stockErr) {
                                console.warn(`[Stock Mode RA2] Stock RA2 merge failed for: ${baseName}`, stockErr);
                            }
                        }
                        resultFiles[idx] = { ...file, content: converted };
                    }
                } catch (err) {
                    console.error(`Conversion error for ${file.name}:`, err);
                }
            }
            
            // Update progress
            const progress = Math.floor(((i + 1) / totalToProcess) * 100);
            setProcessProgress(progress);
            
            // Heartbeat to keep UI alive (especially for many files)
            if (i % 2 === 0) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        // 4. Update state all at once
        setLoadedFiles(resultFiles);
        setSelectedTile(null);
        setSelectedFrame(null);
        
        // Brief success pause
        await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
        console.error("Critical conversion error:", err);
    } finally {
        setProcessProgress(null);
        setIsLoading(false);
    }
  };

  const downloadZip = async () => {
    setIsLoading(true);
    try {
        const zip = new JSZip();
        loadedFiles.forEach(f => {
            const buffer = f.fileType === 'SHP'
                ? ShpParser.writeShp(f.content as ShpFile)
                : TmpParser.writeTmp(f.content as TmpFile);
            zip.file(f.name, buffer);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `converted_tiles.zip`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('Failed to generate ZIP');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div 
        id="editor-container" 
        className={cn(
            "h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden relative",
            isDragging && "ring-4 ring-emerald-500 ring-inset"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
    >
      {/* Blocker during draggable divider operations */}
      {isDraggingDivider && (
        <div className="fixed inset-0 cursor-col-resize z-[9999] bg-transparent select-none pointer-events-auto" />
      )}

      {/* Header */}
      <header id="main-header" className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <PinkCrystal className="w-9 h-9 drop-shadow-[0_0_12px_rgba(255,75,130,0.35)]" />
            <SugarVibesText className="h-6 w-auto sm:block hidden" />
          </div>
          <span className="w-[1px] h-6 bg-slate-800 hidden sm:block" />
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">Theater converter</h1>
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mt-0.5 sm:block hidden">Studio Utility</p>
          </div>
        </div>

        {/* Sleek Tab Toggles */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mx-4 shrink-0">
          <button
            onClick={() => setActiveMainTab('converter')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5",
              activeMainTab === 'converter'
                ? "bg-slate-800 text-white shadow-inner"
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Converter Tab</span>
          </button>
          <button
            onClick={() => setActiveMainTab('canvas')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5",
              activeMainTab === 'canvas'
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Canvas Editor</span>
          </button>
          <button
            onClick={() => setActiveMainTab('tile-creator')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5",
              activeMainTab === 'tile-creator'
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm"
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Tile Creator</span>
          </button>
          <button
            onClick={() => setActiveMainTab('z-editor')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5",
              activeMainTab === 'z-editor'
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm"
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Z-Data Editor</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {loadedFiles.length > 0 && (
            <button
               onClick={handleRenameExtensions}
               className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-semibold bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95 text-slate-300"
               title="Rename all file extensions"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Ext</span>
            </button>
          )}

          {history.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-bold bg-slate-800 border border-amber-500/50 hover:bg-slate-700 active:scale-95 text-amber-500 shadow-[0_0_15px_-5px_theme(colors.amber.500/0.3)] animate-in fade-in slide-in-from-top-2"
              title="Undo the last batch operation"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Resize ({history.length})</span>
            </button>
          )}
          <label className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-semibold",
            "bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95",
            palette ? "border-sky-500/50 text-sky-400" : "text-slate-300"
          )}>
            <FileText className="w-3.5 h-3.5" />
            <span>{palette ? 'Change PAL' : 'Load PAL'}</span>
            <input ref={paletteInputRef} type="file" accept=".pal" className="hidden" onChange={handlePaletteUpload} />
          </label>

          <label className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-xs font-semibold",
            "bg-slate-800 border border-slate-700 hover:bg-slate-700 active:scale-95",
            loadedFiles.length > 0 ? "border-emerald-500/50 text-emerald-400" : "text-slate-300"
          )}>
            <Upload className="w-3.5 h-3.5" />
            <span>{loadedFiles.length > 0 ? `Add Files (${loadedFiles.length})` : 'Load Files'}</span>
            <input ref={tmpInputRef} type="file" accept="*" className="hidden" multiple onChange={handleTmpUpload} />
          </label>



          {loadedFiles.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="flex bg-slate-800 p-0.5 rounded-md border border-slate-700">
                  <button
                      onClick={async () => {
                          console.log("[DEBUG] TS Conversion Button Clicked. Files:", loadedFiles.length);
                          await convertFiles('TS');
                      }}
                      className={cn(
                          "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all active:scale-95",
                          ((activeTmp?.type === 'TS' && activeTmp?.cx === 48) || (activeShp?.sourceType === 'TS'))
                              ? "bg-emerald-500/20 text-emerald-500 font-bold" 
                              : "text-slate-200 bg-slate-700 hover:bg-slate-600 shadow-sm"
                      )}
                  >
                      {loadedFiles.length > 1 ? `Batch TS (${loadedFiles.length})` : "To TS (48x24)"}
                  </button>
                  <button
                      onClick={async () => {
                          console.log("[DEBUG] RA2 Conversion Button Clicked. Files:", loadedFiles.length);
                          await convertFiles('RA2');
                      }}
                      className={cn(
                          "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all active:scale-95",
                          ((activeTmp?.type === 'RA2' && activeTmp?.cx === 60) || (activeShp?.sourceType === 'RA2'))
                              ? "bg-red-500/20 text-red-500 font-bold" 
                              : "text-slate-200 bg-slate-700 hover:bg-slate-600 shadow-sm"
                      )}
                  >
                      {loadedFiles.length > 1 ? `Batch RA2 (${loadedFiles.length})` : "To RA2 (60x30)"}
                  </button>
                  <button
                      onClick={async () => {
                          console.log("[DEBUG] OpenTS Conversion Button Clicked. Files:", loadedFiles.length);
                          await convertFiles('OpenTS');
                      }}
                      className={cn(
                          "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all active:scale-95",
                          ((activeTmp?.type === 'OpenTS' && activeTmp?.cx === 120) || (activeShp?.sourceType === 'OpenTS' && (activeShp?.width || 0) >= 90))
                              ? "bg-amber-500/20 text-amber-500 font-bold" 
                              : "text-slate-200 bg-slate-700 hover:bg-slate-600 shadow-sm"
                      )}
                  >
                      {loadedFiles.length > 1 ? `Batch OpenTS (${loadedFiles.length})` : "To OpenTS (120x60)"}
                  </button>
                  <button
                      onClick={async () => {
                          console.log("[DEBUG] OpenTS 48x96 Conversion Button Clicked. Files:", loadedFiles.length);
                          await convertFiles('OpenTS_48x96');
                      }}
                      className={cn(
                          "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all active:scale-95",
                          ((activeTmp?.type === 'OpenTS' && activeTmp?.cx === 96) || (activeShp?.sourceType === 'OpenTS_48x96') || (activeShp?.sourceType === 'OpenTS' && (activeShp?.width || 0) < 90))
                              ? "bg-amber-500/20 text-amber-500 font-bold" 
                              : "text-slate-200 bg-slate-700 hover:bg-slate-600 shadow-sm"
                      )}
                  >
                      {loadedFiles.length > 1 ? `Batch OpenTS 48x96 (${loadedFiles.length})` : "To OpenTS (48x96)"}
                  </button>
              </div>

              {/* Options Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                  className={cn(
                    "px-2 px-2.5 py-1.5 text-[10px] uppercase font-semibold border rounded flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm cursor-pointer",
                    isOptionsOpen 
                      ? "bg-slate-700 text-sky-400 border-sky-500/60" 
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  )}
                  title="Configure conversion stock and resizing options"
                >
                  <Settings className={cn("w-3.5 h-3.5", isOptionsOpen ? "text-sky-400" : "text-slate-400")} />
                  <span>Options</span>
                </button>

                {isOptionsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsOptionsOpen(false)} 
                    />
                    <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3.5 z-20 flex flex-col gap-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
                        Converter Options
                      </div>
                      
                      <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-200 hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={useStockTs}
                          onChange={(e) => setUseStockTs(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-800 accent-sky-500 cursor-pointer"
                        />
                        <span className="font-semibold select-none group-hover:translate-x-0.5 transition-transform">Use stock TS</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-200 hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={useStockRa2}
                          onChange={(e) => setUseStockRa2(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-800 accent-sky-500 cursor-pointer"
                        />
                        <span className="font-semibold select-none group-hover:translate-x-0.5 transition-transform">Use stock RA2</span>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer group text-xs text-slate-200 hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={smartZData}
                          onChange={(e) => setSmartZData(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-800 accent-sky-500 cursor-pointer"
                        />
                        <span className="font-semibold select-none group-hover:translate-x-0.5 transition-transform">Smart Z-data (experimental)</span>
                      </label>
                      
                      <div className="text-[9px] text-slate-500 border-b border-slate-800 pb-2 mb-1 leading-relaxed">
                        If enabled, we merge stock Z-data into the resized file.
                      </div>

                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 pb-1">
                        Image Resize Filter
                      </div>
                      <div className="flex flex-col gap-1.5 pl-1.5 border-b border-slate-800 pb-2 mb-1">
                        {(['quadratic', 'linear', 'box', 'nearest'] as const).map((filter) => (
                          <label key={filter} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white select-none">
                            <input
                              type="radio"
                              name="imageResizeFilter"
                              value={filter}
                              checked={imageResizeFilter === filter}
                              onChange={() => setImageResizeFilter(filter)}
                              className="w-3.5 h-3.5 text-sky-500 focus:ring-sky-500 bg-slate-800 border-slate-600 accent-sky-500 cursor-pointer"
                            />
                            <span>
                              {filter === 'quadratic' && 'Smooth Weighted'}
                              {filter === 'linear' && 'Linear Weighted'}
                              {filter === 'box' && 'Majority (Box)'}
                              {filter === 'nearest' && 'Crisp / Nearest'}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 pb-1">
                        Z-Data Resize Filter
                      </div>
                      <div className="flex flex-col gap-1.5 pl-1.5">
                        {(['quadratic', 'linear', 'box', 'nearest'] as const).map((filter) => (
                          <label key={filter} className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white select-none">
                            <input
                              type="radio"
                              name="zResizeFilter"
                              value={filter}
                              checked={zResizeFilter === filter}
                              onChange={() => setZResizeFilter(filter)}
                              className="w-3.5 h-3.5 text-sky-500 focus:ring-sky-500 bg-slate-800 border-slate-600 accent-sky-500 cursor-pointer"
                            />
                            <span>
                              {filter === 'quadratic' && 'Smooth Weighted'}
                              {filter === 'linear' && 'Linear Weighted'}
                              {filter === 'box' && 'Majority (Box)'}
                              {filter === 'nearest' && 'Crisp / Nearest'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsZFilesModalOpen(true)}
            title="Resize and transfer Z-data matching files with the same name between TS & RA2. Drag TS files on the left and RA2 files on the right to auto-align and hybridize them."
            className="ml-2 px-2.5 py-1.5 text-[10px] uppercase font-semibold text-amber-400 bg-slate-800 hover:bg-slate-705 border border-slate-700 rounded flex items-center justify-center gap-1 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
            <span>z-files</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />



          {activeFile && (
            <>
              <button
                onClick={() => {
                  let buffer;
                  if (activeFile.fileType === 'SHP') {
                    buffer = ShpParser.writeShp(activeFile.content as ShpFile);
                  } else {
                    buffer = TmpParser.writeTmp(activeFile.content as TmpFile);
                  }
                  const blob = new Blob([buffer], { type: 'application/octet-stream' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = loadedFiles[activeFileIndex!].name;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-3 py-1.5 ml-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-md text-[10px] uppercase font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Download className="w-3 h-3" />
                Save active
              </button>
              {loadedFiles.length > 1 && (
                  <button
                  onClick={downloadZip}
                  className="flex items-center gap-2 px-3 py-1.5 ml-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md text-[10px] uppercase font-bold transition-all shadow-lg shadow-sky-500/20 active:scale-95"
                >
                  <Files className="w-3 h-3" />
                  Save ZIP ({loadedFiles.length})
                </button>
              )}
            </>
          )}

          {(loadedFiles.length > 0 || palette) && (
            <button 
              onClick={resetAll}
              className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
              title="Clear session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 1. Tile Creator Tab */}
      <div className={cn("flex-1 flex flex-col overflow-hidden", activeMainTab !== 'tile-creator' && "hidden")}>
        <TileCreator
          loadedFiles={loadedFiles}
          palette={palette || []}
          onAddFilesToWorkspace={(newFiles) => {
            setLoadedFiles(prev => [...prev, ...newFiles]);
            if (newFiles.length > 0) {
              setActiveFileIndex(loadedFiles.length);
            }
          }}
        />
      </div>

      {/* 2. Canvas Tab */}
      <div className={cn("flex-1 flex flex-col overflow-hidden", activeMainTab !== 'canvas' && "hidden")}>
        <CanvasEditor
          loadedFiles={loadedFiles}
          palette={palette || []}
          onRemoveFile={(index) => {
            const updated = loadedFiles.filter((_, idx) => idx !== index);
            setLoadedFiles(updated);
            if (activeFileIndex === index) {
              setActiveFileIndex(updated.length > 0 ? 0 : null);
              setSelectedTile(null);
              setSelectedFrame(null);
            } else if (activeFileIndex !== null && activeFileIndex > index) {
              setActiveFileIndex(activeFileIndex - 1);
            }
          }}
          placedElements={placedElements}
          setPlacedElements={setPlacedElements}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          gridSize={canvasGridSize}
          setGridSize={setCanvasGridSize}
          gridEngine={canvasGridEngine}
          setGridEngine={setCanvasGridEngine}
          zoom={canvasZoom}
          setZoom={setCanvasZoom}
          toolMode={canvasToolMode}
          setToolMode={setCanvasToolMode}
          activeStampIndex={canvasActiveStampIndex}
          setActiveStampIndex={setCanvasActiveStampIndex}
          customBrush={customBrush}
          setCustomBrush={setCustomBrush}
          customBrushSelectMode={customBrushSelectMode}
          setCustomBrushSelectMode={setCustomBrushSelectMode}
          customBrushSubMode={customBrushSubMode}
          setCustomBrushSubMode={setCustomBrushSubMode}
          customBrushVerticalLine={customBrushVerticalLine}
          setCustomBrushVerticalLine={setCustomBrushVerticalLine}
          customBrushSnap={customBrushSnap}
          setCustomBrushSnap={setCustomBrushSnap}
          history={history}
          setHistory={setHistory}
          redoHistory={redoHistory}
          setRedoHistory={setRedoHistory}
          triggerRootUpdate={triggerRootUpdate}
        />
      </div>

      {/* 3. Z-Data Editor Tab */}
      <div className={cn("flex-1 flex flex-col overflow-hidden", activeMainTab !== 'z-editor' && "hidden")}>
        <ZDataEditor
          loadedFiles={loadedFiles}
          palette={palette}
          activeFileIndex={activeFileIndex}
          onUpdateFile={(fileIndex, updatedTmp) => {
            setLoadedFiles((prev) =>
              prev.map((f, i) => (i === fileIndex ? { ...f, content: updatedTmp } : f))
            );
          }}
        />
      </div>

      {/* 4. Converter Tab */}
      <div className={cn("flex-1 flex overflow-hidden", activeMainTab !== 'converter' && "hidden")}>
        <div id="sidebar-layout" className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Files & Metas */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-800 bg-black/20">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <FileCode className="w-3 h-3" />
              Loaded Files
            </h2>
            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {loadedFiles.length === 0 ? (
                    <div className="py-4 text-center border border-slate-800 border-dashed rounded-lg">
                        <p className="text-[10px] text-slate-600 italic">No files loaded</p>
                    </div>
                ) : (
                    loadedFiles.map((f, i) => (
                        <div
                            key={i}
                            onClick={(e) => {
                                handleFileClick(i, e);
                            }}
                            className={cn(
                                "w-full cursor-pointer px-2 py-1.5 rounded text-[11px] font-medium flex items-center justify-between group transition-colors select-none",
                                selectedFileIndices.includes(i) || activeFileIndex === i 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            )}
                        >
                            <span className="truncate max-w-[140px]">{f.name}</span>
                            <div className="flex items-center gap-1">
                                <span className={cn(
                                    "text-[9px] px-1 rounded font-black",
                                    f.fileType === 'SHP'
                                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/20"
                                        : f.content.type === 'OpenTS' ? "bg-amber-500/20 text-amber-500" : f.content.type === 'RA2' ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"
                                )}>
                                    {f.fileType === 'SHP' ? `SHP` : f.content.type}
                                </span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const updated = loadedFiles.filter((_, idx) => idx !== i);
                                        setLoadedFiles(updated);
                                        setSelectedFileIndices([]);
                                        if (activeFileIndex === i) {
                                            setActiveFileIndex(updated.length > 0 ? 0 : null);
                                            setSelectedTile(null);
                                            setSelectedFrame(null);
                                        }
                                        else if (activeFileIndex !== null && activeFileIndex > i) {
                                            setActiveFileIndex(activeFileIndex - 1);
                                        }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 text-slate-500 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {selectedFileIndices.length > 1 && (
                <button
                    onClick={() => {
                        const updated = loadedFiles.filter((_, idx) => !selectedFileIndices.includes(idx));
                        setLoadedFiles(updated);
                        setSelectedFileIndices([]);
                        setActiveFileIndex(updated.length > 0 ? 0 : null);
                        setSelectedTile(null);
                        setSelectedFrame(null);
                    }}
                    className="w-full mt-2 py-1.5 px-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 text-red-400 hover:text-white rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete ({selectedFileIndices.length}) Files</span>
                </button>
            )}
          </div>
 
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            <section className="bg-slate-900/30 border border-slate-800/40 rounded-lg p-3">
              <h2 
                onClick={() => setIsActiveInfoOpen(!isActiveInfoOpen)}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-between cursor-pointer select-none hover:text-slate-300 transition-colors"
                title="Click to expand/collapse Active Info"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  <span>Active Info</span>
                </div>
                {isActiveInfoOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
              </h2>
              {isActiveInfoOpen && (
                <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {activeFile ? (
                    activeFile.fileType === 'SHP' ? (
                      <div className="grid gap-2">
                        <MetaBadge label="Type" value="SHP Format 80" theme="emerald" />
                        <MetaBadge label="Engine" value={(activeFile.content as ShpFile).sourceType || 'TS'} theme={((activeFile.content as ShpFile).sourceType === 'OpenTS' || (activeFile.content as ShpFile).sourceType === 'OpenTS_48x96') ? 'amber' : (activeFile.content as ShpFile).sourceType === 'RA2' ? 'red' : 'emerald'} />
                        <MetaBadge label="Global Size" value={`${(activeFile.content as ShpFile).width}×${(activeFile.content as ShpFile).height}`} theme="slate" />
                        <MetaBadge label="Frames" value={(activeFile.content as ShpFile).frames.length.toString()} theme="slate" />
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <MetaBadge label="Engine" value={(activeFile.content as TmpFile).type} theme={(activeFile.content as TmpFile).type === 'OpenTS' ? 'amber' : (activeFile.content as TmpFile).type === 'RA2' ? 'red' : 'emerald'} />
                        <MetaBadge label="Grid" value={`${(activeFile.content as TmpFile).cblocks_x}×${(activeFile.content as TmpFile).cblocks_y}`} theme="slate" />
                        <MetaBadge label="Cell" value={`${(activeFile.content as TmpFile).cx}×${(activeFile.content as TmpFile).cy}`} theme="slate" />
                        <MetaBadge label="Count" value={(activeFile.content as TmpFile).tiles.length.toString()} theme="slate" />
                      </div>
                    )
                  ) : (
                    <div className="py-4 text-center border border-slate-800 border-dashed rounded-lg">
                      <p className="text-xs text-slate-600 font-medium italic">Waiting for file...</p>
                    </div>
                  )}
                </div>
              )}
            </section>

          <section className="flex-1 min-h-0 flex flex-col border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Palette Manager</h2>
              {(palette && conversionPalette) && (
                <button
                  type="button"
                  onClick={handleSwapPalettes}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-slate-800 border border-slate-700 hover:text-white text-slate-400 transition-all active:scale-95"
                  title="Swap Base and Conversion Palettes"
                >
                  <ArrowLeftRight className="w-2.5 h-2.5 text-sky-400" />
                  <span>Swap</span>
                </button>
              )}
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 pb-4 custom-scrollbar">
              {/* Base Palette */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Active Base PAL</span>
                  {!palette && (
                    <span className="text-[9px] text-slate-600 italic">No Base loaded</span>
                  )}
                </div>
                {palette ? (
                  <div className="grid grid-cols-8 gap-px bg-slate-800 p-px rounded border border-slate-800 shadow-inner overflow-hidden">
                    {palette.map((color, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedColorIndex(i)}
                        className={cn(
                          "aspect-square w-full hover:scale-150 transition-transform cursor-pointer relative z-0 hover:z-10 shadow-black shadow",
                          selectedColorIndex === i ? "ring-2 ring-white scale-125 z-20 shadow-lg" : ""
                        )}
                        style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
                        title={`Active Base PAL #${i}: R=${color.r} G=${color.g} B=${color.b} (Click to paint)`}
                      />
                    ))}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-slate-800 border-dashed rounded-lg py-5 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer group transition-colors">
                    <FileText className="w-5 h-5 text-slate-700 group-hover:text-slate-500 transition-colors" />
                    <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-400 mt-1 transition-colors">Load Base PAL</span>
                    <input type="file" accept=".pal" className="hidden" onChange={handlePaletteUpload} />
                  </label>
                )}
              </div>

              {/* Conversion Palette */}
              {palette && (
                <div className="space-y-1.5 border-t border-slate-900 pt-3">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">PAL to Convert To</span>
                  {conversionPalette ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-8 gap-px bg-slate-800 p-px rounded border border-slate-800 shadow-inner overflow-hidden opacity-80">
                        {conversionPalette.map((color, i) => (
                          <div
                            key={i}
                            className="aspect-square w-full hover:scale-150 transition-transform cursor-pointer relative z-0 hover:z-10 shadow-black shadow"
                            style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
                            title={`Conversion PAL TARGET #${i}: R=${color.r} G=${color.g} B=${color.b}`}
                          />
                        ))}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white text-[9px] font-bold uppercase transition-all active:scale-95 cursor-pointer text-center">
                          <span>Change Target</span>
                          <input ref={conversionPaletteInputRef} type="file" accept=".pal" className="hidden" onChange={handleConversionPaletteUpload} />
                        </label>

                        <button
                          type="button"
                          onClick={applyPaletteConversion}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded text-[9px] uppercase tracking-wider py-1 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all text-center leading-normal"
                        >
                          Convert Colors
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border border-slate-800 border-dashed rounded-lg py-5 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer group transition-colors">
                      <FileText className="w-5 h-5 text-slate-700 group-hover:text-slate-500 transition-colors" />
                      <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-400 mt-1 transition-colors">Load Target PAL</span>
                      <input type="file" accept=".pal" className="hidden" onChange={handleConversionPaletteUpload} />
                    </label>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>

        {/* Center Loading Overlays */}
        {(isLoading || processProgress !== null) && (
            <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
                {processProgress !== null ? (
                    <div className="w-64 space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="flex flex-col items-center gap-2">
                             <div className="p-3 bg-emerald-500/20 rounded-full animate-pulse">
                                <Layers className="w-8 h-8 text-emerald-500" />
                             </div>
                             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Batch Resizing</h3>
                             <p className="text-[10px] font-mono text-emerald-500/60 tracking-widest uppercase">
                                Optimized Diamond Mapping
                             </p>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 transition-all duration-300 ease-out shadow-[0_0_10px_theme(colors.emerald.500)]" 
                                    style={{ width: `${processProgress}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500">
                                <span>{processProgress}% COMPLETE</span>
                                <span className="text-emerald-500">{processProgress === 100 ? 'FINALIZING...' : 'PROCESSING...'}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                        <Layers className="w-12 h-12 text-emerald-500 animate-bounce" />
                        <p className="font-black uppercase tracking-[0.3em] text-xs text-emerald-500">Initializing Workspace</p>
                    </div>
                )}
            </div>
        )}

        {/* Central Grid */}
        <section id="viewport" className="flex-1 bg-slate-900 flex flex-col min-w-0 relative">
          <div className="flex items-center justify-between px-6 py-2 bg-slate-900 border-b border-white/5 shadow-sm">
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {activeFile?.fileType === 'SHP' 
                        ? (shpViewMode === 'grid' ? 'SHP Sprite Frame Grid' : 'SHP Active Animation Stage')
                        : (displayMode === 'grid' ? 'Terrain Tiles Viewport' : 'Reconstructed Object')
                    }
                </span>

                {activeFile?.fileType === 'SHP' ? (
                  <div className="flex bg-slate-800 p-0.5 rounded-md border border-slate-700 ml-4">
                    <button
                      type="button"
                      onClick={() => setShpViewMode('animation')}
                      className={cn(
                        "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all cursor-pointer",
                        shpViewMode === 'animation' ? "bg-slate-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Animation Player
                    </button>
                    <button
                      type="button"
                      onClick={() => setShpViewMode('grid')}
                      className={cn(
                        "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all cursor-pointer",
                        shpViewMode === 'grid' ? "bg-slate-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Frames Grid
                    </button>
                  </div>
                ) : (
                  displayMode === 'object' && (
                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Zoom</span>
                        <input 
                            type="range" min="1" max="4" step="0.5" 
                            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                            className="h-1 w-20 appearance-none bg-slate-800 rounded-lg outline-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[9px] font-mono text-emerald-500">{zoom}x</span>
                    </div>
                  )
                )}

                {activeFile?.fileType === 'SHP' && shpViewMode === 'animation' && (
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Zoom</span>
                      <input 
                          type="range" min="1" max="4" step="0.5" 
                          value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                          className="h-1 w-20 appearance-none bg-slate-800 rounded-lg outline-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[9px] font-mono text-emerald-500">{zoom}x</span>
                  </div>
                )}

                {activeFile && (
                  <div className="flex items-center gap-2 ml-4 border-l border-slate-800 pl-4 hidden md:flex">
                     <span className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Pane Width</span>
                     <input 
                         type="range" min="360" max="750" step="10" 
                         value={editorPaneWidth} onChange={(e) => setEditorPaneWidth(Number(e.target.value))}
                         className="h-1 w-20 appearance-none bg-slate-850 rounded-lg outline-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                         title="Adjust width of the drawing editor panel"
                     />
                     <span className="text-[9px] font-mono text-emerald-450 font-bold">{editorPaneWidth}px</span>
                  </div>
                )}
             </div>
             {activeFile && (
               <div className="text-[10px] text-emerald-500/80 font-mono font-bold tracking-tight">
                 {activeFile.fileType === 'SHP'
                     ? `${activeShp?.frames.length} sequential frames`
                     : `${activeTmp?.tiles.filter(t => t).length} active / ${activeTmp?.tiles.length} total slots`
                 }
               </div>
             )}
          </div>
          
          <div className="flex-1 overflow-auto p-4 custom-scrollbar relative">
            {!activeFile ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 select-none">
                <Box className="w-16 h-16 mb-4 opacity-10" />
                <p className="font-medium">No landscape loaded</p>
                <p className="text-xs opacity-60 mt-1">Drag and drop .TMP or .SHP files here</p>
              </div>
            ) : activeFile.fileType === 'SHP' ? (
                shpViewMode === 'grid' ? (
                  <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[400px]">
                    {/* scrollable grid of frames on the left/top */}
                    <div className="flex-1 overflow-y-auto max-h-[320px] xl:max-h-full xl:pr-2">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                        {activeShp!.frames.map((frame, i) => (
                          <ShpFramePreview
                            key={`${activeFileIndex}-${i}`}
                            frame={frame}
                            index={i}
                            globalWidth={activeShp!.width}
                            globalHeight={activeShp!.height}
                            palette={palette || []}
                            isSelected={selectedFrameIndex === i}
                            onClick={() => {
                                setSelectedFrame(frame);
                                setSelectedFrameIndex(i);
                                setSelectedTile(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Draggable Divider Handle */}
                    <div 
                      className="hidden xl:flex items-center justify-center w-2 hover:w-3 bg-slate-900 border-l border-r border-slate-805 hover:bg-slate-800 hover:border-emerald-500/20 cursor-col-resize active:bg-emerald-500 hover:text-emerald-450 shrink-0 self-stretch transition-all group relative z-20"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingDivider(true);
                      }}
                      title="Drag left or right to resize drawing panel"
                    >
                      <div className="w-[1.5px] h-10 bg-slate-700 group-hover:bg-emerald-500 rounded group-active:bg-slate-950 group-hover:h-16 transition-all" />
                    </div>

                    {/* interactive painting workbench for currently selected frame */}
                    <div 
                      className="w-full xl:shrink-0 space-y-4"
                      style={{
                        width: typeof window !== 'undefined' && window.innerWidth >= 1280 ? `${editorPaneWidth}px` : '100%'
                      }}
                    >
                      {selectedFrame ? (
                        <PixelEditor
                          label={`SHP Frames Grid Editor - Frame #${selectedFrameIndex}`}
                          data={selectedFrame.data}
                          width={selectedFrame.w}
                          height={selectedFrame.h}
                          palette={palette || []}
                          selectedColorIndex={selectedColorIndex}
                          onChangeSelectedColorIndex={setSelectedColorIndex}
                          onUpdatePixels={(newData) => handleUpdateFramePixels(selectedFrameIndex, newData)}
                          isShadowFrame={selectedFrame.isShadow}
                          onUndo={handleUndo}
                          onRedo={handleRedo}
                          canUndo={history.length > 0}
                          canRedo={redoHistory.length > 0}
                        />
                      ) : (
                        <div className="h-full rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-8 text-slate-600 text-xs">
                          <span>Click a frame in the grid to paint on it directly here</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-full w-full flex items-center justify-center">
                    <div className="w-full max-w-2xl">
                      <PixelEditor 
                        label={`SHP Animation Player - Frame #${selectedFrameIndex}`}
                        data={selectedFrame ? selectedFrame.data : activeShp!.frames[selectedFrameIndex].data}
                        width={selectedFrame ? selectedFrame.w : activeShp!.frames[selectedFrameIndex].w}
                        height={selectedFrame ? selectedFrame.h : activeShp!.frames[selectedFrameIndex].h}
                        palette={palette || []}
                        selectedColorIndex={selectedColorIndex}
                        onChangeSelectedColorIndex={setSelectedColorIndex}
                        onUpdatePixels={(newData) => handleUpdateFramePixels(selectedFrameIndex, newData)}
                        isShadowFrame={selectedFrame ? selectedFrame.isShadow : activeShp!.frames[selectedFrameIndex].isShadow}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={history.length > 0}
                        canRedo={redoHistory.length > 0}
                        frameCount={activeShp!.frames.length}
                        currentFrameIndex={selectedFrameIndex}
                        onFrameIndexChange={(idx) => {
                          setSelectedFrameIndex(idx);
                          setSelectedFrame(activeShp!.frames[idx]);
                        }}
                      />
                    </div>
                  </div>
                )
            ) : (
              <div className="flex flex-col xl:flex-row gap-6 h-full min-h-[400px]">
                {/* Scrollable primary workspace view on the left/top */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[1000px] xl:max-h-full">
                  
                  {/* Complete Reconstructed composite layers */}
                  <CompleteObjectDualView
                    tmpFile={activeTmp!}
                    palette={palette || []}
                    zoom={zoom}
                    isSelected={selectedFullObject}
                    onSelectFullObject={() => {
                      setSelectedFullObject(true);
                      setSelectedTile(null);
                    }}
                  />

                  {/* Individual sub-tiles horizontal rows list */}
                  <div className="space-y-3.5 pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#a1a1aa] flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-[#3f3f46]" />
                        Individual Segment Tiles ({activeTmp!.tiles.length})
                      </span>
                      <span className="text-[8px] text-[#71717a] font-mono select-none">
                        INDEXED COORDINATE FRAGMENTS
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeTmp!.tiles.map((tile, i) => (
                        <TerrainTileWorkspaceRow
                          key={`${activeFileIndex}-${i}`}
                          tile={tile}
                          index={i}
                          palette={palette || []}
                          selectedTileSlot={selectedTile ? selectedTile.slot : null}
                          selectedComponent={selectedTile ? selectedComponent : null}
                          onSelectSegment={(t, comp) => {
                            setSelectedFullObject(false);
                            setSelectedTile(t);
                            setSelectedComponent(comp);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Draggable Divider Handle */}
                <div 
                  className="hidden xl:flex items-center justify-center w-2 hover:w-3 bg-slate-900 border-l border-r border-slate-850 hover:bg-slate-800 hover:border-emerald-500/20 cursor-col-resize active:bg-emerald-500 hover:text-emerald-450 shrink-0 self-stretch transition-all group relative z-20"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsDraggingDivider(true);
                  }}
                  title="Drag left or right to resize drawing panel"
                >
                  <div className="w-[1.5px] h-10 bg-slate-700 group-hover:bg-emerald-500 rounded group-active:bg-slate-950 group-hover:h-16 transition-all" />
                </div>

                {/* Interactive drawing boards section (Width-adjustable) */}
                <div 
                  className="w-full xl:shrink-0 space-y-4"
                  style={{
                    width: typeof window !== 'undefined' && window.innerWidth >= 1280 ? `${editorPaneWidth}px` : '100%'
                  }}
                >
                  {selectedFullObject ? (
                    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar">
                      {/* 1. Composite full-object color layer */}
                      <PixelEditor
                        label="Composite Object Color Layer (Drawing)"
                        data={fullColorComposite.data}
                        width={fullColorComposite.width}
                        height={fullColorComposite.height}
                        palette={palette || []}
                        selectedColorIndex={selectedColorIndex}
                        onChangeSelectedColorIndex={setSelectedColorIndex}
                        onUpdatePixels={(newData) => handleUpdateFullObjectPixels(newData, false)}
                        isTileBase={false}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={history.length > 0}
                        canRedo={redoHistory.length > 0}
                      />

                      {/* 2. Composite full-object z-data height layer */}
                      <PixelEditor
                        label="Composite Object Z-Data Height (Elevation)"
                        data={fullZComposite.data}
                        width={fullZComposite.width}
                        height={fullZComposite.height}
                        palette={palette || []}
                        selectedColorIndex={selectedColorIndex}
                        onChangeSelectedColorIndex={setSelectedColorIndex}
                        onUpdatePixels={(newData) => handleUpdateFullObjectPixels(newData, true)}
                        isTileBase={false}
                        isZData={true}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={history.length > 0}
                        canRedo={redoHistory.length > 0}
                      />
                    </div>
                  ) : selectedTile ? (
                    <div className="space-y-4 max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in slide-in-from-right-3 duration-200">
                      {/* Selected Tile Base Image Editor */}
                      <PixelEditor
                        label={`Base Image Color: Slot #${selectedTile.slot}`}
                        data={selectedTile.data}
                        width={selectedTile.cx}
                        height={selectedTile.cy}
                        palette={palette || []}
                        selectedColorIndex={selectedColorIndex}
                        onChangeSelectedColorIndex={setSelectedColorIndex}
                        onUpdatePixels={(newData) => handleUpdateTilePixels(selectedTile.slot, 'base', newData, false)}
                        isTileBase={true}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={history.length > 0}
                        canRedo={redoHistory.length > 0}
                      />

                      {/* Selected Tile Base Z-Data height Editor */}
                      <PixelEditor
                        label={`Base Z-Height: Slot #${selectedTile.slot}`}
                        data={selectedTile.zData || new Uint8Array(selectedTile.cx * selectedTile.cy)}
                        width={selectedTile.cx}
                        height={selectedTile.cy}
                        palette={palette || []}
                        selectedColorIndex={selectedColorIndex}
                        onChangeSelectedColorIndex={setSelectedColorIndex}
                        onUpdatePixels={(newData) => handleUpdateTilePixels(selectedTile.slot, 'base', newData, true)}
                        isTileBase={true}
                        isZData={true}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={history.length > 0}
                        canRedo={redoHistory.length > 0}
                      />

                      {/* Selected Tile Extra Data Image Editor (only if present) */}
                      {selectedTile.header.has_extra_data && selectedTile.extraImageData ? (
                        <>
                          {/* Selected Tile Extra Color Image Editor */}
                          <PixelEditor
                            label={`Extra Fragment Color: Slot #${selectedTile.slot}`}
                            data={selectedTile.extraImageData}
                            width={selectedTile.header.cx_extra}
                            height={selectedTile.header.cy_extra}
                            palette={palette || []}
                            selectedColorIndex={selectedColorIndex}
                            onChangeSelectedColorIndex={setSelectedColorIndex}
                            onUpdatePixels={(newData) => handleUpdateTilePixels(selectedTile.slot, 'extra', newData, false)}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={history.length > 0}
                            canRedo={redoHistory.length > 0}
                          />

                          {/* Selected Tile Extra Z-Data height Editor */}
                          <PixelEditor
                            label={`Extra Fragment Z-Height: Slot #${selectedTile.slot}`}
                            data={selectedTile.extraZData || new Uint8Array(selectedTile.header.cx_extra * selectedTile.header.cy_extra)}
                            width={selectedTile.header.cx_extra}
                            height={selectedTile.header.cy_extra}
                            palette={palette || []}
                            selectedColorIndex={selectedColorIndex}
                            onChangeSelectedColorIndex={setSelectedColorIndex}
                            onUpdatePixels={(newData) => handleUpdateTilePixels(selectedTile.slot, 'extra', newData, true)}
                            isZData={true}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={history.length > 0}
                            canRedo={redoHistory.length > 0}
                          />
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Details Panel */}
        <aside className={cn(
          "w-80 bg-slate-950 border-l border-slate-800 transition-all duration-300 h-full overflow-y-auto shrink-0",
          (selectedTile || (activeFile?.fileType === 'SHP' && selectedFrame)) ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 absolute right-0"
        )}>
          {selectedTile && (
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white leading-none">Slot #{selectedTile.slot}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Technical details</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer",
                        history.length > 0 ? "text-slate-200 hover:bg-slate-800" : "text-slate-650 cursor-not-allowed"
                      )}
                      title="Undo [Ctrl+Z]"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={redoHistory.length === 0}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer",
                        redoHistory.length > 0 ? "text-slate-200 hover:bg-slate-800" : "text-slate-650 cursor-not-allowed"
                      )}
                      title="Redo [Ctrl+Y]"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => setSelectedTile(null)} className="p-1.5 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Values */}
              <div className="grid gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
                 <ValueRow label="Coordinates" value={`${selectedTile.header.x}, ${selectedTile.header.y}`} />
                 <ValueRow label="Elevation" value={selectedTile.header.height.toString()} />
                 <ValueRow label="Terrain ID" value={selectedTile.header.land_type.toString()} />
                 <ValueRow label="Ramp Type" value={selectedTile.header.ramp_type.toString()} />
                 <ValueRow label="Flags" value={`0x${selectedTile.header.flags.toString(16).toUpperCase()}`} />
                 {selectedTile.header.has_extra_data && (
                   <>
                    <ValueRow label="Extra Offset" value={`${selectedTile.header.x_extra}, ${selectedTile.header.y_extra}`} />
                    <ValueRow label="Extra Size" value={`${selectedTile.header.cx_extra}×${selectedTile.header.cy_extra}`} />
                   </>
                 )}
              </div>

              {/* Radar Colors */}
              <div className="space-y-3">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Radar Map Samples</label>
                 <div className="flex gap-2">
                    <div 
                      className="flex-1 h-8 rounded-lg border border-white/10" 
                      style={{backgroundColor: `rgb(${selectedTile.header.radar_colors[0]},${selectedTile.header.radar_colors[1]},${selectedTile.header.radar_colors[2]})`}}
                      title="Left Sample"
                    />
                    <div 
                      className="flex-1 h-8 rounded-lg border border-white/10" 
                      style={{backgroundColor: `rgb(${selectedTile.header.radar_colors[3]},${selectedTile.header.radar_colors[4]},${selectedTile.header.radar_colors[5]})`}}
                      title="Right Sample"
                    />
                 </div>
              </div>
            </div>
          )}

          {(activeFile?.fileType === 'SHP' && selectedFrame) && (
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white leading-none">Frame #{selectedFrameIndex}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Sprite Properties</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer",
                        history.length > 0 ? "text-slate-200 hover:bg-slate-800" : "text-slate-650 cursor-not-allowed"
                      )}
                      title="Undo [Ctrl+Z]"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={redoHistory.length === 0}
                      className={cn(
                        "p-1 rounded transition-colors cursor-pointer",
                        redoHistory.length > 0 ? "text-slate-200 hover:bg-slate-800" : "text-slate-650 cursor-not-allowed"
                      )}
                      title="Redo [Ctrl+Y]"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => setSelectedFrame(null)} className="p-1.5 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Values */}
              <div className="grid gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
                 <ValueRow label="Frame Width" value={`${selectedFrame.w} px`} />
                 <ValueRow label="Frame Height" value={`${selectedFrame.h} px`} />
                 <ValueRow label="Frame Offset X" value={`${selectedFrame.x} px`} />
                 <ValueRow label="Frame Offset Y" value={`${selectedFrame.y} px`} />
                 <ValueRow label="Compression" value={selectedFrame.compression === 0 ? "Format 80 (RLE Zero)" : "Uncompressed"} />
                 <ValueRow label="Has Shadow" value={selectedFrame.isShadow ? "Yes (Index 1 preserved)" : "No"} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
    {/* Rename Extension Modal */}
      {isRenaming && (
        <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 w-full max-w-sm space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Refactor Extensions</h3>
              <button onClick={() => setIsRenaming(false)} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Extension</label>
              <div className="flex gap-2">
                <input 
                  autoFocus
                  type="text" 
                  value={customExt} 
                  onChange={(e) => setCustomExt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyRename()}
                  className="flex-1 bg-black/40 border border-slate-800 rounded-lg px-4 py-3 text-sm text-emerald-400 font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-inner"
                  placeholder="e.g. sno"
                />
                <button 
                  onClick={applyRename}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-lg text-xs font-bold uppercase transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ZFilesModal 
        isOpen={isZFilesModalOpen}
        onClose={() => setIsZFilesModalOpen(false)}
        onAddFilesToWorkspace={(newFiles) => {
            setLoadedFiles(prev => {
                // filter out existing files with same name AND type to prevent unwanted duplicate overrides
                const updatedPrev = prev.filter(p => !newFiles.some(n => {
                    const nType = n.fileType === 'TMP' && (n.content as TmpFile).type;
                    const pType = p.fileType === 'TMP' && (p.content as TmpFile).type;
                    return n.name.toLowerCase() === p.name.toLowerCase() && nType === pType;
                }));
                const updated = [...updatedPrev, ...newFiles];
                setActiveFileIndex(Math.max(0, updated.length - newFiles.length)); // switch focus to the newly added file content
                return updated;
            });
            setIsZFilesModalOpen(false);
        }}
        palette={palette}
        imageFilter={imageResizeFilter}
        zFilter={zResizeFilter}
        smartZData={smartZData}
      />
    </div>
  );
}

function MetaBadge({ label, value, theme }: { label: string, value: string, theme: 'red' | 'emerald' | 'amber' | 'slate' }) {
  const colors = {
      red: 'text-red-400 bg-red-400/10 border-red-400/20',
      emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      slate: 'text-slate-300 bg-slate-800 border-slate-700'
  };
  return (
    <div className={cn("flex justify-between items-center px-3 py-2 rounded-lg border", colors[theme])}>
      <span className="text-[10px] uppercase font-bold opacity-60 tracking-wider font-sans">{label}</span>
      <span className="text-xs font-mono font-black">{value}</span>
    </div>
  );
}

function ValueRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-900 group">
      <span className="text-xs text-slate-500 font-medium group-hover:text-slate-400 transition-colors uppercase tracking-widest text-[9px]">{label}</span>
      <span className="text-xs text-slate-200 font-mono font-bold">{value}</span>
    </div>
  );
}

const TilePreview = React.memo(({ tile, index, palette, viewMode, isSelected, onClick }: { 
    tile: Tile | null, 
    index: number, 
    palette: RGB[], 
    viewMode: 'image' | 'z-data',
    isSelected: boolean,
    onClick: () => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Intersection observer to only render tiles when they are visible
    // This saves massive amounts of GPU memory on mobile devices
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { 
        threshold: 0, 
        rootMargin: '200px' // Pre-render slightly before they come into view
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!tile || !palette) return;

    if (isVisible && canvasRef.current) {
      // Small delay to ensure the UI stays responsive while scrolling
      const timer = setTimeout(() => {
        if (canvasRef.current && isVisible) {
           TmpParser.renderTileToCanvas(canvasRef.current, tile, palette, viewMode === 'z-data');
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isVisible && canvasRef.current) {
      // Clear canvas size when not visible to free graphics memory
      const canvas = canvasRef.current;
      canvas.width = 1;
      canvas.height = 1;
    }
  }, [tile, palette, viewMode, isVisible]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn(
        "aspect-[2/1] rounded-lg border transition-all cursor-pointer p-1 group relative overflow-hidden",
        isSelected 
          ? "bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_-5px_theme(colors.emerald.500)]" 
          : "bg-slate-800/80 border-slate-800 hover:border-slate-600 hover:bg-slate-800"
      )}
    >
      <div className="w-full h-full rounded-[6px] bg-slate-900/50 flex flex-col items-center justify-center">
        {tile ? (
          <canvas 
            ref={canvasRef} 
            className={cn(
                "max-w-full max-h-full image-pixelated transition-opacity duration-300",
                isVisible ? "opacity-100" : "opacity-0"
            )} 
          />
        ) : (
          <Box className="w-4 h-4 text-slate-800" />
        )}
      </div>
      <div className={cn(
          "absolute bottom-0.5 right-1 px-1 rounded text-[7px] font-black font-mono transition-all",
          isSelected ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-500 group-hover:text-slate-400"
      )}>
        {index}
      </div>
    </div>
  );
});

const LargePreview = React.memo(({ tile, palette, type, viewMode }: { 
    tile: Tile, 
    palette: RGB[], 
    type: 'base' | 'extra',
    viewMode: 'image' | 'z-data'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      if (type === 'base') {
        TmpParser.renderTileToCanvas(canvasRef.current, tile, palette, viewMode === 'z-data');
      } else {
        TmpParser.renderExtraToCanvas(canvasRef.current, tile, palette, viewMode === 'z-data');
      }
    }
    // Clean up on unmount
    return () => {
        if (canvasRef.current) {
            canvasRef.current.width = 1;
            canvasRef.current.height = 1;
        }
    };
  }, [tile, palette, type, viewMode]);

  return (
    <canvas ref={canvasRef} className="image-pixelated scale-[1.5] sm:scale-[2] origin-center shadow-2xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] bg-black/40" />
  );
});

const CompleteObjectView = React.memo(({ tmpFile, palette, viewMode, zoom, onSelectTile }: {
    tmpFile: TmpFile,
    palette: RGB[],
    viewMode: 'image' | 'z-data',
    zoom: number,
    onSelectTile?: (tile: Tile) => void
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (canvasRef.current && palette.length > 0) {
            TmpParser.renderCompleteToCanvas(canvasRef.current, tmpFile, palette, viewMode === 'z-data');
            setDimensions({ 
                w: canvasRef.current.width, 
                h: canvasRef.current.height 
            });
        }
        // Clean up on unmount
        return () => {
            if (canvasRef.current) {
                canvasRef.current.width = 1;
                canvasRef.current.height = 1;
            }
        };
    }, [tmpFile, palette, viewMode]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!onSelectTile) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const clickX = Math.floor((e.clientX - rect.left) * scaleX);
        const clickY = Math.floor((e.clientY - rect.top) * scaleY);

        let minX = Infinity, minY = Infinity;
        const mult = tmpFile.cy / 2;
        const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);
        if (activeTiles.length === 0) return;

        activeTiles.forEach(tile => {
            const h = tile.header;
            const elev = h.height * mult;
            
            minX = Math.min(minX, h.x);
            minY = Math.min(minY, h.y - elev);
            if (h.has_extra_data) {
                minX = Math.min(minX, h.x_extra);
                minY = Math.min(minY, h.y_extra - elev);
            }
        });

        // Loop backwards (topmost layers drawn first) to check pixels under mouse click
        for (let i = activeTiles.length - 1; i >= 0; i--) {
            const tile = activeTiles[i];
            const h = tile.header;
            const elev = h.height * mult;

            // Extra Data layer
            if (h.has_extra_data && tile.extraImageData) {
                const ex = h.x_extra - minX;
                const ey = (h.y_extra - elev) - minY;
                if (clickX >= ex && clickX < ex + h.cx_extra && clickY >= ey && clickY < ey + h.cy_extra) {
                    const localX = clickX - ex;
                    const localY = clickY - ey;
                    const pixelIdx = localY * h.cx_extra + localX;
                    if (tile.extraImageData[pixelIdx] !== 0) {
                        onSelectTile(tile);
                        return;
                    }
                }
            }

            // Base Diamond layer
            const bx = h.x - minX;
            const by = (h.y - elev) - minY;
            if (clickX >= bx && clickX < bx + tile.cx && clickY >= by && clickY < by + tile.cy) {
                const localX = clickX - bx;
                const localY = clickY - by;
                const pixelIdx = localY * tile.cx + localX;
                if (tile.data[pixelIdx] !== 0) {
                    onSelectTile(tile);
                    return;
                }
            }
        }

        // Fallback: If clicked background of boundary boxes
        for (let i = activeTiles.length - 1; i >= 0; i--) {
            const tile = activeTiles[i];
            const h = tile.header;
            const elev = h.height * mult;

            if (h.has_extra_data && tile.extraImageData) {
                const ex = h.x_extra - minX;
                const ey = (h.y_extra - elev) - minY;
                if (clickX >= ex && clickX < ex + h.cx_extra && clickY >= ey && clickY < ey + h.cy_extra) {
                    onSelectTile(tile);
                    return;
                }
            }

            const bx = h.x - minX;
            const by = (h.y - elev) - minY;
            if (clickX >= bx && clickX < bx + tile.cx && clickY >= by && clickY < by + tile.cy) {
                onSelectTile(tile);
                return;
            }
        }
    };

    return (
        <div 
            className="shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 bg-black/40 transition-transform duration-100"
            style={{ 
                width: dimensions.w * zoom, 
                height: dimensions.h * zoom 
            }}
        >
            <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                className="image-pixelated w-full h-full cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all"
            />
        </div>
    );
});

