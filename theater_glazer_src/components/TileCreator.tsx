import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Save, Trash2, ZoomIn, ZoomOut, Move, Maximize2, 
  MousePointer, Image, Settings, Layers, Sliders, CheckCircle2, 
  ChevronRight, HelpCircle, Download, FilePlus, Grid, 
  Eraser, Paintbrush, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  Info, Undo, Redo, Eye, EyeOff, LayoutGrid, AlertTriangle
} from 'lucide-react';
import { TmpParser, TmpFile, Tile, TileHeader, RGB } from '../lib/formats';
import { LoadedFile } from '../types';
import { cn } from '../lib/utils';
import { TilePixelsRenderer, ExtraPixelsRenderer, MiniPixelPainter } from './TileCreatorRenderers';
import { cloneTile, cloneTilesArray } from '../lib/tileUtils';
import { EngineType, detectEngineFromDimensions, getEngineDimensions } from '../lib/tmpDetector';

// --- STOCK STENCILS FOR INITIAL DEMO PLACEMENTS ---
function createDiamondPattern(cx: number, cy: number, baseColor: number, seed: number) {
  const d = new Uint8Array(cx * cy);
  for (let ly = 0; ly < cy; ly++) {
    for (let lx = 0; lx < cx; lx++) {
      if (TmpParser.isInsideWestwoodDiamond(lx, ly, cx, cy)) {
        d[ly * cx + lx] = baseColor + ((lx * seed + ly * 7) % 3);
      }
    }
  }
  return d;
}

function createRectData(w: number, h: number, baseColor: number) {
  const d = new Uint8Array(w * h);
  for (let i = 0; i < d.length; i++) {
    d[i] = baseColor + (i % 4);
  }
  return d;
}

const STOCK_STENCILS: LoadedFile[] = [
  {
    name: "Slope Mound (2x2 Slope)",
    fileType: 'TMP',
    content: {
      cblocks_x: 2,
      cblocks_y: 2,
      cx: 48,
      cy: 24,
      type: 'TS',
      tiles: [
        {
          slot: 0, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 0, y_extra: 0, cx_extra: 0, cy_extra: 0,
            flags: 2, height: 0, land_type: 12, ramp_type: 0, radar_colors: [44, 180, 44, 44, 180, 44],
            has_extra_data: false, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 110, 1),
          zData: createDiamondPattern(48, 24, 90, 0),
          extraImageData: null, extraZData: null, damagedData: null
        },
        {
          slot: 1, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 0, y_extra: 0, cx_extra: 0, cy_extra: 0,
            flags: 2, height: 1, land_type: 12, ramp_type: 1, radar_colors: [44, 180, 44, 44, 180, 44],
            has_extra_data: false, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 114, 2),
          zData: createDiamondPattern(48, 24, 100, 0),
          extraImageData: null, extraZData: null, damagedData: null
        },
        {
          slot: 2, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 0, y_extra: 0, cx_extra: 0, cy_extra: 0,
            flags: 2, height: 1, land_type: 12, ramp_type: 2, radar_colors: [44, 180, 44, 44, 180, 44],
            has_extra_data: false, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 118, 3),
          zData: createDiamondPattern(48, 24, 105, 0),
          extraImageData: null, extraZData: null, damagedData: null
        },
        {
          slot: 3, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 0, y_extra: 0, cx_extra: 0, cy_extra: 0,
            flags: 2, height: 2, land_type: 12, ramp_type: 0, radar_colors: [44, 180, 44, 44, 180, 44],
            has_extra_data: false, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 122, 4),
          zData: createDiamondPattern(48, 24, 120, 0),
          extraImageData: null, extraZData: null, damagedData: null
        }
      ]
    } as TmpFile
  },
  {
    name: "Cliff Ledge (3x1 Cliffs)",
    fileType: 'TMP',
    content: {
      cblocks_x: 3,
      cblocks_y: 1,
      cx: 48,
      cy: 24,
      type: 'TS',
      tiles: [
        {
          slot: 0, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 10, y_extra: -12, cx_extra: 24, cy_extra: 12,
            flags: 2, height: 0, land_type: 12, ramp_type: 3, radar_colors: [120, 100, 80, 120, 100, 80],
            has_extra_data: true, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 160, 1),
          zData: createDiamondPattern(48, 24, 90, 0),
          extraImageData: createRectData(24, 12, 165),
          extraZData: createRectData(24, 12, 110),
          damagedData: null
        },
        {
          slot: 1, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 10, y_extra: -12, cx_extra: 24, cy_extra: 12,
            flags: 2, height: 0, land_type: 12, ramp_type: 3, radar_colors: [120, 100, 80, 120, 100, 80],
            has_extra_data: true, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 160, 2),
          zData: createDiamondPattern(48, 24, 90, 0),
          extraImageData: createRectData(24, 12, 166),
          extraZData: createRectData(24, 12, 110),
          damagedData: null
        },
        {
          slot: 2, cx: 48, cy: 24,
          header: {
            x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0, x_extra: 10, y_extra: -12, cx_extra: 24, cy_extra: 12,
            flags: 2, height: 0, land_type: 12, ramp_type: 3, radar_colors: [120, 100, 85, 120, 100, 85],
            has_extra_data: true, has_z_data: true, has_damaged_data: false, is_fully_transparent: false
          },
          data: createDiamondPattern(48, 24, 160, 3),
          zData: createDiamondPattern(48, 24, 90, 0),
          extraImageData: createRectData(24, 12, 167),
          extraZData: createRectData(24, 12, 110),
          damagedData: null
        }
      ]
    } as TmpFile
  }
];

interface TileCreatorProps {
  loadedFiles: LoadedFile[];
  palette: RGB[];
  onAddFilesToWorkspace: (newFiles: LoadedFile[]) => void;
}

export function TileCreator({ loadedFiles, palette, onAddFilesToWorkspace }: TileCreatorProps) {
  // Draggable and stamping stencil states
  const [activeDraggableFile, setActiveDraggableFile] = useState<LoadedFile | null>(null);
  const [activeStampFile, setActiveStampFile] = useState<LoadedFile | null>(null);
  const [dragHoverAnchor, setDragHoverAnchor] = useState<number | null>(null);

  const stencilFiles = useMemo(() => {
    const userTmp = loadedFiles.filter(f => f.fileType === 'TMP');
    return [...STOCK_STENCILS, ...userTmp];
  }, [loadedFiles]);

  // File settings
  const [fileName, setFileName] = useState('new_isotile.tem');
  const [engineType, setEngineType] = useState<EngineType>('TS');
  const [cblocksX, setCblocksX] = useState(10);
  const [cblocksY, setCblocksY] = useState(10);

  // Dimensions of tile base diamond based on engine
  const { cellW, cellH } = getEngineDimensions(engineType);

  // Active tiles state
  const [tiles, setTiles] = useState<(Tile | null)[]>(() => {
    return new Array(100).fill(null);
  });

  // Hotkey / Action History States
  const [history, setHistory] = useState<(Tile | null)[][]>([]);
  const [redoHistory, setRedoHistory] = useState<(Tile | null)[][]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [hideOverlay, setHideOverlay] = useState(false);
  const [hideExtraImage, setHideExtraImage] = useState(false);
  const [hideHeight, setHideHeight] = useState(false);
  
  // Custom Sidebar Resizer, Stencil Grid toggles, and Height Grid states
  const [sidebarWidth, setSidebarWidth] = useState(320); 
  const [isStencilGridMode, setIsStencilGridMode] = useState(false);
  const [enableHeightGrid, setEnableHeightGrid] = useState(false);
  const [heightGridLevel, setHeightGridLevel] = useState(0);

  const isResizingRef = useRef(false);

  const getHeightColor = (h: number) => {
    const colors = [
      '#10b981', // 0: emerald-500
      '#06b6d4', // 1: cyan-500
      '#3b82f6', // 2: blue-500
      '#8b5cf6', // 3: purple-500
      '#ec4899', // 4: pink-500
      '#f97316', // 5: orange-500
      '#ef4444', // 6: red-500
      '#eab308', // 7: yellow-500
    ];
    if (h >= 0 && h < colors.length) return colors[h];
    return h < 0 ? '#f43f5e' : '#a855f7';
  };

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleSidebarMouseMove);
    document.addEventListener('mouseup', handleSidebarMouseUp);
  };

  const handleSidebarMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.max(280, Math.min(800, e.clientX));
    setSidebarWidth(newWidth);
  }, []);

  const handleSidebarMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleSidebarMouseMove);
    document.removeEventListener('mouseup', handleSidebarMouseUp);
  }, [handleSidebarMouseMove]);

  // Clean drag listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleSidebarMouseMove);
      document.removeEventListener('mouseup', handleSidebarMouseUp);
    };
  }, [handleSidebarMouseMove, handleSidebarMouseUp]);

  const [pendingLoadAction, setPendingLoadAction] = useState<{
    type: 'load' | 'new';
    loadedFile?: LoadedFile;
  } | null>(null);

  // Tools
  const [activeTool, setActiveTool] = useState<'select' | 'add-tile'>('select');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);

  // Image Overlay (Tracer) States
  const [overlayImageSrc, setOverlayImageSrc] = useState<string | null>(null);
  const [overlayImageDims, setOverlayImageDims] = useState<{ width: number; height: number } | null>(null);
  const [overlayX, setOverlayX] = useState<number>(0);
  const [overlayY, setOverlayY] = useState<number>(0);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.5);
  const [keepBaseImage, setKeepBaseImage] = useState<boolean>(false);
  const [onlyBakeSelected, setOnlyBakeSelected] = useState<boolean>(false);
  const [onlyAutoExtraSelected, setOnlyAutoExtraSelected] = useState<boolean>(false);
  const [overlayPixels, setOverlayPixels] = useState<ImageData | null>(null);

  const selectSingleSlot = useCallback((slotIdx: number | null) => {
    setSelectedSlot(slotIdx);
    setSelectedSlots(slotIdx !== null ? [slotIdx] : []);
  }, []);

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Capture current viewport state at the moment of upload
    const currentPanX = panX;
    const currentPanY = panY;
    const currentScale = scale;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        setOverlayImageSrc(img.src);
        setOverlayImageDims({ width: img.width, height: img.height });

        // Try to center on existing tile bounding box
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        tiles.forEach((tile, index) => {
          if (!tile) return;
          const col = index % cblocksX;
          const row = Math.floor(index / cblocksX);
          const screenX = (col - row) * (cellW / 2);
          const screenY = (col + row) * (cellH / 2);
          // Include full tile bounding box
          minX = Math.min(minX, screenX - cellW / 2);
          maxX = Math.max(maxX, screenX + cellW / 2);
          minY = Math.min(minY, screenY);
          maxY = Math.max(maxY, screenY + cellH);
        });

        if (minX !== Infinity) {
          // Center on the tile bounding box
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          setOverlayX(Math.round(centerX - img.width / 2));
          setOverlayY(Math.round(centerY - img.height / 2));
        } else {
          // No tiles: center on the current visible viewport in canvas-space
          const estimatedVpWidth = window.innerWidth - sidebarWidth;
          const estimatedVpHeight = window.innerHeight - 120;
          const vpCenterX = (estimatedVpWidth / 2 - currentPanX) / currentScale;
          const vpCenterY = (estimatedVpHeight / 2 - currentPanY) / currentScale;
          setOverlayX(Math.round(vpCenterX - img.width / 2));
          setOverlayY(Math.round(vpCenterY - img.height / 2));
        }

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const pixels = ctx.getImageData(0, 0, img.width, img.height);
          setOverlayPixels(pixels);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const centerOverlayImage = () => {
    if (!overlayImageDims) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    tiles.forEach((tile, index) => {
      if (!tile) return;
      const col = index % cblocksX;
      const row = Math.floor(index / cblocksX);
      const screenX = (col - row) * (cellW / 2);
      const screenY = (col + row) * (cellH / 2);
      // Include full tile bounding box
      minX = Math.min(minX, screenX - cellW / 2);
      maxX = Math.max(maxX, screenX + cellW / 2);
      minY = Math.min(minY, screenY);
      maxY = Math.max(maxY, screenY + cellH);
    });

    if (minX !== Infinity) {
      // Center on the tile bounding box
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      setOverlayX(Math.round(centerX - overlayImageDims.width / 2));
      setOverlayY(Math.round(centerY - overlayImageDims.height / 2));
    } else {
      // No tiles: center on the current visible viewport in canvas-space
      const estimatedVpWidth = window.innerWidth - sidebarWidth;
      const estimatedVpHeight = window.innerHeight - 120;
      const vpCenterX = (estimatedVpWidth / 2 - panX) / scale;
      const vpCenterY = (estimatedVpHeight / 2 - panY) / scale;
      setOverlayX(Math.round(vpCenterX - overlayImageDims.width / 2));
      setOverlayY(Math.round(vpCenterY - overlayImageDims.height / 2));
    }
  };

  const nudgeOverlay = (dx: number, dy: number) => {
    setOverlayX(prev => prev + dx);
    setOverlayY(prev => prev + dy);
  };

  const findClosestPaletteIndex = useCallback((r: number, g: number, b: number) => {
    let minDistance = Infinity;
    let closestIndex = 1;
    for (let j = 1; j < 256; j++) {
      const targetColor = palette[j] || { r: 0, g: 0, b: 0 };
      const rDiff = r - targetColor.r;
      const gDiff = g - targetColor.g;
      const bDiff = b - targetColor.b;
      const distSq = rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
      if (distSq < minDistance) {
        minDistance = distSq;
        closestIndex = j;
      }
    }
    return closestIndex;
  }, [palette]);

  const bakeOverlay = () => {
    if (!overlayImageSrc || !overlayPixels || !overlayImageDims) return;

    pushToHistory(tiles);

    const overlayWidth = overlayPixels.width;
    const overlayHeight = overlayPixels.height;
    const imgData = overlayPixels.data;

    const getOverlayPixel = (ox: number, oy: number) => {
      if (ox < 0 || ox >= overlayWidth || oy < 0 || oy >= overlayHeight) return null;
      const idx = (oy * overlayWidth + ox) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3];
      return { r, g, b, a };
    };

    const newTiles = tiles.map((tile, index) => {
      if (!tile) return null;

      if (onlyBakeSelected && !selectedSlots.includes(index)) {
        return tile;
      }

      const col = index % cblocksX;
      const row = Math.floor(index / cblocksX);
      const screenX = (col - row) * (cellW / 2);
      const screenY = (col + row) * (cellH / 2);
      const h = tile.header.height;

      const updatedTile = { ...tile };

      // 1. Bake base diamond
      if (!keepBaseImage) {
        const baseData = new Uint8Array(tile.data);
        for (let ty = 0; ty < cellH; ty++) {
          for (let tx = 0; tx < cellW; tx++) {
            if (TmpParser.isInsideWestwoodDiamond(tx, ty, cellW, cellH)) {
              const canvasX = screenX - cellW / 2 + tx;
              const canvasY = screenY - h * (cellH / 2) + ty;

              const overlayPX = Math.round(canvasX - overlayX);
              const overlayPY = Math.round(canvasY - overlayY);

              const px = getOverlayPixel(overlayPX, overlayPY);
              if (px && px.a >= 128) {
                const colorIdx = findClosestPaletteIndex(px.r, px.g, px.b);
                baseData[ty * cellW + tx] = colorIdx;
              }
            }
          }
        }
        updatedTile.data = baseData;
      }

      // 2. Bake extra image (if it exists)
      if (tile.header.has_extra_data && tile.extraImageData) {
        const extraData = new Uint8Array(tile.extraImageData);
        const ew = tile.header.cx_extra;
        const eh = tile.header.cy_extra;

        for (let ey = 0; ey < eh; ey++) {
          for (let ex = 0; ex < ew; ex++) {
            const canvasX = tile.header.x_extra - cellW / 2 + ex;
            const canvasY = tile.header.y_extra - h * (cellH / 2) + ey;

            const overlayPX = Math.round(canvasX - overlayX);
            const overlayPY = Math.round(canvasY - overlayY);

            const px = getOverlayPixel(overlayPX, overlayPY);
            if (px && px.a >= 128) {
              const colorIdx = findClosestPaletteIndex(px.r, px.g, px.b);
              extraData[ey * ew + ex] = colorIdx;
            } else {
              extraData[ey * ew + ex] = 0;
            }
          }
        }
        updatedTile.extraImageData = extraData;
      }

      return updatedTile;
    });

    setTiles(newTiles);
    setIsDirty(true);
    alert('Overlay successfully baked into tiles!');
  };

  const autoCreateExtraImages = () => {
    if (!overlayImageSrc || !overlayPixels || !overlayImageDims) return;

    pushToHistory(tiles);

    const overlayWidth = overlayPixels.width;
    const overlayHeight = overlayPixels.height;
    const imgData = overlayPixels.data;

    const getOverlayPixel = (ox: number, oy: number) => {
      if (ox < 0 || ox >= overlayWidth || oy < 0 || oy >= overlayHeight) return null;
      const idx = (oy * overlayWidth + ox) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const a = imgData[idx + 3];
      return { r, g, b, a };
    };

    const extraPixelsPerTile = new Map<number, { cx: number; cy: number; colorIdx: number }[]>();

    for (let oy = 0; oy < overlayHeight; oy++) {
      for (let ox = 0; ox < overlayWidth; ox++) {
        const px = getOverlayPixel(ox, oy);
        if (!px || px.a < 128) continue;

        const canvasX = overlayX + ox;
        const canvasY = overlayY + oy;

        let bestTileIdx: number | null = null;
        let minCenterY = Infinity;

        tiles.forEach((tile, index) => {
          if (!tile) return;

          if (onlyAutoExtraSelected && !selectedSlots.includes(index)) {
            return;
          }

          const col = index % cblocksX;
          const row = Math.floor(index / cblocksX);
          const screenX = (col - row) * (cellW / 2);
          const screenY = (col + row) * (cellH / 2);
          const h = tile.header.height;

          if (canvasX >= screenX - cellW / 2 && canvasX < screenX + cellW / 2) {
            const centerY = screenY - h * (cellH / 2) + cellH / 2;
            
            if (centerY >= canvasY) {
              if (centerY < minCenterY) {
                minCenterY = centerY;
                bestTileIdx = index;
              }
            }
          }
        });

        if (bestTileIdx !== null) {
          const tile = tiles[bestTileIdx]!;
          const col = bestTileIdx % cblocksX;
          const row = Math.floor(bestTileIdx / cblocksX);
          const screenX = (col - row) * (cellW / 2);
          const screenY = (col + row) * (cellH / 2);
          const h = tile.header.height;

          const rx = canvasX - (screenX - cellW / 2);
          const ry = canvasY - (screenY - h * (cellH / 2));

          const insideDiamond = TmpParser.isInsideWestwoodDiamond(rx, ry, cellW, cellH);

          if (!insideDiamond) {
            const colorIdx = findClosestPaletteIndex(px.r, px.g, px.b);
            
            if (!extraPixelsPerTile.has(bestTileIdx)) {
              extraPixelsPerTile.set(bestTileIdx, []);
            }
            extraPixelsPerTile.get(bestTileIdx)!.push({ cx: canvasX, cy: canvasY, colorIdx });
          }
        }
      }
    }

    const newTiles = tiles.map((tile, index) => {
      if (!tile) return null;

      if (onlyAutoExtraSelected && !selectedSlots.includes(index)) {
        return tile;
      }

      const pixelList = extraPixelsPerTile.get(index);

      if (!pixelList || pixelList.length === 0) {
        if (tile.header.has_extra_data) {
          return {
            ...tile,
            extraImageData: null,
            extraZData: null,
            header: {
              ...tile.header,
              has_extra_data: false,
              x_extra: 0,
              y_extra: 0,
              cx_extra: 0,
              cy_extra: 0
            }
          };
        }
        return tile;
      }

      let minCX = Infinity;
      let maxCX = -Infinity;
      let minCY = Infinity;
      let maxCY = -Infinity;

      pixelList.forEach(p => {
        minCX = Math.min(minCX, p.cx);
        maxCX = Math.max(maxCX, p.cx);
        minCY = Math.min(minCY, p.cy);
        maxCY = Math.max(maxCY, p.cy);
      });

      let cxExtra = maxCX - minCX + 1;
      let cyExtra = maxCY - minCY + 1;

      if (cxExtra % 2 !== 0) cxExtra++;
      if (cyExtra % 2 !== 0) cyExtra++;

      const col = index % cblocksX;
      const row = Math.floor(index / cblocksX);
      const screenX = (col - row) * (cellW / 2);
      const h = tile.header.height;

      const xExtra = minCX + cellW / 2;
      const yExtra = minCY + h * (cellH / 2);

      const extraData = new Uint8Array(cxExtra * cyExtra);
      const extraZ = new Uint8Array(cxExtra * cyExtra);

      pixelList.forEach(p => {
        const rx = p.cx - minCX;
        const ry = p.cy - minCY;
        if (rx >= 0 && rx < cxExtra && ry >= 0 && ry < cyExtra) {
          const idx = ry * cxExtra + rx;
          extraData[idx] = p.colorIdx;
          extraZ[idx] = 224;
        }
      });

      return {
        ...tile,
        extraImageData: extraData,
        extraZData: extraZ,
        header: {
          ...tile.header,
          has_extra_data: true,
          x_extra: xExtra,
          y_extra: yExtra,
          cx_extra: cxExtra,
          cy_extra: cyExtra
        }
      };
    });

    setTiles(newTiles);
    setIsDirty(true);
    alert('Extra images automatically created!');
  };

  const generateZData = () => {
    pushToHistory(tiles);

    const isSelectedScope = selectedSlots.length > 0;
    const newTiles = tiles.map((tile, index) => {
      if (!tile) return null;

      if (isSelectedScope && !selectedSlots.includes(index)) {
        return tile;
      }

      const updatedTile = { ...tile };

      const zData = new Uint8Array(cellW * cellH);
      for (let y = 0; y < cellH; y++) {
        const val = 224 - Math.round((y * 216) / (cellH - 1));
        const zVal = Math.round(val / 8) * 8;

        for (let x = 0; x < cellW; x++) {
          if (TmpParser.isInsideWestwoodDiamond(x, y, cellW, cellH)) {
            zData[y * cellW + x] = zVal;
          }
        }
      }
      updatedTile.zData = zData;

      if (tile.header.has_extra_data && tile.extraImageData) {
        const cxExtra = tile.header.cx_extra;
        const cyExtra = tile.header.cy_extra;
        const extraZ = new Uint8Array(cxExtra * cyExtra);

        for (let i = 0; i < tile.extraImageData.length; i++) {
          if (tile.extraImageData[i] !== 0) {
            extraZ[i] = 224;
          }
        }
        updatedTile.extraZData = extraZ;
      }

      updatedTile.header = {
        ...tile.header,
        has_z_data: true,
        flags: tile.header.flags | 0x02
      };

      return updatedTile;
    });

    setTiles(newTiles);
    setIsDirty(true);
    alert('Z-depth gradients successfully generated!');
  };

  // Canvas Viewport Panning & Zooming
  const [scale, setScale] = useState(1.5);
  const [panX, setPanX] = useState(420);
  const [panY, setPanY] = useState(120);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // History / Undo / Redo core functions
  const pushToHistory = useCallback((currentTiles: (Tile | null)[]) => {
    setHistory(prev => {
      const copy = [...prev, cloneTilesArray(currentTiles)];
      if (copy.length > 50) {
        copy.shift();
      }
      return copy;
    });
    setRedoHistory([]);
    setIsDirty(true);
  }, []);

  const updateTiles = useCallback((newTiles: (Tile | null)[]) => {
    pushToHistory(tiles);
    setTiles(newTiles);
  }, [pushToHistory, tiles]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    setHistory(prevUndo => {
      const copyUndo = [...prevUndo];
      const previousState = copyUndo.pop();
      if (previousState) {
        setRedoHistory(prevRedo => {
          const copyRedo = [...prevRedo, cloneTilesArray(tiles)];
          if (copyRedo.length > 50) {
            copyRedo.shift();
          }
          return copyRedo;
        });
        setTiles(previousState);
      }
      return copyUndo;
    });
  }, [history, tiles]);

  const handleRedo = useCallback(() => {
    if (redoHistory.length === 0) return;
    setRedoHistory(prevRedo => {
      const copyRedo = [...prevRedo];
      const nextState = copyRedo.pop();
      if (nextState) {
        setHistory(prevUndo => {
          const copyUndo = [...prevUndo, cloneTilesArray(tiles)];
          if (copyUndo.length > 50) {
            copyUndo.shift();
          }
          return copyUndo;
        });
        setTiles(nextState);
      }
      return copyRedo;
    });
  }, [redoHistory, tiles]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedSlot === null) return;
    const tile = tiles[selectedSlot];
    if (!tile) return; 

    const newTiles = [...tiles];
    newTiles[selectedSlot] = null;
    updateTiles(newTiles);
    selectSingleSlot(null);
  }, [selectedSlot, tiles, updateTiles, selectSingleSlot]);

  // Drag-and-drop cell swap / translate helper
  const moveTile = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const tileFrom = tiles[fromIdx];
    if (!tileFrom) return;

    const tileTo = tiles[toIdx];
    const newTiles = [...tiles];

    // Compute new header for tileFrom at mapping toIdx
    const toCol = toIdx % cblocksX;
    const toRow = Math.floor(toIdx / cblocksX);
    const placedHeaderFrom: TileHeader = {
      ...tileFrom.header,
      x: (toCol - toRow) * (cellW / 2),
      y: (toCol + toRow) * (cellH / 2)
    };
    const shiftXFrom = placedHeaderFrom.x - tileFrom.header.x;
    const shiftYFrom = placedHeaderFrom.y - tileFrom.header.y;
    if (placedHeaderFrom.has_extra_data) {
      placedHeaderFrom.x_extra = tileFrom.header.x_extra + shiftXFrom;
      placedHeaderFrom.y_extra = tileFrom.header.y_extra + shiftYFrom;
    }
    const placedTileFrom: Tile = {
      ...tileFrom,
      slot: toIdx,
      header: placedHeaderFrom
    };

    if (tileTo) {
      // Compute new header for tileTo at mapping fromIdx (Swap)
      const fromCol = fromIdx % cblocksX;
      const fromRow = Math.floor(fromIdx / cblocksX);
      const placedHeaderTo: TileHeader = {
        ...tileTo.header,
        x: (fromCol - fromRow) * (cellW / 2),
        y: (fromCol + fromRow) * (cellH / 2)
      };
      const shiftXTo = placedHeaderTo.x - tileTo.header.x;
      const shiftYTo = placedHeaderTo.y - tileTo.header.y;
      if (placedHeaderTo.has_extra_data) {
        placedHeaderTo.x_extra = tileTo.header.x_extra + shiftXTo;
        placedHeaderTo.y_extra = tileTo.header.y_extra + shiftYTo;
      }
      const placedTileTo: Tile = {
        ...tileTo,
        slot: fromIdx,
        header: placedHeaderTo
      };

      newTiles[fromIdx] = placedTileTo;
    } else {
      newTiles[fromIdx] = null;
    }

    newTiles[toIdx] = placedTileFrom;

    updateTiles(newTiles);
    selectSingleSlot(toIdx);
  }, [tiles, cblocksX, cellW, cellH, updateTiles, selectSingleSlot]);

  // Extradata Drag Handle Resizing State
  const [dragHandle, setDragHandle] = useState<{
    slot: number;
    edge: 'left' | 'right' | 'top' | 'bottom';
    initialX: number;
    initialY: number;
    initialCx: number;
    initialCy: number;
    startX: number;
    startY: number;
  } | null>(null);

  // Keyboard modifiers for canvas
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Property Inputs
  const [manualPixelX, setManualPixelX] = useState('0');
  const [manualPixelY, setManualPixelY] = useState('0');

  // Mini Pixel Editor state
  const [activeLayer, setActiveLayer] = useState<'base' | 'extra'>('base');
  const [pixelDrawMode, setPixelDrawMode] = useState<'color' | 'z-depth'>('color');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(1);
  const [zValue, setZValue] = useState<number>(100);

  // Track key listeners for space/pan, undo, and delete actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }

      // Safeguard input fields so user can type normally
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.tagName === 'TEXTAREA'
      );
      if (isInput) return;

      // Undo shortcut (Ctrl + Z or Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }

      // Redo shortcut (Ctrl + Y or Cmd + Y or Ctrl + Shift + Z or Cmd + Shift + Z)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }

      // Delete shortcut (X or Delete or Backspace)
      if (e.key.toLowerCase() === 'x' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, handleDeleteSelected]);

  // Sync size when inputs change
  const adjustGridSize = (cols: number, rows: number) => {
    const oldCols = cblocksX;
    const oldRows = cblocksY;
    const newTiles = new Array(cols * rows).fill(null);

    // Re-map existing slots to match the new shape
    for (let y = 0; y < Math.min(oldRows, rows); y++) {
      for (let x = 0; x < Math.min(oldCols, cols); x++) {
        const oldIndex = y * oldCols + x;
        const newIndex = y * cols + x;
        const tile = tiles[oldIndex];
        if (tile) {
          tile.slot = newIndex;
          newTiles[newIndex] = tile;
        }
      }
    }

    updateTiles(newTiles);
    setCblocksX(cols);
    setCblocksY(rows);
    selectSingleSlot(null);
  };

  // Helper: New File Creator (starts with a spacious 12x12 grid containing 1 custom tile centered)
  const executeActualNewFile = () => {
    const cols = 12;
    const rows = 12;
    const centerX = 5;
    const centerY = 5;
    const centerIdx = centerY * cols + centerX;

    const defaultTile = createNewTileInstance(centerIdx, centerX, centerY);
    const newTiles = Array(cols * rows).fill(null);
    newTiles[centerIdx] = defaultTile;

    setTiles(newTiles);
    setCblocksX(cols);
    setCblocksY(rows);
    selectSingleSlot(centerIdx);
    setFileName('new_custom_tile.tem');
    setPanX(420);
    setPanY(120);

    setHistory([]);
    setRedoHistory([]);
    setIsDirty(false);
  };

  const handleNewFile = () => {
    if (isDirty) {
      setPendingLoadAction({ type: 'new' });
    } else {
      executeActualNewFile();
    }
  };

  // Helper: Load File from Workspace, padding to at least a spacious 12x12 grid
  const executeActualLoadFile = (file: LoadedFile) => {
    const tmp = file.content as TmpFile;
    if (!tmp || !tmp.tiles) return;

    // Pad original dimensions to at least a beautiful, editable 12x12 canvas grid
    const targetCols = Math.max(12, tmp.cblocks_x + 8);
    const targetRows = Math.max(12, tmp.cblocks_y + 8);

    const offsetX = Math.floor((targetCols - tmp.cblocks_x) / 2);
    const offsetY = Math.floor((targetRows - tmp.cblocks_y) / 2);

    const targetEngine = detectEngineFromDimensions(tmp.cx, tmp.cy, tmp.type);
    const { cellW: loadCellW, cellH: loadCellH } = getEngineDimensions(targetEngine);

    const paddedTiles: (Tile | null)[] = Array(targetCols * targetRows).fill(null);

    for (let dy = 0; dy < tmp.cblocks_y; dy++) {
      for (let dx = 0; dx < tmp.cblocks_x; dx++) {
        const srcIdx = dy * tmp.cblocks_x + dx;
        const tile = tmp.tiles[srcIdx];
        if (tile) {
          const targetX = dx + offsetX;
          const targetY = dy + offsetY;
          const targetIdx = targetY * targetCols + targetX;

          // Re-calculate slot-aligned coordinates
          const newHeader = { ...tile.header };
          const oldX = tile.header.x;
          const oldY = tile.header.y;

          newHeader.x = (targetX - targetY) * (loadCellW / 2);
          newHeader.y = (targetX + targetY) * (loadCellH / 2);

          // Calibrate extra_image offsets
          const shiftX = newHeader.x - oldX;
          const shiftY = newHeader.y - oldY;

          if (newHeader.has_extra_data) {
            newHeader.x_extra = tile.header.x_extra + shiftX;
            newHeader.y_extra = tile.header.y_extra + shiftY;
          }

          paddedTiles[targetIdx] = {
            ...tile,
            slot: targetIdx,
            header: newHeader,
            cx: loadCellW,
            cy: loadCellH
          };
        }
      }
    }

    setTiles(paddedTiles);
    setCblocksX(targetCols);
    setCblocksY(targetRows);

    const firstActiveIdx = paddedTiles.findIndex(t => t !== null);
    selectSingleSlot(firstActiveIdx !== -1 ? firstActiveIdx : null);

    setFileName(file.name);
    setEngineType(targetEngine);
    setPanX(420);
    setPanY(120);

    setHistory([]);
    setRedoHistory([]);
    setIsDirty(false);
  };

  const handleLoadFile = (file: LoadedFile) => {
    if (isDirty) {
      setPendingLoadAction({ type: 'load', loadedFile: file });
    } else {
      executeActualLoadFile(file);
    }
  };

  // Create a base tile structure
  const createNewTileInstance = (slotIndex: number, gridX: number, gridY: number, heightNum?: number): Tile => {
    const dataSize = cellW * cellH;
    const data = new Uint8Array(dataSize);
    const zData = new Uint8Array(dataSize);

    // Initial default layout inside standard Westwood isometric diamond
    for (let ly = 0; ly < cellH; ly++) {
      for (let lx = 0; lx < cellW; lx++) {
        if (TmpParser.isInsideWestwoodDiamond(lx, ly, cellW, cellH)) {
          const dIdx = ly * cellW + lx;
          // Emerald Grass pattern
          const variant = (lx * 13 + ly * 23) % 4;
          data[dIdx] = 110 + variant * 4; 
          zData[dIdx] = Math.min(255, 90 + ly);
        }
      }
    }

    const defaultHeight = heightNum !== undefined ? heightNum : (enableHeightGrid ? heightGridLevel : 0);

    const header: TileHeader = {
      x: (gridX - gridY) * (cellW / 2),
      y: (gridX + gridY) * (cellH / 2),
      extra_ofs: 0,
      z_ofs: 0,
      extra_z_ofs: 0,
      x_extra: 0,
      y_extra: 0,
      cx_extra: 0,
      cy_extra: 0,
      flags: 2, // has_z_data defaults to active
      height: defaultHeight,
      land_type: 12, // Generic Tiberium-free clear grass
      ramp_type: 0,  // Flat terrain
      radar_colors: [44, 180, 44, 44, 180, 44],
      has_extra_data: false,
      has_z_data: true,
      has_damaged_data: false,
      is_fully_transparent: false
    };

    return {
      slot: slotIndex,
      header,
      data,
      zData,
      extraImageData: null,
      extraZData: null,
      damagedData: null,
      cx: cellW,
      cy: cellH
    };
  };

  // Add customized extra image block to the tile
  const addExtraImageToTile = (slotIdx: number) => {
    const tile = tiles[slotIdx];
    if (!tile) return;

    const extraW = 32;
    const extraH = 16;
    const extraData = new Uint8Array(extraW * extraH);
    const extraZ = new Uint8Array(extraW * extraH);

    // Fill with default visible pattern (soft red/pink visual guidelines overlay)
    for (let i = 0; i < extraData.length; i++) {
      extraData[i] = 180 + (i % 6);
      extraZ[i] = 110;
    }

    const updatedTile: Tile = {
      ...tile,
      extraImageData: extraData,
      extraZData: extraZ,
      header: {
        ...tile.header,
        has_extra_data: true,
        x_extra: Math.round(tile.cx / 4),
        y_extra: Math.round(-tile.cy / 2),
        cx_extra: extraW,
        cy_extra: extraH
      }
    };

    const newTiles = [...tiles];
    newTiles[slotIdx] = updatedTile;
    updateTiles(newTiles);
  };

  const removeExtraImageFromTile = (slotIdx: number) => {
    const tile = tiles[slotIdx];
    if (!tile) return;

    const updatedTile: Tile = {
      ...tile,
      extraImageData: null,
      extraZData: null,
      header: {
        ...tile.header,
        has_extra_data: false,
        x_extra: 0,
        y_extra: 0,
        cx_extra: 0,
        cy_extra: 0
      }
    };

    const newTiles = [...tiles];
    newTiles[slotIdx] = updatedTile;
    updateTiles(newTiles);
    if (activeLayer === 'extra') setActiveLayer('base');
  };

  // Place a tile with specific target index
  const placeTileAtSlot = (slotIndex: number) => {
    const col = slotIndex % cblocksX;
    const row = Math.floor(slotIndex / cblocksX);

    const newTiles = [...tiles];
    newTiles[slotIndex] = createNewTileInstance(slotIndex, col, row);
    updateTiles(newTiles);
    selectSingleSlot(slotIndex);
  };

  // Coordinates placement solver (Raw coordinates coordinates solver to grid cells)
  const executeManualCoordinatePlacement = () => {
    const pxX = parseInt(manualPixelX, 10) || 0;
    const pxY = parseInt(manualPixelY, 10) || 0;

    // Inverse Westwood projection: Solving (cx, cy) from (pxX, pxY) offsets
    const halfW = cellW / 2;
    const halfH = cellH / 2;

    const computedX = Math.round((pxX / halfW + pxY / halfH) / 2);
    const computedY = Math.round((pxY / halfH - pxX / halfW) / 2);

    // Expand boundary grids if solved position lands outside bounds
    let targetCols = cblocksX;
    let targetRows = cblocksY;
    let offsetX = 0;
    let offsetY = 0;

    if (computedX < 0) {
      offsetX = Math.abs(computedX);
      targetCols += offsetX;
    }
    if (computedY < 0) {
      offsetY = Math.abs(computedY);
      targetRows += offsetY;
    }

    const gridCellX = computedX + offsetX;
    const gridCellY = computedY + offsetY;

    if (gridCellX >= targetCols) targetCols = gridCellX + 1;
    if (gridCellY >= targetRows) targetRows = gridCellY + 1;

    // Rescale grid if expanded
    if (targetCols !== cblocksX || targetRows !== cblocksY || offsetX > 0 || offsetY > 0) {
      const oldCols = cblocksX;
      const oldRows = cblocksY;
      const resizedTiles = new Array(targetCols * targetRows).fill(null);

      for (let y = 0; y < oldRows; y++) {
        for (let x = 0; x < oldCols; x++) {
          const tile = tiles[y * oldCols + x];
          if (tile) {
            const ny = y + offsetY;
            const nx = x + offsetX;
            const nIndex = ny * targetCols + nx;
            tile.slot = nIndex;
            // recalculate coordinates mapping
            tile.header.x = (nx - ny) * (cellW / 2);
            tile.header.y = (nx + ny) * (cellH / 2);
            resizedTiles[nIndex] = tile;
          }
        }
      }

      const freshIndex = gridCellY * targetCols + gridCellX;
      resizedTiles[freshIndex] = createNewTileInstance(freshIndex, gridCellX, gridCellY);
      
      updateTiles(resizedTiles);
      setCblocksX(targetCols);
      setCblocksY(targetRows);
      selectSingleSlot(freshIndex);
    } else {
      const idx = gridCellY * cblocksX + gridCellX;
      placeTileAtSlot(idx);
    }
  };

  const handleTilePropertyUpdate = (fields: Partial<TileHeader>) => {
    if (selectedSlot === null) return;
    const tile = tiles[selectedSlot];
    if (!tile) return;

    const updatedTile = {
      ...tile,
      header: {
        ...tile.header,
        ...fields
      }
    };
    
    // Height changes shift positions offset
    if (fields.height !== undefined) {
      updatedTile.header.x = (selectedSlot % cblocksX - Math.floor(selectedSlot / cblocksX)) * (cellW / 2);
      updatedTile.header.y = (selectedSlot % cblocksX + Math.floor(selectedSlot / cblocksX)) * (cellH / 2);
    }

    const newTiles = [...tiles];
    newTiles[selectedSlot] = updatedTile;
    updateTiles(newTiles);
  };

  // Paint pixel arrays
  const handlePixelPaint = (pxX: number, pxY: number, erase = false) => {
    if (selectedSlot === null) return;
    const tile = tiles[selectedSlot];
    if (!tile) return;

    const newTiles = [...tiles];
    const item = { ...tile };

    if (activeLayer === 'base') {
      const data = new Uint8Array(item.data);
      const zData = item.zData ? new Uint8Array(item.zData) : null;
      
      // Affect pixel with brush size
      const r = Math.floor(brushSize / 2);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = pxX + dx;
          const ty = pxY + dy;
          if (tx >= 0 && tx < cellW && ty >= 0 && ty < cellH) {
            // Must stay inside Westwood Diamond boundaries for Base mode
            if (TmpParser.isInsideWestwoodDiamond(tx, ty, cellW, cellH)) {
              const idx = ty * cellW + tx;
              if (pixelDrawMode === 'color') {
                data[idx] = erase ? 0 : selectedPaletteIndex;
              } else if (zData) {
                zData[idx] = erase ? 0 : zValue;
              }
            }
          }
        }
      }

      item.data = data;
      item.zData = zData;
    } else {
      if (!item.extraImageData) return;
      const ew = item.header.cx_extra;
      const eh = item.header.cy_extra;
      const edata = new Uint8Array(item.extraImageData);
      const ezdata = item.extraZData ? new Uint8Array(item.extraZData) : null;

      const r = Math.floor(brushSize / 2);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = pxX + dx;
          const ty = pxY + dy;
          if (tx >= 0 && tx < ew && ty >= 0 && ty < eh) {
            const idx = ty * ew + tx;
            if (pixelDrawMode === 'color') {
              edata[idx] = erase ? 0 : selectedPaletteIndex;
            } else if (ezdata) {
              ezdata[idx] = erase ? 0 : zValue;
            }
          }
        }
      }

      item.extraImageData = edata;
      item.extraZData = ezdata;
    }

    newTiles[selectedSlot] = item;
    setTiles(newTiles);
    setIsDirty(true);
  };

  // Export File back to Workspace
  const saveToWorkspace = () => {
    // Generate valid compiled TmpFile
    const tmp: TmpFile = {
      cblocks_x: cblocksX,
      cblocks_y: cblocksY,
      cx: cellW,
      cy: cellH,
      tiles: tiles,
      type: (engineType === 'OpenTS_48x96' ? 'OpenTS' : engineType) as 'TS' | 'RA2' | 'OpenTS'
    };

    const finalLoaded: LoadedFile = {
      name: fileName.endsWith('.tem') || fileName.endsWith('.tmp') ? fileName : `${fileName}.tem`,
      fileType: 'TMP',
      content: tmp
    };

    onAddFilesToWorkspace([finalLoaded]);
    alert(`File "${finalLoaded.name}" has been added to your Workspace loaded files list!`);
  };

  const downloadFileDirect = () => {
    const tmp: TmpFile = {
      cblocks_x: cblocksX,
      cblocks_y: cblocksY,
      cx: cellW,
      cy: cellH,
      tiles: tiles,
      type: (engineType === 'OpenTS_48x96' ? 'OpenTS' : engineType) as 'TS' | 'RA2' | 'OpenTS'
    };

    const buffer = TmpParser.writeTmp(tmp);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName.endsWith('.tem') || fileName.endsWith('.tmp') ? fileName : `${fileName}.tem`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert pixel drag events on handles back to properties modifier
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSpacePressed) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // Drop or Stamp a stencil file on active grid cell helper
  const handleDropFileAt = (anchorIndex: number, loaded: LoadedFile) => {
    const tmp = loaded.content as TmpFile;
    if (!tmp || !tmp.tiles) return;

    const anchorCol = anchorIndex % cblocksX;
    const anchorRow = Math.floor(anchorIndex / cblocksX);

    const newTiles = [...tiles];

    // Find all active non-null tiles and calculate bounding box offset shifts
    const activeTilesInfo = [];
    for (let i = 0; i < tmp.tiles.length; i++) {
      const tile = tmp.tiles[i];
      if (tile) {
        const col = i % tmp.cblocks_x;
        const row = Math.floor(i / tmp.cblocks_x);
        activeTilesInfo.push({ tile, col, row });
      }
    }

    if (activeTilesInfo.length === 0) return;

    const minCol = Math.min(...activeTilesInfo.map(t => t.col));
    const minRow = Math.min(...activeTilesInfo.map(t => t.row));

    for (const { tile, col, row } of activeTilesInfo) {
      const relCol = col - minCol;
      const relRow = row - minRow;

      const targetX = anchorCol + relCol;
      const targetY = anchorRow + relRow;

      if (targetX >= 0 && targetX < cblocksX && targetY >= 0 && targetY < cblocksY) {
        const targetIdx = targetY * cblocksX + targetX;

        // Recalculate base pixel coordinate offsets relative to the map slot
        const placedHeader: TileHeader = {
          ...tile.header,
          x: (targetX - targetY) * (cellW / 2),
          y: (targetX + targetY) * (cellH / 2),
          height: enableHeightGrid ? heightGridLevel : tile.header.height
        };

        // Calibrate extra image coordinates to match base position shifts
        const shiftX = placedHeader.x - tile.header.x;
        const shiftY = placedHeader.y - tile.header.y;

        if (placedHeader.has_extra_data) {
          placedHeader.x_extra = tile.header.x_extra + shiftX;
          placedHeader.y_extra = tile.header.y_extra + shiftY;
        }

        const placedTile: Tile = {
          ...tile,
          slot: targetIdx,
          header: placedHeader,
          cx: cellW,
          cy: cellH
        };

        newTiles[targetIdx] = placedTile;
      }
    }

    updateTiles(newTiles);
    selectSingleSlot(anchorIndex);
  };

  const handleGridCellClick = (cellIdx: number, e: React.MouseEvent) => {
    if (activeStampFile) {
      handleDropFileAt(cellIdx, activeStampFile);
    } else if (activeTool === 'add-tile') {
      placeTileAtSlot(cellIdx);
    } else {
      const isMulti = e.ctrlKey || e.metaKey;
      if (isMulti) {
        setSelectedSlots(prev => {
          if (prev.includes(cellIdx)) {
            const next = prev.filter(x => x !== cellIdx);
            setSelectedSlot(next.length > 0 ? next[next.length - 1] : null);
            return next;
          } else {
            setSelectedSlot(cellIdx);
            return [...prev, cellIdx];
          }
        });
      } else {
        const nextVal = cellIdx === selectedSlot ? null : cellIdx;
        selectSingleSlot(nextVal);
      }
    }
  };

  // Drag Handles resizing loop
  const startDragHandleExtra = (
    e: React.MouseEvent,
    slotIdx: number, 
    edge: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const tile = tiles[slotIdx];
    if (!tile || !tile.header.has_extra_data) return;

    pushToHistory(tiles);

    setDragHandle({
      slot: slotIdx,
      edge,
      initialX: tile.header.x_extra,
      initialY: tile.header.y_extra,
      initialCx: tile.header.cx_extra,
      initialCy: tile.header.cy_extra,
      startX: e.clientX,
      startY: e.clientY
    });
  };

  // Global window listeners for drag handle updates
  useEffect(() => {
    if (!dragHandle) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const tile = tiles[dragHandle.slot];
      if (!tile) return;

      const dX = (e.clientX - dragHandle.startX) / scale;
      const dY = (e.clientY - dragHandle.startY) / scale;

      const newTiles = [...tiles];
      const updatedHeader = { ...tile.header };

      if (dragHandle.edge === 'right') {
        updatedHeader.cx_extra = Math.max(4, Math.round((dragHandle.initialCx + dX) / 2) * 2);
      } else if (dragHandle.edge === 'bottom') {
        updatedHeader.cy_extra = Math.max(4, Math.round((dragHandle.initialCy + dY) / 2) * 2);
      } else if (dragHandle.edge === 'left') {
        const delta = Math.round(dX);
        const resolvedCx = Math.max(4, Math.round((dragHandle.initialCx - delta) / 2) * 2);
        updatedHeader.x_extra = dragHandle.initialX + (dragHandle.initialCx - resolvedCx);
        updatedHeader.cx_extra = resolvedCx;
      } else if (dragHandle.edge === 'top') {
        const delta = Math.round(dY);
        const resolvedCy = Math.max(4, Math.round((dragHandle.initialCy - delta) / 2) * 2);
        updatedHeader.y_extra = dragHandle.initialY + (dragHandle.initialCy - resolvedCy);
        updatedHeader.cy_extra = resolvedCy;
      }

      newTiles[dragHandle.slot] = {
        ...tile,
        header: updatedHeader
      };

      setTiles(newTiles);
    };

    const handleWindowMouseUp = () => {
      // Upon snap freeze drag release, ensure raster arrays match new size nicely and interpolate
      if (dragHandle) {
        const tile = tiles[dragHandle.slot];
        if (tile && tile.extraImageData) {
          const finalW = tile.header.cx_extra;
          const finalH = tile.header.cy_extra;
          
          // Re-scale arrays
          const resizedData = new Uint8Array(finalW * finalH);
          const resizedZ = tile.extraZData ? new Uint8Array(finalW * finalH) : null;

          const oldW = dragHandle.initialCx;
          const oldH = dragHandle.initialCy;

          for (let y = 0; y < finalH; y++) {
            const sy = Math.floor((y * oldH) / finalH);
            for (let x = 0; x < finalW; x++) {
              const sx = Math.floor((x * oldW) / finalW);
              
              if (sx >= 0 && sx < oldW && sy >= 0 && sy < oldH) {
                const oldIdx = sy * oldW + sx;
                const newIdx = y * finalW + x;
                resizedData[newIdx] = tile.extraImageData[oldIdx];
                if (resizedZ && tile.extraZData) {
                  resizedZ[newIdx] = tile.extraZData[oldIdx];
                }
              }
            }
          }

          const newTiles = [...tiles];
          newTiles[dragHandle.slot] = {
            ...tile,
            extraImageData: resizedData,
            extraZData: resizedZ
          };
          setTiles(newTiles);
        }
      }
      setDragHandle(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragHandle, tiles, scale]);

  // Selected tile object
  const activeTile = selectedSlot !== null ? tiles[selectedSlot] : null;

  // Highly precise, height-aware isometric coordinate solver
  const resolveCellAtCoordinates = useCallback((pxX: number, pxY: number): number | null => {
    const halfW = cellW / 2;
    const halfH = cellH / 2;

    // Search back-to-front rendering order (i.e. reverse loop so frontmost tile takes priority)
    for (let r = cblocksY - 1; r >= 0; r--) {
      for (let c = cblocksX - 1; c >= 0; c--) {
        const index = r * cblocksX + c;
        const tile = tiles[index];

        const screenX = (c - r) * halfW;
        const screenY = (c + r) * halfH;

        let Y_offset = 0;
        if (!tile) {
          Y_offset = (enableHeightGrid && !hideHeight) ? heightGridLevel * halfH : 0;
        } else {
          Y_offset = !hideHeight ? tile.header.height * halfH : 0;
        }

        const vx = screenX;
        const vy = screenY + halfH - Y_offset;

        const dx = pxX - vx;
        const dy = pxY - vy;

        if ((Math.abs(dx) / halfW + Math.abs(dy) / halfH) <= 1.0) {
          return index;
        }
      }
    }
    return null;
  }, [tiles, cblocksX, cblocksY, enableHeightGrid, heightGridLevel, hideHeight, cellW, cellH]);

  // Render tile preview canvas in isometric layout
  const gridCells = useMemo(() => {
    const list = [];
    for (let y = 0; y < cblocksY; y++) {
      for (let x = 0; x < cblocksX; x++) {
        list.push({
          index: y * cblocksX + x,
          x,
          y
        });
      }
    }
    return list;
  }, [cblocksX, cblocksY]);

  return (
    <div id="tile-creator-workspace" className="flex-1 flex overflow-hidden relative bg-slate-900 border-t border-slate-800">
      
      {/* Dirty Check Save Prompt Dialogue */}
      {pendingLoadAction && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-205">
            <div className="flex items-start gap-3.5">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-100 font-sans tracking-tight">Unsaved custom map edits</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  You have unsaved changes in your current map file. Would you like to save this file back into your Workspace loaded files list, or discard modifications before proceeding?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <button
                onClick={() => {
                  saveToWorkspace();
                  const action = pendingLoadAction;
                  setPendingLoadAction(null);
                  if (action.type === 'new') {
                    executeActualNewFile();
                  } else if (action.type === 'load' && action.loadedFile) {
                    executeActualLoadFile(action.loadedFile);
                  }
                }}
                className="w-full h-9 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded text-xs flex items-center justify-center transition-all cursor-pointer shadow-md select-none"
              >
                Save & Continue
              </button>
              
              <button
                onClick={() => {
                  const action = pendingLoadAction;
                  setPendingLoadAction(null);
                  if (action.type === 'new') {
                    executeActualNewFile();
                  } else if (action.type === 'load' && action.loadedFile) {
                    executeActualLoadFile(action.loadedFile);
                  }
                }}
                className="w-full h-9 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-bold rounded text-xs flex items-center justify-center transition-all cursor-pointer select-none border border-slate-700"
              >
                Discard Changes
              </button>

              <button
                onClick={() => {
                  setPendingLoadAction(null);
                }}
                className="w-full h-9 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-350 font-semibold rounded text-xs flex items-center justify-center transition-all cursor-pointer select-none border border-slate-800"
              >
                Cancel Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Property Side panel */}
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className="relative border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-visible"
      >
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-4 space-y-4 pb-20">
          
          {/* Draw & Drop Stencil Assets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 shrink-0">
                <Grid className="w-3.5 h-3.5 text-blue-400" />
                Source Tile Stencils
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const toGrid = !isStencilGridMode;
                    setIsStencilGridMode(toGrid);
                    if (toGrid) {
                      setSidebarWidth(Math.max(sidebarWidth, 540));
                    } else {
                      setSidebarWidth(320);
                    }
                  }}
                  className={cn(
                    "text-[8px] px-1.5 py-0.5 rounded font-black uppercase transition-all border flex items-center gap-0.5 cursor-pointer select-none",
                    isStencilGridMode 
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30 font-black shadow-sm" 
                      : "bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200"
                  )}
                  title={isStencilGridMode ? "Switch to list view" : "Turn view to 1:1 Packed Tile Preview"}
                >
                  {isStencilGridMode ? <Layers className="w-2.5 h-2.5" /> : <LayoutGrid className="w-2.5 h-2.5" />}
                  <span>{isStencilGridMode ? "List View" : "1:1 Grid"}</span>
                </button>

                {activeStampFile && (
                  <button 
                    onClick={() => { setActiveStampFile(null); setDragHoverAnchor(null); }}
                    className="text-[8px] text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-1 py-0.5 rounded font-bold uppercase cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5">
              <div className="text-[9px] text-slate-400 leading-relaxed bg-blue-500/5 p-2 rounded border border-blue-500/10">
                <span className="font-bold text-blue-300">Slope & Cliff merger:</span> Drag onto grid, or click to activate Click-and-Stamp stencil mode! Right-click anywhere on grid to cancel.
              </div>

              {isStencilGridMode ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[9px] text-slate-400 font-bold bg-slate-950 px-2 py-1 rounded border border-slate-850">
                    Packed 1:1 Stencil File previews grid:
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto custom-scrollbar p-1.5 bg-slate-950 rounded-lg border border-slate-850 justify-center">
                    {stencilFiles.map((file, fIdx) => {
                      const tmp = file.content as TmpFile;
                      if (!tmp || !tmp.tiles) return null;

                      let minX = Infinity;
                      let maxX = -Infinity;
                      let minY = Infinity;
                      let maxY = -Infinity;

                      tmp.tiles.forEach((tile) => {
                        if (!tile) return;
                        const tx = tile.header.x;
                        const ty = tile.header.y - tile.header.height * (cellH / 2);
                        
                        minX = Math.min(minX, tx);
                        maxX = Math.max(maxX, tx + cellW);
                        minY = Math.min(minY, ty);
                        maxY = Math.max(maxY, ty + cellH);

                        if (tile.header.has_extra_data && tile.extraImageData) {
                          const ex = tile.header.x_extra;
                          const ey = tile.header.y_extra - tile.header.height * (cellH / 2);
                          minX = Math.min(minX, ex);
                          maxX = Math.max(maxX, ex + tile.header.cx_extra);
                          minY = Math.min(minY, ey);
                          maxY = Math.max(maxY, ey + tile.header.cy_extra);
                        }
                      });

                      if (minX === Infinity) {
                        minX = 0;
                        maxX = cellW;
                        minY = 0;
                        maxY = cellH;
                      }

                      const totalW = maxX - minX;
                      const totalH = maxY - minY;
                      const isSelectedStamp = activeStampFile?.name === file.name;

                      return (
                        <div
                          key={`grid-file-${file.name}`}
                          draggable
                          onDragStart={(e) => {
                            setActiveDraggableFile(file);
                            e.dataTransfer.setData('text/plain', file.name);
                          }}
                          onDragEnd={() => {
                            setActiveDraggableFile(null);
                            setDragHoverAnchor(null);
                          }}
                          onClick={() => {
                            if (isSelectedStamp) {
                              setActiveStampFile(null);
                              setDragHoverAnchor(null);
                            } else {
                              setActiveStampFile(file);
                              setActiveTool('select');
                            }
                          }}
                          className={cn(
                            "group relative border cursor-grab active:cursor-grabbing transition-all hover:scale-105 duration-100 ease-out shadow-sm overflow-hidden flex flex-col justify-between items-center p-2 bg-slate-950 rounded-lg",
                            isSelectedStamp
                              ? "border-amber-400 bg-amber-500/10 shadow shadow-amber-500/10 ring-1 ring-amber-400/20"
                              : "border-slate-850 hover:border-slate-700 hover:bg-slate-900"
                          )}
                          style={{
                            width: `${Math.max(110, totalW + 16)}px`,
                            height: `${Math.max(105, totalH + 34)}px`
                          }}
                          title={`Composed Stencil File: ${file.name}\nSize: ${tmp.cblocks_x}x${tmp.cblocks_y} blocks`}
                        >
                          <div className="relative pointer-events-none flex-1 flex items-center justify-center animate-in fade-in duration-200">
                            <div style={{ width: `${totalW}px`, height: `${totalH}px`, position: 'relative' }}>
                              {tmp.tiles.map((tile, tIdx) => {
                                if (!tile) return null;
                                const sTileW = tile.cx || tmp.cx || cellW;
                                const sTileH = tile.cy || tmp.cy || cellH;
                                const tx = tile.header.x - minX;
                                const ty = tile.header.y - tile.header.height * (sTileH / 2) - minY;

                                return (
                                  <React.Fragment key={`stencil-tile-${file.name}-${tIdx}`}>
                                    {/* Base layer */}
                                    <div 
                                      style={{
                                        position: 'absolute',
                                        left: `${tx}px`,
                                        top: `${ty}px`,
                                        width: `${sTileW}px`,
                                        height: `${sTileH}px`,
                                        zIndex: tIdx
                                      }}
                                    >
                                      <TilePixelsRenderer tile={tile} palette={palette} width={sTileW} height={sTileH} />
                                    </div>

                                    {/* Extra cliff/overlay built on base */}
                                    {tile.header.has_extra_data && tile.extraImageData && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          left: `${tile.header.x_extra - minX}px`,
                                          top: `${tile.header.y_extra - tile.header.height * (cellH / 2) - minY}px`,
                                          width: `${tile.header.cx_extra}px`,
                                          height: `${tile.header.cy_extra}px`,
                                          zIndex: tIdx + 100
                                        }}
                                        className="opacity-95"
                                      >
                                        <ExtraPixelsRenderer 
                                          pixels={tile.extraImageData} 
                                          palette={palette} 
                                          w={tile.header.cx_extra} 
                                          h={tile.header.cy_extra} 
                                        />
                                      </div>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>

                          <div className="w-full text-center mt-1 border-t border-slate-900/50 pt-1 shrink-0">
                            <div className="text-[9px] font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[130px]">
                              {file.name}
                            </div>
                            <div className="font-mono text-[7px] text-slate-500 leading-none mt-0.5">
                              {tmp.cblocks_x}x{tmp.cblocks_y} • {tmp.tiles.filter(t => t !== null).length} blocks
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {stencilFiles.map((file, sIdx) => {
                    const tmp = file.content as TmpFile;
                    const isSelectedStamp = activeStampFile?.name === file.name;
                    const totalActiveTiles = tmp?.tiles?.filter(t => t !== null).length || 0;

                    return (
                      <div
                        key={`${file.name}-${sIdx}`}
                        draggable
                        onDragStart={(e) => {
                          setActiveDraggableFile(file);
                          e.dataTransfer.setData('text/plain', file.name);
                        }}
                        onDragEnd={() => {
                          setActiveDraggableFile(null);
                          setDragHoverAnchor(null);
                        }}
                        onClick={() => {
                          if (isSelectedStamp) {
                            setActiveStampFile(null);
                            setDragHoverAnchor(null);
                          } else {
                            setActiveStampFile(file);
                            setActiveTool('select');
                          }
                        }}
                        className={cn(
                          "group p-2.5 bg-slate-950 hover:bg-slate-900 rounded-lg border text-left cursor-grab active:cursor-grabbing transition-all select-none relative",
                          isSelectedStamp 
                            ? "border-blue-400/80 bg-blue-950/20 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/20" 
                            : "border-slate-850 hover:border-slate-800"
                        )}
                      >
                        {isSelectedStamp && (
                          <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        )}

                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-[11px] font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-44">
                              {file.name}
                            </h4>
                            <div className="font-mono text-[9px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span className="bg-slate-900 px-1 py-0.1 border border-slate-850 rounded">
                                {tmp ? `${tmp.cblocks_x}x${tmp.cblocks_y}` : '0x0'} blocks
                              </span>
                              <span>
                                {totalActiveTiles} active tiles
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end shrink-0 select-none">
                            <span className={cn(
                              "text-[8px] font-extrabold px-1 py-0.2 rounded font-sans uppercase tracking-wider",
                              file.name.includes("Cliff") 
                                ? "bg-red-400/10 text-red-400" 
                                : "bg-emerald-400/10 text-emerald-400"
                            )}>
                              {file.name.includes("Cliff") ? 'Cliff' : 'Slope'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        {/* 3D Height-Grid & Floor builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Build Height Grid
            </h2>
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold text-slate-400 select-none cursor-pointer flex items-center gap-1">
                <input 
                  type="checkbox" 
                  checked={enableHeightGrid}
                  onChange={(e) => setEnableHeightGrid(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0 w-3 h-3 cursor-pointer"
                />
                <span>Active</span>
              </label>
            </div>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5 font-sans">
            <div className="text-[9px] text-slate-400 leading-relaxed bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
              When active, empty slots hover in 3D at <span className="font-bold text-emerald-300 font-sans">Build Height</span>. Creating tiles (Clicks / Add Tile / Stencils) binds them to this height!
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-sans">
                Height Level:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHeightGridLevel(hl => Math.max(-128, hl - 1))}
                  className="h-7 w-7 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold border border-slate-800 transition-all cursor-pointer"
                >
                  -
                </button>
                <div 
                  className="px-3 py-1 font-black text-xs font-mono text-center rounded border bg-slate-950 min-w-[34px]"
                  style={{ 
                    borderColor: getHeightColor(heightGridLevel), 
                    color: getHeightColor(heightGridLevel) 
                  }}
                >
                  {heightGridLevel}
                </div>
                <button
                  onClick={() => setHeightGridLevel(hl => Math.min(127, hl + 1))}
                  className="h-7 w-7 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold border border-slate-800 transition-all cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {enableHeightGrid && (
              <div className="flex items-center gap-1.5 justify-center text-[9px] text-slate-400 font-medium font-sans">
                <span className="w-2.5 h-2.5 rounded-full inline-block animate-pulse shrink-0" style={{ backgroundColor: getHeightColor(heightGridLevel) }} />
                <span>
                  Grid line color binds to <span className="font-bold font-mono" style={{ color: getHeightColor(heightGridLevel) }}>{getHeightColor(heightGridLevel)}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Image Overlay (Tracer) */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5 text-sky-400" />
            Image Overlay (Tracer)
          </h2>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3 text-[11px] font-sans">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400">Load PNG Overlay</label>
              <input
                type="file"
                accept="image/png"
                onChange={handleOverlayUpload}
                className="w-full text-slate-300 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-slate-800 file:text-slate-200 file:cursor-pointer hover:file:bg-slate-700"
              />
            </div>

            {overlayImageSrc && overlayImageDims && (
              <div className="space-y-3 pt-1 border-t border-slate-800/60">
                {/* Opacity Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-400 font-bold">Opacity</label>
                    <span className="font-mono text-sky-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded">
                      {Math.round(overlayOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Nudging Controls */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold block">Nudge Offset (X: {overlayX}px, Y: {overlayY}px)</label>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={() => nudgeOverlay(-10, 0)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Left 10px"
                    >
                      -10X
                    </button>
                    <button
                      onClick={() => nudgeOverlay(-1, 0)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Left 1px"
                    >
                      -1X
                    </button>
                    <button
                      onClick={() => nudgeOverlay(1, 0)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Right 1px"
                    >
                      +1X
                    </button>
                    <button
                      onClick={() => nudgeOverlay(10, 0)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Right 10px"
                    >
                      +10X
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={() => nudgeOverlay(0, -10)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Up 10px"
                    >
                      -10Y
                    </button>
                    <button
                      onClick={() => nudgeOverlay(0, -1)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Up 1px"
                    >
                      -1Y
                    </button>
                    <button
                      onClick={() => nudgeOverlay(0, 1)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Down 1px"
                    >
                      +1Y
                    </button>
                    <button
                      onClick={() => nudgeOverlay(0, 10)}
                      className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded font-mono font-bold text-slate-300 cursor-pointer"
                      title="Nudge Down 10px"
                    >
                      +10Y
                    </button>
                  </div>
                </div>

                {/* Option Checkboxes */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={keepBaseImage}
                      onChange={(e) => setKeepBaseImage(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Keep Base Image (Bake only to Extra)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={onlyBakeSelected}
                      onChange={(e) => setOnlyBakeSelected(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Only bake in selected extra images ({selectedSlots.length} selected)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={onlyAutoExtraSelected}
                      onChange={(e) => setOnlyAutoExtraSelected(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Only auto-extra for selected tiles ({selectedSlots.length} selected)</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={bakeOverlay}
                    className="w-full py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    Bake Overlay
                  </button>

                  <button
                    onClick={autoCreateExtraImages}
                    className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-450 text-slate-950 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    title="Scan overlay and assign pixels to nearest tiles, auto-sizing extra images and cutting off where top tiles start"
                  >
                    Auto-Create Extra Images
                  </button>

                  <button
                    onClick={generateZData}
                    className="w-full py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    title="Generate depth Z-gradient for base tiles and Z=224 for extra images"
                  >
                    Generate Z-Data
                  </button>

                  <button
                    onClick={centerOverlayImage}
                    className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    title="Center the overlay image to the existing tiles bounding box, or to the middle of the viewport"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Center Image
                  </button>

                  <button
                    onClick={() => {
                      setOverlayImageSrc(null);
                      setOverlayImageDims(null);
                      setOverlayPixels(null);
                    }}
                    className="w-full py-1 text-slate-500 hover:text-red-400 transition-colors text-[9px] uppercase font-bold tracking-wide"
                  >
                    Clear Overlay Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workspace controls */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FilePlus className="w-3.5 h-3.5 text-pink-500" />
            File Operations
          </h2>
          <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-400">File Name</label>
              <input 
                type="text" 
                value={fileName} 
                onChange={(e) => setFileName(e.target.value)} 
                className="w-full mt-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-white focus:outline-none focus:border-emerald-500" 
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button 
                onClick={handleNewFile}
                className="h-9 rounded-md py-1 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Resets tile builder to 1x1 grid template"
              >
                <Plus className="w-3 h-3" />
                New Grid 1x1
              </button>
              
              <button 
                onClick={saveToWorkspace}
                className="h-9 rounded-md py-1 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
              >
                <Save className="w-3 h-3" />
                Add to Workspace
              </button>
            </div>

            <button 
              onClick={downloadFileDirect}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1 mt-1"
            >
              <Download className="w-3.5 h-3.5" />
              Download .TEM
            </button>

            {/* Quick Load File option dropdown */}
            {loadedFiles.filter(f => f.fileType === 'TMP').length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Load File to Edit</label>
                <select 
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const fileObj = loadedFiles.find(f => f.name === selectedName && f.fileType === 'TMP');
                    if (fileObj) {
                      handleLoadFile(fileObj);
                    }
                  }}
                  defaultValue=""
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="" disabled>Select workspace file...</option>
                  {loadedFiles.filter(f => f.fileType === 'TMP').map(f => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Engine Setup */}
        <div className="space-y-1.5">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-emerald-500" />
            Grid Engine Type
          </h2>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/60 rounded-lg border border-slate-800">
            <button 
              onClick={() => {
                setEngineType('TS');
                // Re-instantiate flat grid sizes as engine sizes change
                setSelectedSlot(null);
              }}
              className={cn(
                "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                engineType === 'TS' ? "bg-slate-800 text-emerald-400 font-black border border-slate-700" : "text-slate-400 hover:text-slate-200"
              )}
            >
              TS (48×24)
            </button>
            <button 
              onClick={() => {
                setEngineType('RA2');
                setSelectedSlot(null);
              }}
              className={cn(
                "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                engineType === 'RA2' ? "bg-slate-800 text-red-400 font-black border border-slate-700" : "text-slate-400 hover:text-slate-200"
              )}
            >
              RA2 (60×30)
            </button>
            <button 
              onClick={() => {
                setEngineType('OpenTS');
                setSelectedSlot(null);
              }}
              className={cn(
                "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                engineType === 'OpenTS' ? "bg-slate-800 text-amber-400 font-black border border-slate-700" : "text-slate-400 hover:text-slate-200"
              )}
            >
              OpenTS (120×60)
            </button>
            <button 
              onClick={() => {
                setEngineType('OpenTS_48x96');
                setSelectedSlot(null);
              }}
              className={cn(
                "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                engineType === 'OpenTS_48x96' ? "bg-slate-800 text-amber-400 font-black border border-slate-700" : "text-slate-400 hover:text-slate-200"
              )}
            >
              OpenTS (48×96)
            </button>
          </div>
        </div>



        {/* Board Config dimensions */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-blue-500" />
            Grid Dimension Extender
          </h2>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block">Columns</label>
                <div className="flex items-center gap-1 mt-1">
                  <input 
                    type="number" 
                    min="1" 
                    max="100"
                    value={cblocksX} 
                    onChange={(e) => adjustGridSize(Math.max(1, parseInt(e.target.value) || 1), cblocksY)}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white focus:outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block">Rows</label>
                <div className="flex items-center gap-1 mt-1">
                  <input 
                    type="number" 
                    min="1" 
                    max="100"
                    value={cblocksY} 
                    onChange={(e) => adjustGridSize(cblocksX, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white focus:outline-none" 
                  />
                </div>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 italic mt-1 text-center">
              Increasing indices expands the board without deleting tiles.
            </div>
          </div>
        </div>

        {/* Coordinates solver placing tool */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            Manual Pixel Coordinates Placement
          </h2>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block">Pixel X</label>
                <input 
                  type="number" 
                  value={manualPixelX}
                  onChange={(e) => setManualPixelX(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white focus:outline-none" 
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block">Pixel Y</label>
                <input 
                  type="number" 
                  value={manualPixelY}
                  onChange={(e) => setManualPixelY(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] text-white focus:outline-none" 
                />
              </div>
            </div>
            
            <button 
              onClick={executeManualCoordinatePlacement}
              className="w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all"
            >
              Solve Grid Cell & Place Tile
            </button>
            <div className="text-[9px] text-slate-500 font-mono leading-relaxed bg-black/40 p-1.5 rounded border border-slate-800">
              Formula resolves exact isometric grid cell column & Row. Spacing increments: {cellW}W x {cellH}H pixels.
            </div>
          </div>
        </div>

        </div>

        {/* Sidebar Drag Handle */}
        <div 
          onMouseDown={handleSidebarMouseDown}
          className="absolute top-0 right-0 bottom-0 w-[5px] hover:w-[7px] bg-slate-900 hover:bg-emerald-500/40 active:bg-emerald-500 cursor-col-resize z-50 transition-all border-r border-slate-800"
          title="Drag to resize sidebar width"
        />
      </aside>

      {/* Center Map Work Area */}
      <section className="flex-1 flex flex-col relative bg-slate-900 select-none">
        
        {/* Toolbars */}
        <div className="h-12 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            
            <button
              onClick={() => setActiveTool('select')}
              className={cn(
                "h-8 px-3 rounded text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5",
                activeTool === 'select' 
                  ? "bg-slate-800 text-white border border-slate-700" 
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <MousePointer className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Tile (Default)</span>
            </button>

            <button
              onClick={() => setActiveTool('add-tile')}
              className={cn(
                "h-8 px-3 rounded text-[11px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5",
                activeTool === 'add-tile'
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tile Tool</span>
            </button>

            <div className="h-4 w-[1px] bg-slate-800" />

            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={cn(
                "h-8 px-3 rounded text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 border",
                history.length === 0 
                  ? "text-slate-650 border-slate-900 bg-slate-950/20 cursor-not-allowed" 
                  : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-750 hover:text-white cursor-pointer"
              )}
              title="Undo last action (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5 text-amber-500" />
              <span>Undo</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={redoHistory.length === 0}
              className={cn(
                "h-8 px-3 rounded text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 border",
                redoHistory.length === 0 
                  ? "text-slate-650 border-slate-900 bg-slate-950/20 cursor-not-allowed" 
                  : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-750 hover:text-white cursor-pointer"
              )}
              title="Redo last undone action (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <Redo className="w-3.5 h-3.5 text-amber-500" />
              <span>Redo</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedSlot === null || !tiles[selectedSlot]}
              className={cn(
                "h-8 px-3 rounded text-[11px] font-bold uppercase transition-all flex items-center gap-1.5 border",
                (selectedSlot === null || !tiles[selectedSlot])
                  ? "text-slate-650 border-slate-900 bg-slate-950/20 cursor-not-allowed" 
                  : "bg-red-950/20 text-red-400 border-red-900/30 hover:bg-red-900/10 cursor-pointer"
              )}
              title="Delete selected tile (x)"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete (X)</span>
            </button>

          </div>

          <div className="flex items-center gap-3">
            {/* View Layer Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setHideOverlay(p => !p)}
                className={cn(
                  "h-8 px-2.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 border",
                  hideOverlay
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30 font-black shadow-sm"
                    : "bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-250"
                )}
                title="Hides tile coordinate text and red extra-image boundaries"
              >
                {hideOverlay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>Hide Overlay</span>
              </button>

              <button
                onClick={() => setHideExtraImage(p => !p)}
                className={cn(
                  "h-8 px-2.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 border",
                  hideExtraImage
                    ? "bg-pink-500/15 text-pink-400 border-pink-500/30 font-black shadow-sm"
                    : "bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-250"
                )}
                title="Hides extra custom-image overlays completely to see background tiles"
              >
                {hideExtraImage ? <LayoutGrid className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                <span>Hide Extra Image</span>
              </button>

              <button
                onClick={() => setHideHeight(p => !p)}
                className={cn(
                  "h-8 px-2.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 border",
                  hideHeight
                    ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-black shadow-sm"
                    : "bg-slate-900/40 text-slate-400 border-slate-800 hover:text-slate-250"
                )}
                title="Visually flattens the view of tiles to Height 0 to reveal background layers"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Hide Height</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-800 block" />

            {/* Viewport Zoom */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-bold shrink-0">
                Grid: {cblocksX}x{cblocksY} ({engineType})
              </span>
              <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />
              <button 
                onClick={() => setScale(prev => Math.max(0.4, prev - 0.2))}
                className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 cursor-pointer hidden sm:block"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-black text-slate-300 w-11 text-center font-mono hidden sm:block">
                {Math.round(scale * 100)}%
              </span>
              <button 
                onClick={() => setScale(prev => Math.min(4, prev + 0.2))}
                className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 cursor-pointer hidden sm:block"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setScale(1.5); setPanX(420); setPanY(120); }}
                className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 cursor-pointer text-[10px] font-bold uppercase font-sans tracking-wide shrink-0"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Spacebar Indicator */}
        {isSpacePressed && (
          <div className="absolute top-14 left-4 z-10 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center gap-1.5 pointer-events-none animate-pulse">
            <Move className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Spacebar Pan active</span>
          </div>
        )}

        {/* Canvas Area Container */}
        <div 
          className={cn(
            "flex-1 overflow-hidden relative cursor-grab",
            isSpacePressed && "cursor-move",
            isPanning && "cursor-grabbing"
          )}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            handleCanvasMouseMove(e);
            
            // Precise isometric mouse coordinate solver
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            const pxX = (mx - panX) / scale;
            const pxY = (my - panY) / scale;
            
            const solvedIdx = resolveCellAtCoordinates(pxX, pxY);
            
            if (solvedIdx !== null) {
              setHoveredSlot(solvedIdx);
              if (activeStampFile || activeDraggableFile) {
                setDragHoverAnchor(solvedIdx);
              }
            } else {
              setHoveredSlot(null);
            }
          }}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => {
            handleCanvasMouseUp();
            setHoveredSlot(null);
            setDragHoverAnchor(null);
          }}
          onClick={(e) => {
            // Only select if user is not actively spacebar-panning
            if (isPanning) return;
            if (hoveredSlot !== null) {
              handleGridCellClick(hoveredSlot, e);
            }
          }}
          onContextMenu={(e) => {
            if (activeStampFile) {
              e.preventDefault();
              setActiveStampFile(null);
              setDragHoverAnchor(null);
            }
          }}
        >
          {/* Spatial Iso grid coordinate wrapper */}
          <div 
            className="absolute origin-top-left transition-transform duration-75"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${scale})`
            }}
            onMouseLeave={() => setDragHoverAnchor(null)}
          >
            {/* Draw isometric slot diamonds grids background */}
            {gridCells.map(({ index, x, y }) => {
              const tile = tiles[index];
              
              // Map isometric coordinate transformation
              const screenX = (x - y) * (cellW / 2);
              const screenY = (x + y) * (cellH / 2);

              const selected = selectedSlot === index;

              // Compute overlay stencil tile if dragging or active stamp brush is hovering
              let overlayTile: Tile | null = null;
              if ((activeDraggableFile || activeStampFile) && dragHoverAnchor !== null) {
                const stencilFile = activeDraggableFile || activeStampFile;
                const tmp = stencilFile?.content as TmpFile;
                if (tmp) {
                  const anchorCol = dragHoverAnchor % cblocksX;
                  const anchorRow = Math.floor(dragHoverAnchor / cblocksX);
                  const dx = x - anchorCol;
                  const dy = y - anchorRow;
                  if (dx >= 0 && dx < tmp.cblocks_x && dy >= 0 && dy < tmp.cblocks_y) {
                    const srcIdx = dy * tmp.cblocks_x + dx;
                    overlayTile = tmp.tiles[srcIdx] || null;
                  }
                }
              }

              const isOverlaid = !!overlayTile;
              const displayTile = overlayTile || tile;

              return (
                <div 
                  key={index}
                  onMouseEnter={() => {
                    if (activeStampFile) {
                      setDragHoverAnchor(index);
                    }
                  }}
                  draggable={!isSpacePressed && activeTool === 'select' && !!tile}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    setDraggingSlot(index);
                  }}
                  onDragEnd={() => {
                    setDraggingSlot(null);
                    setDragHoverAnchor(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingSlot !== null || activeDraggableFile) {
                      setDragHoverAnchor(index);
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (draggingSlot !== null || activeDraggableFile) {
                      setDragHoverAnchor(index);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedFromStr = e.dataTransfer.getData('text/plain');
                    const draggedFromIdx = draggedFromStr !== '' ? Number(draggedFromStr) : null;

                    if (draggedFromIdx !== null && !isNaN(draggedFromIdx)) {
                      moveTile(draggedFromIdx, index);
                    } else if (activeDraggableFile) {
                      handleDropFileAt(index, activeDraggableFile);
                    }
                    setDraggingSlot(null);
                    setDragHoverAnchor(null);
                  }}
                  className={cn(
                    "absolute transition-opacity duration-150",
                    draggingSlot === index && "opacity-40"
                  )}
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    width: `${cellW}px`,
                    height: `${cellH}px`,
                    transform: `translate(-50%, 0)`
                  }}
                >
                  {/* Subtle dotted slot coordinate placeholder if empty */}
                  {!displayTile ? (
                    <div 
                      className={cn(
                        "w-full h-full flex items-center justify-center transition-all cursor-crosshair rounded-full",
                        hoveredSlot === index
                          ? "bg-amber-500/20"
                          : activeTool === 'add-tile' 
                            ? "hover:bg-emerald-500/5" 
                            : "hover:bg-slate-800/10"
                      )}
                      style={{
                        clipPath: `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`,
                        transform: enableHeightGrid 
                          ? `translateY(${-(hideHeight ? 0 : heightGridLevel) * (cellH / 2)}px)`
                          : undefined,
                        borderColor: selected
                          ? '#10b981'
                          : selectedSlots.includes(index)
                            ? '#3b82f6'
                            : hoveredSlot === index
                              ? '#f59e0b'
                              : enableHeightGrid 
                                ? getHeightColor(heightGridLevel) 
                                : activeTool === 'add-tile' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(51, 65, 85, 0.4)',
                        borderWidth: (selected || selectedSlots.includes(index) || hoveredSlot === index || enableHeightGrid) ? '2px' : '1px',
                        borderStyle: (selected || hoveredSlot === index || enableHeightGrid) ? 'solid' : 'dashed'
                      }}
                    >
                      {!hideOverlay && (
                        <span 
                          className="text-[7px] font-black select-none font-mono"
                          style={{
                            color: selected
                              ? '#10b981'
                              : selectedSlots.includes(index)
                                ? '#3b82f6'
                                : hoveredSlot === index
                                  ? '#f59e0b'
                                  : enableHeightGrid ? getHeightColor(heightGridLevel) : undefined,
                            opacity: (selected || selectedSlots.includes(index) || hoveredSlot === index || enableHeightGrid) ? 0.9 : 0.3
                          }}
                        >
                          {x},{y}
                        </span>
                      )}
                    </div>
                  ) : (
                    // Render Active Isometric Tile or Overlay Stencil Preview
                    (() => {
                      const effectiveHeight = (isOverlaid && enableHeightGrid) ? heightGridLevel : displayTile.header.height;
                      return (
                        <div 
                          className={cn(
                            "relative w-full h-full cursor-pointer group transition-all"
                          )}
                          style={{
                            transform: `translateY(${-(hideHeight ? 0 : effectiveHeight) * (cellH / 2)}px)`,
                            clipPath: `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`
                          }}
                        >
                          {/* Generates HTML Canvas dynamically based on decoded pixels */}
                          <TilePixelsRenderer tile={displayTile} palette={palette} width={cellW} height={cellH} />
                          
                          {/* Hover highlight overlay inside clipped div to trace the diamond */}
                          {hoveredSlot === index && (
                            <div className="absolute inset-0 bg-amber-550/20 border-2 border-amber-500/70 pointer-events-none z-30" />
                          )}

                          {/* Selected highlight overlay inside clipped div to trace the diamond */}
                          {selected && !isOverlaid && (
                            <div className="absolute inset-0 bg-emerald-500/15 border-2 border-emerald-500 pointer-events-none z-30" />
                          )}

                          {/* Multi-selected highlight overlay inside clipped div to trace the diamond */}
                          {!selected && selectedSlots.includes(index) && !isOverlaid && (
                            <div className="absolute inset-0 bg-blue-500/15 border-2 border-blue-500 border-dashed pointer-events-none z-30" />
                          )}
                          
                          {/* Stencil highlight overlay inside clipped div to trace the diamond */}
                          {isOverlaid && (
                            <div className="absolute inset-0 bg-blue-500/15 border-2 border-blue-400 border-dashed pointer-events-none z-30" />
                          )}
                          
                          {/* Index display indicator overlay */}
                          {!hideOverlay && (
                            <div className={cn(
                              "absolute inset-0 flex items-center justify-center pointer-events-none",
                              isOverlaid ? "bg-blue-500/10" : "bg-black/0 group-hover:bg-black/10"
                            )}>
                              {isOverlaid ? (
                                <span className="text-[6px] font-black text-blue-200 bg-blue-950/90 px-1 py-0.5 rounded font-mono shadow-sm tracking-wider animate-pulse uppercase">
                                  STENCIL H:{effectiveHeight}
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-black text-white bg-black/60 px-1 py-0.5 rounded font-mono shadow">
                                  H:{effectiveHeight} {x},{y}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Draw interactive Extradata cliff boundary rectangles & handles if tile contains extra files */}
                  {displayTile && displayTile.header.has_extra_data && !hideExtraImage && (() => {
                    const effectiveHeight = (isOverlaid && enableHeightGrid) ? heightGridLevel : displayTile.header.height;
                    return (
                      <div 
                        className={cn(
                          "absolute border pointer-events-none z-20 transition-all",
                          hideOverlay 
                            ? "border-transparent bg-transparent"
                            : isOverlaid 
                              ? "border-blue-400/60 bg-blue-400/5 opacity-80" 
                              : "border-red-500/70 bg-red-400/5"
                        )}
                        style={{
                          left: `${displayTile.header.x_extra - displayTile.header.x}px`,
                          top: `${displayTile.header.y_extra - displayTile.header.y - (hideHeight ? 0 : effectiveHeight) * (cellH / 2)}px`,
                          width: `${displayTile.header.cx_extra}px`,
                          height: `${displayTile.header.cy_extra}px`
                        }}
                      >
                        {/* Display Extra pixels within bounds */}
                        <div className="w-full h-full overflow-hidden opacity-85">
                          {displayTile.extraImageData && (
                            <ExtraPixelsRenderer 
                              pixels={displayTile.extraImageData} 
                              palette={palette} 
                              w={displayTile.header.cx_extra} 
                              h={displayTile.header.cy_extra} 
                            />
                          )}
                        </div>

                      {/* RESIZE DRAG HANDLES on 4 cardial edges */}
                      {selected && !isOverlaid && !hideOverlay && (
                        <>
                          {/* Right Handle */}
                          <div 
                            onMouseDown={(e) => startDragHandleExtra(e, index, 'right')}
                            className="absolute bg-white border border-red-500 w-2.5 h-2.5 hover:bg-emerald-400 hover:border-black cursor-ew-resize pointer-events-auto"
                            style={{ top: '50%', right: '-5px', transform: 'translateY(-50%)' }}
                          />
                          {/* Bottom Handle */}
                          <div 
                            onMouseDown={(e) => startDragHandleExtra(e, index, 'bottom')}
                            className="absolute bg-white border border-red-500 w-2.5 h-2.5 hover:bg-emerald-400 hover:border-black cursor-ns-resize pointer-events-auto shadow"
                            style={{ bottom: '-5px', left: '50%', transform: 'translateX(-50%)' }}
                          />
                          {/* Left Handle */}
                          <div 
                            onMouseDown={(e) => startDragHandleExtra(e, index, 'left')}
                            className="absolute bg-white border border-red-500 w-2.5 h-2.5 hover:bg-emerald-400 hover:border-black cursor-ew-resize pointer-events-auto"
                            style={{ top: '50%', left: '-5px', transform: 'translateY(-50%)' }}
                          />
                          {/* Top Handle */}
                          <div 
                            onMouseDown={(e) => startDragHandleExtra(e, index, 'top')}
                            className="absolute bg-white border border-red-500 w-2.5 h-2.5 hover:bg-emerald-400 hover:border-black cursor-ns-resize pointer-events-auto shadow"
                            style={{ top: '-5px', left: '50%', transform: 'translateX(-50%)' }}
                          />
                        </>
                      )}
                    </div>
                  )})()}

                </div>
              );
            })}

            {overlayImageSrc && overlayImageDims && (
              <img
                src={overlayImageSrc}
                style={{
                  position: 'absolute',
                  left: `${overlayX}px`,
                  top: `${overlayY}px`,
                  width: `${overlayImageDims.width}px`,
                  height: `${overlayImageDims.height}px`,
                  opacity: overlayOpacity,
                  pointerEvents: 'none',
                  zIndex: 100,
                  imageRendering: 'pixelated',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  display: 'block'
                }}
                alt="Tracer Overlay"
              />
            )}
          </div>
        </div>

        {/* Informative Help tip footer banner */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-3 font-medium select-none">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span><strong>Tip:</strong> Hold <strong>Spacebar</strong> + Drag Canvas workspace to Pan. Hold <strong>Ctrl / Cmd</strong> to select multiple tiles.</span>
            </div>
            
            {/* Selected slots tooltip bar */}
            {selectedSlots.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md text-[10px] text-blue-300 overflow-hidden">
                <span className="font-extrabold uppercase tracking-wider text-[8.5px] text-blue-400 shrink-0">Selected ({selectedSlots.length}):</span>
                <div className="flex items-center gap-1 overflow-x-auto max-w-full custom-scrollbar py-0.5 whitespace-nowrap">
                  {selectedSlots.map(slotIdx => {
                    const scX = slotIdx % cblocksX;
                    const scY = Math.floor(slotIdx / cblocksX);
                    const hasTile = !!tiles[slotIdx];
                    return (
                      <span 
                        key={slotIdx} 
                        onClick={() => {
                          setSelectedSlot(slotIdx);
                        }}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold border cursor-pointer hover:border-amber-500/60 transition-colors select-none shrink-0",
                          hasTile 
                            ? "bg-slate-900 border-emerald-500/30 text-emerald-400" 
                            : "bg-slate-950 border-slate-850 text-slate-500"
                        )}
                        title={hasTile ? `Active Tile at Column ${scX}, Row ${scY}` : `Empty Slot at Column ${scX}, Row ${scY}`}
                      >
                        ({scX},{scY}){hasTile ? ` H:${tiles[slotIdx]?.header.height}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {activeTile && activeTile.header.has_extra_data && (
            <span className="text-red-400 bg-red-400/5 px-2 py-0.5 rounded border border-red-500/10 font-bold uppercase text-[9px] tracking-wide animate-pulse shrink-0 self-start md:self-auto">
              Drag Red Handles to Resize extra cliff image overlay!
            </span>
          )}
        </div>
      </section>

      {/* Right Properties & Pixel Drawing Palette sidepanel */}
      <aside className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
        {activeTile ? (
          <div className="p-4 space-y-4 flex flex-col h-full">
            
            {/* Selected Tile Meta info Header */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                  Slot #{selectedSlot}
                </span>
                <button 
                  onClick={() => {
                    const freshTiles = [...tiles];
                    freshTiles[selectedSlot!] = null;
                    updateTiles(freshTiles);
                    setSelectedSlot(null);
                  }}
                  className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-405 rounded transition-colors cursor-pointer"
                  title="Delete entire tile"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="text-white font-bold text-xs mt-1.5">
                Selected Grid Tile Properties
              </h3>
            </div>

            {/* Properties Sliders */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3 text-[11px]">
              
              {/* Height Offset logic */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-bold">Tile Height / Elevation</label>
                  <span className="font-mono text-emerald-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded">
                    {activeTile.header.height} steps
                  </span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <button 
                    onClick={() => handleTilePropertyUpdate({ height: Math.max(-128, activeTile.header.height - 1) })}
                    className="p-1.5 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-350 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="range" 
                    min="-16" 
                    max="16" 
                    value={activeTile.header.height} 
                    onChange={(e) => handleTilePropertyUpdate({ height: parseInt(e.target.value) || 0 })}
                    className="flex-1 cursor-pointer accent-emerald-500" 
                  />
                  <button 
                    onClick={() => handleTilePropertyUpdate({ height: Math.min(127, activeTile.header.height + 1) })}
                    className="p-1.5 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-350 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[8.5px] text-slate-500">
                  Elevation pushes the render of the tile upwards by {cellH / 2}px per step on Westwood map files.
                </div>
              </div>

              {/* Land type setup */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">Land Flag Type</label>
                <select 
                  value={activeTile.header.land_type}
                  onChange={(e) => handleTilePropertyUpdate({ land_type: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded font-bold text-white text-[11px] focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="0">0: Concrete (unbuildable, high defense)</option>
                  <option value="1">1: Ice</option>
                  <option value="2">2: Rough / Rugged</option>
                  <option value="3">3: Water / River</option>
                  <option value="5">5: Asphalt Road (high speed)</option>
                  <option value="8">8: Wall barrier obstacle</option>
                  <option value="12">12: Clear Grass Terrain</option>
                  <option value="15">15: Shore / Sandy Beach</option>
                </select>
              </div>

              {/* Ramp Type flag */}
              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">Ramp Shape Index</label>
                <select
                  value={activeTile.header.ramp_type}
                  onChange={(e) => handleTilePropertyUpdate({ ramp_type: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded font-bold text-white text-[11px] focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="0">0: Flat / Level Ground</option>
                  <option value="1">1: Slope ascending NE</option>
                  <option value="2">2: Slope ascending NW</option>
                  <option value="3">3: Flat cliff face edge</option>
                  <option value="5">5: Corner ledge border</option>
                </select>
              </div>

            </div>

            {/* Cliff Extradata block setup */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 font-bold">Extra Image Frame</label>
                <span className={cn(
                  "font-bold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded",
                  activeTile.header.has_extra_data 
                    ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                    : "bg-slate-950 text-slate-500"
                )}>
                  {activeTile.header.has_extra_data ? "Linked" : "No Attachment"}
                </span>
              </div>

              {!activeTile.header.has_extra_data ? (
                <button 
                  onClick={() => addExtraImageToTile(selectedSlot)}
                  className="w-full py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Image className="w-3.5 h-3.5" />
                  Add Extra Image Frame
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-400 leading-snug">
                    <div>Offset X: {activeTile.header.x_extra}px</div>
                    <div>Offset Y: {activeTile.header.y_extra}px</div>
                    <div>W: {activeTile.header.cx_extra} px</div>
                    <div>H: {activeTile.header.cy_extra} px</div>
                  </div>

                  <button 
                    onClick={() => removeExtraImageFromTile(selectedSlot)}
                    className="w-full py-1.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-transparent hover:border-red-500/10 text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Detach Extra Image Frame
                  </button>
                </div>
              )}
            </div>

            {/* INTEGRATED MINI PIXEL EDITOR SECTION */}
            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between bg-slate-950 p-1 rounded-lg border border-slate-850 shrink-0">
                <button 
                  onClick={() => setActiveLayer('base')}
                  className={cn(
                    "flex-1 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer",
                    activeLayer === 'base' ? "bg-slate-800 text-white" : "text-slate-500"
                  )}
                >
                  Base Image
                </button>
                <button 
                  disabled={!activeTile.header.has_extra_data}
                  onClick={() => setActiveLayer('extra')}
                  className={cn(
                    "flex-1 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                    activeLayer === 'extra' ? "bg-slate-800 text-white" : "text-slate-500"
                  )}
                >
                  Extra Image
                </button>
              </div>

              {/* Editing Grid Canvas Area */}
              <div className="mt-2 text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between shrink-0">
                <span>Raster painting brush: {activeLayer === 'base' ? `${cellW}x${cellH}` : `${activeTile.header.cx_extra}x${activeTile.header.cy_extra}`}</span>
                
                {/* Editor layout options */}
                <div className="flex bg-slate-900 border border-slate-800 rounded p-0.5">
                  <button 
                    onClick={() => setPixelDrawMode('color')}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] uppercase font-black cursor-pointer",
                      pixelDrawMode === 'color' ? "bg-emerald-500 text-slate-950" : "text-slate-400"
                    )}
                  >
                    Color
                  </button>
                  <button 
                    onClick={() => setPixelDrawMode('z-depth')}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] uppercase font-black cursor-pointer",
                      pixelDrawMode === 'z-depth' ? "bg-amber-500 text-slate-950" : "text-slate-400"
                    )}
                  >
                    Z-Data
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-black rounded-lg border border-slate-800 overflow-hidden relative flex items-center justify-center p-2 min-h-[140px] max-h-[180px]">
                {/* Embedded pixel painting view */}
                <MiniPixelPainter 
                  tile={activeTile}
                  layer={activeLayer}
                  drawMode={pixelDrawMode}
                  palette={palette}
                  colorValue={selectedPaletteIndex}
                  depthValue={zValue}
                  brush={brushSize}
                  onPaint={handlePixelPaint}
                  onStartPaint={() => pushToHistory(tiles)}
                />
              </div>

              {/* Drawing options footer tools */}
              <div className="mt-2 grid grid-cols-2 gap-1.5 shrink-0">
                <div className="flex items-center justify-between px-2 py-1 bg-slate-900 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Brush Size</span>
                  <select 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value) || 1)}
                    className="bg-transparent text-[10px] text-white font-mono focus:outline-none cursor-pointer"
                  >
                    <option value="1">1 px</option>
                    <option value="3">3 px</option>
                    <option value="5">5 px</option>
                  </select>
                </div>

                {pixelDrawMode === 'z-depth' ? (
                  <div className="flex items-center justify-between px-2 py-1 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Z-Data Value</span>
                    <input 
                      type="number" 
                      min="0"
                      max="255"
                      value={zValue}
                      onChange={(e) => setZValue(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
                      className="w-12 bg-transparent text-[10px] text-white font-mono text-right focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-2 py-1 bg-slate-900 rounded border border-slate-800">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Color Index</span>
                    <input 
                      type="number" 
                      min="0"
                      max="255"
                      value={selectedPaletteIndex}
                      onChange={(e) => setSelectedPaletteIndex(Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
                      className="w-12 bg-transparent text-[10px] text-white font-mono text-right focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Palette index visual quick picker */}
              {pixelDrawMode === 'color' && (
                <div className="mt-2.5 space-y-1 shrink-0">
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                    Quick Color Picker index ({selectedPaletteIndex})
                  </div>
                  <div className="h-10 overflow-x-auto overflow-y-hidden flex items-center gap-1 pb-1.5 custom-scrollbar bg-slate-950 p-1 rounded-md border border-slate-850">
                    {Array.from({ length: 64 }, (_, idx) => {
                      const color = palette[idx + 20] || { r: 120, g: 120, b: 120 }; // show popular range indices
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedPaletteIndex(idx + 20)}
                          className={cn(
                            "w-5 h-5 rounded hover:scale-110 active:scale-95 transition-all shrink-0 border border-black cursor-pointer shadow-sm relative",
                            selectedPaletteIndex === (idx + 20) ? "ring-2 ring-emerald-400 max-w-[20px]" : "opacity-90"
                          )}
                          style={{
                            backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`
                          }}
                          title={`Palette index ${idx + 20}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
            <MousePointer className="w-8 h-8 text-slate-650" />
            <p className="text-[11px] font-medium leading-relaxed">
              No grid cell slot highlighted. Use the default <strong>Select Tile</strong> tool over the isometric grid, or place tiles via coordinate solvers!
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
