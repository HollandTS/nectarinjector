
import React, { useRef, useState, MouseEvent as ReactMouseEvent, useEffect, useCallback, useLayoutEffect } from 'react';
import type { CanvasImage, RgbaColor, GridType, ProjectOverlay, OverlayFilters, ShuffleMode, JitterType, JitterShape, ContourSettings, MaskEntry, MaskGroup, TransitionStamp, ToolMode, OriginalColorSettings } from '../types';
import { GRID_CONFIGS, DEFAULT_FILTERS } from '../constants';
import { applySharpen, applyPixelNoise, applyPixelFilters, applyContourEffect, applyContourInjection } from '../utils/imageEffects';
import { bakeOverlaysToTile, renderOverlayFully, loadImage } from '../utils/textureInjection';
import { colorDistance, rgbToHex, hexToRgb } from '../utils/colorUtils';
import { removeFakeTransparency } from '../utils/transparencyUtils';
import { isoToScreen, screenToIso, getImageDrawPos } from '../utils/geoUtils';
import { getTileCellSpan } from '../utils/openTsTileRenderer';
import { sampleColorsFromLasso } from '../utils/colorSampling';
import { makeThreeDTargetId, isThreeDTargetId, getThreeDObjectIdFromTarget } from '../utils/threeDInjectionUtils';
import { ALL_LAYERS_TARGET_ID, isAllLayersTargetId } from '../utils/allLayersInjectionHelper';
import { isSceneGroupId, getSceneGroups } from '../utils/sceneGroupUtils';
import DraggableContainer from './DraggableContainer';
import { Camera as LucideCamera, MousePointer2 as LucideMousePointer2 } from 'lucide-react';
import { IsometricGrid } from './canvas/IsometricGrid';
import { DraggableImage } from './canvas/DraggableImage';
import { SmartOverlay } from './canvas/SmartOverlay';
import { TiledOverlay } from './canvas/TiledOverlay';
import { MainToolbar, ActiveControlType } from './panels/MainToolbar';
import { LayerStack } from './panels/LayerStack';
import { IsotilesPanel } from './panels/IsotilesPanel';
import { SceneOrganizerPanel } from './panels/SceneOrganizerPanel';
import { TextureInjectionPanel } from './panels/TextureInjectionPanel';
import { TilePaletteModal } from './modals/TilePaletteModal';
import { DrawMaskModal } from './modals/DrawMaskModal';
import { DepthToImageModal } from './modals/DepthToImageModal';
import { ThreeDCanvas } from './canvas/ThreeDCanvas';
import { ThreeDPanel } from './panels/ThreeDPanel';
import { HandBrushPanel } from './panels/HandBrushPanel';
import { BrushUndoWindow } from './panels/BrushUndoWindow';
import { HandBrushCursor } from './canvas/HandBrushCursor';
import type { HandBrushSettings, ThreeDObject, BrushHistoryEntry } from '../types';
import type { LatOption } from '../services/latsService';
import { PRESET_BRUSHES } from '../utils/brushPresets';
import { applyHandBrushToTiles } from '../utils/handBrushHelper';
import { getNextRotatedShpItem, applyLoadedShpItemToSettings } from '../utils/shpBrushHelper';
import { buildBrushHistoryEntry, applyBrushHistoryJump } from '../utils/brushHistoryHelper';
import { bakeUnderneathToTiles } from '../utils/transparencyBakeHelper';
import { convertIsotilesToTiledOverlay } from '../utils/isotilesToLayerHelper';
import { SeamlessMakerPanel } from './panels/SeamlessMakerPanel';
import { Brush as LucideBrush } from 'lucide-react';
import { autoMatchTileHeightsOnCanvas, computeHeldTilesPlacement } from '../utils/waeRampHelper';

const SCROLL_PADDING = 500;

interface CanvasAreaProps {
    images: CanvasImage[];
    overlays: ProjectOverlay[];
    heldImages?: CanvasImage[];
    onClearHeldImages?: () => void;
    onPlaceHeldImages?: (placed: CanvasImage[]) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
    onRemoveOverlay: (id: string) => void;
    onReorderOverlays: (newOverlays: ProjectOverlay[]) => void;
    onGenerateTexture: (prompt: string, isFourInOne: boolean) => void;
    onLoadTexture: (src: string, isFourInOne?: boolean, customName?: string) => void;
    onLoadOverlay: (src: string) => void;
    gridType: GridType;
    lastActiveGrid: 'ts_full' | 'ra2_full' | 'opents_full';
    onUpdateImagePos: (ids: string[], dgx: number, dgy: number, snapGrid: boolean) => void;
    onFlip: (axis: 'h' | 'v') => void;
    onPackIsometric: () => void;
    onColorPack: () => void;
    width: number;
    height: number;
    isEyedropperActive: boolean;
    setIsEyedropperActive: (v: boolean) => void;
    isGlobalEyedropperActive: boolean;
    setIsGlobalEyedropperActive: (v: boolean) => void;
    onColorPick: (color: RgbaColor) => void;
    transparencyColor: RgbaColor | null;
    tolerance: number;
    selectedImageIds: Set<string>;
    setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    zoom: number;
    setZoom: (v: number) => void;
    onApplyMaskToImages: (overlay: ProjectOverlay) => Promise<void>;
    onUndo: () => void;
    onUndoInjection: () => void;
    onUndoOriginalColor: () => void;
    onApplyOriginalColorAdjustment: (settings: OriginalColorSettings) => void;
    canUndo: boolean;
    canUndoInjection: boolean;
    canUndoOriginalColor: boolean;
    pickedColor: RgbaColor | null;
    onApplyContour: (ids: Set<string>, settings: ContourSettings) => void;
    onSnapOverlayToTile: (overlayId: string) => void;
    onDropLibraryTile: (filename: string, gridX?: number, gridY?: number) => void;
    isAiGenerating: string | null;
    onAiGenerateTexture: (overlayId: string) => void;
    onAddAdditionalTexture: (overlayId: string, src: string) => void;
    onReIdOverlays: () => void;
    textureInjectionOverlayId: string | null;
    setTextureInjectionOverlayId: (id: string | null) => void;
    isThreeDMode: boolean;
    setIsThreeDMode: (v: boolean) => void;
    showThreeDObjects: boolean;
    setShowThreeDObjects: (v: boolean) => void;
    isSnapEnabled: boolean;
    setIsSnapEnabled: (v: boolean) => void;
    useTransparencyToDrag?: boolean;
    threeDObjects: ThreeDObject[];
    selectedThreeDObjectId: string | null;
    setSelectedThreeDObjectId: (id: string | null) => void;
    selectedThreeDObjectIds?: Set<string>;
    setSelectedThreeDObjectIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
    autoGrabTrigger?: number;
    onAddThreeDObject: (glbUrl: string, name: string) => void;
    onAddLoadedThreeDObject?: (obj: ThreeDObject) => void;
    onRemoveThreeDObject: (id: string) => void;
    onDuplicateThreeDObject?: (id?: string) => void;
    onUpdateThreeDObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    onConvertLayerTo3DPlane?: (layerOrGroupId: string) => void;
    onBakeThreeD: () => void;
    onSnapThreeDToTile: () => void;
    onTransformStart: () => void;
    onTransformEnd: () => void;
    threeDCanvasRef: React.RefObject<{ capture: () => string | null } | null>;
    toolMode: ToolMode;
    setToolMode: (mode: ToolMode) => void;
    activeStamp: TransitionStamp | null;
    onUpdateStamp: (id: string, updates: Partial<TransitionStamp>) => void;
    isCapturingStamp: boolean;
    setIsCapturingStamp: (v: boolean) => void;
    onStampDraw: (newImages: CanvasImage[]) => void;
    onOpenStampTool: () => void;
    isStampToolOpen: boolean;
    onBakeSmartOverlay: (id: string) => void;
    onAddSmartOverlayAtPosition: (src: string, x: number, y: number, w: number, h: number) => void;
    templateName?: string;
    onSelectLatOption?: (option: LatOption) => void;
    isLatLoading?: boolean;
    onImagesChange?: (newImages: CanvasImage[], shouldPushHistory?: boolean) => void;
    onFilesChange?: (files: FileList) => void;
    onOpenLibrary?: () => void;
    onApplySceneHierarchy?: (
        nextOverlays: ProjectOverlay[],
        nextThreeDObjects: ThreeDObject[],
        nextImages: CanvasImage[]
    ) => void;
    autoSlopeSnap?: boolean;
    setAutoSlopeSnap?: (enabled: boolean) => void;
}

const CanvasArea: React.FC<CanvasAreaProps> = (props) => {
    const { images, overlays, heldImages = [], onClearHeldImages, onPlaceHeldImages, onUpdateOverlay, onRemoveOverlay, onReorderOverlays, onGenerateTexture, onLoadTexture, onLoadOverlay, gridType, lastActiveGrid, onUpdateImagePos, onFlip, onPackIsometric, onColorPack, width, height, isEyedropperActive, setIsEyedropperActive, isGlobalEyedropperActive, setIsGlobalEyedropperActive, onColorPick, transparencyColor, tolerance, selectedImageIds, setSelectedImageIds, zoom, setZoom, onApplyMaskToImages, onUndo, onUndoInjection, onUndoOriginalColor, onApplyOriginalColorAdjustment, canUndo, canUndoInjection, canUndoOriginalColor, pickedColor, onApplyContour, onSnapOverlayToTile, onDropLibraryTile, isAiGenerating, onAiGenerateTexture, onAddAdditionalTexture, onReIdOverlays, textureInjectionOverlayId, setTextureInjectionOverlayId, isThreeDMode, setIsThreeDMode, showThreeDObjects, setShowThreeDObjects, isSnapEnabled, setIsSnapEnabled, useTransparencyToDrag = true, threeDObjects, selectedThreeDObjectId, setSelectedThreeDObjectId, selectedThreeDObjectIds, setSelectedThreeDObjectIds, autoGrabTrigger, onAddThreeDObject, onAddLoadedThreeDObject, onRemoveThreeDObject, onDuplicateThreeDObject, onUpdateThreeDObject, onConvertLayerTo3DPlane, onBakeThreeD, onSnapThreeDToTile, onTransformStart, onTransformEnd, threeDCanvasRef, toolMode, setToolMode, activeStamp, onUpdateStamp, isCapturingStamp, setIsCapturingStamp, onStampDraw, onOpenStampTool, isStampToolOpen, onBakeSmartOverlay, onAddSmartOverlayAtPosition, templateName, onSelectLatOption, isLatLoading, onFilesChange, onOpenLibrary } = props;
    
    const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
    const viewportRef = useRef<HTMLDivElement>(null); 
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);
    const activeReplaceId = useRef<string | null>(null);
    
    // REFS for stable window event handlers
    const imagesRef = useRef(images);
    const selectedIdsRef = useRef(selectedImageIds);
    const gridTypeRef = useRef(gridType);
    const activeGridRef = useRef(activeGrid);
    const overlaysRef = useRef(overlays);
    const transColorRef = useRef(transparencyColor);
    const toleranceRef = useRef(tolerance);
    const activeStampRef = useRef(activeStamp);
    
    useEffect(() => { imagesRef.current = images; }, [images]);
    useEffect(() => { selectedIdsRef.current = selectedImageIds; }, [selectedImageIds]);
    useEffect(() => { gridTypeRef.current = gridType; }, [gridType]);
    useEffect(() => { activeGridRef.current = activeGrid; }, [activeGrid]);
    useEffect(() => { overlaysRef.current = overlays; }, [overlays]);
    useEffect(() => { transColorRef.current = transparencyColor; }, [transparencyColor]);
    useEffect(() => { toleranceRef.current = tolerance; }, [tolerance]);
    useEffect(() => { activeStampRef.current = activeStamp; }, [activeStamp]);

    const [showLayers, setShowLayers] = useState(true); 
    const [showIsotilesWindow, setShowIsotilesWindow] = useState(false);
    const [showSceneOrganizer, setShowSceneOrganizer] = useState(false);
    const [showSeamlessMaker, setShowSeamlessMaker] = useState(false);
    const [seamlessPreviewSrcs, setSeamlessPreviewSrcs] = useState<Record<string, string>>({});
    const [activeControlType, setActiveControlType] = useState<ActiveControlType>('layers');
    const [isControlIsolated, setIsControlIsolated] = useState(false);
    const [localAutoSlopeSnap, setLocalAutoSlopeSnap] = useState(true);
    const autoSlopeSnap = props.autoSlopeSnap !== undefined ? props.autoSlopeSnap : localAutoSlopeSnap;
    const setAutoSlopeSnap = props.setAutoSlopeSnap || setLocalAutoSlopeSnap;

    useEffect(() => {
        if (isThreeDMode) {
            setActiveControlType('3d');
        }
    }, [isThreeDMode]);

    const isLayerControlDisabled =
        activeControlType === 'tiles' ||
        (isControlIsolated && activeControlType !== 'layers');
    const isTileControlDisabled =
        isControlIsolated && activeControlType !== 'tiles';
    const isThreeDControlActive =
        isThreeDMode && (!isControlIsolated || activeControlType === '3d'); 
    const [openSettingsId, setOpenSettingsId] = useState<string | null>(null); 
    const [selectionBox, setSelectionBox] = useState({ x1: 0, y1: 0, x2: 0, y2: 0, active: false });
    const [showDrawModal, setShowDrawModal] = useState<string | null>(null);
    const [showTextureInjection, setShowTextureInjection] = useState(false);
    const [previewGroupIds, setPreviewGroupIds] = useState<string[]>([]);
    const [showPaletteForGroupId, setShowPaletteForGroupId] = useState<string | null>(null);
    const [isLivePreview, setIsLivePreview] = useState(false);
    const [contourSettings, setContourSettings] = useState<ContourSettings>({ thickness: 5, feather: 2, brightness: 100, contrast: 100, saturation: 100, hue: 0, targetColor: { r: 0, g: 0, b: 0, a: 1 }, tolerance: 20, invert: false, maskGroups: [], activeMaskGroupId: null });
    const [activeInjectionEyedropperId, setActiveInjectionEyedropperId] = useState<string | null>(null);
    const [activeInjectionTarget, setActiveInjectionTarget] = useState<string>('mask');
    const [activeMaskGroupId, setActiveMaskGroupId] = useState<string | null>(null);
    const [activeTransitionGroupId, setActiveTransitionGroupId] = useState<string | null>(null);
    const [activeSecondaryGroupId, setActiveSecondaryGroupId] = useState<string | null>(null);
    const [activeExtraGroupId, setActiveExtraGroupId] = useState<string | null>(null);
    const activeInjectionTargetRef = useRef(activeInjectionTarget);
    const activeMaskGroupIdRef = useRef(activeMaskGroupId);
    const activeTransitionGroupIdRef = useRef(activeTransitionGroupId);
    const activeSecondaryGroupIdRef = useRef(activeSecondaryGroupId);
    const activeExtraGroupIdRef = useRef(activeExtraGroupId);

    useEffect(() => { activeInjectionTargetRef.current = activeInjectionTarget; }, [activeInjectionTarget]);
    useEffect(() => { activeMaskGroupIdRef.current = activeMaskGroupId; }, [activeMaskGroupId]);
    useEffect(() => { activeTransitionGroupIdRef.current = activeTransitionGroupId; }, [activeTransitionGroupId]);
    useEffect(() => { activeSecondaryGroupIdRef.current = activeSecondaryGroupId; }, [activeSecondaryGroupId]);
    useEffect(() => { activeExtraGroupIdRef.current = activeExtraGroupId; }, [activeExtraGroupId]);
    const [activeLassoId, setActiveLassoId] = useState<string | null>(null);
    const [lassoPath, setLassoPath] = useState<{x: number, y: number}[]>([]);
    const [previewMaskId, setPreviewMaskId] = useState<string | null>(null);
    const [previewBakedSrcs, setPreviewBakedSrcs] = useState<Record<string, string>>({});
    const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const cancelPreviewRef = useRef<boolean>(false);
    const [isAltHeld, setIsAltHeld] = useState(false);
    const [isContourPickerActive, setIsContourPickerActive] = useState(false);
    const [isContourLassoActive, setIsContourLassoActive] = useState(false);
    const [stampCursorPos, setStampCursorPos] = useState<{x: number, y: number} | null>(null);
    const [heldCursorPos, setHeldCursorPos] = useState<{x: number, y: number} | null>(null);

    useEffect(() => {
        if (!heldImages || heldImages.length === 0) {
            setHeldCursorPos(null);
            return;
        }

        const handleWindowMouseMove = (e: MouseEvent) => {
            if (canvasContainerRef.current) {
                const rect = canvasContainerRef.current.getBoundingClientRect();
                const cx = (e.clientX - rect.left) / zoom;
                const cy = (e.clientY - rect.top) / zoom;
                setHeldCursorPos({ x: cx, y: cy });
            }
        };

        window.addEventListener('mousemove', handleWindowMouseMove);
        return () => window.removeEventListener('mousemove', handleWindowMouseMove);
    }, [heldImages?.length, zoom]);

    useEffect(() => {
        if (images.length === 0 && overlays.length === 0 && (!heldImages || heldImages.length === 0)) {
            setPreviewMaskId(null);
            setPreviewGroupIds([]);
            setPreviewBakedSrcs({});
            setSeamlessPreviewSrcs({});
            setOpenSettingsId(null);
            setActiveInjectionEyedropperId(null);
            setActiveLassoId(null);
            setLassoPath([]);
            setSelectionBox({ x1: 0, y1: 0, x2: 0, y2: 0, active: false });
        }
    }, [images.length, overlays.length, heldImages?.length]);

    const [isDepthToImageOpen, setIsDepthToImageOpen] = useState(false);
    const [depthScreenshot, setDepthScreenshot] = useState<string | null>(null);
    const [depthPosition, setDepthPosition] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [toolbarWarning, setToolbarWarning] = useState<string | null>(null);

    const [isHandBrushOpen, setIsHandBrushOpen] = useState(false);
    const [handBrushSettings, setHandBrushSettings] = useState<HandBrushSettings>({
        brushSrc: PRESET_BRUSHES[0]?.path || '',
        brushName: PRESET_BRUSHES[0]?.name || 'Circle Soft',
        mode: 'coloring',
        footprint: 1,
        mainScale: 100,
        canvasZoom: 100,
        rotation: 0,
        strength: 100,
        mirrorH: false,
        mirrorV: false,
        shuffleMode: 'none',
        randomizeRotation: false,
        invert: false,
        tilingMode: 'tiled',
        hue: 0,
        contrast: 100,
        brightness: 100,
        saturation: 100,
        normalHue: 0,
        normalSaturation: 100,
        normalBrightness: 100,
        normalTransparency: 0,
        autoBakeUnderneath: true,
        onlySelectedTiles: false,
        showSelectionBox: false,
        isShpBrush: false,
        shpShadowEnabled: true,
        shpShadowDarkness: 55,
        shpShadowBlendPalIndex1: 25,
        shpShadowSoftness: 0,
        shpShadowOffsetX: 0,
        shpShadowOffsetY: 0,
        loadedShpItems: [],
        selectedShpIds: [],
        shpRandomPick: false,
    });
    const [handBrushCursorPos, setHandBrushCursorPos] = useState<{ x: number; y: number } | null>(null);
    const [isBakingUnderneath, setIsBakingUnderneath] = useState(false);
    const [isBrushUndoWindowOpen, setIsBrushUndoWindowOpen] = useState(true);
    const [brushHistoryEntries, setBrushHistoryEntries] = useState<BrushHistoryEntry[]>([]);
    const [brushHistoryIndex, setBrushHistoryIndex] = useState<number>(-1);
    const brushImgRef = useRef<HTMLImageElement | null>(null);
    const shadowBrushImgRef = useRef<HTMLImageElement | null>(null);
    const strokeAffectedTileIds = useRef<Set<string>>(new Set());
    const strokeBeforeTilesRef = useRef<Map<string, { name: string; src: string }>>(new Map());
    const handBrushSettingsRef = useRef(handBrushSettings);
    useEffect(() => { handBrushSettingsRef.current = handBrushSettings; }, [handBrushSettings]);

    useEffect(() => {
        let isMounted = true;
        if (handBrushSettings.brushSrc) {
            loadImage(handBrushSettings.brushSrc).then(img => {
                if (isMounted) brushImgRef.current = img;
            });
        }
        if (handBrushSettings.isShpBrush && handBrushSettings.shpShadowSrc) {
            loadImage(handBrushSettings.shpShadowSrc).then(sImg => {
                if (isMounted) shadowBrushImgRef.current = sImg;
            });
        } else {
            shadowBrushImgRef.current = null;
        }
        return () => { isMounted = false; };
    }, [handBrushSettings.brushSrc, handBrushSettings.isShpBrush, handBrushSettings.shpShadowSrc]);

    const handleToggleHandBrush = () => {
        if (isHandBrushOpen) {
            setIsHandBrushOpen(false);
            if (toolMode === 'HAND_BRUSH') setToolMode('SELECT');
        } else {
            setIsHandBrushOpen(true);
            setIsBrushUndoWindowOpen(true);
            setToolMode('HAND_BRUSH');
        }
    };

    const handleJumpBrushHistory = (targetIndex: number) => {
        const clamped = Math.max(-1, Math.min(brushHistoryEntries.length - 1, targetIndex));
        if (clamped === brushHistoryIndex) return;
        const nextImages = applyBrushHistoryJump(
            imagesRef.current,
            brushHistoryEntries,
            brushHistoryIndex,
            clamped
        );
        imagesRef.current = nextImages;
        setBrushHistoryIndex(clamped);
        if (props.onImagesChange) {
            props.onImagesChange(nextImages, false);
        } else {
            onStampDraw(nextImages);
        }
    };

    const handleUndoBrush = () => {
        if (brushHistoryIndex >= 0) {
            handleJumpBrushHistory(brushHistoryIndex - 1);
        }
    };

    const handleRedoBrush = () => {
        if (brushHistoryIndex < brushHistoryEntries.length - 1) {
            handleJumpBrushHistory(brushHistoryIndex + 1);
        }
    };

    const handleClearBrushHistory = () => {
        setBrushHistoryEntries([]);
        setBrushHistoryIndex(-1);
    };

    const handleHandBrushDraw = async (clickX: number, clickY: number) => {
        const currentSettings = handBrushSettingsRef.current;
        if (currentSettings.onlySelectedTiles && selectedIdsRef.current.size === 0) return;
        if (!brushImgRef.current && currentSettings.brushSrc) {
            brushImgRef.current = await loadImage(currentSettings.brushSrc);
        }
        if (!brushImgRef.current) return;
        if (currentSettings.isShpBrush && currentSettings.shpShadowSrc && !shadowBrushImgRef.current) {
            shadowBrushImgRef.current = await loadImage(currentSettings.shpShadowSrc);
        }

        // Capture pre-stroke tile sources for any tiles not yet recorded in this stroke
        for (const tile of imagesRef.current) {
            if (!strokeBeforeTilesRef.current.has(tile.id)) {
                strokeBeforeTilesRef.current.set(tile.id, {
                    name: tile.filename || 'Tile',
                    src: tile.src,
                });
            }
        }

        const currentConfig = GRID_CONFIGS[activeGridRef.current] || { width: 48, height: 24 };
        let overrideRotation: number | undefined = undefined;
        if (currentSettings.randomizeRotation) {
            overrideRotation = Math.floor(Math.random() * 360);
        }

        const res = await applyHandBrushToTiles(
            imagesRef.current,
            selectedIdsRef.current,
            clickX,
            clickY,
            currentSettings,
            brushImgRef.current,
            currentConfig,
            overrideRotation,
            shadowBrushImgRef.current
        );

        if (res.affectedTileIds.length > 0) {
            res.affectedTileIds.forEach(id => strokeAffectedTileIds.current.add(id));
            imagesRef.current = res.updatedImages;
            if (props.onImagesChange) {
                // false = do NOT push to main app undo stack; brush has its own isolated Undo List
                props.onImagesChange(res.updatedImages, false);
            } else {
                onStampDraw(res.updatedImages);
            }
        }
    };

    const handleHandBrushEnd = async () => {
        const affected = Array.from(strokeAffectedTileIds.current);
        strokeAffectedTileIds.current.clear();
        const beforeSnapshotMap = new Map(strokeBeforeTilesRef.current);
        strokeBeforeTilesRef.current.clear();

        const curSettings = handBrushSettingsRef.current;

        if (affected.length > 0) {
            if (curSettings.mode === 'transparency' && curSettings.autoBakeUnderneath) {
                const tilesToBake = imagesRef.current.filter(img => affected.includes(img.id));
                const res = await bakeUnderneathToTiles(
                    tilesToBake,
                    imagesRef.current,
                    overlaysRef.current,
                    gridTypeRef.current,
                    false
                );
                if (res.bakedCount > 0) {
                    imagesRef.current = res.updatedImages;
                    if (props.onImagesChange) {
                        props.onImagesChange(res.updatedImages, false);
                    } else {
                        onStampDraw(res.updatedImages);
                    }
                }
            }

            // Record completed brush stroke in isolated Brush Undo List
            const entry = buildBrushHistoryEntry(
                beforeSnapshotMap,
                imagesRef.current,
                affected,
                curSettings
            );
            if (entry) {
                setBrushHistoryEntries(prev => {
                    const sliced = prev.slice(0, brushHistoryIndex + 1);
                    const next = [...sliced, entry].slice(-50);
                    setBrushHistoryIndex(next.length - 1);
                    return next;
                });
            }
        }

        // Rotate to the next checked SHP upon each brush press when Random-Pick is enabled
        if (curSettings.isShpBrush && curSettings.shpRandomPick) {
            const nextShpItem = getNextRotatedShpItem(curSettings);
            if (nextShpItem && nextShpItem.id !== curSettings.activeShpId) {
                const rotUpdates = applyLoadedShpItemToSettings(nextShpItem);
                setHandBrushSettings(prev => ({ ...prev, ...rotUpdates }));
            }
        }
    };

    const handleBakeUnderneath = async () => {
        setIsBakingUnderneath(true);
        try {
            const beforeBakeMap = new Map<string, { name: string; src: string }>();
            for (const tile of imagesRef.current) {
                beforeBakeMap.set(tile.id, { name: tile.filename || 'Tile', src: tile.src });
            }
            const targets = selectedIdsRef.current.size > 0
                ? imagesRef.current.filter(img => selectedIdsRef.current.has(img.id))
                : imagesRef.current;
            const res = await bakeUnderneathToTiles(
                targets,
                imagesRef.current,
                overlaysRef.current,
                gridTypeRef.current,
                false
            );
            if (res.bakedCount > 0) {
                imagesRef.current = res.updatedImages;
                if (props.onImagesChange) {
                    props.onImagesChange(res.updatedImages, false);
                } else {
                    onStampDraw(res.updatedImages);
                }
                const entry = buildBrushHistoryEntry(
                    beforeBakeMap,
                    res.updatedImages,
                    targets.map(t => t.id),
                    { ...handBrushSettingsRef.current, brushName: 'Bake Underneath' }
                );
                if (entry) {
                    setBrushHistoryEntries(prev => {
                        const sliced = prev.slice(0, brushHistoryIndex + 1);
                        const next = [...sliced, entry].slice(-50);
                        setBrushHistoryIndex(next.length - 1);
                        return next;
                    });
                }
            }
        } finally {
            setIsBakingUnderneath(false);
        }
    };

    const handleOpenDepthToImage = async () => {
        if (selectedImageIds.size === 0) {
            setToolbarWarning("Please select one or more tiles on the canvas first!");
            setTimeout(() => setToolbarWarning(null), 3500);
            return;
        }

        try {
            const selectedImages = imagesRef.current.filter(img => selectedImageIds.current ? selectedImageIds.current.has(img.id) : selectedIdsRef.current.has(img.id));
            if (selectedImages.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const currentConfig = GRID_CONFIGS[activeGridRef.current] || { width: 48, height: 24 };

            const positions = selectedImages.map(img => {
                const drawPos = getImageDrawPos(img, currentConfig.width, currentConfig.height);
                const left = Math.floor(drawPos.x) + img.offsetX;
                const top = Math.floor(drawPos.y) + img.offsetY;
                return { img, left, top };
            });

            positions.forEach(({ img, left, top }) => {
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, left + img.width);
                maxY = Math.max(maxY, top + img.height);
            });

            const w = maxX - minX;
            const h = maxY - minY;
            if (w <= 0 || h <= 0) return;

            const captureCanvas = document.createElement('canvas');
            captureCanvas.width = w;
            captureCanvas.height = h;
            const captureCtx = captureCanvas.getContext('2d')!;
            captureCtx.imageSmoothingEnabled = false;

            for (const { img, left, top } of positions) {
                const imageElement = await loadImage(img.src);
                if (imageElement) {
                    captureCtx.drawImage(imageElement, left - minX, top - minY, img.width, img.height);
                }
            }

            const dataUrl = captureCanvas.toDataURL('image/png');
            setDepthScreenshot(dataUrl);
            setDepthPosition({ x: minX, y: minY, width: w, height: h });
            setIsDepthToImageOpen(true);
        } catch (error) {
            console.error("Error generating depth screenshot:", error);
            setToolbarWarning("Failed to capture screenshot layout. Please wait for files to load fully.");
            setTimeout(() => setToolbarWarning(null), 4000);
        }
    };

    const activeLassoIdRef = useRef(activeLassoId);
    useEffect(() => { activeLassoIdRef.current = activeLassoId; }, [activeLassoId]);

    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

    useEffect(() => { if (viewportRef.current) { viewportRef.current.scrollLeft = 50; viewportRef.current.scrollTop = 150; } }, []);
    
    const wheelZoomRef = useRef<{
        clientX: number;
        clientY: number;
        oldScrollLeft: number;
        oldScrollTop: number;
        oldZoom: number;
        nextZoom: number;
    } | null>(null);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !wheelZoomRef.current) return;
        
        const { clientX, clientY, oldScrollLeft, oldScrollTop, oldZoom, nextZoom } = wheelZoomRef.current;
        wheelZoomRef.current = null; // Clear to prevent multiple trigger
        
        if (oldZoom === nextZoom) return;

        // Apply perfect mathematical zoom targeting!
        const ratio = nextZoom / oldZoom;
        viewport.scrollLeft = (clientX + oldScrollLeft) * ratio - clientX;
        viewport.scrollTop = (clientY + oldScrollTop) * ratio - clientY;
    }, [zoom]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const handleWheel = (e: WheelEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            // Hover check: if hovering overlay window/sidebar, scroll naturally
            const isCanvasTarget = target.closest('#main-canvas-container') || target.classList.contains('canvas-background') || target === viewport;
            const isSidebarOrModal = target.closest('.fixed') || target.closest('.absolute:not(#main-canvas-container)') || target.closest('.overflow-auto') || target.closest('select') || target.closest('input');

            if (!isCanvasTarget || isSidebarOrModal) {
                return;
            }

            e.preventDefault();
            const delta = e.deltaY;
            const viewportRect = viewport.getBoundingClientRect();
            const clientX = e.clientX - viewportRect.left;
            const clientY = e.clientY - viewportRect.top;

            setZoom(prevZoom => {
                const step = 0.05 * prevZoom;
                const nextZoom = delta < 0 ? prevZoom + step : prevZoom - step;
                const finalZoom = Math.max(0.1, Math.min(nextZoom, 15));
                
                wheelZoomRef.current = {
                    clientX,
                    clientY,
                    oldScrollLeft: viewport.scrollLeft,
                    oldScrollTop: viewport.scrollTop,
                    oldZoom: prevZoom,
                    nextZoom: finalZoom
                };
                return finalZoom;
            });
        };

        viewport.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            viewport.removeEventListener('wheel', handleWheel);
        };
    }, [setZoom]);
    
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => setIsAltHeld(e.altKey);
        window.addEventListener('keydown', handleKey); window.addEventListener('keyup', handleKey);
        return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKey); };
    }, []);

    const getEffectiveInjectionOverlay = useCallback((targetId?: string | null): ProjectOverlay | null => {
        const resolvedId =
            targetId ||
            textureInjectionOverlayId ||
            overlays[0]?.id ||
            (threeDObjects.length > 0 ? makeThreeDTargetId('all') : null);
        if (!resolvedId) return null;

        const existing = overlays.find(o => o.id === resolvedId);
        if (existing) return existing;

        if (isAllLayersTargetId(resolvedId)) {
            return {
                id: resolvedId,
                name: 'All Layers (3D + Visible 2D Stack)',
                type: 'tiled',
                src: resolvedId,
                repeatX: 1,
                repeatY: 1,
                x: 0,
                y: 0,
                width: width,
                height: height,
                opacity: 100,
                isVisible: true,
                placement: 'front',
                filters: {
                    ...DEFAULT_FILTERS,
                    staticScale: 100,
                    maskGroups: [],
                    maskOverlayIds: [],
                    colorSwaps: [],
                    maskEntries: [],
                },
            };
        }

        if (isSceneGroupId(resolvedId)) {
            const sceneGroups = getSceneGroups(overlays, threeDObjects, images);
            const matchedGroup = sceneGroups.find(sg => sg.id === resolvedId);
            return {
                id: resolvedId,
                name: matchedGroup ? `Group: ${matchedGroup.name}` : 'Scene Group',
                type: 'tiled',
                src: resolvedId,
                repeatX: 1,
                repeatY: 1,
                x: 0,
                y: 0,
                width: width,
                height: height,
                opacity: 100,
                isVisible: true,
                placement: 'front',
                filters: {
                    ...DEFAULT_FILTERS,
                    staticScale: 100,
                    maskGroups: [],
                    maskOverlayIds: [],
                    colorSwaps: [],
                    maskEntries: [],
                },
            };
        }

        if (isThreeDTargetId(resolvedId)) {
            const objId = getThreeDObjectIdFromTarget(resolvedId);
            const matchedObj = threeDObjects.find(o => o.id === objId);
            return {
                id: resolvedId,
                name: objId === 'all' ? 'All 3D Objects (Scene)' : `3D: ${matchedObj?.name || 'Object'}`,
                type: 'tiled',
                src: resolvedId,
                repeatX: 1,
                repeatY: 1,
                x: 0,
                y: 0,
                width: width,
                height: height,
                opacity: 100,
                isVisible: true,
                placement: 'front',
                filters: {
                    ...DEFAULT_FILTERS,
                    staticScale: 100,
                    maskGroups: [],
                    maskOverlayIds: [],
                    colorSwaps: [],
                    maskEntries: [],
                },
            };
        }

        return overlays[0] || null;
    }, [textureInjectionOverlayId, overlays, threeDObjects, images, width, height]);

    useEffect(() => {
        const hasPreviewActive = Boolean(previewMaskId) || previewGroupIds.length > 0;
        if (!hasPreviewActive) {
            cancelPreviewRef.current = true;
            setPreviewBakedSrcs({});
            setIsPreviewProcessing(false);
            setPreviewProgress(0);
            return;
        }

        const timer = setTimeout(() => {
            const bakePreviews = async () => {
                const baseOverlay = getEffectiveInjectionOverlay(previewMaskId);
                if (baseOverlay) {
                    // If specific group previews are toggled on (and not all), filter to those groups
                    let overlay = baseOverlay;
                    if (previewGroupIds.length > 0 && baseOverlay.filters.maskGroups.length > 0) {
                        const groupIndices = baseOverlay.filters.maskGroups
                            .map((g, idx) => (previewGroupIds.includes(g.id) ? idx : -1))
                            .filter((idx) => idx !== -1);
                        if (groupIndices.length > 0 && groupIndices.length < baseOverlay.filters.maskGroups.length) {
                            overlay = {
                                ...baseOverlay,
                                filters: {
                                    ...baseOverlay.filters,
                                    maskGroups: groupIndices.map((i) => baseOverlay.filters.maskGroups[i]),
                                    maskOverlayIds: groupIndices.map((i) => (baseOverlay.filters.maskOverlayIds || [])[i] || null),
                                },
                            };
                        }
                    }

                    setIsPreviewProcessing(true);
                    setPreviewProgress(0);
                    cancelPreviewRef.current = false;

                    const newBakedSrcs: Record<string, string> = {};
                    const imagesToBake = images;
                    
                    // Use a shared cache for this batch of bakes
                    const batchCache = new Map<string, HTMLCanvasElement>();

                    for (let i = 0; i < imagesToBake.length; i++) {
                        if (cancelPreviewRef.current) break;
                        
                        const img = imagesToBake[i];
                        const baked = await bakeOverlaysToTile(img, [overlay], activeGrid, transparencyColor, tolerance, overlays, batchCache);
                        newBakedSrcs[img.id] = baked;
                        
                        setPreviewProgress((i + 1) / imagesToBake.length);
                        // Yield to main thread
                        await new Promise(r => setTimeout(r, 0));
                    }
                    
                    if (!cancelPreviewRef.current) {
                        setPreviewBakedSrcs(newBakedSrcs);
                    }
                    setIsPreviewProcessing(false);
                }
            };
            bakePreviews();
        }, 150);

        return () => {
            clearTimeout(timer);
            cancelPreviewRef.current = true;
        };
    }, [previewMaskId, previewGroupIds, overlays, threeDObjects, images, selectedImageIds, activeGrid, transparencyColor, tolerance, getEffectiveInjectionOverlay]);

    const handleNudge = (dx: number, dy: number) => { 
        if (selectedImageIds.size > 0) { 
            const dgx = dx * 0.05;
            const dgy = dy * 0.05;
            onUpdateImagePos(Array.from(selectedImageIds), dgx, dgy, false); 
        } 
    };

    const handleReplaceFile = (f: File) => {
        if (!activeReplaceId.current) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            onUpdateOverlay(activeReplaceId.current!, { src: e.target?.result as string });
            activeReplaceId.current = null;
        };
        reader.readAsDataURL(f);
    };

    const handleStampCapture = async (box: {x1: number, y1: number, x2: number, y2: number}) => {
        const currentStamp = activeStampRef.current;
        if (!currentStamp) return;
        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);
        const captureW = Math.round(maxX - minX);
        const captureH = Math.round(maxY - minY);
        if (captureW < 1 || captureH < 1) return;

        const finalW = Math.min(captureW, 1024);
        const finalH = Math.min(captureH, 1024);

        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = finalW;
        captureCanvas.height = finalH;
        const captureCtx = captureCanvas.getContext('2d')!;
        captureCtx.imageSmoothingEnabled = false;

        const currentConfig = GRID_CONFIGS[activeGridRef.current] || { width: 48, height: 24 };

        // Helper to load and draw an image
        const drawImageToCapture = (src: string, x: number, y: number, w: number, h: number, opacity: number = 1) => {
            return new Promise<void>(resolve => {
                const img = new Image();
                if (!src.startsWith('data:')) img.crossOrigin = "Anonymous";
                img.onload = () => {
                    captureCtx.globalAlpha = opacity;
                    captureCtx.drawImage(img, x - minX, y - minY, w, h);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = src;
            });
        };

        // 1. Back Overlays
        const backOverlays = overlaysRef.current.filter(o => o.placement === 'back' && o.isVisible && o.src);
        for (const ov of backOverlays) {
            if (ov.x < maxX && ov.x + ov.width > minX && ov.y < maxY && ov.y + ov.height > minY) {
                await drawImageToCapture(ov.src!, ov.x, ov.y, ov.width, ov.height, ov.opacity / 100);
            }
        }

        // 2. Tiles (sorted back-to-front by isometric depth)
        const tiles = [...imagesRef.current].sort((a, b) => {
            const orderA = a.gridX + a.gridY;
            const orderB = b.gridX + b.gridY;
            if (orderA !== orderB) return orderA - orderB;
            return a.gridX - b.gridX;
        });
        for (const img of tiles) {
            const drawPos = getImageDrawPos(img, currentConfig.width, currentConfig.height);
            const left = Math.floor(drawPos.x) + img.offsetX;
            const top = Math.floor(drawPos.y) + img.offsetY;

            if (left < maxX && left + img.width > minX && top < maxY && top + img.height > minY) {
                await drawImageToCapture(img.src, left, top, img.width, img.height);
            }
        }

        // 3. Front Overlays
        const frontOverlays = overlaysRef.current.filter(o => o.placement === 'front' && o.isVisible && o.src);
        for (const ov of frontOverlays) {
            if (ov.x < maxX && ov.x + ov.width > minX && ov.y < maxY && ov.y + ov.height > minY) {
                await drawImageToCapture(ov.src!, ov.x, ov.y, ov.width, ov.height, ov.opacity / 100);
            }
        }

        const resultDataUrl = captureCanvas.toDataURL('image/png');
        props.onUpdateStamp(currentStamp.id, {
            dataUrl: resultDataUrl,
            width: finalW,
            height: finalH
        });
        setIsCapturingStamp(false);
        setToolMode('SELECT');
    };

    const handleStampDraw = async (x: number, y: number) => {
        if (!activeStamp) return;
        
        let drawX = x - activeStamp.width / 2;
        let drawY = y - activeStamp.height / 2;

        const currentConfig = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

        // Find the tile to draw on (the one with highest Z index / last in array that contains the point)
        let targetTile: CanvasImage | null = null;
        for (let i = images.length - 1; i >= 0; i--) {
            const img = images[i];
            const drawPos = getImageDrawPos(img, currentConfig.width, currentConfig.height);
            const left = Math.floor(drawPos.x) + img.offsetX;
            const top = Math.floor(drawPos.y) + img.offsetY;

            if (x >= left && x <= left + img.width && y >= top && y <= top + img.height) {
                targetTile = img;
                break;
            }
        }

        if (!targetTile) return;

        // Create stamp canvas with effects
        const stampCanvas = document.createElement('canvas');
        stampCanvas.width = activeStamp.width;
        stampCanvas.height = activeStamp.height;
        const stampCtx = stampCanvas.getContext('2d')!;

        const stampImg = new Image();
        await new Promise<void>(resolve => {
            stampImg.onload = () => {
                // Apply skew
                if (activeStamp.skewX !== 0 || activeStamp.skewY !== 0) {
                    stampCtx.setTransform(1, Math.tan(activeStamp.skewY * Math.PI / 180), Math.tan(activeStamp.skewX * Math.PI / 180), 1, 0, 0);
                }
                stampCtx.drawImage(stampImg, 0, 0);
                
                // Apply Alpha Fall-off
                if (activeStamp.falloffEnabled) {
                    const idata = stampCtx.getImageData(0, 0, stampCanvas.width, stampCanvas.height);
                    const data = idata.data;
                    const mid = stampCanvas.width / 2;
                    const solidHalf = (activeStamp.falloffWidth / 100) * mid;
                    const denominator = mid - solidHalf;
                    
                    for (let lx = 0; lx < stampCanvas.width; lx++) {
                        let alphaMult = 1;
                        const distFromMid = Math.abs(lx - mid);
                        if (distFromMid > solidHalf && denominator > 0) {
                            alphaMult = 1 - ((distFromMid - solidHalf) / denominator);
                        }
                        alphaMult = Math.max(0, Math.min(1, alphaMult));
                        for (let ly = 0; ly < stampCanvas.height; ly++) {
                            const idx = (ly * stampCanvas.width + lx) * 4;
                            data[idx + 3] *= alphaMult;
                        }
                    }
                    stampCtx.putImageData(idata, 0, 0);
                }
                resolve();
            };
            stampImg.src = activeStamp.dataUrl;
        });

        // Draw onto the tile
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = targetTile.width;
        tileCanvas.height = targetTile.height;
        const tileCtx = tileCanvas.getContext('2d')!;
        
        const tileImg = new Image();
        tileImg.crossOrigin = "Anonymous";
        await new Promise<void>(resolve => {
            tileImg.onload = () => {
                tileCtx.drawImage(tileImg, 0, 0);
                const drawPos = getImageDrawPos(targetTile!, currentConfig.width, currentConfig.height);
                const tileLeft = Math.floor(drawPos.x) + targetTile!.offsetX;
                const tileTop = Math.floor(drawPos.y) + targetTile!.offsetY;
                
                tileCtx.drawImage(stampCanvas, drawX - tileLeft, drawY - tileTop);
                resolve();
            };
            tileImg.src = targetTile!.src;
        });

        const newImages = images.map(img => img.id === targetTile!.id ? { ...img, src: tileCanvas.toDataURL() } : img);
        onStampDraw(newImages);
    };

    const handleCloneLayer = (ov: ProjectOverlay) => {
        const newName = `${ov.name || 'layer'}-clone1`;
        const newOv: ProjectOverlay = { 
            ...ov, 
            id: `ov-clone-${Date.now()}`, 
            name: newName,
            x: ov.x + 20, 
            y: ov.y + 20, 
            filters: { ...ov.filters } 
        };
        onReorderOverlays([...overlays, newOv]);
    };

    const handleDownloadLayer = async (ov: ProjectOverlay) => {
        const srcToUse = ov.src;
        if (!srcToUse) return;
        try {
            const img = await loadImage(srcToUse);
            if (!img) return;
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

            const cleanCanvas = removeFakeTransparency(canvas, transparencyColor, tolerance);
            const link = document.createElement('a');
            link.href = cleanCanvas.toDataURL('image/png');
            link.download = `overlay-${ov.id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Download layer failed", e);
        }
    };

    const handleDownloadLayerTemplate = async (ov: ProjectOverlay) => {
        const { getLoadedPalette } = await import('../utils/paletteViewerHelper');
        const minimalProject: any = {
            version: "1.0",
            name: ov.name || 'layer',
            images: [],
            overlays: [ov],
            threeDObjects: [],
            gridType: gridType,
            transparencyColor: transparencyColor ? `rgba(${transparencyColor.r},${transparencyColor.g},${transparencyColor.b},${transparencyColor.a})` : '#000000',
            tolerance: tolerance,
            zoom: zoom,
            overlayOpacity: 1,
            overlayLayer: 'front',
            palette: getLoadedPalette() || undefined,
            timestamp: Date.now()
        };
        const { saveProject } = await import('../src/services/projectService');
        const blob = await saveProject(minimalProject);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ov.name || 'layer'}_template.tileproject`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadViewedLayer = async (ov: ProjectOverlay) => {
        const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
        const f = ov.filters;
        const footprint = f.staticScale / 100;
        const tileW = config.width * footprint, tileH = config.height * footprint;
        
        const rx = Math.max(1, Number(ov.repeatX) || 1);
        const ry = Math.max(1, Number(ov.repeatY) || 1);
        const minX = -ry * (tileW / 2);
        const maxX = rx * (tileW / 2);
        const minY = -tileH;
        const maxY = (rx + ry) * (tileH / 2) + tileH * 2.5;
        
        const leftVal = isNaN(ov.x) ? 0 : Math.round(ov.x + minX);
        const topVal = isNaN(ov.y) ? 0 : Math.round(ov.y + minY);
        const targetWidth = Math.max(1, Math.ceil((maxX - minX) + tileW * 2) || 1); 
        const targetHeight = Math.max(1, Math.ceil((maxY - minY) + tileH * 2) || 1); 

        const canvas = await renderOverlayFully(ov, leftVal, topVal, config, targetWidth, targetHeight, overlays, 1);
        if (canvas) {
            const outCanvas = transparencyColor ? removeFakeTransparency(canvas, transparencyColor, tolerance) : canvas;
            const link = document.createElement('a');
            link.href = outCanvas.toDataURL('image/png');
            link.download = `viewed-layer-${ov.id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleImageSelect = (id: string, e: ReactMouseEvent) => { 
        if (activeInjectionEyedropperId || activeLassoId || isAltHeld || isEyedropperActive || isContourPickerActive || isContourLassoActive || toolMode === 'TRANSITION_STAMP') return; 
        const n = new Set(selectedImageIds); 
        if (e.ctrlKey || e.metaKey) { if (n.has(id)) n.delete(id); else n.add(id); } else { if (!n.has(id)) { n.clear(); n.add(id); } } 
        setSelectedImageIds(n); 
    };

    const isPointInPoly = (p: {x: number, y: number}, poly: {x: number, y: number}[]) => {
        let isInside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if (((poly[i].y > p.y) !== (poly[j].y > p.y)) && (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) isInside = !isInside; }
        return isInside;
    };

    const sampleColorsInLasso = async (path: {x: number, y: number}[] = [], lassoOverlayId?: string | null, contourLasso?: boolean) => {
        if (path.length < 2) return;

        const collectedColors = await sampleColorsFromLasso(
            path,
            imagesRef.current,
            gridTypeRef.current,
            transColorRef.current,
            toleranceRef.current
        );

        if (collectedColors.length === 0) return;

        if (!contourLasso && activeInjectionTargetRef.current === 'edgeJitterColorRange') {
            const ovId = lassoOverlayId ?? activeLassoIdRef.current;
            const ov = overlaysRef.current.find(o => o.id === ovId);
            if (!ov) return;

            const existingColors = [...(ov.filters.edgeJitterColors || [])];
            const existingSet = new Set(existingColors.map(c => `${c.r},${c.g},${c.b}`));

            for (const col of collectedColors) {
                const key = `${col.r},${col.g},${col.b}`;
                if (!existingSet.has(key)) {
                    existingSet.add(key);
                    existingColors.push(col);
                }
            }

            onUpdateOverlay(ov.id, { filters: { ...ov.filters, edgeJitterColors: existingColors, edgeJitterColorRangeOnly: true } });
            return;
        }

        let targetGroups: MaskGroup[] = [];
        let targetGroupId: string | null = null;
        let updateCallback: (groups: MaskGroup[]) => void;

        if (contourLasso) {
            targetGroups = [...contourSettings.maskGroups];
            targetGroupId = contourSettings.activeMaskGroupId;
            updateCallback = (next) => setContourSettings({ ...contourSettings, maskGroups: next, activeMaskGroupId: targetGroupId });
        } else {
            const ovId = lassoOverlayId ?? activeLassoIdRef.current;
            const ov = overlaysRef.current.find(o => o.id === ovId) || getEffectiveInjectionOverlay(ovId);
            if (!ov) return;
            
            targetGroups = [...ov.filters.maskGroups];
            targetGroupId = activeMaskGroupIdRef.current;

            updateCallback = (next) => {
                onUpdateOverlay(ov.id, { filters: { ...ov.filters, maskGroups: next, activeMaskGroupId: targetGroupId, maskToColor: true } });
            };
        }

        if (targetGroups.length === 0) {
            const newGroup = { id: `group-${Date.now()}`, colors: [], tolerance: 10 };
            targetGroups = [newGroup];
            targetGroupId = newGroup.id;
            setActiveMaskGroupId(targetGroupId);
        } else if (!targetGroupId || !targetGroups.some(g => g.id === targetGroupId)) {
            targetGroupId = targetGroups[targetGroups.length - 1].id;
            setActiveMaskGroupId(targetGroupId);
        }

        const newGroups = targetGroups.map(g => {
            if (g.id !== targetGroupId) return g;
            const existingColors = [...g.colors];
            const existingSet = new Set(existingColors.map(c => `${c.r},${c.g},${c.b}`));
            for (const col of collectedColors) {
                const key = `${col.r},${col.g},${col.b}`;
                if (!existingSet.has(key)) {
                    existingSet.add(key);
                    existingColors.push(col);
                }
            }
            return { ...g, colors: existingColors };
        });

        updateCallback(newGroups);
    };

    const handleCanvasMouseDown = (e: ReactMouseEvent) => { 
        if (isThreeDMode) return;
        if (e.button === 2) { 
            e.preventDefault(); 
            if (heldImages && heldImages.length > 0) {
                onClearHeldImages?.();
                return;
            }
            if (activeInjectionEyedropperId || activeLassoId || isContourPickerActive || isContourLassoActive || toolMode === 'TRANSITION_STAMP' || toolMode === 'HAND_BRUSH') {
                setActiveInjectionEyedropperId(null);
                setActiveLassoId(null);
                setIsContourPickerActive(false);
                setIsContourLassoActive(false);
                setToolMode('SELECT');
                setIsCapturingStamp(false);
                setIsHandBrushOpen(false);
                return;
            }
            setSelectedImageIds(new Set()); 
            return; 
        }
        const canvasRect = canvasContainerRef.current!.getBoundingClientRect();
        const startX = (e.clientX - canvasRect.left) / zoom; 
        const startY = (e.clientY - canvasRect.top) / zoom;
        
        if (heldImages && heldImages.length > 0) {
            const currentConfig = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
            const iso = screenToIso(startX, startY, currentConfig.width, currentConfig.height);
            const firstSpan = getTileCellSpan(heldImages[0], currentConfig.width, currentConfig.height);
            const anchorGridX = Math.round(iso.i) - firstSpan.minCol;
            const anchorGridY = Math.round(iso.j) - firstSpan.minRow;

            const placedImages = computeHeldTilesPlacement(
                heldImages,
                anchorGridX,
                anchorGridY,
                images,
                autoSlopeSnap && isSnapEnabled,
                currentConfig.width,
                currentConfig.height
            );

            onPlaceHeldImages?.(placedImages);
            return;
        }
        
        if (toolMode === 'HAND_BRUSH') {
            if (handBrushSettingsRef.current.onlySelectedTiles && selectedImageIds.size === 0) {
                setToolbarWarning("'Only to Selected Tiles' is enabled! Select tiles first or uncheck 'Only to Selected Tiles'.");
                setTimeout(() => setToolbarWarning(null), 3000);
                return;
            }
            handleHandBrushDraw(startX, startY);
            let lastDrawX = startX;
            let lastDrawY = startY;
            const onBrushMove = (moveEv: MouseEvent) => {
                if (!canvasContainerRef.current) return;
                const rect = canvasContainerRef.current.getBoundingClientRect();
                const curX = (moveEv.clientX - rect.left) / zoom; 
                const curY = (moveEv.clientY - rect.top) / zoom;
                const dist = Math.sqrt(Math.pow(curX - lastDrawX, 2) + Math.pow(curY - lastDrawY, 2));
                if (dist > 10) {
                    handleHandBrushDraw(curX, curY);
                    lastDrawX = curX;
                    lastDrawY = curY;
                }
            };
            const onBrushUp = () => {
                window.removeEventListener('mousemove', onBrushMove);
                window.removeEventListener('mouseup', onBrushUp);
                handleHandBrushEnd();
            };
            window.addEventListener('mousemove', onBrushMove);
            window.addEventListener('mouseup', onBrushUp);
            return;
        }

        if (toolMode === 'TRANSITION_STAMP' && !isCapturingStamp) {
            handleStampDraw(startX, startY);
            let lastDrawX = startX;
            let lastDrawY = startY;
            const onStampMove = (moveEv: MouseEvent) => {
                if (!canvasContainerRef.current) return;
                const rect = canvasContainerRef.current.getBoundingClientRect();
                const curX = (moveEv.clientX - rect.left) / zoom; 
                const curY = (moveEv.clientY - rect.top) / zoom;
                const dist = Math.sqrt(Math.pow(curX - lastDrawX, 2) + Math.pow(curY - lastDrawY, 2));
                if (dist > 10) {
                    handleStampDraw(curX, curY);
                    lastDrawX = curX;
                    lastDrawY = curY;
                }
            };
            const onStampUp = () => {
                window.removeEventListener('mousemove', onStampMove); window.removeEventListener('mouseup', onStampUp);
            };
            window.addEventListener('mousemove', onStampMove); window.addEventListener('mouseup', onStampUp);
            return;
        }

        if (activeLassoId || isContourLassoActive) { 
            // Capture these values NOW before any state resets so async fn can use them
            const capturedLassoId = activeLassoId;
            const capturedContourLasso = isContourLassoActive;
            const collectedPath = [{x: startX, y: startY}];
            setLassoPath(collectedPath); 
            const onLassoMove = (moveEv: MouseEvent) => {
                if (!canvasContainerRef.current) return;
                const rect = canvasContainerRef.current.getBoundingClientRect();
                const curX = (moveEv.clientX - rect.left) / zoom; 
                const curY = (moveEv.clientY - rect.top) / zoom;
                collectedPath.push({x: curX, y: curY});
                setLassoPath([...collectedPath]);
            };
            const onLassoUp = () => {
                window.removeEventListener('mousemove', onLassoMove); window.removeEventListener('mouseup', onLassoUp);
                // Auto-off lasso before sampling so the captured IDs are used
                setActiveLassoId(null);
                setIsContourLassoActive(false);
                setLassoPath([]);
                if (collectedPath.length > 1) {
                    sampleColorsInLasso(collectedPath, capturedLassoId, capturedContourLasso); 
                }
            };
            window.addEventListener('mousemove', onLassoMove); window.addEventListener('mouseup', onLassoUp);
            return; 
        }
        
        const targetElem = e.target as HTMLElement;
        const isPanelOrControl = !!targetElem.closest('button, input, select, textarea, [role="dialog"], .fixed');
        const isClickingCanvas = !isPanelOrControl;
        if (isAltHeld || isClickingCanvas || isCapturingStamp) {
            if (isThreeDMode && !isCapturingStamp) return;
            if (isTileControlDisabled && !isCapturingStamp) return;
            if (isEyedropperActive || e.button !== 0 || activeInjectionEyedropperId || isContourPickerActive) return; 
            setSelectionBox({ x1: startX, y1: startY, x2: startX, y2: startY, active: true }); 
            if (!e.ctrlKey && !isCapturingStamp) {
                setTimeout(() => {
                    setSelectedImageIds(new Set());
                }, 0);
            }
            const onMouseMove = (moveEv: MouseEvent) => {
                setSelectionBox(prev => ({ ...prev, x2: (moveEv.clientX - canvasRect.left) / zoom, y2: (moveEv.clientY - canvasRect.top) / zoom }));
            };
            const onMouseUp = (upEv: MouseEvent) => {
                window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp);
                
                const finalX2 = (upEv.clientX - canvasRect.left) / zoom;
                const finalY2 = (upEv.clientY - canvasRect.top) / zoom;
                const finalBox = { x1: startX, y1: startY, x2: finalX2, y2: finalY2 };

                if (isCapturingStamp) {
                    handleStampCapture(finalBox);
                } else {
                    const minX = Math.min(finalBox.x1, finalBox.x2), maxX = Math.max(finalBox.x1, finalBox.x2), minY = Math.min(finalBox.y1, finalBox.y2), maxY = Math.max(finalBox.y1, finalBox.y2); 
                    const ns = new Set((e.ctrlKey || e.metaKey) ? selectedIdsRef.current : []); 
                    if (Math.abs(finalBox.x1 - finalBox.x2) + Math.abs(finalBox.y1 - finalBox.y2) > 3) { 
                        const currentConfig = GRID_CONFIGS[activeGridRef.current] || { width: 48, height: 24 };
                        imagesRef.current.forEach(img => { 
                            const drawPos = getImageDrawPos(img, currentConfig.width, currentConfig.height);
                            const left = Math.floor(drawPos.x) + img.offsetX;
                            const top = Math.floor(drawPos.y) + img.offsetY;
                            if (left < maxX && left + img.width > minX && top < maxY && top + img.height > minY) ns.add(img.id); 
                        }); 
                        setSelectedImageIds(ns); 
                    } else if (!(e.ctrlKey || e.metaKey)) setSelectedImageIds(new Set());
                }
                setSelectionBox(prev => ({ ...prev, active: false }));
            };
            window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            setHeldCursorPos({ x, y });
        }
        const filename = e.dataTransfer.getData('tile-filename');
        if (filename) {
            e.preventDefault();
            onDropLibraryTile(filename);
        }
    };

    const effectivePreviewMaskId = previewMaskId;

    return (
        <div 
            ref={viewportRef} 
            className="flex-grow overflow-auto bg-[#0d1117] relative scrollbar-thin scrollbar-thumb-slate-700"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDrop}
            onMouseMove={(e) => {
                if (canvasContainerRef.current) {
                    const rect = canvasContainerRef.current.getBoundingClientRect();
                    const cx = (e.clientX - rect.left) / zoom;
                    const cy = (e.clientY - rect.top) / zoom;
                    setHeldCursorPos({ x: cx, y: cy });
                } else {
                    setHeldCursorPos(null);
                }

                if (toolMode === 'HAND_BRUSH' && canvasContainerRef.current) {
                    const rect = canvasContainerRef.current.getBoundingClientRect();
                    setHandBrushCursorPos({
                        x: (e.clientX - rect.left) / zoom,
                        y: (e.clientY - rect.top) / zoom
                    });
                } else if (toolMode !== 'HAND_BRUSH') {
                    setHandBrushCursorPos(null);
                }

                if (toolMode === 'TRANSITION_STAMP' && !isCapturingStamp && canvasContainerRef.current) {
                    const rect = canvasContainerRef.current.getBoundingClientRect();
                    setStampCursorPos({
                        x: (e.clientX - rect.left) / zoom,
                        y: (e.clientY - rect.top) / zoom
                    });
                } else {
                    setStampCursorPos(null);
                }
            }}
            onMouseLeave={() => {
                setHeldCursorPos(null);
                setHandBrushCursorPos(null);
                setStampCursorPos(null);
            }}
        >
            <input type="file" ref={replaceInputRef} className="hidden" accept="image/*" onChange={e => e.currentTarget.files?.[0] && handleReplaceFile(e.currentTarget.files[0])} />
            {(selectionBox.active || (activeLassoId && lassoPath.length > 0) || (isContourLassoActive && lassoPath.length > 0)) && ( <div className="fixed inset-0 z-[9000] cursor-crosshair" /> )}
            {showDrawModal && <DrawMaskModal onClose={() => setShowDrawModal(null)} onSave={(src) => { 
                const ov = overlays.find(o => o.id === showDrawModal);
                if (ov) onUpdateOverlay(showDrawModal, { filters: { ...ov.filters, customStampSrc: src } });
                setShowDrawModal(null); 
            }} />}
            {isCapturingStamp && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl font-black uppercase tracking-widest animate-pulse flex items-center space-x-3 border-2 border-white/20">
                    <LucideCamera className="w-5 h-5" />
                    <span>Capturing Stamp: Drag to select area</span>
                </div>
            )}
            {toolMode === 'TRANSITION_STAMP' && !isCapturingStamp && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] bg-cyan-600 text-white px-6 py-3 rounded-full shadow-2xl font-black uppercase tracking-widest flex items-center space-x-3 border-2 border-white/20">
                    <LucideMousePointer2 className="w-5 h-5" />
                    <span>Stamp Tool Active: Click tiles to draw</span>
                </div>
            )}
            {toolMode === 'HAND_BRUSH' && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] bg-cyan-600/90 text-white px-5 py-2.5 rounded-full shadow-2xl font-black uppercase tracking-wider flex items-center space-x-2 border border-cyan-400/40 backdrop-blur-md pointer-events-none">
                    <LucideBrush className="w-4 h-4 text-cyan-200" />
                    <span className="text-xs">
                        Hand Brush Active{' '}
                        {handBrushSettings.onlySelectedTiles
                            ? selectedImageIds.size > 0
                                ? `(Selected Only: ${selectedImageIds.size} tile${selectedImageIds.size > 1 ? 's' : ''})`
                                : '(Select tiles or uncheck Only to Selected Tiles)'
                            : '(All Tiles)'}
                    </span>
                </div>
            )}
            <TextureInjectionPanel 
                key="texture-injection-panel"
                isOpen={showTextureInjection} 
                onClose={() => setShowTextureInjection(false)}
                activeOverlay={getEffectiveInjectionOverlay()}
                onUpdateOverlay={onUpdateOverlay}
                allOverlays={overlays}
                threeDObjects={threeDObjects}
                setOpenSettingsId={setTextureInjectionOverlayId}
                activeInjectionTarget={activeInjectionTarget}
                setActiveInjectionTarget={setActiveInjectionTarget}
                activeMaskGroupId={activeMaskGroupId}
                setActiveMaskGroupId={setActiveMaskGroupId}
                activeTransitionGroupId={activeTransitionGroupId}
                setActiveTransitionGroupId={setActiveTransitionGroupId}
                activeSecondaryGroupId={activeSecondaryGroupId}
                setActiveSecondaryGroupId={setActiveSecondaryGroupId}
                activeExtraGroupId={activeExtraGroupId}
                setActiveExtraGroupId={setActiveExtraGroupId}
                isEyedropperActive={!!activeInjectionEyedropperId}
                setIsEyedropperActive={(v) => {
                    if (v) {
                        const targetId = getEffectiveInjectionOverlay()?.id || null;
                        setActiveInjectionEyedropperId(targetId);
                    } else {
                        setActiveInjectionEyedropperId(null);
                    }
                }}
                isLassoActive={!!activeLassoId}
                setIsLassoActive={(v) => {
                    if (v) {
                        const targetId = getEffectiveInjectionOverlay()?.id || null;
                        setActiveLassoId(targetId);
                    } else {
                        setActiveLassoId(null);
                    }
                }}
                isGlobalEyedropperActive={isGlobalEyedropperActive}
                setIsGlobalEyedropperActive={setIsGlobalEyedropperActive}
                onApplyMaskToImages={onApplyMaskToImages}
                onUndo={onUndo}
                onUndoInjection={onUndoInjection}
                onUndoOriginalColor={onUndoOriginalColor}
                onApplyOriginalColorAdjustment={onApplyOriginalColorAdjustment}
                canUndo={canUndo}
                canUndoInjection={canUndoInjection}
                canUndoOriginalColor={canUndoOriginalColor}
                pickedColor={pickedColor}
                previewMaskId={previewMaskId}
                setPreviewMaskId={setPreviewMaskId}
                previewGroupIds={previewGroupIds}
                setPreviewGroupIds={setPreviewGroupIds}
                selectedImages={images.filter(img => selectedImageIds.has(img.id))}
                onOpenPalette={setShowPaletteForGroupId}
                transparencyColor={transparencyColor}
                tolerance={tolerance}
                onBakeSmartOverlay={onBakeSmartOverlay}
            />
            {showPaletteForGroupId && (
                <TilePaletteModal 
                    selectedImages={images.filter(img => selectedImageIds.has(img.id))}
                    existingColors={(() => {
                        const activeOverlay = getEffectiveInjectionOverlay();
                        return activeOverlay?.filters.maskGroups.find(g => g.id === showPaletteForGroupId)?.colors || [];
                    })()}
                    transparencyColor={transparencyColor}
                    tolerance={tolerance}
                    onClose={() => setShowPaletteForGroupId(null)}
                    onAddColors={(colors) => {
                        const activeOverlay = getEffectiveInjectionOverlay();
                        if (!activeOverlay) return;
                        const f = activeOverlay.filters;
                        const nextGroups = f.maskGroups.map(g => {
                            if (g.id === showPaletteForGroupId) {
                                const existingKeys = new Set(g.colors.map(c => `${c.r},${c.g},${c.b}`));
                                const newColors = colors.filter(c => !existingKeys.has(`${c.r},${c.g},${c.b}`));
                                return { ...g, colors: [...g.colors, ...newColors] };
                            }
                            return g;
                        });
                        onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: nextGroups } });
                    }}
                />
            )}

            <HandBrushPanel
                isOpen={isHandBrushOpen}
                onClose={() => {
                    setIsHandBrushOpen(false);
                    if (toolMode === 'HAND_BRUSH') setToolMode('SELECT');
                }}
                settings={handBrushSettings}
                onUpdateSettings={(updates) => setHandBrushSettings(prev => ({ ...prev, ...updates }))}
                overlays={overlays}
                threeDObjectsCount={threeDObjects.length}
                images={images}
                selectedImageIds={selectedImageIds}
                gridType={gridType}
                onBakeUnderneath={handleBakeUnderneath}
                isBakingUnderneath={isBakingUnderneath}
                isUndoWindowOpen={isBrushUndoWindowOpen}
                onToggleUndoWindow={() => setIsBrushUndoWindowOpen(prev => !prev)}
                brushHistoryCount={brushHistoryEntries.length}
            />

            <BrushUndoWindow
                isOpen={isHandBrushOpen && isBrushUndoWindowOpen}
                onClose={() => setIsBrushUndoWindowOpen(false)}
                entries={brushHistoryEntries}
                currentIndex={brushHistoryIndex}
                onUndoBrush={handleUndoBrush}
                onRedoBrush={handleRedoBrush}
                onJumpToIndex={handleJumpBrushHistory}
                onClearBrushHistory={handleClearBrushHistory}
            />

            <IsotilesPanel
                isOpen={showIsotilesWindow}
                onClose={() => setShowIsotilesWindow(false)}
                images={images}
                selectedImageIds={selectedImageIds}
                setSelectedImageIds={setSelectedImageIds}
                onRemoveImage={(id) => {
                    const nextImages = images.filter(img => img.id !== id);
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                    setSelectedImageIds(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }}
                onRemoveSelectedImages={() => {
                    if (selectedImageIds.size === 0) return;
                    const nextImages = images.filter(img => !selectedImageIds.has(img.id));
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                    setSelectedImageIds(new Set());
                }}
                onFilesChange={onFilesChange}
                onOpenLibrary={onOpenLibrary}
                onFlip={onFlip}
                onPackIsometric={onPackIsometric}
                onColorPack={onColorPack}
                onTurnToLayer={async () => {
                    const selectedTiles = images.filter(img => selectedImageIds.has(img.id));
                    if (selectedTiles.length === 0) return;
                    const newOverlay = await convertIsotilesToTiledOverlay(selectedTiles, activeGrid, 'front');
                    if (newOverlay) {
                        onReorderOverlays([...overlays, newOverlay]);
                        setShowLayers(true);
                        setOpenSettingsId(newOverlay.id);
                    }
                }}
                onOpenSeamlessMaker={() => setShowSeamlessMaker(true)}
                overlays={overlays}
                gridType={activeGrid}
                transparencyColor={transparencyColor}
                tolerance={tolerance}
                onReplaceImages={(updatedImages) => {
                    if (props.onImagesChange) props.onImagesChange(updatedImages);
                    else onStampDraw(updatedImages);
                }}
                cellHeight={(GRID_CONFIGS[activeGrid] || { width: 48, height: 24 }).height}
                autoSlopeSnap={autoSlopeSnap}
                onToggleAutoSlopeSnap={setAutoSlopeSnap}
                onAdjustHeightLevel={(delta) => {
                    if (selectedImageIds.size === 0) return;
                    const nextImages = images.map(img =>
                        selectedImageIds.has(img.id)
                            ? { ...img, heightLevel: (img.heightLevel ?? 0) + delta }
                            : img
                    );
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                }}
                onResetHeightLevel={() => {
                    if (selectedImageIds.size === 0) return;
                    const nextImages = images.map(img =>
                        selectedImageIds.has(img.id)
                            ? { ...img, heightLevel: 0 }
                            : img
                    );
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                }}
                onAutoMatchRampHeights={() => {
                    const currentConfig = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
                    const nextImages = autoMatchTileHeightsOnCanvas(
                        images,
                        selectedImageIds,
                        currentConfig.width,
                        currentConfig.height
                    );
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                }}
            />

            <SeamlessMakerPanel
                isOpen={showSeamlessMaker}
                onClose={() => setShowSeamlessMaker(false)}
                images={images}
                selectedImageIds={selectedImageIds}
                gridType={activeGrid}
                transparencyColor={transparencyColor}
                tolerance={tolerance}
                onPreviewUpdate={setSeamlessPreviewSrcs}
                onApplySeamless={(updatedMap) => {
                    const nextImages = images.map(img => updatedMap.get(img.id) || img);
                    if (props.onImagesChange) props.onImagesChange(nextImages);
                    else onStampDraw(nextImages);
                }}
            />

            {isThreeDMode && (
                <ThreeDPanel 
                    objects={threeDObjects} 
                    selectedObjectId={selectedThreeDObjectId} 
                    selectedObjectIds={selectedThreeDObjectIds}
                    onSelectObject={(id, toggleMulti) => {
                        if (toggleMulti && setSelectedThreeDObjectIds) {
                            setSelectedThreeDObjectIds(prev => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                const arr = Array.from(next);
                                setSelectedThreeDObjectId(arr.length > 0 ? arr[arr.length - 1] : null);
                                return next;
                            });
                        } else {
                            setSelectedThreeDObjectId(id);
                            setSelectedThreeDObjectIds?.(new Set([id]));
                        }
                    }}
                    overlays={overlays}
                    gridType={activeGrid}
                    templateName={templateName}
                    onAddObject={onAddThreeDObject} 
                    onAddLoadedObject={onAddLoadedThreeDObject}
                    onRemoveObject={onRemoveThreeDObject} 
                    onDuplicateObject={onDuplicateThreeDObject}
                    onUpdateObject={onUpdateThreeDObject} 
                    onBake={onBakeThreeD}
                    onSnapToTile={onSnapThreeDToTile}
                    onClose={() => setIsThreeDMode(false)}
                    onConvertLayerToPlane={onConvertLayerTo3DPlane}
                    images={images}
                    selectedImageIds={selectedImageIds}
                    onCommitExtraBakedImages={(updatedImages) => {
                        if (props.onImagesChange) props.onImagesChange(updatedImages);
                        else onStampDraw(updatedImages);
                    }}
                />
            )}
            {showLayers && (
                <LayerStack 
                    templateName={templateName}
                    overlays={overlays.filter(o => !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id) && !isSceneGroupId(o.id))} 
                    openSettingsId={openSettingsId} 
                    setOpenSettingsId={setOpenSettingsId} 
                    onUpdateOverlay={onUpdateOverlay} 
                    onRemoveOverlay={onRemoveOverlay} 
                    onReorderOverlays={onReorderOverlays} 
                    onApplyMaskToImages={onApplyMaskToImages} 
                    selectedImageIds={selectedImageIds} 
                    images={images}
                    onUndo={onUndo} 
                    canUndo={canUndo} 
                    setActiveInjectionEyedropperId={setActiveInjectionEyedropperId} 
                    activeInjectionEyedropperId={activeInjectionEyedropperId} 
                    activeInjectionTarget={activeInjectionTarget}
                    setActiveInjectionTarget={setActiveInjectionTarget}
                    activeLassoId={activeLassoId}
                    setActiveLassoId={setActiveLassoId}
                    setPreviewMaskId={setPreviewMaskId} 
                    previewMaskId={previewMaskId} 
                    setShowDrawModal={setShowDrawModal} 
                    onCommitColorSwap={async (id) => { const ov = overlays.find(o => o.id === id); if (!ov || !ov.src) return; const c = document.createElement('canvas'); const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return; const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => { c.width = img.width; c.height = img.height; ctx.drawImage(img, 0, 0); applyPixelFilters(c, ov.filters); onUpdateOverlay(id, { src: c.toDataURL('image/png'), filters: { ...ov.filters, targetColor: null, replaceColor: null } }); }; img.src = ov.src; }} 
                    onSlice4InOne={(ov) => { if (!ov.src) return; const img = new Image(); img.crossOrigin = "Anonymous"; img.onload = () => { const w = img.width / 2; const h = img.height / 2; for (let row = 0; row < 2; row++) { for (let col = 0; col < 2; col++) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); if (ctx) { ctx.drawImage(img, col * w, row * h, w, h, 0, 0, w, h); onLoadTexture(canvas.toDataURL('image/png')); } } } }; img.src = ov.src; }} 
                    onCloneLayer={handleCloneLayer} 
                    onReplaceLayer={(id) => { activeReplaceId.current = id; replaceInputRef.current?.click(); }} 
                    onDownloadLayer={handleDownloadLayer} 
                    onDownloadLayerTemplate={handleDownloadLayerTemplate}
                    onDownloadViewedLayer={handleDownloadViewedLayer}
                    onSnapOverlayToTile={onSnapOverlayToTile} 
                    gridType={gridType} 
                    isAiGenerating={isAiGenerating}
                    onAiGenerateTexture={onAiGenerateTexture}
                    onAddAdditionalTexture={onAddAdditionalTexture}
                    onReIdOverlays={onReIdOverlays}
                    onConvertLayerTo3DPlane={onConvertLayerTo3DPlane}
                    onLoadTexture={onLoadTexture}
                />
            )}
            <SceneOrganizerPanel
                isOpen={showSceneOrganizer}
                onClose={() => setShowSceneOrganizer(false)}
                overlays={overlays}
                threeDObjects={threeDObjects}
                images={images}
                selectedImageIds={selectedImageIds}
                setSelectedImageIds={setSelectedImageIds}
                selectedThreeDObjectId={selectedThreeDObjectId}
                setSelectedThreeDObjectId={setSelectedThreeDObjectId}
                openSettingsId={openSettingsId}
                setOpenSettingsId={setOpenSettingsId}
                showThreeDObjects={showThreeDObjects}
                setShowThreeDObjects={setShowThreeDObjects}
                onUpdateOverlay={onUpdateOverlay}
                onUpdateThreeDObject={onUpdateThreeDObject}
                onApplyHierarchy={(nextOverlays, nextThreeDObjects, nextImages) => {
                    if (props.onApplySceneHierarchy) {
                        props.onApplySceneHierarchy(nextOverlays, nextThreeDObjects, nextImages);
                    } else {
                        onReorderOverlays(nextOverlays);
                        if (props.onImagesChange) props.onImagesChange(nextImages);
                    }
                }}
            />
            <MainToolbar 
                onFlip={onFlip} 
                handleNudge={handleNudge} 
                onPackIsometric={onPackIsometric} 
                onColorPack={onColorPack} 
                setShowTextureInjection={setShowTextureInjection} 
                showTextureInjection={showTextureInjection} 
                customGrid={config} 
                onApplyCustomGrid={() => {}} 
                onGenerateTexture={onGenerateTexture}
                onLoadTexture={onLoadTexture}
                onLoadOverlay={onLoadOverlay}
                isThreeDMode={isThreeDMode}
                setIsThreeDMode={setIsThreeDMode}
                showThreeDObjects={showThreeDObjects}
                setShowThreeDObjects={setShowThreeDObjects}
                isSnapEnabled={isSnapEnabled}
                setIsSnapEnabled={setIsSnapEnabled}
                onOpenStampTool={onOpenStampTool}
                isStampToolOpen={isStampToolOpen}
                previewMaskId={previewMaskId}
                setPreviewMaskId={setPreviewMaskId}
                activeOverlayId={getEffectiveInjectionOverlay()?.id || null}
                onOpenDepthToImage={handleOpenDepthToImage}
                selectedImageCount={selectedImageIds.size}
                showLayers={showLayers}
                setShowLayers={setShowLayers}
                showIsotilesWindow={showIsotilesWindow}
                setShowIsotilesWindow={setShowIsotilesWindow}
                showSceneOrganizer={showSceneOrganizer}
                setShowSceneOrganizer={setShowSceneOrganizer}
                showSeamlessMaker={showSeamlessMaker}
                setShowSeamlessMaker={setShowSeamlessMaker}
                activeControlType={activeControlType}
                setActiveControlType={setActiveControlType}
                isControlIsolated={isControlIsolated}
                setIsControlIsolated={setIsControlIsolated}
                onSelectLatOption={onSelectLatOption}
                isLatLoading={isLatLoading}
                isHandBrushOpen={isHandBrushOpen}
                onToggleHandBrush={handleToggleHandBrush}
            />
            {isPreviewProcessing && (
                <div className="fixed bottom-0 left-0 right-0 h-1 bg-black/40 z-[10000] flex items-center">
                    <div 
                        className="h-full bg-cyan-500 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                        style={{ width: `${previewProgress * 100}%` }}
                    />
                    <button 
                        onClick={() => {
                            cancelPreviewRef.current = true;
                            setIsPreviewProcessing(false);
                        }}
                        className="absolute right-2 bottom-2 bg-red-600 hover:bg-red-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded border border-red-400/30 shadow-lg transition-all active:scale-95"
                    >
                        Cancel Preview
                    </button>
                </div>
            )}
            <div 
                style={{ 
                    width: width * zoom + SCROLL_PADDING * 2, 
                    height: height * zoom + SCROLL_PADDING * 2, 
                    minWidth: '100%', 
                    minHeight: '100%', 
                    position: 'relative' 
                }} 
                className="bg-[#0d1117]"
                onMouseDown={handleCanvasMouseDown}
                onContextMenu={e => e.preventDefault()}
            >
                <div id="main-canvas-container" ref={canvasContainerRef} onDrop={handleDrop} onDragOver={e => e.preventDefault()} className="absolute bg-[#0d1117] origin-top-left transition-transform duration-100" style={{ width, height, left: 100, top: 200, transform: `scale(${zoom})`, imageRendering: 'pixelated', cursor: toolMode === 'HAND_BRUSH' ? 'none' : 'default' }} onContextMenu={e => e.preventDefault()}>
                    <div className="canvas-background absolute inset-0 opacity-[0.03] bg-[linear-gradient(90deg,#888_1px,transparent_1px),linear-gradient(180deg,#888_1px,transparent_1px)] bg-[length:96px_96px] pointer-events-none"></div>
                    <IsometricGrid type={gridType} width={width} height={height} />
                    {isCapturingStamp && (
                        <div className="absolute inset-0 border-4 border-cyan-500/50 pointer-events-none z-[9999] animate-pulse">
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
                                Capture Mode: Drag to Select Area
                            </div>
                        </div>
                    )}
                    {overlays.filter(ov => ov.placement === 'back' && !isThreeDTargetId(ov.id) && !isAllLayersTargetId(ov.id) && !isSceneGroupId(ov.id)).map(ov => ( 
                        ov.type === 'smart' ? 
                        <SmartOverlay 
                            key={ov.id} 
                            overlay={ov} 
                            onUpdate={onUpdateOverlay} 
                            zoom={zoom} 
                            isEyedropperActive={isEyedropperActive} 
                            gridType={activeGrid} 
                            activeInjectionEyedropperId={activeInjectionEyedropperId} 
                            activeLassoId={activeLassoId} 
                            isAltHeld={isAltHeld} 
                            isThreeDMode={isThreeDMode} 
                            isLayerControlDisabled={isLayerControlDisabled}
                            toolMode={toolMode}
                            allOverlays={overlays}
                            isHoldingTiles={!!(heldImages && heldImages.length > 0)}
                            onDrop={handleDrop}
                        /> : 
                        <TiledOverlay 
                            key={ov.id} 
                            overlay={ov} 
                            gridType={activeGrid} 
                            onUpdate={onUpdateOverlay} 
                            zoom={zoom} 
                            isEyedropperActive={isEyedropperActive} 
                            activeInjectionEyedropperId={activeInjectionEyedropperId} 
                            activeLassoId={activeLassoId} 
                            isAltHeld={isAltHeld} 
                            isThreeDMode={isThreeDMode} 
                            isLayerControlDisabled={isLayerControlDisabled}
                            toolMode={toolMode}
                            allOverlays={overlays}
                            isHoldingTiles={!!(heldImages && heldImages.length > 0)}
                            onDrop={handleDrop}
                        /> 
                    ))}
                    {images.map(image => (
                        <DraggableImage 
                            key={image.id} 
                            image={image} 
                            allImages={images}
                            autoSlopeSnap={autoSlopeSnap}
                            onUpdateImagePos={onUpdateImagePos} 
                            isEyedropperActive={isEyedropperActive} 
                            transparencyColor={transparencyColor} 
                            tolerance={tolerance} 
                            gridType={gridType} 
                            lastActiveGrid={lastActiveGrid}
                            isSelected={selectedImageIds.has(image.id)} 
                            onSelect={(e) => handleImageSelect(image.id, e)} 
                            zoom={zoom} 
                            selectedImageIds={selectedImageIds} 
                            previewContour={isLivePreview ? contourSettings : null} 
                            previewMaskOverlay={previewMaskId ? getEffectiveInjectionOverlay(previewMaskId) : (previewGroupIds.length > 0 ? getEffectiveInjectionOverlay() : null)} 
                            previewGroupIds={previewGroupIds}
                            previewBakedSrc={seamlessPreviewSrcs[image.id] || previewBakedSrcs[image.id] || null} 
                            overlays={overlays}
                            activeInjectionEyedropperId={activeInjectionEyedropperId} 
                            activeLassoId={activeLassoId} 
                            isContourPickerActive={isContourPickerActive}
                            isContourLassoActive={isContourLassoActive}
                            isAltHeld={isAltHeld} 
                            isThreeDMode={isThreeDMode}
                            isTileControlDisabled={isTileControlDisabled}
                            isSnapEnabled={isSnapEnabled}
                            useTransparencyToDrag={useTransparencyToDrag}
                            onGlobalTransparencyPick={onColorPick} 
                            toolMode={toolMode}
                            hideSelectionOutline={toolMode === 'HAND_BRUSH' && !handBrushSettings.showSelectionBox}
                            isCapturingStamp={isCapturingStamp}
                            isHoldingTiles={!!(heldImages && heldImages.length > 0)}
                            onDrop={handleDrop}
                            onSampleColor={(color) => {
                                if (color.a < 0.05) return;

                                if (activeInjectionTarget === 'edgeJitterColorRange' && activeInjectionEyedropperId) {
                                    const ov = overlays.find(o => o.id === activeInjectionEyedropperId);
                                    if (!ov) return;
                                    const currentColors = ov.filters.edgeJitterColors || [];
                                    if (!currentColors.some(c => colorDistance(c, color) < 2)) {
                                        onUpdateOverlay(ov.id, {
                                            filters: {
                                                ...ov.filters,
                                                edgeJitterColors: [...currentColors, color],
                                                edgeJitterColorRangeOnly: true
                                            }
                                        });
                                    }
                                    return;
                                }

                                if (activeInjectionTarget.startsWith('smartSwap') && activeInjectionEyedropperId) {
                                    const ov = overlays.find(o => o.id === activeInjectionEyedropperId);
                                    if (!ov) return;
                                    const sampled = { r: color.r, g: color.g, b: color.b, a: 1 };

                                    if (activeInjectionTarget.startsWith('smartSwap-')) {
                                        const swapId = activeInjectionTarget.replace('smartSwap-', '');
                                        const currentList = ov.filters.smartColorSwaps || [];
                                        const nextList = currentList.map(s => s.id === swapId ? {
                                            ...s,
                                            targetColor: sampled,
                                            replaceColor: s.replaceColor || sampled
                                        } : s);
                                        onUpdateOverlay(ov.id, {
                                            filters: {
                                                ...ov.filters,
                                                smartColorSwaps: nextList
                                            }
                                        });
                                    } else {
                                        const currentSettings = ov.filters.smartColorSwapSettings || {
                                            targetColor: null,
                                            replaceColor: null,
                                            tolerance: 20,
                                            hue: 0,
                                            saturation: 100,
                                            brightness: 100,
                                            sharpening: 0,
                                            smoothing: 0
                                        };
                                        onUpdateOverlay(ov.id, {
                                            filters: {
                                                ...ov.filters,
                                                smartColorSwapSettings: {
                                                    ...currentSettings,
                                                    targetColor: sampled,
                                                    replaceColor: currentSettings.replaceColor || sampled
                                                }
                                            }
                                        });
                                    }
                                    setActiveInjectionEyedropperId(null);
                                    return;
                                }

                                if (activeInjectionEyedropperId || isContourPickerActive) {
                                    let targetGroups: MaskGroup[] = [];
                                    let targetId: string | null = null;
                                    let updateFunc: (groups: MaskGroup[]) => void;

                                    if (isContourPickerActive) {
                                        targetGroups = [...contourSettings.maskGroups];
                                        targetId = contourSettings.activeMaskGroupId;
                                        updateFunc = (next) => setContourSettings({ ...contourSettings, maskGroups: next, activeMaskGroupId: targetId });
                                    } else {
                                        const ov = overlays.find(o => o.id === activeInjectionEyedropperId) || getEffectiveInjectionOverlay(activeInjectionEyedropperId);
                                        if (!ov) return;
                                        
                                        targetGroups = [...ov.filters.maskGroups];
                                        targetId = activeMaskGroupId;
                                        updateFunc = (next) => {
                                            onUpdateOverlay(ov.id, { filters: { ...ov.filters, maskGroups: next, maskToColor: true } });
                                        };
                                    }

                                    if (targetGroups.length === 0) {
                                        const newGroup = { id: `group-${Date.now()}`, colors: [], tolerance: 10 };
                                        targetGroups = [newGroup];
                                        targetId = newGroup.id;
                                        setActiveMaskGroupId(targetId);
                                    } else if (!targetId || !targetGroups.some(g => g.id === targetId)) {
                                        targetId = targetGroups[targetGroups.length - 1].id;
                                        setActiveMaskGroupId(targetId);
                                    }
                                    
                                    const nextGroups = targetGroups.map(g => {
                                        if (g.id !== targetId) return g;
                                        if (g.colors.some(c => colorDistance(c, color) < 2)) return g;
                                        return { ...g, colors: [...g.colors, color] };
                                    });
                                    updateFunc(nextGroups);
                                }
                            }} 
                        />
                    ))}
                    {overlays.filter(ov => ov.placement === 'front' && !isThreeDTargetId(ov.id) && !isAllLayersTargetId(ov.id) && !isSceneGroupId(ov.id)).map(ov => ( 
                        ov.type === 'smart' ? 
                        <SmartOverlay 
                            key={ov.id} 
                            overlay={ov} 
                            onUpdate={onUpdateOverlay} 
                            zoom={zoom} 
                            isEyedropperActive={isEyedropperActive} 
                            gridType={activeGrid} 
                            activeInjectionEyedropperId={activeInjectionEyedropperId} 
                            activeLassoId={activeLassoId} 
                            isAltHeld={isAltHeld} 
                            isThreeDMode={isThreeDMode} 
                            isLayerControlDisabled={isLayerControlDisabled}
                            toolMode={toolMode}
                            allOverlays={overlays}
                            isHoldingTiles={!!(heldImages && heldImages.length > 0)}
                            onDrop={handleDrop}
                        /> : 
                        <TiledOverlay 
                            key={ov.id} 
                            overlay={ov} 
                            gridType={activeGrid} 
                            onUpdate={onUpdateOverlay} 
                            zoom={zoom} 
                            isEyedropperActive={isEyedropperActive} 
                            activeInjectionEyedropperId={activeInjectionEyedropperId} 
                            activeLassoId={activeLassoId} 
                            isAltHeld={isAltHeld} 
                            isThreeDMode={isThreeDMode} 
                            isLayerControlDisabled={isLayerControlDisabled}
                            toolMode={toolMode}
                            allOverlays={overlays}
                            isHoldingTiles={!!(heldImages && heldImages.length > 0)}
                            onDrop={handleDrop}
                        /> 
                    ))}
                    
                    <ThreeDCanvas 
                        ref={threeDCanvasRef}
                        width={width} 
                        height={height} 
                        objects={threeDObjects} 
                        overlays={overlays}
                        gridType={gridType}
                        selectedObjectId={selectedThreeDObjectId} 
                        selectedObjectIds={selectedThreeDObjectIds}
                        onSelectObject={(id) => {
                            setSelectedThreeDObjectId(id);
                            setSelectedThreeDObjectIds?.(id ? new Set([id]) : new Set());
                        }} 
                        onSelectObjects={(ids) => {
                            setSelectedThreeDObjectIds?.(new Set(ids));
                            setSelectedThreeDObjectId(ids.length > 0 ? ids[ids.length - 1] : null);
                        }}
                        autoGrabTrigger={autoGrabTrigger}
                        onUpdateObject={onUpdateThreeDObject} 
                        onTransformStart={onTransformStart}
                        onTransformEnd={onTransformEnd}
                        isActive={isThreeDControlActive}
                        isVisible={showThreeDObjects}
                        zoom={zoom}
                    />

                    {selectionBox.active && <div className="absolute border-2 border-cyan-400/80 bg-cyan-400/10 pointer-events-none z-[10000] rounded-[1px]" style={{ left: Math.min(selectionBox.x1, selectionBox.x2), top: Math.min(selectionBox.y1, selectionBox.y2), width: Math.abs(selectionBox.x1 - selectionBox.x2), height: Math.abs(selectionBox.y1 - selectionBox.y2) }} /> }
                    {(activeLassoId || isContourLassoActive) && lassoPath.length > 1 && (
                        <svg className="absolute inset-0 pointer-events-none z-[2000]" style={{ width, height }}>
                            <polyline points={lassoPath.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(168, 85, 247, 0.1)" stroke="rgba(168, 85, 247, 0.8)" strokeWidth="2" strokeDasharray="4 2" />
                        </svg>
                    )}

                    {toolMode === 'TRANSITION_STAMP' && !isCapturingStamp && activeStamp && stampCursorPos && (
                        <div 
                            className="absolute pointer-events-none z-[5000] border border-cyan-500/50"
                            style={{
                                left: stampCursorPos.x - activeStamp.width / 2,
                                top: stampCursorPos.y - activeStamp.height / 2,
                                width: activeStamp.width,
                                height: activeStamp.height,
                                backgroundImage: `url(${activeStamp.dataUrl})`,
                                backgroundSize: '100% 100%',
                                imageRendering: 'pixelated',
                                transform: `skew(${activeStamp.skewX}deg, ${activeStamp.skewY}deg)`,
                                opacity: 0.7
                            }}
                        >
                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                        </div>
                    )}

                    {toolMode === 'HAND_BRUSH' && (
                        <HandBrushCursor
                            cursorPos={handBrushCursorPos}
                            settings={handBrushSettings}
                            config={GRID_CONFIGS[activeGrid] || { width: 48, height: 24 }}
                            zoom={zoom}
                        />
                    )}

                    {heldImages && heldImages.length > 0 && heldCursorPos && (() => {
                        const currentConfig = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
                        const iso = screenToIso(heldCursorPos.x, heldCursorPos.y, currentConfig.width, currentConfig.height);
                        const firstSpan = getTileCellSpan(heldImages[0], currentConfig.width, currentConfig.height);
                        const anchorGridX = Math.round(iso.i) - firstSpan.minCol;
                        const anchorGridY = Math.round(iso.j) - firstSpan.minRow;
                        const previewPlaced = computeHeldTilesPlacement(
                            heldImages,
                            anchorGridX,
                            anchorGridY,
                            images,
                            autoSlopeSnap && isSnapEnabled,
                            currentConfig.width,
                            currentConfig.height
                        );

                        return previewPlaced.map((img, idx) => {
                            const drawPos = getImageDrawPos(img, currentConfig.width, currentConfig.height);
                            
                            return (
                                <div 
                                    key={`held-preview-${idx}`}
                                    className="absolute pointer-events-none opacity-60 z-[99999]"
                                    style={{
                                        left: drawPos.x + (img.offsetX || 0),
                                        top: drawPos.y + (img.offsetY || 0),
                                        width: img.width,
                                        height: img.height,
                                    }}
                                >
                                    <img 
                                        src={img.src} 
                                        className="w-full h-full object-contain" 
                                        style={{ imageRendering: 'pixelated' }}
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            <DepthToImageModal 
                isOpen={isDepthToImageOpen} 
                onClose={() => setIsDepthToImageOpen(false)} 
                screenshotData={depthScreenshot} 
                screenshotPosition={depthPosition} 
                onPlaceLayer={(src, pos) => onAddSmartOverlayAtPosition(src, pos.x, pos.y, pos.width, pos.height)} 
            />

            {toolbarWarning && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-950/95 border border-red-500/30 text-red-100 px-6 py-3.5 rounded-full shadow-2xl z-[100000] flex items-center space-x-2.5 font-sans text-xs uppercase font-black tracking-wider animate-in slide-in-from-bottom-5 fade-in duration-200">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span>{toolbarWarning}</span>
                </div>
            )}
        </div>
    );
};

export default CanvasArea;
