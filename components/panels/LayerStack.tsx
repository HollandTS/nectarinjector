
import React from 'react';
import DraggableContainer from '../DraggableContainer';
import { FilterSlider } from '../ui/FilterSlider';
import { rgbToHex, hexToRgb, getAverageColorRgb, rgbToHsl, hslToRgb } from '../../utils/colorUtils';
import { GRID_CONFIGS } from '../../constants';
import { LucidePlus, LucideTrash2, LucideSparkles, LucideImage, LucideLoader2, LucideChevronDown, LucideChevronRight, LucideChevronUp, LucideDownload, LucideSettings, LucideX, LucideCamera, LucideRotateCcw, LucideMaximize2, LucideMinimize2, LucidePalette } from 'lucide-react';
import { generateSimilarTexture } from '../../services/geminiService';
import { DEFAULT_FILTERS } from '../../constants';
import type { ProjectOverlay, OverlayFilters, ShuffleMode, JitterType, MaskGroup, TileType, GridType, JitterShape, JitterWaveShape, AdditionalTexture, SmartColorSwapSettings, RgbaColor, CanvasImage } from '../../types';
import { bakeColorFiltersToImageUrl, bakeColorSwapsToOverlayImage } from '../../utils/overlayFilterProcessor';
import { bakeJitterToOverlayImage } from '../../utils/jitterBake';
import { renderOverlayFully, loadImage } from '../../utils/textureInjection';
import { removeFakeTransparency } from '../../utils/transparencyUtils';
import { downloadCleanPng } from '../../utils/downloadUtils';
import { mergeSelectedOverlays } from '../../utils/layerMergeUtils';
import { linkSelectedOverlays, unlinkOverlay } from '../../utils/layerLinkUtils';
import { ConfirmInjectModal } from '../modals/ConfirmInjectModal';
import { LinkLayersModal } from '../modals/LinkLayersModal';
import { StockImagesModal } from '../modals/StockImagesModal';
import { LayerCard } from './layerSettings/LayerCard';

interface LayerStackProps {
    overlays: ProjectOverlay[];
    openSettingsId: string | null;
    setOpenSettingsId: (id: string | null) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
    onRemoveOverlay: (id: string) => void;
    onReorderOverlays: (newOverlays: ProjectOverlay[]) => void;
    onApplyMaskToImages: (ov: ProjectOverlay) => void;
    selectedImageIds: Set<string>;
    images?: CanvasImage[];
    onUndo: () => void;
    canUndo: boolean;
    setActiveInjectionEyedropperId: (id: string | null) => void;
    activeInjectionEyedropperId: string | null;
    activeInjectionTarget: string;
    setActiveInjectionTarget: (target: string) => void;
    activeLassoId?: string | null;
    setActiveLassoId?: (id: string | null) => void;
    setPreviewMaskId: (id: string | null) => void;
    previewMaskId: string | null;
    setShowDrawModal: (id: string | null) => void;
    onCommitColorSwap: (id: string) => void;
    onSlice4InOne: (ov: ProjectOverlay) => void;
    onCloneLayer: (ov: ProjectOverlay) => void;
    onReplaceLayer: (id: string) => void;
    onDownloadLayer: (ov: ProjectOverlay) => void;
    onDownloadViewedLayer: (ov: ProjectOverlay) => void;
    onSnapOverlayToTile: (overlayId: string) => void;
    gridType: GridType;
    isAiGenerating: string | null;
    onAiGenerateTexture: (overlayId: string) => void;
    onAddAdditionalTexture: (overlayId: string, src: string) => void;
    onReIdOverlays: () => void;
    onConvertLayerTo3DPlane?: (layerOrGroupId: string) => void;
    onLoadTexture?: (src: string, isFourInOne?: boolean, customName?: string) => void;
    templateName?: string;
}

export const LayerStack: React.FC<LayerStackProps> = ({
    overlays, openSettingsId, setOpenSettingsId, onUpdateOverlay, onRemoveOverlay, onReorderOverlays, onApplyMaskToImages, selectedImageIds, images = [], onUndo, canUndo, setActiveInjectionEyedropperId, activeInjectionEyedropperId, activeInjectionTarget, setActiveInjectionTarget, activeLassoId, setActiveLassoId, setPreviewMaskId, previewMaskId, setShowDrawModal, onCommitColorSwap, onSlice4InOne, onCloneLayer, onReplaceLayer, onDownloadLayer, onDownloadViewedLayer, onSnapOverlayToTile, gridType, isAiGenerating, onAiGenerateTexture, onAddAdditionalTexture, onReIdOverlays, onConvertLayerTo3DPlane, onLoadTexture, templateName
}) => {
    const [isAllSettingsHidden, setIsAllSettingsHidden] = React.useState(false);
    const [isMinimized, setIsMinimized] = React.useState(false);
    const [isWide, setIsWide] = React.useState(false);
    const [containerSize, setContainerSize] = React.useState<{ width: number; height: number } | undefined>(undefined);
    const [showAdditionalTextures, setShowAdditionalTextures] = React.useState<string | null>(null);
    const [openTextureSettings, setOpenTextureSettings] = React.useState<{overlayId: string, textureIdx: number} | null>(null);
    const [textureHistory, setTextureHistory] = React.useState<Record<string, any>>({});
    const [showSmartColorSwap, setShowSmartColorSwap] = React.useState<string | null>(null);
    const [showLayerPicker, setShowLayerPicker] = React.useState<string | null>(null);
    const [selectedLayerIds, setSelectedLayerIds] = React.useState<Set<string>>(new Set());
    const [isMerging, setIsMerging] = React.useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = React.useState(false);
    const [confirmInjectOverlay, setConfirmInjectOverlay] = React.useState<ProjectOverlay | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const activeOverlayForFile = React.useRef<string | null>(null);
    const layerLoadInputRef = React.useRef<HTMLInputElement>(null);

    const toggleLayerSelection = (id: string) => {
        setSelectedLayerIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleMergeLayers = async () => {
        if (selectedLayerIds.size < 2) return;
        const selectedOverlays = overlays.filter(o => selectedLayerIds.has(o.id));
        if (selectedOverlays.length < 2) return;

        setIsMerging(true);
        try {
            const newOverlays = await mergeSelectedOverlays(selectedOverlays, overlays, gridType);
            onReorderOverlays(newOverlays);
            setSelectedLayerIds(new Set());
        } catch (e) {
            console.error("Failed to merge layers:", e);
        } finally {
            setIsMerging(false);
        }
    };

    const handleConfirmLinkLayers = (name: string) => {
        if (selectedLayerIds.size < 2) return;
        const newOverlays = linkSelectedOverlays(selectedLayerIds, overlays, name);
        onReorderOverlays(newOverlays);
        setIsLinkModalOpen(false);
        setSelectedLayerIds(new Set());
    };

    const handleUnlinkLayer = (overlayId: string) => {
        const newOverlays = unlinkOverlay(overlayId, overlays);
        onReorderOverlays(newOverlays);
    };

    const handleSaveLayer = (ov: ProjectOverlay) => {
        try {
            const layerData = JSON.stringify(ov, null, 2);
            const templateTitle = templateName ? templateName.trim() : 'project';
            const layerNameSanitized = ov.name ? ov.name.trim() : 'layer';
            const fileName = `${templateTitle}+${layerNameSanitized}.nectarlayer`;

            const blob = new Blob([layerData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e: any) {
            console.error("Save Layer Error:", e);
        }
    };

    const handleLoadLayerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const parsed = JSON.parse(text);

                if (!parsed || typeof parsed !== 'object' || !parsed.name || !parsed.type) {
                    throw new Error("Invalid .nectarlayer file structure.");
                }

                // Generate new unique ID to avoid duplications
                const newId = `overlay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const loadedOverlay: ProjectOverlay = {
                    ...parsed,
                    id: newId,
                };

                onReorderOverlays([...overlays, loadedOverlay]);
            } catch (err: any) {
                console.error("Load Layer Error:", err);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Bake Tiled Overlay to Smart Overlay and Restore functions
    const handleBakeToSmart = async (ov: ProjectOverlay) => {
        if (ov.type !== 'tiled' || !ov.src) return;
        
        try {
            const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
            const f = ov.filters;
            const footprint = (f.staticScale || 100) / 100;
            const isRa2Tiled = config.width === 60 && ov.type === 'tiled';
            const ra2ScaleFix = isRa2Tiled ? 1.01015 : 1;
            const individualZoom = ((f.mainScale || 100) / 100) * ra2ScaleFix;
            const tileW = config.width * footprint, tileH = config.height * footprint;
            
            const rx = Math.max(1, Number(ov.repeatX) || 1);
            const ry = Math.max(1, Number(ov.repeatY) || 1);

            const minX = -ry * (tileW / 2);
            const maxX = rx * (tileW / 2);
            const minY = -tileH;
            const maxY = (rx + ry) * (tileH / 2) + tileH * 2.5;
            
            const targetWidth = Math.max(1, Math.ceil((maxX - minX) + tileW * 2) || 1); 
            const targetHeight = Math.max(1, Math.ceil((maxY - minY) + tileH * 2) || 1);  

            // Render the layer exactly as it is viewed
            const canvas = await renderOverlayFully(ov, ov.x + minX, ov.y + minY, config, targetWidth, targetHeight, overlays, 1);
            if (!canvas) return;

            const bakedDataUrl = canvas.toDataURL('image/png');

            // Calculate smart overlay properties
            const xSmart = ov.x + minX;
            const ySmart = ov.y + minY;
            const scaleFactor = footprint * individualZoom;
            const widthSmart = canvas.width / (scaleFactor || 1);
            const heightSmart = canvas.height / (scaleFactor || 1);

            // Back up the original tiled parameters
            const backup = {
                type: 'tiled' as const,
                src: ov.src,
                x: ov.x,
                y: ov.y,
                width: ov.width,
                height: ov.height,
                repeatX: ov.repeatX,
                repeatY: ov.repeatY,
                filters: JSON.parse(JSON.stringify(ov.filters)) as OverlayFilters
            };

            // Neutralize core filters and effects since they are now baked into the image source
            const neutralizedFilters: OverlayFilters = {
                ...ov.filters,
                blur: 0,
                sharpen: 0,
                masterSharpSmooth: 0,
                smartSmoothStrength: 0,
                balanceColors: 0,
                brightness: 100,
                contrast: 100,
                saturation: 100,
                hue: 0,
                targetColor: null,
                replaceColor: null,
                colorSwaps: [],
                pixelNoise: 0,
            };

            onUpdateOverlay(ov.id, {
                type: 'smart',
                src: bakedDataUrl,
                x: xSmart,
                y: ySmart,
                width: widthSmart,
                height: heightSmart,
                filters: neutralizedFilters,
                originalTiledBackup: backup
            });
        } catch (e) {
            console.error("Failed to render tiled layer to smart layer:", e);
        }
    };

    const handleRestoreTiled = (ov: ProjectOverlay) => {
        if (!ov.originalTiledBackup) return;
        const backup = ov.originalTiledBackup;

        onUpdateOverlay(ov.id, {
            type: 'tiled',
            src: backup.src,
            x: backup.x,
            y: backup.y,
            width: backup.width,
            height: backup.height,
            repeatX: backup.repeatX,
            repeatY: backup.repeatY,
            filters: backup.filters,
            originalTiledBackup: undefined // Clear the backup to restore un-greyed/greyed state
        });
    };

    // Color & Filters Bake State & Undo History
    const [filterUndoHistory, setFilterUndoHistory] = React.useState<Record<string, { src: string, filters: OverlayFilters }>>({});
    const [jitterUndoHistory, setJitterUndoHistory] = React.useState<Record<string, { src: string, filters: OverlayFilters }>>({});
    const [bakingOverlayId, setBakingOverlayId] = React.useState<string | null>(null);

    const handleApplyColorFilters = async (ov: ProjectOverlay) => {
        if (!ov.src) return;
        setBakingOverlayId(ov.id);
        try {
            // Backup current state for local undo (deep-copying additionalTextures array and nested filters)
            setFilterUndoHistory(prev => ({
                ...prev,
                [ov.id]: {
                    src: ov.src!,
                    filters: {
                        ...ov.filters,
                        additionalTextures: ov.filters.additionalTextures 
                            ? ov.filters.additionalTextures.map(t => ({ 
                                ...t, 
                                filters: t.filters ? { ...t.filters } : {} 
                              })) 
                            : []
                    }
                }
            }));

            // Step 1: Bake filters into the primary source image
            const bakedSrc = await bakeColorFiltersToImageUrl(ov.src, {
                ...ov.filters
            });

            // Step 2: Bake core overlay filters into each additional texture's source image
            let updatedAdditionalTextures = ov.filters.additionalTextures || [];
            if (ov.filters.additionalTextures && ov.filters.additionalTextures.length > 0) {
                updatedAdditionalTextures = await Promise.all(
                    ov.filters.additionalTextures.map(async (add) => {
                        if (!add.src) return add;
                        try {
                            const bakedAddSrc = await bakeColorFiltersToImageUrl(add.src, {
                                ...ov.filters,
                                ...(add.filters || {})
                            });
                            return { ...add, src: bakedAddSrc };
                        } catch (e) {
                            console.error("Failed to bake additional texture:", add.src, e);
                            return add;
                        }
                    })
                );
            }

            // Update the overlay: source and additional textures updated to baked, filters reset to default
            onUpdateOverlay(ov.id, {
                src: bakedSrc,
                filters: {
                    ...ov.filters,
                    additionalTextures: updatedAdditionalTextures,
                    blur: 0,
                    sharpen: 0,
                    masterSharpSmooth: 0,
                    smartSmoothStrength: 0,
                    balanceColors: 0,
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    hue: 0
                }
            });
        } catch (err: any) {
            console.error("Failed to apply and bake filters:", err);
        } finally {
            setBakingOverlayId(null);
        }
    };

    const handleApplyColorSwaps = async (ov: ProjectOverlay, swapType: 'smart' | 'normal' | 'tile' | 'all' = 'all') => {
        if (!ov.src) return;
        setBakingOverlayId(ov.id);
        try {
            // Backup current state for local undo
            setFilterUndoHistory(prev => ({
                ...prev,
                [ov.id]: {
                    src: ov.src!,
                    filters: {
                        ...ov.filters,
                        additionalTextures: ov.filters.additionalTextures 
                            ? ov.filters.additionalTextures.map(t => ({ 
                                ...t, 
                                filters: t.filters ? { ...t.filters } : {} 
                              })) 
                            : []
                    }
                }
            }));

            // Step 1: Bake color swaps into primary source image using newly added utility
            const bakedSrc = await bakeColorSwapsToOverlayImage(ov.src, ov.filters, swapType);

            // Step 2: Bake color swaps into each additional texture's source image as well!
            let updatedAdditionalTextures = ov.filters.additionalTextures || [];
            if (ov.filters.additionalTextures && ov.filters.additionalTextures.length > 0) {
                updatedAdditionalTextures = await Promise.all(
                    ov.filters.additionalTextures.map(async (add) => {
                        if (!add.src) return add;
                        try {
                            const bakedAddSrc = await bakeColorSwapsToOverlayImage(add.src, ov.filters, swapType);
                            return { ...add, src: bakedAddSrc };
                        } catch (e) {
                            console.error("Failed to bake additional texture swap:", add.src, e);
                            return add;
                        }
                    })
                );
            }

            // Update the overlay: source and additional textures updated to baked, then reset settings
            if (swapType === 'normal') {
                onUpdateOverlay(ov.id, {
                    src: bakedSrc,
                    filters: {
                        ...ov.filters,
                        additionalTextures: updatedAdditionalTextures,
                        targetColor: null,
                        replaceColor: null,
                        colorSwaps: [] // reset swaps list
                    }
                });
            } else if (swapType === 'smart') {
                onUpdateOverlay(ov.id, {
                    src: bakedSrc,
                    filters: {
                        ...ov.filters,
                        additionalTextures: updatedAdditionalTextures,
                        smartColorSwapEnabled: false,
                        smartColorSwaps: []
                    }
                });
            } else if (swapType === 'tile') {
                onUpdateOverlay(ov.id, {
                    src: bakedSrc,
                    filters: {
                        ...ov.filters,
                        additionalTextures: updatedAdditionalTextures,
                        tileColorSwaps: []
                    }
                });
            } else { // 'all'
                onUpdateOverlay(ov.id, {
                    src: bakedSrc,
                    filters: {
                        ...ov.filters,
                        additionalTextures: updatedAdditionalTextures,
                        targetColor: null,
                        replaceColor: null,
                        colorSwaps: [],
                        smartColorSwapEnabled: false,
                        smartColorSwaps: [],
                        tileColorSwaps: []
                    }
                });
            }
        } catch (err: any) {
            console.error("Failed to apply and bake color swaps:", err);
        } finally {
            setBakingOverlayId(null);
        }
    };

    const handleUndoColorFilters = (overlayId: string) => {
        const hist = filterUndoHistory[overlayId];
        if (hist) {
            onUpdateOverlay(overlayId, {
                src: hist.src,
                filters: {
                    ...hist.filters
                }
            });
            // Clear entry from local history
            setFilterUndoHistory(prev => {
                const copy = { ...prev };
                delete copy[overlayId];
                return copy;
            });
        }
    };

    const handleApplyJitter = async (ov: ProjectOverlay) => {
        if (!ov.src) return;
        setBakingOverlayId(ov.id);
        try {
            setJitterUndoHistory(prev => ({
                ...prev,
                [ov.id]: {
                    src: ov.src!,
                    filters: {
                        ...ov.filters,
                        additionalTextures: ov.filters.additionalTextures
                            ? ov.filters.additionalTextures.map(t => ({
                                ...t,
                                filters: t.filters ? { ...t.filters } : {}
                              }))
                            : []
                    }
                }
            }));

            const bakedSrc = await bakeJitterToOverlayImage(ov.src, ov.filters);

            let updatedAdditionalTextures = ov.filters.additionalTextures || [];
            if (ov.filters.additionalTextures && ov.filters.additionalTextures.length > 0) {
                updatedAdditionalTextures = await Promise.all(
                    ov.filters.additionalTextures.map(async (add) => {
                        if (!add.src) return add;
                        try {
                            const bakedAddSrc = await bakeJitterToOverlayImage(add.src, {
                                ...ov.filters,
                                ...(add.filters || {})
                            });
                            return { ...add, src: bakedAddSrc };
                        } catch (e) {
                            console.error("Failed to bake additional texture jitter:", e);
                            return add;
                        }
                    })
                );
            }

            onUpdateOverlay(ov.id, {
                src: bakedSrc,
                filters: {
                    ...ov.filters,
                    additionalTextures: updatedAdditionalTextures,
                    jitterType: 'none',
                    pixelNoise: 0,
                    edgeJitterAmount: 0,
                    edgeJitterOnly: false
                }
            });
        } catch (err: any) {
            console.error("Failed to apply and bake jitter:", err);
        } finally {
            setBakingOverlayId(null);
        }
    };

    const handleUndoJitter = (overlayId: string) => {
        const hist = jitterUndoHistory[overlayId];
        if (hist) {
            onUpdateOverlay(overlayId, {
                src: hist.src,
                filters: {
                    ...hist.filters
                }
            });
            setJitterUndoHistory(prev => {
                const copy = { ...prev };
                delete copy[overlayId];
                return copy;
            });
        }
    };

    // Click outside handler for texture settings
    React.useEffect(() => {
        if (!openTextureSettings) return;
        const handleOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.texture-settings-dropdown') && !target.closest('.texture-settings-trigger')) {
                setOpenTextureSettings(null);
            }
        };
        window.addEventListener('mousedown', handleOutside);
        return () => window.removeEventListener('mousedown', handleOutside);
    }, [openTextureSettings]);

    const moveLayer = (idx: number, d: 'up' | 'down') => {
        const nl = [...overlays];
        const ni = d === 'up' ? idx + 1 : idx - 1;
        if (ni >= 0 && ni < nl.length) {
            [nl[idx], nl[ni]] = [nl[ni], nl[idx]];
            onReorderOverlays(nl);
        }
    };

    const updateFilter = (id: string, k: keyof OverlayFilters, v: any) => {
        const ov = overlays.find(o => o.id === id);
        if (ov) {
            onUpdateOverlay(id, { filters: { ...ov.filters, [k]: v } });
        }
    };

    const getFilterStyle = (f: OverlayFilters) => {
        return `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg)`;
    };

    const handleFileBrowse = (overlayId: string) => {
        activeOverlayForFile.current = overlayId;
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0 && activeOverlayForFile.current) {
            const overlayId = activeOverlayForFile.current;
            Array.from(files).forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    onAddAdditionalTexture(overlayId, ev.target?.result as string);
                };
                reader.readAsDataURL(file);
            });
        }
        e.target.value = '';
    };

    const addColorSwap = (id: string) => {
        const ov = overlays.find(o => o.id === id);
        if (!ov) return;
        const newSwap = {
            id: `swap-${Date.now()}`,
            targetColor: null,
            replaceColor: null,
            tolerance: 20
        };
        const nextSwaps = [...(ov.filters.colorSwaps || []), newSwap];
        onUpdateOverlay(id, { filters: { ...ov.filters, colorSwaps: nextSwaps } });
    };

    const updateColorSwap = (overlayId: string, swapId: string, updates: any) => {
        const ov = overlays.find(o => o.id === overlayId);
        if (!ov) return;
        const nextSwaps = ov.filters.colorSwaps.map(s => s.id === swapId ? { ...s, ...updates } : s);
        onUpdateOverlay(overlayId, { filters: { ...ov.filters, colorSwaps: nextSwaps } });
    };

    const removeColorSwap = (overlayId: string, swapId: string) => {
        const ov = overlays.find(o => o.id === overlayId);
        if (!ov) return;
        const nextSwaps = ov.filters.colorSwaps.filter(s => s.id !== swapId);
        onUpdateOverlay(overlayId, { filters: { ...ov.filters, colorSwaps: nextSwaps } });
    };

    const isEmpty = overlays.length === 0;

    React.useEffect(() => {
        if (openSettingsId) {
            setContainerSize({ width: 450, height: 800 });
        } else if (isEmpty) {
            setContainerSize({ width: 170, height: 40 });
        } else if (isAllSettingsHidden) {
            setContainerSize({ width: 450, height: 180 });
        } else {
            setContainerSize({ width: 450, height: 280 });
        }
    }, [openSettingsId, isEmpty, isAllSettingsHidden]);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (openTextureSettings && !(e.target as HTMLElement).closest('.texture-settings-dropdown')) {
                setOpenTextureSettings(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openTextureSettings]);

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" multiple />
            <input type="file" ref={layerLoadInputRef} onChange={handleLoadLayerFile} className="hidden" accept=".nectarlayer" />
            <DraggableContainer 
                initialPos={{ x: window.innerWidth - 340, y: 20 }} 
                size={isMinimized ? { width: containerSize?.width || (isWide ? 460 : 320), height: 46 } : containerSize}
                onResize={(sz) => setContainerSize(sz)}
                resizable={!isMinimized}
                minWidth={280}
                minHeight={isMinimized ? 46 : 200}
                className={`${isEmpty ? 'w-24' : ''} bg-[#1a1f26]/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col z-[400] transition-all`}
            >
                <div className={`p-2 border-b border-slate-700 flex justify-between items-center drag-handle cursor-move select-none ${isEmpty ? 'pb-1' : 'p-3'}`}>
                    <div className="flex items-center space-x-2 flex-grow min-w-0">
                        <span className={`font-black uppercase text-cyan-400 tracking-wider truncate ${isEmpty ? 'text-[7px]' : 'text-xs'}`}>
                            Layers {overlays.length > 0 && <span className="text-[10px] text-slate-400 font-mono">({overlays.length})</span>}
                        </span>
                        <button 
                            onClick={() => layerLoadInputRef.current?.click()}
                            className="text-[8px] bg-cyan-950/40 border border-cyan-500/20 hover:bg-cyan-900/40 px-1.5 py-0.5 rounded text-cyan-400 font-black uppercase transition-all cursor-pointer"
                            title="Load Layer (.nectarlayer)"
                        >
                            Load
                        </button>
                        <button 
                            onClick={() => setIsStockModalOpen(true)}
                            className="text-[8px] bg-emerald-950/50 border border-emerald-500/30 hover:bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-400 font-black uppercase transition-all cursor-pointer"
                            title="Open Stock Images Library (/IMAGES)"
                        >
                            STOCK
                        </button>
                        {!isEmpty && (
                            <div className="flex items-center space-x-1">
                                {selectedLayerIds.size >= 2 && (
                                    <>
                                        <button 
                                            onClick={handleMergeLayers}
                                            disabled={isMerging}
                                            className="text-[8px] bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-2 py-0.5 rounded text-white font-black uppercase transition-all shadow-lg shadow-purple-600/30 flex items-center space-x-1 animate-in fade-in zoom-in-95 duration-150"
                                            title="Merge selected layers into one"
                                        >
                                            {isMerging ? (
                                                <LucideLoader2 className="w-2.5 h-2.5 animate-spin" />
                                            ) : (
                                                <span>Merge</span>
                                            )}
                                        </button>
                                        <button 
                                            onClick={() => setIsLinkModalOpen(true)}
                                            className="text-[8px] bg-sky-400 hover:bg-sky-300 px-2 py-0.5 rounded text-slate-950 font-black uppercase transition-all shadow-lg shadow-sky-400/30 flex items-center space-x-1 animate-in fade-in zoom-in-95 duration-150 cursor-pointer"
                                            title="Link selected layers together without merging"
                                        >
                                            <span>Link</span>
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={onReIdOverlays}
                                    className="text-[8px] bg-red-800 hover:bg-red-700 px-1.5 py-0.5 rounded text-red-400 font-black uppercase transition-all"
                                    title="Re-assign IDs"
                                >
                                    Re-ID
                                </button>
                                <button 
                                    onClick={() => {
                                        if (openSettingsId) {
                                            setOpenSettingsId(null);
                                            setIsAllSettingsHidden(false);
                                        } else if (overlays.length > 0) {
                                            setOpenSettingsId(overlays[overlays.length - 1].id);
                                            setIsAllSettingsHidden(false);
                                            if (!containerSize || containerSize.width <= 340) {
                                                setContainerSize({ width: 450, height: Math.max(containerSize?.height || 540, 540) });
                                                setIsWide(true);
                                            }
                                        }
                                    }}
                                    className="text-[8px] bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 hover:text-white font-black uppercase transition-all"
                                    title={openSettingsId ? "Collapse all layer settings" : "Expand top layer settings"}
                                >
                                    {openSettingsId ? 'Collapse' : 'Expand'}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                        {!isEmpty && (
                            <>
                                <button 
                                    onClick={() => {
                                        const nextWide = !isWide;
                                        setIsWide(nextWide);
                                        setContainerSize({ width: nextWide ? 460 : 320, height: containerSize?.height || 520 });
                                    }}
                                    className={`p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors ${isWide ? 'text-cyan-400 bg-cyan-950/40' : ''}`}
                                    title={isWide ? "Narrow window (320px)" : "Widen window (460px)"}
                                >
                                    {isWide ? <LucideMinimize2 className="w-3.5 h-3.5" /> : <LucideMaximize2 className="w-3.5 h-3.5" />}
                                </button>
                                <button 
                                    onClick={onUndo} 
                                    disabled={!canUndo}
                                    className={`flex items-center space-x-1 p-1 rounded text-[10px] font-black uppercase transition-all ${canUndo ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-slate-600 cursor-not-allowed opacity-50'}`}
                                    title="Undo layer action"
                                >
                                    <LucideRotateCcw className="w-3 h-3" />
                                </button>
                            </>
                        )}
                        <button 
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                            title={isMinimized ? "Expand layers panel" : "Minimize layers panel"}
                        >
                            {isMinimized ? <LucideChevronDown className="w-3.5 h-3.5" /> : <LucideChevronUp className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <div className={`overflow-y-auto scrollbar-hide ${isEmpty ? 'p-1' : 'p-3 space-y-3'}`}>
                        {isEmpty ? (
                            <div className="text-[6px] text-slate-700 text-center py-1 uppercase font-black tracking-widest opacity-30">Empty Stack</div>
                        ) : [...overlays].reverse().map((ov, revIdx) => {
                            const idx = overlays.length - 1 - revIdx;
                            const isSettingsOpen = openSettingsId === ov.id && !isAllSettingsHidden;
                            const isSelectedForMerge = selectedLayerIds.has(ov.id);

                            return (
                                <LayerCard 
                                    key={ov.id}
                                    ov={ov}
                                    idx={idx}
                                    isSettingsOpen={isSettingsOpen}
                                    isSelectedForMerge={isSelectedForMerge}
                                    onToggleExpand={() => {
                                        if (isSettingsOpen) {
                                            setOpenSettingsId(null);
                                        } else {
                                            setOpenSettingsId(ov.id);
                                            setIsAllSettingsHidden(false);
                                            if (!containerSize || containerSize.width <= 340) {
                                                setContainerSize({ width: 450, height: Math.max(containerSize?.height || 540, 540) });
                                                setIsWide(true);
                                            }
                                        }
                                    }}
                                    onToggleSelection={() => toggleLayerSelection(ov.id)}
                                    onUnlinkLayer={() => handleUnlinkLayer(ov.id)}
                                    onUpdateOverlay={onUpdateOverlay}
                                    onRemoveOverlay={onRemoveOverlay}
                                    onMoveLayer={moveLayer}
                                    onReplaceLayer={onReplaceLayer}
                                    onCloneLayer={onCloneLayer}
                                    onSnapOverlayToTile={onSnapOverlayToTile}
                                    onConvertTo3DPlane={onConvertLayerTo3DPlane}
                                    onSaveLayer={handleSaveLayer}
                                    onDownloadLayer={onDownloadLayer}
                                    onDownloadViewedLayer={onDownloadViewedLayer}
                                    onSlice4InOne={onSlice4InOne}
                                    onConfirmInject={(target) => setConfirmInjectOverlay(target)}
                                    updateFilter={updateFilter}
                                    handleBakeToSmart={handleBakeToSmart}
                                    handleRestoreTiled={handleRestoreTiled}
                                    showAdditionalTextures={showAdditionalTextures}
                                    setShowAdditionalTextures={setShowAdditionalTextures}
                                    handleFileBrowse={handleFileBrowse}
                                    onAiGenerateTexture={onAiGenerateTexture}
                                    isAiGenerating={isAiGenerating}
                                    openTextureSettings={openTextureSettings}
                                    setOpenTextureSettings={setOpenTextureSettings}
                                    handleApplyColorFilters={handleApplyColorFilters}
                                    handleUndoColorFilters={handleUndoColorFilters}
                                    bakingOverlayId={bakingOverlayId}
                                    filterUndoHistory={filterUndoHistory}
                                    setShowDrawModal={setShowDrawModal}
                                    activeLassoId={activeLassoId}
                                    setActiveLassoId={setActiveLassoId}
                                    activeInjectionEyedropperId={activeInjectionEyedropperId}
                                    setActiveInjectionEyedropperId={setActiveInjectionEyedropperId}
                                    activeInjectionTarget={activeInjectionTarget}
                                    setActiveInjectionTarget={setActiveInjectionTarget}
                                    handleApplyJitter={handleApplyJitter}
                                    handleUndoJitter={handleUndoJitter}
                                    jitterUndoHistory={jitterUndoHistory}
                                    showSmartColorSwap={showSmartColorSwap}
                                    setShowSmartColorSwap={setShowSmartColorSwap}
                                    handleApplyColorSwaps={handleApplyColorSwaps}
                                    addColorSwap={addColorSwap}
                                    updateColorSwap={updateColorSwap}
                                    removeColorSwap={removeColorSwap}
                                    selectedImageIds={selectedImageIds}
                                    images={images}
                                />
                            );
                        })}
                    </div>
                )}
            {!isEmpty && openTextureSettings && (
                (() => {
                    const ov = overlays.find(o => o.id === openTextureSettings.overlayId);
                    if (!ov) return null;
                    const tex = ov.filters.additionalTextures[openTextureSettings.textureIdx];
                    if (!tex) return null;
                    const tIdx = openTextureSettings.textureIdx;

                    const handleAutoMatch = async () => {
                        const targetAvg = await getAverageColorRgb(ov.src);
                        const texAvg = await getAverageColorRgb(tex.src);
                        const targetHsl = rgbToHsl(targetAvg.r, targetAvg.g, targetAvg.b);
                        const texHsl = rgbToHsl(texAvg.r, texAvg.g, texAvg.b);

                        // Save history
                        setTextureHistory(prev => ({
                            ...prev,
                            [`${ov.id}-${tIdx}`]: { ...tex.filters }
                        }));

                        const hueDiff = targetHsl.h - texHsl.h;
                        const satMult = targetHsl.s / (texHsl.s || 1);
                        const briMult = targetHsl.l / (texHsl.l || 1);

                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { 
                            ...t, 
                            filters: { 
                                ...t.filters, 
                                hue: hueDiff,
                                saturation: Math.min(200, Math.max(0, 100 * satMult)),
                                brightness: Math.min(200, Math.max(0, 100 * briMult))
                            } 
                        } : t);
                        updateFilter(ov.id, 'additionalTextures', next);
                    };

                    const handleUndoTexture = () => {
                        const hist = textureHistory[`${ov.id}-${tIdx}`];
                        if (hist) {
                            const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: hist } : t);
                            updateFilter(ov.id, 'additionalTextures', next);
                            // Clear history for this one
                            const nextHist = { ...textureHistory };
                            delete nextHist[`${ov.id}-${tIdx}`];
                            setTextureHistory(nextHist);
                        }
                    };

                    return (
                        <div className="texture-settings-dropdown absolute right-full mr-2 top-0 w-48 bg-[#1a1f26]/95 border border-slate-700 rounded-xl shadow-2xl p-3 z-[500] animate-in slide-in-from-right-2 duration-200 backdrop-blur-xl">
                            <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1">
                                <span className="text-[8px] font-black text-indigo-400 uppercase">Texture Settings</span>
                                <div className="flex items-center space-x-1">
                                    <button 
                                        onClick={handleAutoMatch}
                                        className="text-[7px] bg-emerald-600 hover:bg-emerald-500 px-1.5 py-0.5 rounded text-white font-black uppercase transition-all"
                                        title="Auto-match colors to target layer"
                                    >
                                        Auto-Match
                                    </button>
                                    {textureHistory[`${ov.id}-${tIdx}`] && (
                                        <button 
                                            onClick={handleUndoTexture}
                                            className="text-[7px] bg-red-800 hover:bg-red-700 px-1.5 py-0.5 rounded text-red-400 font-black uppercase transition-all"
                                            title="Undo auto-match"
                                        >
                                            Undo
                                        </button>
                                    )}
                                    <button onClick={() => setOpenTextureSettings(null)}><LucideX size={10} className="text-slate-500" /></button>
                                </div>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
                                <div className="space-y-1">
                                    <p className="text-[7px] font-bold text-slate-500 uppercase">Color & Filters</p>
                                    <FilterSlider label="Brightness" min={0} max={200} value={tex.filters.brightness || 100} defaultValue={100} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: { ...t.filters, brightness: v } } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                    <FilterSlider label="Contrast" min={0} max={200} value={tex.filters.contrast || 100} defaultValue={100} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: { ...t.filters, contrast: v } } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                    <FilterSlider label="Saturation" min={0} max={200} value={tex.filters.saturation || 100} defaultValue={100} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: { ...t.filters, saturation: v } } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                    <FilterSlider label="Hue" min={-180} max={180} value={tex.filters.hue || 0} defaultValue={0} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: { ...t.filters, hue: v } } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                </div>
                                <div className="space-y-1 pt-2 border-t border-slate-800">
                                    <p className="text-[7px] font-bold text-slate-500 uppercase">Tiling</p>
                                    <FilterSlider label="Main Scale" min={10} max={400} value={tex.filters.mainScale || 100} defaultValue={100} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, filters: { ...t.filters, mainScale: v } } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                    <FilterSlider label="Canvas Zoom" min={10} max={400} value={tex.canvasZoom || 100} defaultValue={100} onChange={v => {
                                        const next = ov.filters.additionalTextures.map((t, i) => i === tIdx ? { ...t, canvasZoom: v } : t);
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }} />
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}
            <ConfirmInjectModal
                overlay={confirmInjectOverlay}
                onConfirm={() => {
                    const target = confirmInjectOverlay;
                    setConfirmInjectOverlay(null);
                    if (target) {
                        if (previewMaskId === target.id) {
                            setPreviewMaskId(null);
                        }
                        onApplyMaskToImages(target);
                    }
                }}
                onCancel={() => setConfirmInjectOverlay(null)}
            />
            <LinkLayersModal
                isOpen={isLinkModalOpen}
                layerCount={selectedLayerIds.size}
                defaultName={`Linked Layer (${selectedLayerIds.size})`}
                onConfirm={handleConfirmLinkLayers}
                onCancel={() => setIsLinkModalOpen(false)}
            />
            <StockImagesModal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                onSelectImage={(src, name) => {
                    if (onLoadTexture) {
                        onLoadTexture(src, false, name);
                    }
                }}
            />
        </DraggableContainer>
        </>
    );
};
