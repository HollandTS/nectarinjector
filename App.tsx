
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { CanvasImage, RgbaColor, GridType, ActiveGridType, OverlayLayer, ProjectOverlay, OverlayFilters, ContourSettings, MaskEntry, MaskGroup, ThreeDObject, TransitionStamp, ToolMode, AdditionalTexture, OriginalColorSettings } from './types';
import { makeThreeDTargetId } from './utils/threeDInjectionUtils';
import { isAllLayersTargetId } from './utils/allLayersInjectionHelper';
import ControlPanel from './components/ControlPanel';
import CanvasArea from './components/CanvasArea';
import Loader from './components/Loader';
import { DropOverlay } from './components/ui/DropOverlay';
import { TileLibrary } from './components/panels/TileLibrary';
import TransitionStampTool from './components/TransitionStampTool';
import { generateSimilarTexture, generateSeamlessTexture, getLayoutCommand } from './services/geminiService';
import { processTransparency, sliceImageInto4 } from './utils/imageUtils';
import { GRID_CONFIGS, DEFAULT_FILTERS, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { isoToScreen, screenToIso, getImageDrawPos } from './utils/geoUtils';
import { colorDistance, rgbToHsl, hslToRgb } from './utils/colorUtils';
import { applyContourEffect, applySharpen, applyPixelNoise, applyPixelFilters, applyOriginalColorAdjustment } from './utils/imageEffects';
import { bakeOverlaysToTile, clearImageCache, loadImage, renderOverlayToCanvas } from './utils/textureInjection';
import { saveProject, loadProject, ProjectData } from './src/services/projectService';
import JSZip from 'jszip';
import { loadDefaultPalette, parsePalFile, parseTmpFile, renderTmpToPng, isValidWwTmp, isValidWwPal, PaletteColor as WwPaletteColor, getTmpMinOffsets, updateTmpFileFromCanvas } from './utils/westwoodTmpParser';
import { TmpParser } from './utils/formats';
import { detectGridTypeForTmp, detectGridTypeForWidth } from './utils/opentsUtils';
import { useLatHandler } from './utils/useLatHandler';
import { calculatePackedPositions, calculateColorPackedPositions } from './utils/tilePackingUtils';
import { getTileCellSpan } from './utils/openTsTileRenderer';
import { setLoadedPalette, getLoadedPalette, getLoadedPaletteFileName } from './utils/paletteViewerHelper';
import { clearSurfaceCache } from './utils/overlaySurfaceRenderer';
import { checkTilesHaveTransparency } from './utils/transparencyBakeHelper';
import { reRenderTmpImagesWithPalette, serializePaletteToRaw } from './utils/projectPaletteHelper';
import { cloneThreeDObject } from './utils/threeDShadowHelper';
import { convertLayerToThreeDPlane } from './utils/layerTo3DPlaneUtils';
import { isSceneGroupId } from './utils/sceneGroupUtils';
import {
    convert2DPixelDeltaTo3DAndIso,
    convert3DDeltaTo2DPixelsAndIso,
} from './utils/sceneGroupMoveHelper';
import { applyMovedTilesWithSmartHeight } from './utils/waeRampHelper';

const App: React.FC = () => {
    const [images, setImages] = useState<CanvasImage[]>([]);
    const [templateName, setTemplateName] = useState<string>("project");
    const [activePalette, setActivePalette] = useState<WwPaletteColor[] | null>(null);
    const hasCustomPaletteRef = useRef<boolean>(false);

    useEffect(() => {
        loadDefaultPalette().then(pal => {
            if (!hasCustomPaletteRef.current) {
                setActivePalette(prev => prev || pal);
                if (!getLoadedPalette()) {
                    setLoadedPalette(pal, 'isotem.pal');
                }
            }
        });
    }, []);

    const [history, setHistory] = useState<{ images: CanvasImage[], threeDObjects: ThreeDObject[], overlays: ProjectOverlay[] }[]>([]);
    const [redoHistory, setRedoHistory] = useState<{ images: CanvasImage[], threeDObjects: ThreeDObject[], overlays: ProjectOverlay[] }[]>([]);
    const [tileHistory, setTileHistory] = useState<CanvasImage[][]>([]);
    const [originalColorHistory, setOriginalColorHistory] = useState<CanvasImage[][]>([]);
    const [zoom, setZoom] = useState(1);
    const [overlays, setOverlays] = useState<ProjectOverlay[]>([]);
    const [overlayOpacity, setOverlayOpacity] = useState(100);
    const [overlayLayer, setOverlayLayer] = useState<OverlayLayer>('back');
    const [gridType, setGridType] = useState<GridType>('ts_full');
    const [lastActiveGrid, setLastActiveGrid] = useState<ActiveGridType>('ts_full');
    const handleSetGridType = (type: GridType) => {
        setGridType(type);
        if (type !== 'none') {
            setLastActiveGrid(type);
        }
    };
    const [transparencyColor, setTransparencyColor] = useState<RgbaColor | null>(null);
    const [tolerance, setTolerance] = useState(1);
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadConfirmation, setLoadConfirmation] = useState<{ file: File, isLegacy: boolean } | null>(null);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const [eyedropperMode, setEyedropperMode] = useState<'NONE' | 'TRANSPARENCY' | 'ORIGINAL_COLOR'>('NONE');
    const [pickedColor, setPickedColor] = useState<RgbaColor | null>(null);
    const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
    const [isGlobalDragging, setIsGlobalDragging] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [threeDObjects, setThreeDObjects] = useState<ThreeDObject[]>([]);
    const [selectedThreeDObjectId, setSelectedThreeDObjectId] = useState<string | null>(null);
    const [selectedThreeDObjectIds, setSelectedThreeDObjectIds] = useState<Set<string>>(new Set());
    const [autoGrabTrigger, setAutoGrabTrigger] = useState<number>(0);
    const [isThreeDMode, setIsThreeDMode] = useState(false);
    const [showThreeDObjects, setShowThreeDObjects] = useState(true);
    const [textureInjectionOverlayId, setTextureInjectionOverlayId] = useState<string | null>(null);
    const [isSnapEnabled, setIsSnapEnabled] = useState(true);
    const [autoSlopeSnap, setAutoSlopeSnap] = useState(true);
    const threeDCanvasRef = useRef<{ capture: () => string | null }>(null);

    const handleSelectSingleThreeDObject = useCallback((id: string | null) => {
        setSelectedThreeDObjectId(id);
        setSelectedThreeDObjectIds(id ? new Set([id]) : new Set());
    }, []);

    useEffect(() => {
        if (!textureInjectionOverlayId) {
            if (overlays.length > 0) {
                setTextureInjectionOverlayId(overlays[0].id);
            } else if (threeDObjects.length > 0) {
                setTextureInjectionOverlayId(makeThreeDTargetId('all'));
            }
        }
    }, [overlays, threeDObjects, textureInjectionOverlayId]);
    
    // Transition Stamp States
    const [stamps, setStamps] = useState<TransitionStamp[]>([]);
    const [activeStampId, setActiveStampId] = useState<string | null>(null);
    const [isStampToolOpen, setIsStampToolOpen] = useState(false);
    const [toolMode, setToolMode] = useState<ToolMode>('SELECT');
    const [isCapturingStamp, setIsCapturingStamp] = useState(false);
    const [heldImages, setHeldImages] = useState<CanvasImage[]>([]);
    const [saveIsotilesAsPng, setSaveIsotilesAsPng] = useState(false);
    const [includeThreeDInTemplate, setIncludeThreeDInTemplate] = useState(true);
    const [useTransparencyToDrag, setUseTransparencyToDrag] = useState(true);
    
    const nextId = useRef(0);
    const overlayNextId = useRef(0);
    const dragCounter = useRef(0);

    const cloneOverlays = (list: ProjectOverlay[]): ProjectOverlay[] =>
        list.map(ov => ({
            ...ov,
            filters: {
                ...ov.filters,
                additionalTextures: ov.filters.additionalTextures
                    ? ov.filters.additionalTextures.map(t => ({
                        ...t,
                        filters: t.filters ? { ...t.filters } : {}
                    }))
                    : []
            }
        }));

    const pushToHistory = useCallback((currentImages: CanvasImage[], currentThreeD: ThreeDObject[], currentOverlays: ProjectOverlay[]) => {
        setHistory(prev => [...prev.slice(-19), { 
            images: [...currentImages], 
            threeDObjects: [...currentThreeD],
            overlays: cloneOverlays(currentOverlays)
        }]);
        setRedoHistory([]);
    }, []);

    const handleUndo = useCallback(() => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setRedoHistory(rPrev => [...rPrev, {
            images: [...images],
            threeDObjects: [...threeDObjects],
            overlays: cloneOverlays(overlays)
        }]);
        clearImageCache();
        setImages(prev.images);
        setThreeDObjects(prev.threeDObjects);
        setOverlays(prev.overlays);
        setHistory(prevHist => prevHist.slice(0, -1));
    }, [history, images, threeDObjects, overlays]);

    const handleRedo = useCallback(() => {
        if (redoHistory.length === 0) return;
        const next = redoHistory[redoHistory.length - 1];
        setHistory(prev => [...prev, {
            images: [...images],
            threeDObjects: [...threeDObjects],
            overlays: cloneOverlays(overlays)
        }]);
        clearImageCache();
        setImages(next.images);
        setThreeDObjects(next.threeDObjects);
        setOverlays(next.overlays);
        setRedoHistory(rPrev => rPrev.slice(0, -1));
    }, [redoHistory, images, threeDObjects, overlays]);

    const handleUndoInjection = useCallback(() => {
        if (tileHistory.length === 0) return;
        const prev = tileHistory[tileHistory.length - 1];
        setImages(prev);
        setTileHistory(prevHist => prevHist.slice(0, -1));
    }, [tileHistory]);

    const handleUndoOriginalColor = useCallback(() => {
        if (originalColorHistory.length === 0) return;
        const prev = originalColorHistory[originalColorHistory.length - 1];
        setImages(prev);
        setOriginalColorHistory(prevHist => prevHist.slice(0, -1));
    }, [originalColorHistory]);

    const handleApplyOriginalColorAdjustment = useCallback(async (settings: OriginalColorSettings) => {
        if (selectedImageIds.size === 0) return;
        
        setOriginalColorHistory(prev => [...prev.slice(-19), [...images]]);
        
        const newImages = await Promise.all(images.map(async img => {
            if (!selectedImageIds.has(img.id)) return img;
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            
            const originalImg = new Image();
            originalImg.crossOrigin = "anonymous";
            originalImg.src = img.src;
            await new Promise(r => originalImg.onload = r);
            
            ctx.drawImage(originalImg, 0, 0);
            applyOriginalColorAdjustment(canvas, settings);
            
            const nextSrc = canvas.toDataURL();
            return { ...img, src: nextSrc, originalSrc: nextSrc };
        }));
        
        setImages(newImages);
    }, [images, selectedImageIds]);

    const handleAddStamp = useCallback((stamp: TransitionStamp) => {
        setStamps(prev => [...prev, stamp]);
    }, []);

    const handleUpdateStamp = useCallback((id: string, updates: Partial<TransitionStamp>) => {
        setStamps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    }, []);

    const handleSelectStamp = useCallback((id: string | null) => {
        setActiveStampId(id);
    }, []);

    const handleUpdateThreeDObject = useCallback((id: string, updates: Partial<ThreeDObject>, shouldPushHistory: boolean = false) => {
        if (shouldPushHistory) pushToHistory(images, threeDObjects, overlays);
        const targetObj = threeDObjects.find(o => o.id === id);
        if (
            targetObj &&
            targetObj.sceneGroupId &&
            targetObj.sceneGroupMoveTogether !== false &&
            updates.position &&
            (updates.position.x !== targetObj.position.x || updates.position.z !== targetObj.position.z)
        ) {
            const delta3DX = updates.position.x - targetObj.position.x;
            const delta3DZ = updates.position.z - targetObj.position.z;
            const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
            const { dxPixels, dyPixels, dgx, dgy } = convert3DDeltaTo2DPixelsAndIso(
                delta3DX,
                delta3DZ,
                activeGrid
            );
            const grpId = targetObj.sceneGroupId;

            setOverlays(prev =>
                prev.map(ov =>
                    ov.sceneGroupId === grpId && ov.sceneGroupMoveTogether !== false
                        ? { ...ov, x: ov.x + dxPixels, y: ov.y + dyPixels }
                        : ov
                )
            );
            setImages(prev =>
                prev.map(img =>
                    img.sceneGroupId === grpId && img.sceneGroupMoveTogether !== false
                        ? { ...img, gridX: img.gridX + dgx, gridY: img.gridY + dgy }
                        : img
                )
            );
        }
        setThreeDObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        // Only auto-select if nothing is currently selected
        setTimeout(() => {
            setSelectedThreeDObjectId(prev => prev ? prev : id);
            setSelectedThreeDObjectIds(prev => prev.size > 0 ? prev : new Set([id]));
        }, 0);
    }, [images, threeDObjects, overlays, gridType, lastActiveGrid, pushToHistory]);

    const handleSnap3DTo2D = useCallback(() => {
        const target3DIds = selectedThreeDObjectIds.size > 0
            ? Array.from(selectedThreeDObjectIds)
            : (selectedThreeDObjectId ? [selectedThreeDObjectId] : []);
        if (target3DIds.length === 0 || selectedImageIds.size === 0) return;
        
        const firstTileId = Array.from(selectedImageIds)[0];
        const tile = images.find(img => img.id === firstTileId);
        const primaryId = selectedThreeDObjectId && target3DIds.includes(selectedThreeDObjectId)
            ? selectedThreeDObjectId
            : target3DIds[0];
        const primaryObj = threeDObjects.find(o => o.id === primaryId);
        
        if (!tile || !primaryObj) return;
        
        const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
        
        // Calculate center of the grid in iso units
        const centerIso = screenToIso(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, config.width, config.height);
        
        // Displacement from center in grid units
        const di = tile.gridX - centerIso.i;
        const dj = tile.gridY - centerIso.j;
        
        const scale = (74.8 / CANVAS_HEIGHT) * (config.height);
        
        // Offset to align with tile center (0.5, 0.5 in grid units)
        const threeDZ = (di + 0.5) * scale;
        const threeDX = (dj + 0.5) * scale;

        const deltaX = threeDX - primaryObj.position.x;
        const deltaZ = threeDZ - primaryObj.position.z;

        pushToHistory(images, threeDObjects, overlays);
        const idSet = new Set(target3DIds);
        setThreeDObjects(prev => prev.map(o => {
            if (!idSet.has(o.id)) return o;
            return {
                ...o,
                position: {
                    x: o.position.x + deltaX,
                    y: o.position.y,
                    z: o.position.z + deltaZ,
                }
            };
        }));
    }, [selectedThreeDObjectId, selectedThreeDObjectIds, selectedImageIds, images, threeDObjects, overlays, gridType, pushToHistory]);

    const handleFilesChange = (files: FileList | File[]) => {
        pushToHistory(images, threeDObjects, overlays);
        setIsLoading("Preparing assets...");
        const newImages: CanvasImage[] = [];
        
        // Read each file as ArrayBuffer to inspect its type dynamically from binary structure/signature
        const fileBuffersPromises = Array.from(files).map(file => {
            return new Promise<{ file: File, buffer: ArrayBuffer }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({ file, buffer: e.target?.result as ArrayBuffer });
                };
                reader.onerror = () => {
                    resolve({ file, buffer: new ArrayBuffer(0) });
                };
                reader.readAsArrayBuffer(file);
            });
        });

        Promise.all(fileBuffersPromises).then(async (parsedFiles) => {
            // 1. Check if any file is a valid palette (JASC-PAL, 768-byte raw, or .pal file)
            let detectedPalette: WwPaletteColor[] | null = null;
            const palInfo = parsedFiles.find(p => isValidWwPal(p.buffer, p.file.name));
            if (palInfo) {
                try {
                    detectedPalette = parsePalFile(palInfo.buffer);
                    hasCustomPaletteRef.current = true;
                    setActivePalette(detectedPalette);
                    setLoadedPalette(detectedPalette, palInfo.file.name);
                    clearSurfaceCache();
                    setTransparencyColor({ r: 0, g: 0, b: 0, a: 0 });
                } catch (err: any) {
                    setError(`Failed to parse palette file: ${err.message}`);
                }
            }

            if (detectedPalette) {
                // Instantly re-render any existing loaded .tmp images and held images using the newly loaded palette
                setImages(prevImages => reRenderTmpImagesWithPalette(prevImages, detectedPalette!));
                setHeldImages(prevHeld => reRenderTmpImagesWithPalette(prevHeld, detectedPalette!));
            }

            const currentPalette = detectedPalette || getLoadedPalette() || activePalette || await loadDefaultPalette();

            // 2. Process all non-palette files
            const processPromises = parsedFiles.map(pf => {
                const { file, buffer } = pf;
                
                if (isValidWwPal(buffer, file.name)) {
                    return Promise.resolve();
                }

                return new Promise<void>((resolve) => {
                    if (isValidWwTmp(buffer)) {
                        try {
                            const parsedTmp = parseTmpFile(buffer);
                            
                            // Auto-detect game tileset format and set gridType perfectly
                            const detectedEngine = detectGridTypeForTmp(parsedTmp.cx, parsedTmp.cy, file.name, gridType);
                            handleSetGridType(detectedEngine);
                            
                            // Compose and render entire map tile group as a combined image
                            const rendered = renderTmpToPng(parsedTmp, currentPalette);
                            setTransparencyColor({ r: 0, g: 0, b: 0, a: 0 });
                            
                            const offsets = getTmpMinOffsets(parsedTmp);
                            newImages.push({
                                id: `img-${nextId.current++}`,
                                src: rendered.src,
                                originalSrc: rendered.src,
                                name: file.name,
                                gridX: 45,
                                gridY: 10,
                                offsetX: 0,
                                offsetY: 0,
                                width: rendered.width,
                                height: rendered.height,
                                flipH: false,
                                flipV: false,
                                tmpBuffer: buffer,
                                tmpMinX: offsets.minX,
                                tmpMinY: offsets.minY,
                                tmpCols: offsets.cols,
                                tmpRows: offsets.rows,
                                tmpCells: offsets.cells,
                                isIsotile: true
                            });
                        } catch (err: any) {
                            setError(`Failed parsing .TMP tileset: ${err.message}`);
                        }
                        resolve();
                    } else {
                        // Standard image file load
                        const blob = new Blob([buffer], { type: file.type || "image/png" });
                        const blobUrl = URL.createObjectURL(blob);
                        const img = new Image();
                        img.onload = () => {
                            const origCanvas = document.createElement('canvas');
                            origCanvas.width = img.width;
                            origCanvas.height = img.height;
                            const origCtx = origCanvas.getContext('2d');
                            if (origCtx) {
                                origCtx.imageSmoothingEnabled = false;
                                origCtx.drawImage(img, 0, 0);
                            }
                            const rawDataUrl = origCanvas.toDataURL('image/png');

                            const processedCanvas = processTransparency(img, transparencyColor, tolerance);
                            const src = processedCanvas.toDataURL('image/png');
                            newImages.push({
                                id: `img-${nextId.current++}`,
                                src: src,
                                originalSrc: rawDataUrl,
                                name: file.name,
                                gridX: 0,
                                gridY: 0,
                                offsetX: 0,
                                offsetY: 0,
                                width: processedCanvas.width,
                                height: processedCanvas.height,
                                flipH: false,
                                flipV: false,
                                isIsotile: true
                            });
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        };
                        img.src = blobUrl;
                    }
                });
            });

            await Promise.all(processPromises);

            if (newImages.length === 0) {
                setIsLoading(null);
                return;
            }
            
            const startX = 45;
            const startY = 10;
            
            // Inspect if a .tmp file determines the active grid config
            const anyTmp = parsedFiles.some(pf => isValidWwTmp(pf.buffer));
            
            let detectedGridType = gridType;
            if (anyTmp && newImages[0]) {
                detectedGridType = detectGridTypeForWidth(newImages[0].width, gridType);
            }
            
            const config = GRID_CONFIGS[detectedGridType] || { width: 48, height: 24 };
            const cols = Math.ceil(Math.sqrt(newImages.length));
            
            let curColX = 0;
            let curRowY = 0;
            let maxRowSpanY = 1;
            let colCount = 0;

            const arrangedNewImages = newImages.map((img) => {
                const { spanX, spanY, minCol, minRow } = getTileCellSpan(img, config.width, config.height);
                const placedX = curColX - minCol;
                const placedY = curRowY - minRow;

                curColX += spanX;
                maxRowSpanY = Math.max(maxRowSpanY, spanY);
                colCount++;

                if (colCount >= cols) {
                    curColX = 0;
                    curRowY += maxRowSpanY;
                    maxRowSpanY = 1;
                    colCount = 0;
                }

                return { 
                    ...img, 
                    gridX: placedX,
                    gridY: placedY
                };
            });
            
            setHeldImages(arrangedNewImages);
            setSelectedImageIds(new Set());
            setIsLoading(null);
        });
    };

    const handleAddFromLibrary = useCallback((filename: string) => {
        const url = `https://raw.githubusercontent.com/HollandTS/Tile_Canvas_Pro/main/TS_tiles/${filename}`;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const processedCanvas = processTransparency(img, transparencyColor, tolerance);
            const src = processedCanvas.toDataURL('image/png');
            
            const newTile: CanvasImage = {
                id: `img-${nextId.current++}`,
                src: src,
                originalSrc: url, 
                name: filename,
                gridX: 0,
                gridY: 0,
                offsetX: 0,
                offsetY: 0,
                width: img.width,
                height: img.height,
                flipH: false,
                flipV: false,
                isIsotile: true
            };
            setHeldImages([newTile]);
            setSelectedImageIds(new Set());
        };
        img.onerror = () => {
            setError(`Failed to fetch ${filename} from GitHub. Verify exact capitalization.`);
        };
        img.src = url;
    }, [gridType, transparencyColor, tolerance]);

    const handleUpdateImagePosLocal = useCallback(async (ids: string[], dgx: number, dgy: number, snapGrid: boolean) => {
        pushToHistory(images, threeDObjects, overlays);
        const idSet = new Set(ids);

        // Expand idSet to include any other Isotiles in the same Scene Group with Move Together enabled
        const movedSceneGroupIds = new Set<string>();
        images.forEach(img => {
            if (idSet.has(img.id) && img.sceneGroupId && img.sceneGroupMoveTogether !== false) {
                movedSceneGroupIds.add(img.sceneGroupId);
            }
        });
        if (movedSceneGroupIds.size > 0) {
            images.forEach(img => {
                if (img.sceneGroupId && movedSceneGroupIds.has(img.sceneGroupId) && img.sceneGroupMoveTogether !== false) {
                    idSet.add(img.id);
                }
            });

            const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
            const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
            const dxPixels = (dgx - dgy) * (config.width / 2);
            const dyPixels = (dgx + dgy) * (config.height / 2);
            const { delta3DX, delta3DZ } = convert2DPixelDeltaTo3DAndIso(dxPixels, dyPixels, activeGrid);

            setOverlays(prev =>
                prev.map(ov =>
                    ov.sceneGroupId && movedSceneGroupIds.has(ov.sceneGroupId) && ov.sceneGroupMoveTogether !== false
                        ? { ...ov, x: ov.x + dxPixels, y: ov.y + dyPixels }
                        : ov
                )
            );
            setThreeDObjects(prev =>
                prev.map(obj =>
                    obj.sceneGroupId && movedSceneGroupIds.has(obj.sceneGroupId) && obj.sceneGroupMoveTogether !== false
                        ? {
                              ...obj,
                              position: {
                                  x: obj.position.x + delta3DX,
                                  y: obj.position.y,
                                  z: obj.position.z + delta3DZ,
                              },
                          }
                        : obj
                )
            );
        }

        const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
        const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

        setImages(prevImages =>
            applyMovedTilesWithSmartHeight(
                prevImages,
                idSet,
                dgx,
                dgy,
                snapGrid,
                autoSlopeSnap,
                config.width,
                config.height
            )
        );
    }, [images, threeDObjects, overlays, gridType, lastActiveGrid, autoSlopeSnap, pushToHistory]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if (e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelectedImageIds(new Set(images.map(img => img.id)));
            }
            if (isThreeDMode && (selectedThreeDObjectIds.size > 0 || selectedThreeDObjectId) && (e.key === 'Delete' || (e.key.toLowerCase() === 'x' && !e.shiftKey && !e.ctrlKey && !e.metaKey))) {
                // Only delete 3D objects if Delete is pressed (or X when not in an active transform)
                if (e.key === 'Delete') {
                    e.preventDefault();
                    const idsToRemove = selectedThreeDObjectIds.size > 0
                        ? selectedThreeDObjectIds
                        : new Set(selectedThreeDObjectId ? [selectedThreeDObjectId] : []);
                    pushToHistory(images, threeDObjects, overlays);
                    setThreeDObjects(prev => prev.filter(o => !idsToRemove.has(o.id)));
                    setSelectedThreeDObjectId(null);
                    setSelectedThreeDObjectIds(new Set());
                    return;
                }
            }
            if (!isThreeDMode && selectedImageIds.size > 0 && (e.key === 'Delete' || e.key.toLowerCase() === 'x')) {
                e.preventDefault();
                setImages(prev => prev.filter(img => !selectedImageIds.has(img.id)));
                setSelectedImageIds(new Set());
            }
            if (selectedImageIds.size > 0 && !(isThreeDMode && (selectedThreeDObjectId || selectedThreeDObjectIds.size > 0)) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                // Move exactly 1 grid step along isometric alignment always
                const dgx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                const dgy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
                handleUpdateImagePosLocal(Array.from(selectedImageIds), dgx, dgy, true);
            }
            if (!isThreeDMode && selectedImageIds.size > 0 && (e.key === '[' || e.key === ']' || e.key === 'PageUp' || e.key === 'PageDown')) {
                e.preventDefault();
                const delta = (e.key === ']' || e.key === 'PageUp') ? 1 : -1;
                pushToHistory(images, threeDObjects, overlays);
                setImages(prev => prev.map(img =>
                    selectedImageIds.has(img.id)
                        ? { ...img, heightLevel: (img.heightLevel ?? 0) + delta }
                        : img
                ));
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            }
            if (e.key.toLowerCase() === 'c') {
                e.preventDefault();
                handleSnap3DTo2D();
            }
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
                if (selectedThreeDObjectId || selectedThreeDObjectIds.size > 0) {
                    e.preventDefault();
                    handleDuplicateThreeDObject();
                }
            }
            if (e.key === 'Escape') {
                setHeldImages([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImageIds, handleUpdateImagePosLocal, handleUndo, handleRedo, handleSnap3DTo2D, selectedThreeDObjectId, selectedThreeDObjectIds, isThreeDMode, threeDObjects, overlays, isSnapEnabled, zoom, gridType, lastActiveGrid, heldImages, images, pushToHistory]);

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (e.dataTransfer?.types.includes('Files')) {
                setIsGlobalDragging(true);
            }
        };
        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current <= 0) {
                dragCounter.current = 0;
                setIsGlobalDragging(false);
            }
        };
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current = 0;
            setIsGlobalDragging(false);
        };
        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);
        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    const handleFlipImages = (axis: 'h' | 'v') => {
      pushToHistory(images, threeDObjects, overlays);
      setImages(prev => prev.map(img => {
        if (selectedImageIds.has(img.id)) {
          return { ...img, flipH: axis === 'h' ? !img.flipH : img.flipH, flipV: axis === 'v' ? !img.flipV : img.flipV };
        }
        return img;
      }));
    };

    const handlePackIsometric = () => {
      if (selectedImageIds.size < 2) return;
      pushToHistory(images, threeDObjects, overlays);
      
      const selectedImages = images.filter(img => selectedImageIds.has(img.id));
      const posMap = calculatePackedPositions(selectedImages, gridType);

      setImages(prev => prev.map(img => {
          const nextPos = posMap.get(img.id);
          return nextPos ? { ...img, ...nextPos } : img;
      }));
    };

    const handleColorPack = async () => {
        if (selectedImageIds.size < 2) return;
        setIsLoading("Sorting by hue...");
        pushToHistory(images, threeDObjects, overlays);
        
        const selectedImages = images.filter(img => selectedImageIds.has(img.id));
        const posMap = await calculateColorPackedPositions(selectedImages, gridType);

        setImages(prev => prev.map(img => {
            const nextPos = posMap.get(img.id);
            return nextPos ? { ...img, ...nextPos } : img;
        }));
        setIsLoading(null);
    };

    const handleApplyContour = useCallback(async (ids: Set<string>, settings: ContourSettings) => {
        if (ids.size === 0) return;
        if (!settings.targetColor && settings.maskGroups.length === 0) {
            setError("Please pick an anchor color or define a group first.");
            return;
        }
        setIsLoading("Rendering anchored transitions...");
        pushToHistory(images, threeDObjects, overlays);
        
        // Sequential processing for memory safety
        const updatedImages = [...images];
        for (let i = 0; i < updatedImages.length; i++) {
            const image = updatedImages[i];
            if (!ids.has(image.id)) continue;
            
            const newImg = await new Promise<CanvasImage>((resolve) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    canvas.width = img.width; canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    applyContourEffect(ctx, settings, transparencyColor, tolerance);
                    const newSrc = canvas.toDataURL('image/png');
                    resolve({ ...image, src: newSrc, originalSrc: newSrc });
                };
                img.src = image.src;
            });
            updatedImages[i] = newImg;
        }
        setImages(updatedImages);
        setIsLoading(null);
    }, [images, pushToHistory, transparencyColor, tolerance]);

    const handleUpdateOverlay = useCallback((id: string, updates: Partial<ProjectOverlay>, shouldPushHistory: boolean = false) => {
        if (shouldPushHistory) pushToHistory(images, threeDObjects, overlays);
        clearImageCache();

        const existingTarget = overlays.find(ov => ov.id === id);
        if (existingTarget) {
            const hasPosChange =
                (updates.x !== undefined && updates.x !== existingTarget.x) ||
                (updates.y !== undefined && updates.y !== existingTarget.y);
            if (hasPosChange && existingTarget.sceneGroupId && existingTarget.sceneGroupMoveTogether !== false) {
                const dx = updates.x !== undefined ? updates.x - existingTarget.x : 0;
                const dy = updates.y !== undefined ? updates.y - existingTarget.y : 0;
                const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
                const { delta3DX, delta3DZ, dgx, dgy } = convert2DPixelDeltaTo3DAndIso(
                    dx,
                    dy,
                    activeGrid
                );
                const grpId = existingTarget.sceneGroupId;

                setThreeDObjects(prev =>
                    prev.map(obj =>
                        obj.sceneGroupId === grpId && obj.sceneGroupMoveTogether !== false
                            ? {
                                  ...obj,
                                  position: {
                                      x: obj.position.x + delta3DX,
                                      y: obj.position.y,
                                      z: obj.position.z + delta3DZ,
                                  },
                              }
                            : obj
                    )
                );
                setImages(prev =>
                    prev.map(img =>
                        img.sceneGroupId === grpId && img.sceneGroupMoveTogether !== false
                            ? { ...img, gridX: img.gridX + dgx, gridY: img.gridY + dgy }
                            : img
                    )
                );
            }
        }

        setOverlays(prev => {
            const target = prev.find(ov => ov.id === id);
            if (!target) {
                if (id.startsWith('3d-obj:') || isAllLayersTargetId(id) || isSceneGroupId(id)) {
                    const isAllLayers = isAllLayersTargetId(id);
                    const isSceneGrp = isSceneGroupId(id);
                    const objId = isAllLayers || isSceneGrp ? 'all' : id.slice('3d-obj:'.length);
                    const matchedObj = threeDObjects.find(o => o.id === objId);
                    const grpName = isSceneGrp
                        ? (prev.find(o => o.sceneGroupId === id)?.sceneGroupName ||
                           threeDObjects.find(o => o.sceneGroupId === id)?.sceneGroupName ||
                           images.find(i => i.sceneGroupId === id)?.sceneGroupName ||
                           'Scene Group')
                        : '';
                    const newVirtualOverlay: ProjectOverlay = {
                        id,
                        name: isAllLayers
                            ? 'All Layers (3D + Visible 2D Stack)'
                            : isSceneGrp
                            ? `Group: ${grpName}`
                            : (objId === 'all' ? 'All 3D Objects (Scene)' : `3D: ${matchedObj?.name || 'Object'}`),
                        type: 'tiled',
                        src: id,
                        repeatX: 1,
                        repeatY: 1,
                        x: 0,
                        y: 0,
                        width: CANVAS_WIDTH,
                        height: CANVAS_HEIGHT,
                        opacity: 100,
                        isVisible: true,
                        placement: overlayLayer,
                        filters: {
                            ...DEFAULT_FILTERS,
                            staticScale: 100,
                            maskGroups: [],
                            maskOverlayIds: [],
                            colorSwaps: [],
                            maskEntries: [],
                        },
                        ...updates,
                    };
                    return [...prev, newVirtualOverlay];
                }
                return prev;
            }

            const hasPosChange = (updates.x !== undefined && updates.x !== target.x) || (updates.y !== undefined && updates.y !== target.y);
            if (hasPosChange && (target.linkGroupId || (target.sceneGroupId && target.sceneGroupMoveTogether !== false))) {
                const dx = updates.x !== undefined ? updates.x - target.x : 0;
                const dy = updates.y !== undefined ? updates.y - target.y : 0;
                return prev.map(ov => {
                    if (ov.id === id) {
                        return { ...ov, ...updates };
                    }
                    const sameLink = Boolean(target.linkGroupId && ov.linkGroupId === target.linkGroupId);
                    const sameSceneGroup = Boolean(
                        target.sceneGroupId &&
                        target.sceneGroupMoveTogether !== false &&
                        ov.sceneGroupId === target.sceneGroupId &&
                        ov.sceneGroupMoveTogether !== false
                    );
                    if (sameLink || sameSceneGroup) {
                        return {
                            ...ov,
                            x: ov.x + dx,
                            y: ov.y + dy
                        };
                    }
                    return ov;
                });
            }

            return prev.map(ov => ov.id === id ? { ...ov, ...updates } : ov);
        });
    }, [images, threeDObjects, overlays, overlayLayer, gridType, lastActiveGrid, pushToHistory]);

    const handleAddTextureSource = (src: string, isFourInOne: boolean = false, customName?: string) => {
        const initialFootprint = 100;
        const newOverlay: ProjectOverlay = {
            id: `ov-${overlayNextId.current}`,
            name: customName || `Texture ${overlayNextId.current}`,
            type: 'tiled',
            src: src,
            repeatX: 1,
            repeatY: 1,
            x: 400,
            y: 400,
            width: 0,
            height: 0,
            opacity: 100,
            isVisible: true,
            placement: overlayLayer,
            filters: { 
                ...DEFAULT_FILTERS, 
                staticScale: initialFootprint,
                maskGroups: [],
                colorSwaps: [],
                maskEntries: []
            },
            isFourInOne: isFourInOne
        };
        setOverlays(prev => [...prev, newOverlay]);
        overlayNextId.current++;
    };

    const handleAddOverlaySource = (src: string) => {
        const initialFootprint = 100;
        const img = new Image();
        img.onload = () => {
            const newOverlay: ProjectOverlay = {
                id: `ov-${Date.now()}-${overlayNextId.current++}`,
                name: `Overlay ${overlayNextId.current}`,
                type: 'smart',
                src: src,
                repeatX: 1,
                repeatY: 1,
                x: 400,
                y: 400,
                width: img.width,
                height: img.height,
                opacity: 100,
                isVisible: true,
                placement: overlayLayer,
                filters: { 
                    ...DEFAULT_FILTERS, 
                    staticScale: initialFootprint,
                    maskGroups: [],
                    maskOverlayIds: [],
                    colorSwaps: [],
                    maskEntries: []
                }
            };
            setOverlays(prev => [...prev, newOverlay]);
        };
        img.src = src;
    };

    const handleAddSmartOverlayAtPosition = useCallback((src: string, x: any, y?: number, w?: number, h?: number) => {
        let xVal = 0;
        let yVal = 0;
        let wVal = 100;
        let hVal = 100;
        
        if (typeof x === 'object' && x !== null) {
            xVal = x.x;
            yVal = x.y;
            wVal = x.width;
            hVal = x.height;
        } else {
            xVal = Number(x) || 0;
            yVal = Number(y) || 0;
            wVal = Number(w) || 100;
            hVal = Number(h) || 100;
        }

        pushToHistory(images, threeDObjects, overlays);
        const newOverlay: ProjectOverlay = {
            id: `ov-${Date.now()}-${overlayNextId.current++}`,
            name: `AI Depth Overlay ${overlayNextId.current}`,
            type: 'smart',
            src: src,
            repeatX: 1,
            repeatY: 1,
            x: xVal,
            y: yVal,
            width: wVal,
            height: hVal,
            initialX: xVal,
            initialY: yVal,
            initialWidth: wVal,
            initialHeight: hVal,
            isResizing: false,
            opacity: 100,
            isVisible: true,
            placement: 'front',
            filters: { 
                ...DEFAULT_FILTERS, 
                staticScale: 100,
                maskGroups: [],
                maskOverlayIds: [],
                colorSwaps: [],
                maskEntries: []
            }
        };
        setOverlays(prev => [...prev, newOverlay]);
    }, [images, threeDObjects, overlays, pushToHistory]);

    const [isAiGenerating, setIsAiGenerating] = useState<string | null>(null);

    const handleAiGenerateTexture = async (overlayId: string) => {
        const ov = overlays.find(o => o.id === overlayId);
        if (!ov || !ov.src) return;

        setIsAiGenerating(overlayId);
        try {
            const resultBase64 = await generateSimilarTexture(ov.src);
            const slices = await sliceImageInto4(resultBase64);
            
            const newTextures: AdditionalTexture[] = slices.map(src => ({
                src,
                weight: 50,
                canvasZoom: 100,
                filters: { ...DEFAULT_FILTERS }
            }));

            pushToHistory(images, threeDObjects, overlays);
            setOverlays(prev => prev.map(o => o.id === overlayId ? {
                ...o,
                filters: {
                    ...o.filters,
                    additionalTextures: [...(o.filters.additionalTextures || []), ...newTextures]
                }
            } : o));
        } catch (error: any) {
            console.error("AI Texture Generation Error:", error);
            alert(error.message || "Failed to generate similar texture.");
        } finally {
            setIsAiGenerating(null);
        }
    };

    const handleAddAdditionalTexture = (overlayId: string, src: string) => {
        pushToHistory(images, threeDObjects, overlays);
        setOverlays(prev => prev.map(ov => {
            if (ov.id !== overlayId) return ov;
            const next: AdditionalTexture = { 
                src, 
                weight: 50, 
                canvasZoom: 100, 
                filters: { ...DEFAULT_FILTERS } 
            };
            return {
                ...ov,
                filters: {
                    ...ov.filters,
                    additionalTextures: [...ov.filters.additionalTextures, next]
                }
            };
        }));
    };

    const handleSnapOverlayToTile = useCallback((overlayId: string) => {
        const ov = overlays.find(o => o.id === overlayId);
        if (!ov) return;
        
        let targetTile: CanvasImage | null = null;
        if (selectedImageIds.size === 1) {
            targetTile = images.find(img => selectedImageIds.has(img.id)) || null;
        } else {
            const cx = ov.x + (ov.width || 0) / 2;
            const cy = ov.y + (ov.height || 0) / 2;
            const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
            
            let minDist = Infinity;
            images.forEach(img => {
                const pos = isoToScreen(img.gridX, img.gridY, config.width, config.height);
                const dx = pos.x - cx;
                const dy = pos.y - cy;
                const dist = dx*dx + dy*dy;
                if (dist < minDist) {
                    minDist = dist;
                    targetTile = img;
                }
            });
        }

        if (targetTile) {
            const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
            const drawPos = getImageDrawPos(targetTile, config.width, config.height);
            const drawX = Math.floor(drawPos.x) + targetTile.offsetX;
            const drawY = Math.floor(drawPos.y) + targetTile.offsetY;
            
            handleUpdateOverlay(overlayId, {
                x: drawX,
                y: drawY,
                width: targetTile.width,
                height: targetTile.height
            });
        }
    }, [overlays, images, selectedImageIds, gridType, handleUpdateOverlay]);

    const handleGenerateTexture = async (prompt: string, isFourInOne: boolean = false) => {
        setIsLoading("Generating high-detail texture...");
        try {
            const textureSrc = await generateSeamlessTexture(prompt);
            handleAddTextureSource(textureSrc, isFourInOne);
        } catch (e: any) { setError(e.message); }
        finally { setIsLoading(null); }
    };

    const handleExecuteLayoutCommand = async (prompt: string) => {
      if (!prompt) return;
      setIsLoading("AI Brain is calculating layout...");
      pushToHistory(images, threeDObjects, overlays);
      try {
        const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
        const mappedImages = images.map(img => {
            const pos = isoToScreen(img.gridX, img.gridY, config.width, config.height);
            return { ...img, x: pos.x, y: pos.y };
        });
        const result = await getLayoutCommand(prompt, mappedImages as any, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
        setImages(prev => prev.map(img => {
          const update = result.updates.find(u => u.id === img.id);
          if (update) {
              const iso = screenToIso(update.x, update.y, config.width, config.height);
              return { ...img, gridX: Math.round(iso.i), gridY: Math.round(iso.j) };
          }
          return img;
        }));
      } catch (e: any) { setError(e.message); }
      finally { setIsLoading(null); }
    };

    const handleSaveTemplate = async () => {
        const defaultName = templateName ? templateName.trim() : `project-${new Date().toISOString().slice(0,10)}`;
        let fileName = defaultName;

        setIsLoading("Creating project package...");
        try {
            const projectData: ProjectData = {
                version: "2.0",
                name: templateName,
                images,
                overlays,
                threeDObjects: includeThreeDInTemplate ? threeDObjects : [],
                gridType,
                lastActiveGrid,
                transparencyColor: transparencyColor ? `rgba(${transparencyColor.r},${transparencyColor.g},${transparencyColor.b},${transparencyColor.a})` : 'none',
                tolerance,
                zoom,
                overlayOpacity,
                overlayLayer,
                palette: activePalette || undefined,
                stamps,
                timestamp: Date.now()
            };

            const content = await saveProject(projectData);
            const link = document.createElement('a');
            const url = URL.createObjectURL(content);
            link.href = url;
            link.download = fileName.endsWith('.tileproject') ? fileName : `${fileName}.tileproject`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Delay revocation to ensure download starts
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e: any) {
            console.error("Save Error:", e);
            setError("Save failed: " + e.message);
        } finally {
            setIsLoading(null);
        }
    };

    const handleLoadTemplate = async (file: File, intoExisting: boolean = false) => {
        setIsLoading("Loading project...");
        
        try {
            const project = await loadProject(file);
            
            // Name the project to the loaded project's name
            const loadedProjectName = (project.name && project.name.trim()) 
                ? project.name.trim() 
                : file.name.replace(/\.[^/.]+$/, "").replace(/_template$/, "");
            if (loadedProjectName) {
                setTemplateName(loadedProjectName);
            }

            // Restore saved grid option first so any subsequent operations use the saved grid
            if (project.lastActiveGrid) {
                setLastActiveGrid(project.lastActiveGrid);
            }
            if (project.gridType) {
                handleSetGridType(project.gridType);
            }

            // Load the palette that was loaded in that project
            if (project.palette && project.palette.length > 0) {
                hasCustomPaletteRef.current = true;
                setActivePalette(project.palette);
                setLoadedPalette(project.palette);
                clearSurfaceCache();
                project.images = reRenderTmpImagesWithPalette(project.images, project.palette);
            }

            // Build old -> new ID maps so cross-references (wallOverlayId, textureOverlayId, maskOverlayIds, etc.) stay intact
            const overlayIdMap = new Map<string, string>();
            const threeDIdMap = new Map<string, string>();

            const remapProjectItems = (
                rawImages: CanvasImage[],
                rawOverlays: ProjectOverlay[],
                rawThreeD: ThreeDObject[]
            ) => {
                const mappedImages = rawImages.map(img => ({
                    ...img,
                    id: `img-${Date.now()}-${nextId.current++}`
                }));

                // Pass 1: assign new IDs to non-virtual overlays
                const tempOverlays = rawOverlays.map(ov => {
                    if (ov.id.startsWith('3d-obj:') || isAllLayersTargetId(ov.id) || isSceneGroupId(ov.id)) {
                        return ov;
                    }
                    const newId = `overlay-${Date.now()}-${overlayNextId.current++}`;
                    overlayIdMap.set(ov.id, newId);
                    return { ...ov, id: newId };
                });

                // Pass 2: assign new IDs to 3D objects and remap overlay references
                const mappedThreeD = rawThreeD.map(obj => {
                    const newId = `3d-${Date.now()}-${nextId.current++}`;
                    threeDIdMap.set(obj.id, newId);
                    return {
                        ...obj,
                        id: newId,
                        textureOverlayId: obj.textureOverlayId
                            ? (overlayIdMap.get(obj.textureOverlayId) || obj.textureOverlayId)
                            : obj.textureOverlayId,
                        cliffShapingSettings: obj.cliffShapingSettings
                            ? {
                                  ...obj.cliffShapingSettings,
                                  wallOverlayId: obj.cliffShapingSettings.wallOverlayId
                                      ? (overlayIdMap.get(obj.cliffShapingSettings.wallOverlayId) ||
                                         obj.cliffShapingSettings.wallOverlayId)
                                      : obj.cliffShapingSettings.wallOverlayId,
                              }
                            : obj.cliffShapingSettings,
                        slopeShapingSettings: obj.slopeShapingSettings
                            ? {
                                  ...obj.slopeShapingSettings,
                                  slopeOverlayId: obj.slopeShapingSettings.slopeOverlayId
                                      ? (overlayIdMap.get(obj.slopeShapingSettings.slopeOverlayId) ||
                                         obj.slopeShapingSettings.slopeOverlayId)
                                      : obj.slopeShapingSettings.slopeOverlayId,
                              }
                            : obj.slopeShapingSettings,
                        shadowSettings: obj.shadowSettings
                            ? {
                                  ...obj.shadowSettings,
                                  targetLayerId: obj.shadowSettings.targetLayerId
                                      ? (overlayIdMap.get(obj.shadowSettings.targetLayerId) ||
                                         obj.shadowSettings.targetLayerId)
                                      : obj.shadowSettings.targetLayerId,
                              }
                            : obj.shadowSettings,
                    };
                });

                // Pass 3: remap virtual 3d-obj: overlay IDs and internal filter references
                const mappedOverlays = tempOverlays.map(ov => {
                    let finalId = ov.id;
                    let finalSrc = ov.src;
                    if (ov.id.startsWith('3d-obj:')) {
                        const oldObjId = ov.id.slice('3d-obj:'.length);
                        const newObjId = threeDIdMap.get(oldObjId) || oldObjId;
                        finalId = `3d-obj:${newObjId}`;
                        finalSrc = finalId;
                    }
                    const f = ov.filters;
                    const remappedFilters = f
                        ? {
                              ...f,
                              maskOverlayIds: f.maskOverlayIds
                                  ? f.maskOverlayIds.map(mid => (mid ? overlayIdMap.get(mid) || mid : null))
                                  : f.maskOverlayIds,
                              transitionOverlayId: f.transitionOverlayId
                                  ? overlayIdMap.get(f.transitionOverlayId) || f.transitionOverlayId
                                  : f.transitionOverlayId,
                              depthSettings: f.depthSettings
                                  ? {
                                        ...f.depthSettings,
                                        depthOverlayId: f.depthSettings.depthOverlayId
                                            ? overlayIdMap.get(f.depthSettings.depthOverlayId) ||
                                              f.depthSettings.depthOverlayId
                                            : f.depthSettings.depthOverlayId,
                                    }
                                  : f.depthSettings,
                          }
                        : f;
                    return {
                        ...ov,
                        id: finalId,
                        src: finalSrc,
                        filters: remappedFilters,
                    };
                });

                return { mappedImages, mappedOverlays, mappedThreeD };
            };

            if (!intoExisting) {
                clearImageCache();
                clearSurfaceCache();
                setHeldImages([]);
                setSelectedImageIds(new Set());
                setSelectedThreeDObjectId(null);
                setSelectedThreeDObjectIds(new Set());

                const { mappedImages, mappedOverlays, mappedThreeD } = remapProjectItems(
                    project.images || [],
                    project.overlays || [],
                    project.threeDObjects || []
                );
                
                setImages(mappedImages);
                setOverlays(mappedOverlays);
                setThreeDObjects(mappedThreeD);
                if (mappedThreeD.length > 0) {
                    setShowThreeDObjects(true);
                }

                if (project.transparencyColor && project.transparencyColor !== 'none') {
                    const match = project.transparencyColor.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
                    if (match) {
                        setTransparencyColor({
                            r: parseInt(match[1]),
                            g: parseInt(match[2]),
                            b: parseInt(match[3]),
                            a: match[4] ? parseFloat(match[4]) : 1
                        });
                    }
                } else if (project.transparencyColor === 'none') {
                    setTransparencyColor(null);
                }
                if (project.tolerance !== undefined) setTolerance(project.tolerance);
                if (project.zoom) setZoom(project.zoom);
                if (project.overlayOpacity) setOverlayOpacity(project.overlayOpacity);
                if (project.overlayLayer) setOverlayLayer(project.overlayLayer);
                if (project.stamps) setStamps(project.stamps);
            } else {
                // Merge into existing - RE-ID to avoid key collisions
                pushToHistory(images, threeDObjects, overlays);
                if (project.palette && project.palette.length > 0) {
                    setImages(prev => reRenderTmpImagesWithPalette(prev, project.palette!));
                }
                
                const { mappedImages, mappedOverlays, mappedThreeD } = remapProjectItems(
                    project.images || [],
                    project.overlays || [],
                    project.threeDObjects || []
                );
                const reIdStamps = (project.stamps || []).map((s: any) => ({
                    ...s,
                    id: `stamp-${Date.now()}-${Math.random()}`
                }));

                setImages(prev => [...prev, ...mappedImages]);
                setOverlays(prev => [...prev, ...mappedOverlays]);
                setThreeDObjects(prev => [...prev, ...mappedThreeD]);
                setStamps(prev => [...prev, ...reIdStamps]);
                if (mappedThreeD.length > 0) {
                    setShowThreeDObjects(true);
                }
            }

        } catch (err: any) {
            setError("Load failed: " + err.message);
        } finally {
            setIsLoading(null);
        }
    };

    const handleLoadLegacyJson = (file: File, intoExisting: boolean = false) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!intoExisting) {
                    setImages([]);
                    setOverlays([]);
                    setThreeDObjects([]);
                    nextId.current = 0;
                    overlayNextId.current = 0;
                }
                pushToHistory(images, threeDObjects, overlays);
                const legacy = JSON.parse(e.target?.result as string);
                if (!legacy.canvas_items) throw new Error("Invalid legacy JSON format.");
                
                const loadedProjectName = (legacy.name && legacy.name.trim()) 
                    ? legacy.name.trim() 
                    : file.name.replace(/\.[^/.]+$/, "").replace(/_template$/, "");
                if (loadedProjectName) {
                    setTemplateName(loadedProjectName);
                }
                
                setIsLoading("Searching GitHub Repo...");
                const gridName = legacy.settings?.selected_grid || "";
                // Map legacy ts_small to modern perfectly-tiling ts_full
                const currentGridType: GridType = 'ts_full';
                handleSetGridType(currentGridType);
                const config = GRID_CONFIGS[currentGridType]!;

                const newImages: CanvasImage[] = [];
                const loadPromises = legacy.canvas_items.map((item: any) => {
                    return new Promise<void>((resolve) => {
                        const filename = item.filepath.split(/[\\/]/).pop();
                        const url = `https://raw.githubusercontent.com/HollandTS/Tile_Canvas_Pro/main/TS_tiles/${filename}`;
                        
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            const processedCanvas = processTransparency(img, null, tolerance);
                            const src = processedCanvas.toDataURL('image/png');
                            const anchorX = item.x + (img.width / 2);
                            const anchorY = item.y - config.height + img.height;
                            const iso = screenToIso(anchorX, anchorY, config.width, config.height);
                            newImages.push({
                                id: `img-${nextId.current++}`,
                                src: src,
                                originalSrc: url,
                                name: filename,
                                gridX: Math.round(iso.i),
                                gridY: Math.round(iso.j),
                                offsetX: 0,
                                offsetY: 0,
                                width: img.width,
                                height: img.height,
                                flipH: false,
                                flipV: false,
                                isIsotile: true
                            });
                            resolve();
                        };
                        img.onerror = () => {
                            console.warn(`Legacy asset 404: ${filename}`);
                            resolve();
                        };
                        img.src = url;
                    });
                });

                await Promise.all(loadPromises);
                if (newImages.length === 0) {
                    setError("No images could be loaded from GitHub source.");
                } else {
                    setImages(prev => [...prev, ...newImages]);
                }
                setIsLoading(null);
            } catch (err) {
                setIsLoading(null);
                setError("Legacy Load Fail: " + (err as Error).message);
            }
        };
        reader.readAsText(file);
    };

    const handleClearCanvas = () => {
        pushToHistory(images, threeDObjects, overlays);
        clearImageCache();
        clearSurfaceCache();
        setImages([]);
        setHeldImages([]);
        setOverlays([]);
        setThreeDObjects([]);
        setStamps([]);
        setActiveStampId(null);
        setTransparencyColor(null);
        setSelectedImageIds(new Set());
        setSelectedThreeDObjectId(null);
        setSelectedThreeDObjectIds(new Set());
        setTextureInjectionOverlayId(null);
        setTileHistory([]);
        setOriginalColorHistory([]);
    };

    const handleClearOverlay = (id: string) => {
        pushToHistory(images, threeDObjects, overlays);
        setOverlays(prev => prev.filter(ov => ov.id !== id));
    };

    const { handleSelectLatOption } = useLatHandler({
        gridType,
        lastActiveGrid,
        activePalette,
        images,
        threeDObjects,
        overlays,
        nextId,
        setImages,
        setSelectedImageIds,
        setHeldImages,
        pushToHistory,
        handleClearCanvas,
        setIsLoading,
        setError,
    });

    const handleApplyMaskToImages = useCallback(async (overlay: ProjectOverlay) => {
        const targetIds = selectedImageIds.size > 0 ? selectedImageIds : new Set(images.map(img => img.id));
        if (targetIds.size === 0 && images.length === 0) {
            return;
        }
        
        setIsLoading(selectedImageIds.size === 0 ? "Injecting texture to all..." : "Injecting texture to selection...");
        pushToHistory(images, threeDObjects, overlays);
        setTileHistory(prev => [...prev.slice(-19), [...images]]);
        clearImageCache();
        
        const foundOv = overlays.find(o => o.id === overlay.id) || overlay;
        const latestOverlay = { ...foundOv, isVisible: true };
        
        if (!latestOverlay.src) {
            setIsLoading(null);
            return;
        }

        const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
        const batchCache = new Map<string, HTMLCanvasElement>();
        const updatedImages = [...images];

        for (let i = 0; i < updatedImages.length; i++) {
            const image = updatedImages[i];
            if (!targetIds.has(image.id)) continue;
            
            try {
                const newSrc = await bakeOverlaysToTile(
                    image,
                    [latestOverlay],
                    activeGrid,
                    transparencyColor,
                    tolerance,
                    overlays,
                    batchCache
                );
                updatedImages[i] = {
                    ...image,
                    src: newSrc,
                    originalSrc: newSrc,
                    flipH: false,
                    flipV: false,
                    renderMode: latestOverlay.filters.renderMode || 'pixel'
                };
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
            } catch (err) {
                console.error("Failed to process image", image.id, err);
            }
        }
        
        setImages(updatedImages);
        if (overlay.type === 'smart') {
            setOverlays(prev => prev.map(o => o.id === overlay.id ? { ...o, isVisible: false } : o));
        }
        clearImageCache();
        setIsLoading(null);
    }, [images, overlays, threeDObjects, transparencyColor, tolerance, gridType, lastActiveGrid, pushToHistory, selectedImageIds]);

    const handleBakeSmartOverlay = useCallback(async (overlayId: string) => {
        const ov = overlays.find(o => o.id === overlayId);
        if (!ov) return;
        
        setIsLoading(`Baking ${ov.name} to tiles...`);
        pushToHistory(images, threeDObjects, overlays);
        setTileHistory(prev => [...prev.slice(-19), [...images]]);
        clearImageCache();

        try {
            const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
            const batchCache = new Map<string, HTMLCanvasElement>();
            const updatedImages = [...images];
            for (let i = 0; i < updatedImages.length; i++) {
                const image = updatedImages[i];
                const newSrc = await bakeOverlaysToTile(image, [ov], activeGrid, transparencyColor, tolerance, overlays, batchCache);
                updatedImages[i] = {
                    ...image,
                    src: newSrc,
                    originalSrc: newSrc,
                    flipH: false,
                    flipV: false,
                    renderMode: ov.filters.renderMode || 'pixel'
                };
            }
            
            setImages(updatedImages);
            setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, isVisible: false } : o));
            clearImageCache();
        } catch (err: any) {
            setError("Bake failed: " + err.message);
        } finally {
            setIsLoading(null);
        }
    }, [images, overlays, gridType, lastActiveGrid, transparencyColor, tolerance, threeDObjects, pushToHistory]);

    const handleApplyChanges = async () => {
        if (overlays.length === 0) return;
        setIsLoading("Baking all layers...");
        pushToHistory(images, threeDObjects, overlays);
        setTileHistory(prev => [...prev.slice(-19), [...images]]);
        clearImageCache();
        
        try {
            const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
            // Create a full scene snapshot for accurate baking
            const snapshot = document.createElement('canvas');
            snapshot.width = CANVAS_WIDTH;
            snapshot.height = CANVAS_HEIGHT;
            const sCtx = snapshot.getContext('2d')!;
            
            // Render all visible non-injection overlays to the snapshot
            for (const ov of overlays) {
                if (!ov.isVisible) continue;
                
                const f = ov.filters;
                const isInjection = f.globalMode || (f.maskToColor && f.maskGroups.length > 0);
                if (isInjection) continue;

                const ovImg = await loadImage(ov.src);
                if (ovImg) {
                    sCtx.save();
                    sCtx.globalAlpha = ov.opacity / 100;
                    renderOverlayToCanvas(sCtx, ov, ovImg, 0, 0, GRID_CONFIGS[activeGrid], CANVAS_WIDTH, CANVAS_HEIGHT);
                    sCtx.restore();
                }
            }

            // Also capture 3D if active
            if (isThreeDMode && threeDCanvasRef.current) {
                const threeDData = threeDCanvasRef.current.capture();
                if (threeDData) {
                    const threeDImg = await loadImage(threeDData);
                    if (threeDImg) {
                        sCtx.globalAlpha = 1.0;
                        sCtx.drawImage(threeDImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    }
                }
            }

            const updatedImages = [...images];
            const cache = new Map();
            const activeOverlayWithMode = overlays.find(o => o.isVisible && (o.filters.renderMode === 'smooth' || o.filters.renderMode === 'crisp'));
            for (let i = 0; i < updatedImages.length; i++) {
                const image = updatedImages[i];
                // Use the snapshot for baking
                const newSrc = await bakeOverlaysToTile(image, overlays, activeGrid, transparencyColor, tolerance, overlays, cache, snapshot, { x: 0, y: 0 });
                updatedImages[i] = {
                    ...image,
                    src: newSrc,
                    originalSrc: newSrc,
                    flipH: false,
                    flipV: false,
                    renderMode: activeOverlayWithMode ? activeOverlayWithMode.filters.renderMode : (image.renderMode || 'pixel')
                };
                if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
            }
            
            setImages(updatedImages);
            clearImageCache();
        } catch (err: any) {
            setError("Bake failed: " + err.message);
        } finally {
            setIsLoading(null);
        }
    };

    const handleDownloadAll = async () => {
        if (images.length === 0) return;
        setIsLoading("Checking tiles & zipping package...");
        try {
            // Check if any tiles have unbaked transparency from hand brush
            const { hasTransparency, transparentTileCount } = await checkTilesHaveTransparency(images);
            const hasUnderLayer = overlays.some(o => o.placement === 'back' && o.isVisible && o.src) || threeDObjects.length > 0;
            if (hasTransparency && !hasUnderLayer) {
                alert(`Notice: ${transparentTileCount} tile(s) have unbaked transparency! Because there is no layer placed underneath ('Under'), transparent areas will be filled with black. Tip: Place a layer underneath and click 'Bake Underneath' in the Hand Brush tool.`);
            }

            const zip = new JSZip();
            const palette = getLoadedPalette() || activePalette || await loadDefaultPalette();

            // Include the active .pal file in the exported ZIP so external viewers/games use the exact custom palette
            if (hasCustomPaletteRef.current && palette && palette.length > 0) {
                try {
                    const rawPalBytes = serializePaletteToRaw(palette);
                    const palFileName = getLoadedPaletteFileName() || 'isotem.pal';
                    zip.file(palFileName, rawPalBytes);
                } catch (palErr) {
                    console.warn("Could not bundle .pal file into zip:", palErr);
                }
            }

            // Sequential processing for zipping too
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                let src = image.src;

                const hasValidTmpBuffer = image.tmpBuffer && (image.tmpBuffer instanceof ArrayBuffer || (image.tmpBuffer as any).buffer instanceof ArrayBuffer);
                if (hasValidTmpBuffer && !saveIsotilesAsPng) {
                    try {
                        const parsedTmp = parseTmpFile(image.tmpBuffer);
                        
                        const img = new Image();
                        img.src = src;
                        await new Promise<void>((resolveLoad) => {
                            img.onload = () => resolveLoad();
                            img.onerror = () => resolveLoad();
                        });

                        const canvas = document.createElement("canvas");
                        canvas.width = img.width || image.width;
                        canvas.height = img.height || image.height;
                        const ctx = canvas.getContext("2d");
                        if (ctx) {
                            ctx.imageSmoothingEnabled = false;
                            ctx.drawImage(img, 0, 0);
                            updateTmpFileFromCanvas(canvas, parsedTmp, palette);
                        }

                        const arrayBuffer = TmpParser.writeTmp(parsedTmp);
                        zip.file(image.name, arrayBuffer);
                    } catch (err: any) {
                        console.error(`Failed compiling tile ${image.name} back to .tmp format:`, err);
                        // Fallback to write PNG so we don't block entire export, but preserve original filename extension
                        const base64Data = src.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                        zip.file(image.name, base64Data, { base64: true });
                    }
                } else {
                    let fName = image.name;
                    if (saveIsotilesAsPng && /\.(tmp|tem)$/i.test(fName)) {
                        fName = fName.replace(/\.(tmp|tem)$/i, '.png');
                    }

                    // Apply transparency key to PNG tiles upon saving
                    if (transparencyColor && !hasValidTmpBuffer) {
                        try {
                            const img = new Image();
                            await new Promise<void>((resolveLoad) => {
                                img.onload = () => resolveLoad();
                                img.onerror = () => resolveLoad();
                                img.src = src;
                            });
                            const processedCanvas = processTransparency(img, transparencyColor, tolerance);
                            src = processedCanvas.toDataURL('image/png');
                        } catch (err) {
                            console.warn("Transparency processing on save failed:", err);
                        }
                    }

                    // If PNG tile has unbaked transparency inside diamond, fill transparent pixels inside diamond with black
                    if (hasTransparency) {
                        try {
                            const img = new Image();
                            await new Promise<void>((resolveLoad) => {
                                img.onload = () => resolveLoad();
                                img.onerror = () => resolveLoad();
                                img.src = src;
                            });
                            const tCanvas = document.createElement("canvas");
                            tCanvas.width = img.width || image.width;
                            tCanvas.height = img.height || image.height;
                            const tCtx = tCanvas.getContext("2d", { willReadFrequently: true });
                            if (tCtx) {
                                tCtx.drawImage(img, 0, 0);
                                const tData = tCtx.getImageData(0, 0, tCanvas.width, tCanvas.height);
                                const d = tData.data;
                                const w = tCanvas.width;
                                const h = tCanvas.height;
                                const midX = (w - 1) / 2;
                                const midY = (h - 1) / 2;
                                const radX = w / 2;
                                const radY = h / 2;
                                for (let py = 0; py < h; py++) {
                                    const dy = Math.abs(py - midY) / radY;
                                    if (dy > 1.0) continue;
                                    for (let px = 0; px < w; px++) {
                                        const dx = Math.abs(px - midX) / radX;
                                        if (dx + dy <= 1.02) {
                                            const idx = (py * w + px) * 4;
                                            if (d[idx + 3] < 255) {
                                                d[idx] = 0;
                                                d[idx + 1] = 0;
                                                d[idx + 2] = 0;
                                                d[idx + 3] = 255;
                                            }
                                        }
                                    }
                                }
                                tCtx.putImageData(tData, 0, 0);
                                src = tCanvas.toDataURL('image/png');
                            }
                        } catch (err) {
                            console.warn("PNG transparency fill failed:", err);
                        }
                    }

                    const base64Data = src.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                    zip.file(fName, base64Data, { base64: true });
                }
            }
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            const defaultZipName = templateName && templateName.trim() ? `${templateName.trim()}${templateName.toLowerCase().endsWith(".zip") ? "" : ".zip"}` : "tileset.zip";
            link.href = URL.createObjectURL(content); link.download = defaultZipName;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch (e: any) { setError("Zip failed: " + e.message); }
        finally { setIsLoading(null); }
    };

    const handleFileDropAtZone = (files: FileList | File[], zone: 'tiles' | 'tiling' | 'smart') => {
        if (!files.length) return;
        setIsGlobalDragging(false);
        dragCounter.current = 0;
        
        const filesArray = Array.from(files);
        const glbFiles = filesArray.filter(f => f.name.toLowerCase().endsWith('.glb'));

        if (glbFiles.length > 0) {
            setIsThreeDMode(true);
            setShowThreeDObjects(true);

            const imageFiles = filesArray.filter(f => /\.(png|jpe?g|webp)$/i.test(f.name));

            glbFiles.forEach(glbFile => {
                const glbUrl = URL.createObjectURL(glbFile);
                const glbName = glbFile.name;

                // Match images
                let matchedImages = imageFiles;
                if (glbFiles.length > 1) {
                    const baseName = glbName.substring(0, glbName.lastIndexOf('.')).toLowerCase();
                    matchedImages = imageFiles.filter(img => 
                        img.name.toLowerCase().startsWith(baseName) || 
                        img.name.toLowerCase().includes(baseName)
                    );
                }

                let diffuseUrl: string | undefined = undefined;
                let normalUrl: string | undefined = undefined;
                let metallicUrl: string | undefined = undefined;
                let roughnessUrl: string | undefined = undefined;

                matchedImages.forEach(img => {
                    const lowName = img.name.toLowerCase();
                    const url = URL.createObjectURL(img);
                    if (lowName.includes('normal') || lowName.includes('nrm') || lowName.includes('norm')) {
                        normalUrl = url;
                    } else if (lowName.includes('metallic') || lowName.includes('metal') || lowName.includes('met')) {
                        metallicUrl = url;
                    } else if (lowName.includes('roughness') || lowName.includes('rough') || lowName.includes('rgh')) {
                        roughnessUrl = url;
                    } else if (lowName.includes('diffuse') || lowName.includes('albedo') || lowName.includes('color') || lowName.includes('base') || lowName.includes('col') || lowName.includes('diff')) {
                        diffuseUrl = url;
                    } else {
                        diffuseUrl = url;
                    }
                });

                handleAddThreeDObject(glbUrl, glbName, diffuseUrl, normalUrl, metallicUrl, roughnessUrl);
            });
            return;
        }
        
        if (zone === 'tiles') {
            handleFilesChange(files);
            return;
        }
        
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            if (zone === 'tiling') handleAddTextureSource(src);
            else if (zone === 'smart') handleAddOverlaySource(src);
        };
        reader.readAsDataURL(file);
    };

    const handleDropLibraryTile = (filename: string) => {
        handleAddFromLibrary(filename);
    };

    const handleAddThreeDObject = (
        glbUrl: string, 
        name: string,
        textureUrl?: string,
        normalMapUrl?: string,
        metallicMapUrl?: string,
        roughnessMapUrl?: string
    ) => {
        pushToHistory(images, threeDObjects, overlays);
        const newObj: ThreeDObject = {
            id: `3d-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            glbUrl,
            name,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            uvMapping: 'default',
            textureUrl,
            normalMapUrl,
            metallicMapUrl,
            roughnessMapUrl,
            textureSettings: {
                sharpness: 0,
                scale: 1,
                contrast: 100,
                brightness: 100,
                hue: 0,
                saturation: 100,
                metallic: 0,
                roughness: 1,
                normalScale: 1.0,
                magFilter: 'linear',
                minFilter: 'linear',
                anisotropy: 1,
                repeatX: 1,
                repeatY: 1,
                offsetX: 0,
                offsetY: 0,
                rotation: 0
            }
        };
        setThreeDObjects(prev => [...prev, newObj]);
        handleSelectSingleThreeDObject(newObj.id);
    };

    const handleAddLoadedThreeDObject = (loadedObj: ThreeDObject) => {
        pushToHistory(images, threeDObjects, overlays);
        setThreeDObjects(prev => [...prev, loadedObj]);
        handleSelectSingleThreeDObject(loadedObj.id);
        setIsThreeDMode(true);
        setShowThreeDObjects(true);
    };

    const handleRemoveThreeDObject = (id: string) => {
        pushToHistory(images, threeDObjects, overlays);
        setThreeDObjects(prev => prev.filter(o => o.id !== id));
        if (selectedThreeDObjectId === id) setSelectedThreeDObjectId(null);
        setSelectedThreeDObjectIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleDuplicateThreeDObject = (id?: string) => {
        const idsToDup = id
            ? [id]
            : (selectedThreeDObjectIds.size > 0
                ? Array.from(selectedThreeDObjectIds)
                : (selectedThreeDObjectId ? [selectedThreeDObjectId] : []));
        if (idsToDup.length === 0) return;

        const sourceObjs = threeDObjects.filter(o => idsToDup.includes(o.id));
        if (sourceObjs.length === 0) return;

        pushToHistory(images, threeDObjects, overlays);
        const duplicatedList = sourceObjs.map(src => cloneThreeDObject(src));
        const duplicatedIds = duplicatedList.map(d => d.id);

        setThreeDObjects(prev => [...prev, ...duplicatedList]);
        setSelectedThreeDObjectId(duplicatedIds[duplicatedIds.length - 1]);
        setSelectedThreeDObjectIds(new Set(duplicatedIds));
        setIsThreeDMode(true);
        setShowThreeDObjects(true);
        // Trigger automatic Grab ('translate') mode on the newly duplicated object(s)
        setAutoGrabTrigger(Date.now());
    };

    const handleConvertLayerTo3DPlane = useCallback(async (layerOrGroupId: string) => {
        setIsLoading("Baking layer & un-transforming UV for 3D plane...");
        try {
            const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
            const planeObj = await convertLayerToThreeDPlane(layerOrGroupId, overlays, activeGrid);
            if (!planeObj) {
                setError("Could not convert layer to 3D plane.");
                return;
            }
            pushToHistory(images, threeDObjects, overlays);
            setThreeDObjects(prev => [...prev, planeObj]);
            handleSelectSingleThreeDObject(planeObj.id);
            setIsThreeDMode(true);
            setShowThreeDObjects(true);
        } catch (err: any) {
            setError("Layer to 3D Plane failed: " + (err?.message || "Unknown error"));
        } finally {
            setIsLoading(null);
        }
    }, [gridType, lastActiveGrid, overlays, images, threeDObjects, pushToHistory, handleSelectSingleThreeDObject]);

    const handleBakeThreeD = useCallback(async () => {
        if (!threeDCanvasRef.current) return;
        const dataUrl = threeDCanvasRef.current.capture();
        if (!dataUrl) return;

        pushToHistory(images, threeDObjects, overlays);
        setTileHistory(prev => [...prev.slice(-19), [...images]]);
        setIsLoading("Baking 3D scene to tiles...");
        
        try {
            // Create a scene snapshot for the 3D render
            const snapshot = document.createElement('canvas');
            snapshot.width = CANVAS_WIDTH;
            snapshot.height = CANVAS_HEIGHT;
            const sCtx = snapshot.getContext('2d')!;
            
            const threeDImg = await loadImage(dataUrl);
            if (threeDImg) {
                sCtx.drawImage(threeDImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }

            const updatedImages = [...images];
            for (let i = 0; i < updatedImages.length; i++) {
                const image = updatedImages[i];
                // We use a dummy overlay to trigger the injection logic in bakeOverlaysToTile
                // Or we can just modify bakeOverlaysToTile to always use snapshot if provided
                const newSrc = await bakeOverlaysToTile(image, overlays, gridType, transparencyColor, tolerance, overlays, new Map(), snapshot, { x: 0, y: 0 });
                updatedImages[i] = { ...image, src: newSrc, flipH: false, flipV: false };
            }
            
            setImages(updatedImages);
            setIsThreeDMode(false);
        } catch (err: any) {
            setError("Bake failed: " + err.message);
        } finally {
            setIsLoading(null);
        }
    }, [threeDCanvasRef, overlays, images, gridType, transparencyColor, tolerance]);

    return (
        <div className="flex h-screen bg-slate-800 font-sans select-none overflow-hidden text-slate-200">
            {isLoading && <Loader message={isLoading} />}
            
            {loadConfirmation && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1f26] border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Load Project</h3>
                            <p className="text-slate-400 text-sm">How would you like to load this template?</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => {
                                    if (loadConfirmation.isLegacy) handleLoadLegacyJson(loadConfirmation.file, true);
                                    else handleLoadTemplate(loadConfirmation.file, true);
                                    setLoadConfirmation(null);
                                }}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-cyan-900/20"
                            >
                                Yes, load into existing
                            </button>
                            <button 
                                onClick={() => {
                                    if (loadConfirmation.isLegacy) handleLoadLegacyJson(loadConfirmation.file, false);
                                    else handleLoadTemplate(loadConfirmation.file, false);
                                    setLoadConfirmation(null);
                                }}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase py-3 rounded-xl transition-all active:scale-95 border border-slate-700"
                            >
                                No, current project will be wiped
                            </button>
                            <button 
                                onClick={() => setLoadConfirmation(null)}
                                className="w-full text-slate-500 hover:text-slate-400 text-xs font-bold uppercase py-2 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isGlobalDragging && (
                <DropOverlay 
                    onDropAtZone={handleFileDropAtZone} 
                    onCancel={() => {
                        setIsGlobalDragging(false);
                        dragCounter.current = 0;
                    }}
                />
            )}
            {error && <div className="fixed top-5 right-5 bg-red-500 text-white py-2 px-4 rounded-lg shadow-2xl z-50 animate-bounce font-bold tracking-tight max-w-sm">{error}</div>}
            <ControlPanel
                onFilesChange={handleFilesChange} onClearCanvas={handleClearCanvas} onExecuteCommand={handleExecuteLayoutCommand} onApplyChanges={handleApplyChanges} onDownloadAll={handleDownloadAll}
                transparencyColor={transparencyColor} setTransparencyColor={setTransparencyColor} tolerance={tolerance} setTolerance={setTolerance}
                isEyedropperActive={eyedropperMode !== 'NONE'} setIsEyedropperActive={(v) => setEyedropperMode(v ? 'TRANSPARENCY' : 'NONE')} images={images} setImages={setImages}
                gridType={gridType} setGridType={handleSetGridType} overlayOpacity={overlayOpacity} setOverlayOpacity={setOverlayOpacity}
                overlayLayer={overlayLayer} setOverlayLayer={setOverlayLayer} zoom={zoom} setZoom={setZoom} setOverlays={setOverlays}
                onUndo={handleUndo} canUndo={history.length > 0}
                onRedo={handleRedo} canRedo={redoHistory.length > 0}
                onSaveTemplate={handleSaveTemplate} 
                onLoadTemplate={(file) => setLoadConfirmation({ file, isLegacy: false })}
                onLoadLegacyJson={(file) => setLoadConfirmation({ file, isLegacy: true })}
                onOpenLibrary={() => setIsLibraryOpen(true)}
                onOpenStampTool={() => setIsStampToolOpen(!isStampToolOpen)}
                isStampToolOpen={isStampToolOpen}
                saveIsotilesAsPng={saveIsotilesAsPng}
                setSaveIsotilesAsPng={setSaveIsotilesAsPng}
                includeThreeDInTemplate={includeThreeDInTemplate}
                setIncludeThreeDInTemplate={setIncludeThreeDInTemplate}
                useTransparencyToDrag={useTransparencyToDrag}
                setUseTransparencyToDrag={setUseTransparencyToDrag}
                templateName={templateName}
                setTemplateName={setTemplateName}
            />
            {isLibraryOpen && <TileLibrary onClose={() => setIsLibraryOpen(false)} onSelect={handleAddFromLibrary} />}
            {isStampToolOpen && (
                <TransitionStampTool 
                    stamps={stamps}
                    activeStampId={activeStampId}
                    onAddStamp={handleAddStamp}
                    onUpdateStamp={handleUpdateStamp}
                    onSelectStamp={handleSelectStamp}
                    onCaptureRequest={() => {
                        if (!activeStampId) {
                            const id = `stamp-${Date.now()}`;
                            handleAddStamp({
                                id,
                                name: `Stamp ${stamps.length + 1}`,
                                dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAySURBVHgB7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8atwAB69C9YQAAAABJRU5ErkJggg==',
                                width: 32,
                                height: 32,
                                skewX: 0,
                                skewY: 0,
                                falloffEnabled: false,
                                falloffWidth: 50,
                                autoSnap: true
                            });
                            handleSelectStamp(id);
                        }
                        setToolMode('SELECT');
                        setIsCapturingStamp(true);
                    }}
                    onUndo={handleUndo}
                    onUseStamp={() => setToolMode(toolMode === 'TRANSITION_STAMP' ? 'SELECT' : 'TRANSITION_STAMP')}
                    toolMode={toolMode}
                    isOpen={isStampToolOpen}
                    onClose={() => {
                        setIsStampToolOpen(false);
                        setToolMode('SELECT');
                    }}
                />
            )}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0c10]">
                <CanvasArea
                    templateName={templateName}
                    images={images} overlays={overlays} 
                    heldImages={heldImages}
                    onClearHeldImages={() => setHeldImages([])}
                    onPlaceHeldImages={(placed) => {
                        pushToHistory(images, threeDObjects, overlays);
                        setImages(prev => [...prev, ...placed]);
                        setHeldImages([]);
                    }}
                    onUpdateOverlay={handleUpdateOverlay} onRemoveOverlay={handleClearOverlay} onReorderOverlays={setOverlays}
                    onGenerateTexture={handleGenerateTexture} onLoadTexture={handleAddTextureSource} onLoadOverlay={handleAddOverlaySource}
                    onAddSmartOverlayAtPosition={handleAddSmartOverlayAtPosition}
                    gridType={gridType} lastActiveGrid={lastActiveGrid} onUpdateImagePos={handleUpdateImagePosLocal}
                    onFlip={handleFlipImages} onPackIsometric={handlePackIsometric} onColorPack={handleColorPack} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} 
                    isEyedropperActive={eyedropperMode !== 'NONE'} 
                    setIsEyedropperActive={(v) => setEyedropperMode(v ? 'TRANSPARENCY' : 'NONE')}
                    isGlobalEyedropperActive={eyedropperMode === 'ORIGINAL_COLOR'}
                    setIsGlobalEyedropperActive={(v) => setEyedropperMode(v ? 'ORIGINAL_COLOR' : 'NONE')}
                    onColorPick={color => { 
                        if (eyedropperMode === 'TRANSPARENCY') {
                            setTransparencyColor(color); 
                        } else if (eyedropperMode === 'ORIGINAL_COLOR') {
                            setPickedColor(color);
                        }
                        setEyedropperMode('NONE'); 
                    }}
                    transparencyColor={transparencyColor} tolerance={tolerance} selectedImageIds={selectedImageIds} setSelectedImageIds={setSelectedImageIds}
                    zoom={zoom} setZoom={setZoom} onApplyMaskToImages={handleApplyMaskToImages} onUndo={handleUndo} onUndoInjection={handleUndoInjection} 
                    onUndoOriginalColor={handleUndoOriginalColor}
                    onApplyOriginalColorAdjustment={handleApplyOriginalColorAdjustment}
                    canUndo={history.length > 0} canUndoInjection={tileHistory.length > 0}
                    canUndoOriginalColor={originalColorHistory.length > 0}
                    pickedColor={pickedColor}
                    onApplyContour={handleApplyContour} onSnapOverlayToTile={handleSnapOverlayToTile} onDropLibraryTile={handleDropLibraryTile}
                    isAiGenerating={isAiGenerating} onAiGenerateTexture={handleAiGenerateTexture} onAddAdditionalTexture={handleAddAdditionalTexture}
                    onReIdOverlays={() => setOverlays(prev => prev.map((ov, i) => ({ ...ov, id: `overlay-${Date.now()}-${i}` })))}
                    textureInjectionOverlayId={textureInjectionOverlayId}
                    setTextureInjectionOverlayId={setTextureInjectionOverlayId}
                    isThreeDMode={isThreeDMode} setIsThreeDMode={setIsThreeDMode}
                    showThreeDObjects={showThreeDObjects} setShowThreeDObjects={setShowThreeDObjects}
                    isSnapEnabled={isSnapEnabled} setIsSnapEnabled={setIsSnapEnabled}
                    autoSlopeSnap={autoSlopeSnap} setAutoSlopeSnap={setAutoSlopeSnap}
                    useTransparencyToDrag={useTransparencyToDrag}
                    threeDObjects={threeDObjects} selectedThreeDObjectId={selectedThreeDObjectId}
                    setSelectedThreeDObjectId={setSelectedThreeDObjectId}
                    selectedThreeDObjectIds={selectedThreeDObjectIds}
                    setSelectedThreeDObjectIds={setSelectedThreeDObjectIds}
                    autoGrabTrigger={autoGrabTrigger}
                    onAddThreeDObject={handleAddThreeDObject}
                    onAddLoadedThreeDObject={handleAddLoadedThreeDObject}
                    onRemoveThreeDObject={handleRemoveThreeDObject}
                    onDuplicateThreeDObject={handleDuplicateThreeDObject}
                    onUpdateThreeDObject={handleUpdateThreeDObject}
                    onConvertLayerTo3DPlane={handleConvertLayerTo3DPlane}
                    onTransformStart={() => pushToHistory(images, threeDObjects, overlays)}
                    onTransformEnd={() => {}}
                    onBakeThreeD={handleBakeThreeD}
                    onSnapThreeDToTile={handleSnap3DTo2D}
                    threeDCanvasRef={threeDCanvasRef}
                    toolMode={toolMode} setToolMode={setToolMode}
                    isCapturingStamp={isCapturingStamp} setIsCapturingStamp={setIsCapturingStamp}
                    activeStamp={stamps.find(s => s.id === activeStampId) || null}
                    onUpdateStamp={handleUpdateStamp}
                    onStampDraw={(newImages) => {
                        pushToHistory(images, threeDObjects, overlays);
                        setImages(newImages);
                    }}
                    onImagesChange={(newImages, shouldPushHistory = true) => {
                        if (shouldPushHistory) {
                            pushToHistory(images, threeDObjects, overlays);
                        }
                        setImages(newImages);
                    }}
                    onOpenStampTool={() => setIsStampToolOpen(!isStampToolOpen)}
                    isStampToolOpen={isStampToolOpen}
                    onBakeSmartOverlay={handleBakeSmartOverlay}
                    onSelectLatOption={handleSelectLatOption}
                    isLatLoading={isLoading === 'Loading LATS...'}
                    onFilesChange={handleFilesChange}
                    onOpenLibrary={() => setIsLibraryOpen(true)}
                    onApplySceneHierarchy={(nextOverlays, nextThreeDObjects, nextImages) => {
                        pushToHistory(images, threeDObjects, overlays);
                        setOverlays(nextOverlays);
                        setThreeDObjects(nextThreeDObjects);
                        setImages(nextImages);
                    }}
                />
            </main>
        </div>
    );
};

export default App;
