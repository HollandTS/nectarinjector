import React, { useState, useEffect, useRef } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { CanvasImage, GridType, RgbaColor } from '../../types';
import { GRID_CONFIGS } from '../../constants';
import {
    SeamlessMakerSettings,
    DEFAULT_SEAMLESS_SETTINGS,
    processSeamlessIsotiles,
    SeamlessSynthesisMode,
    SeamlessBlendCurve,
    SeamlessEdgeDirection,
} from '../../utils/seamlessMakerUtils';
import { isInsideOpenTsDiamond } from '../../utils/openTsTileRenderer';
import { renderTessellationPreview } from '../../utils/seamlessPreviewRenderer';
import {
    LucideSparkles,
    LucideMinus,
    LucideMaximize2,
    LucideX,
    LucideRotateCcw,
    LucideCheck,
    LucideEye,
    LucideGrid,
    LucideSliders,
} from 'lucide-react';

interface SeamlessMakerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    gridType: GridType;
    transparencyColor: RgbaColor | null;
    tolerance: number;
    onApplySeamless: (updatedMap: Map<string, CanvasImage>) => void;
    onPreviewUpdate?: (previewMap: Record<string, string>) => void;
}

export const SeamlessMakerPanel: React.FC<SeamlessMakerPanelProps> = ({
    isOpen,
    onClose,
    images,
    selectedImageIds,
    gridType,
    transparencyColor,
    tolerance,
    onApplySeamless,
    onPreviewUpdate,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [settings, setSettings] = useState<SeamlessMakerSettings>(DEFAULT_SEAMLESS_SETTINGS);
    const [liveViewportPreview, setLiveViewportPreview] = useState(true);
    const [showSeamOverlay, setShowSeamOverlay] = useState(false);
    const [showOriginalHold, setShowOriginalHold] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
        width: 390,
        height: 640,
    });

    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const processedMapRef = useRef<Map<string, CanvasImage>>(new Map());

    const selectedTiles = images.filter((img) => selectedImageIds.has(img.id));
    const targetTiles = selectedTiles.length > 0 ? selectedTiles : images.slice(0, 16);

    const updateSetting = <K extends keyof SeamlessMakerSettings>(
        key: K,
        val: SeamlessMakerSettings[K]
    ) => {
        setSettings((prev) => ({ ...prev, [key]: val }));
    };

    // Clear viewport preview when window closes
    useEffect(() => {
        if (!isOpen && onPreviewUpdate) {
            onPreviewUpdate({});
        }
    }, [isOpen, onPreviewUpdate]);

    // Run seamless preview calculation when settings or selection change
    useEffect(() => {
        if (!isOpen || targetTiles.length === 0) {
            processedMapRef.current.clear();
            if (onPreviewUpdate) onPreviewUpdate({});
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setIsProcessing(true);
            try {
                const updatedMap = await processSeamlessIsotiles(
                    targetTiles,
                    gridType,
                    settings,
                    transparencyColor,
                    tolerance
                );
                if (cancelled) return;
                processedMapRef.current = updatedMap;

                // Update live viewport preview if enabled
                if (onPreviewUpdate) {
                    if (liveViewportPreview && !showOriginalHold) {
                        const previewObj: Record<string, string> = {};
                        updatedMap.forEach((tile, id) => {
                            previewObj[id] = tile.src;
                        });
                        onPreviewUpdate(previewObj);
                    } else {
                        onPreviewUpdate({});
                    }
                }

                // Render the 3x3 OpenTS Tessellation Preview Canvas
                await renderTessellationPreview(
                    previewCanvasRef.current,
                    showOriginalHold
                        ? targetTiles
                        : targetTiles.map((t) => updatedMap.get(t.id) || t),
                    gridType,
                    showSeamOverlay
                );
            } finally {
                if (!cancelled) setIsProcessing(false);
            }
        }, 70);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        isOpen,
        settings,
        selectedImageIds,
        images,
        gridType,
        transparencyColor,
        tolerance,
        liveViewportPreview,
        showSeamOverlay,
        showOriginalHold,
    ]);

    if (!isOpen) return null;

    const applyPreset = (preset: 'balanced' | 'soft_terrain' | 'crisp_stone' | 'multi_stitch' | 'cliff_extra') => {
        if (preset === 'balanced') {
            setSettings((prev) => ({
                ...DEFAULT_SEAMLESS_SETTINGS,
                targetArea: prev.targetArea,
                protectExtraArtwork: prev.targetArea === 'base_only',
            }));
        } else if (preset === 'soft_terrain') {
            setSettings((prev) => ({
                ...DEFAULT_SEAMLESS_SETTINGS,
                targetArea: prev.targetArea,
                protectExtraArtwork: prev.targetArea === 'base_only',
                mode: 'opposite_wrap',
                edgeWidth: 9,
                blendStrength: 95,
                blendCurve: 'cosine',
                cornerEqualizer: 80,
                cornerRadius: 7,
                luminanceMatch: 75,
                chrominanceMatch: 65,
                detailPreservation: 55,
            }));
        } else if (preset === 'crisp_stone') {
            setSettings((prev) => ({
                ...DEFAULT_SEAMLESS_SETTINGS,
                targetArea: prev.targetArea,
                protectExtraArtwork: prev.targetArea === 'base_only',
                mode: 'mirror_blend',
                edgeWidth: 5,
                blendStrength: 80,
                blendCurve: 'smoothstep',
                cornerEqualizer: 55,
                cornerRadius: 4,
                luminanceMatch: 45,
                chrominanceMatch: 35,
                detailPreservation: 90,
            }));
        } else if (preset === 'multi_stitch') {
            setSettings((prev) => ({
                ...DEFAULT_SEAMLESS_SETTINGS,
                targetArea: prev.targetArea,
                protectExtraArtwork: prev.targetArea === 'base_only',
                mode: 'neighbor_stitch',
                edgeWidth: 7,
                blendStrength: 90,
                blendCurve: 'cosine',
                cornerEqualizer: 75,
                cornerRadius: 6,
                luminanceMatch: 65,
                chrominanceMatch: 55,
                detailPreservation: 75,
                stitchGridNeighbors: true,
                wrapOuterPerimeter: true,
            }));
        } else if (preset === 'cliff_extra') {
            setSettings({
                ...DEFAULT_SEAMLESS_SETTINGS,
                targetArea: 'extra_only',
                protectExtraArtwork: false,
                mode: 'opposite_wrap',
                extraBlendAxis: 'horizontal',
                extraEdgeWidth: 8,
                extraBlendStrength: 90,
                blendCurve: 'cosine',
                luminanceMatch: 55,
                chrominanceMatch: 45,
                detailPreservation: 80,
                stitchGridNeighbors: true,
                wrapOuterPerimeter: true,
            });
        }
    };

    const handleCommit = async () => {
        if (targetTiles.length === 0) return;
        setIsProcessing(true);
        try {
            const mapToCommit =
                processedMapRef.current.size > 0
                    ? processedMapRef.current
                    : await processSeamlessIsotiles(
                          targetTiles,
                          gridType,
                          settings,
                          transparencyColor,
                          tolerance
                      );
            if (onPreviewUpdate) onPreviewUpdate({});
            onApplySeamless(mapToCommit);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <DraggableContainer
            initialPos={{ x: 460, y: 75 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={350}
            minHeight={isMinimized ? 52 : 420}
            className="bg-[#161b22]/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl z-[1250] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 bg-slate-900/90 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <LucideSparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-white leading-tight">
                            Seamless Maker
                        </h2>
                        <p className="text-[10px] text-emerald-400/90 font-medium">
                            OpenTS Anti-Tessellation ·{' '}
                            {selectedTiles.length > 0
                                ? `${selectedTiles.length} Selected`
                                : `All (${targetTiles.length})`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setSettings(DEFAULT_SEAMLESS_SETTINGS)}
                        className="p-1.5 text-slate-400 hover:text-emerald-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Reset to Default Settings"
                    >
                        <LucideRotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand Window' : 'Minimize Window'}
                    >
                        {isMinimized ? (
                            <LucideMaximize2 className="w-4 h-4" />
                        ) : (
                            <LucideMinus className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (onPreviewUpdate) onPreviewUpdate({});
                            onClose();
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close Seamless Maker"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-3.5 space-y-3 overflow-y-auto flex-1 flex flex-col scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Live 3x3 OpenTS Tessellation Preview */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2 space-y-1.5 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                <LucideGrid className="w-3 h-3" />
                                <span>3×3 OpenTS Diamond Tessellation Preview</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onMouseDown={() => setShowOriginalHold(true)}
                                    onMouseUp={() => setShowOriginalHold(false)}
                                    onMouseLeave={() => setShowOriginalHold(false)}
                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                                        showOriginalHold
                                            ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                    }`}
                                    title="Hold to compare with original un-blended tiles"
                                >
                                    Hold: Before
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSeamOverlay(!showSeamOverlay)}
                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border transition-colors cursor-pointer ${
                                        showSeamOverlay
                                            ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                    title="Show/Hide OpenTS 48×23 Diamond & Extra Art Seam Lines"
                                >
                                    Seam Grid
                                </button>
                            </div>
                        </div>

                        <div className="relative w-full h-32 rounded-lg bg-[#090d12] border border-slate-800/80 flex items-center justify-center overflow-hidden">
                            <canvas
                                ref={previewCanvasRef}
                                className="max-w-full max-h-full object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />
                            {targetTiles.length === 0 && (
                                <span className="text-[10px] text-slate-500 font-bold uppercase">
                                    Select or load Isotiles to preview
                                </span>
                            )}
                            {isProcessing && (
                                <div className="absolute top-1.5 right-2 text-[8px] font-bold uppercase text-emerald-400 bg-black/70 px-1.5 py-0.5 rounded">
                                    Updating...
                                </div>
                            )}
                        </div>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-5 gap-1 pt-0.5">
                            <button
                                type="button"
                                onClick={() => applyPreset('balanced')}
                                className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[8px] font-black uppercase text-emerald-300 transition-colors cursor-pointer"
                            >
                                Balanced
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset('soft_terrain')}
                                className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[8px] font-black uppercase text-amber-300 transition-colors cursor-pointer"
                            >
                                Soft Grass
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset('crisp_stone')}
                                className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[8px] font-black uppercase text-cyan-300 transition-colors cursor-pointer"
                            >
                                Crisp Rock
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset('multi_stitch')}
                                className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[8px] font-black uppercase text-purple-300 transition-colors cursor-pointer"
                            >
                                Multi-Stitch
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset('cliff_extra')}
                                className="py-1 px-1 rounded bg-slate-900 hover:bg-slate-800 border border-orange-500/40 text-[8px] font-black uppercase text-orange-300 transition-colors cursor-pointer"
                                title="Isolate & make Cliff / Extra Art seamless"
                            >
                                Cliff Wall
                            </button>
                        </div>
                    </div>

                    {/* Target Area Isolation Selector: Base Only (Extra Art Disabled) | Both | Extra Art Only */}
                    <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-2 space-y-1.5 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-orange-400">
                                Target Layer / Extra-Art Isolation
                            </span>
                            <span className="text-[8px] font-bold uppercase text-slate-400">
                                {settings.targetArea === 'base_only'
                                    ? 'Extra Art Disabled (Protected)'
                                    : settings.targetArea === 'extra_only'
                                    ? 'Isolated: Extra Art Only'
                                    : 'Base Diamond + Extra Art'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setSettings((prev) => ({
                                        ...prev,
                                        targetArea: 'base_only',
                                        protectExtraArtwork: true,
                                    }));
                                }}
                                className={`py-1.5 px-2 rounded-lg border text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    settings.targetArea === 'base_only'
                                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-sm'
                                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                                title="Seamless-blend only the base isometric diamond; Extra Art / Cliffs are untouched"
                            >
                                Base Only (No Extra)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSettings((prev) => ({
                                        ...prev,
                                        targetArea: 'both',
                                        protectExtraArtwork: false,
                                    }));
                                }}
                                className={`py-1.5 px-2 rounded-lg border text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    settings.targetArea === 'both'
                                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm'
                                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                                title="Seamless-blend both the Base Diamond and Cliff / Extra Art"
                            >
                                Both (Base + Extra)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSettings((prev) => ({
                                        ...prev,
                                        targetArea: 'extra_only',
                                        protectExtraArtwork: false,
                                    }));
                                }}
                                className={`py-1.5 px-2 rounded-lg border text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    settings.targetArea === 'extra_only'
                                        ? 'bg-orange-500/25 border-orange-400 text-orange-200 shadow-sm'
                                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                                title="Isolate Cliff / Extra Art Only — Base Diamond is untouched"
                            >
                                Extra Art Only
                            </button>
                        </div>

                        {/* Extra Art Specific Controls (shown when 'both' or 'extra_only' is active) */}
                        {(settings.targetArea === 'both' || settings.targetArea === 'extra_only') && (
                            <div className="pt-2 mt-1.5 border-t border-slate-800/90 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8.5px] font-black uppercase text-orange-300">
                                        Cliff / Extra-Image Seam Axis
                                    </span>
                                    <select
                                        value={settings.extraBlendAxis}
                                        onChange={(e) =>
                                            updateSetting(
                                                'extraBlendAxis',
                                                e.target.value as 'horizontal' | 'vertical' | 'both'
                                            )
                                        }
                                        className="bg-black/60 border border-slate-700 rounded-lg px-2 py-0.5 text-[9px] font-bold text-orange-200"
                                    >
                                        <option value="horizontal">Horizontal Cliff Wall (Left ↔ Right)</option>
                                        <option value="vertical">Vertical Overhang (Top ↔ Bottom)</option>
                                        <option value="both">Both Axes (Horizontal + Vertical)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between text-[8.5px] font-bold">
                                            <span className="text-slate-400">Extra Seam Depth</span>
                                            <span className="text-orange-300 font-mono">{settings.extraEdgeWidth} px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1}
                                            max={18}
                                            step={1}
                                            value={settings.extraEdgeWidth}
                                            onChange={(e) =>
                                                updateSetting('extraEdgeWidth', Number(e.target.value))
                                            }
                                            onDoubleClick={() =>
                                                updateSetting('extraEdgeWidth', DEFAULT_SEAMLESS_SETTINGS.extraEdgeWidth)
                                            }
                                            title="Double-click to reset to default"
                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between text-[8.5px] font-bold">
                                            <span className="text-slate-400">Extra Seam Strength</span>
                                            <span className="text-orange-300 font-mono">{settings.extraBlendStrength}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={settings.extraBlendStrength}
                                            onChange={(e) =>
                                                updateSetting('extraBlendStrength', Number(e.target.value))
                                            }
                                            onDoubleClick={() =>
                                                updateSetting('extraBlendStrength', DEFAULT_SEAMLESS_SETTINGS.extraBlendStrength)
                                            }
                                            title="Double-click to reset to default"
                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 1: Synthesis Mode & Edge Controls */}
                    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                <LucideSliders className="w-3 h-3" />
                                <span>1. Diamond Edge Transition</span>
                            </span>
                            <select
                                value={settings.mode}
                                onChange={(e) =>
                                    updateSetting('mode', e.target.value as SeamlessSynthesisMode)
                                }
                                className="bg-black/60 border border-slate-700 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
                            >
                                <option value="opposite_wrap">Opposite-Edge Wrap (Torus)</option>
                                <option value="mirror_blend">Symmetric Mirror Fold</option>
                                <option value="harmonic_bridge">Harmonic Interior Bridge</option>
                                <option value="neighbor_stitch">Grid Neighbor Cross-Stitch</option>
                            </select>
                        </div>

                        {/* Edge Transition Depth */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400">Edge Transition Depth</span>
                                <span className="text-emerald-300 font-mono">{settings.edgeWidth} px steps</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={14}
                                step={1}
                                value={settings.edgeWidth}
                                onChange={(e) => updateSetting('edgeWidth', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('edgeWidth', DEFAULT_SEAMLESS_SETTINGS.edgeWidth)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>

                        {/* Edge Blend Strength */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400">Seam Blend Strength</span>
                                <span className="text-emerald-300 font-mono">{settings.blendStrength}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={settings.blendStrength}
                                onChange={(e) => updateSetting('blendStrength', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('blendStrength', DEFAULT_SEAMLESS_SETTINGS.blendStrength)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>

                        {/* Falloff Curve & Axis Direction */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">
                                    Falloff Profile
                                </label>
                                <select
                                    value={settings.blendCurve}
                                    onChange={(e) =>
                                        updateSetting('blendCurve', e.target.value as SeamlessBlendCurve)
                                    }
                                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-200"
                                >
                                    <option value="cosine">Cosine S-Curve</option>
                                    <option value="smoothstep">Hermite Smoothstep</option>
                                    <option value="linear">Linear Ramp</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">
                                    Isometric Axes
                                </label>
                                <select
                                    value={settings.edgeDirection}
                                    onChange={(e) =>
                                        updateSetting(
                                            'edgeDirection',
                                            e.target.value as SeamlessEdgeDirection
                                        )
                                    }
                                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-200"
                                >
                                    <option value="both">All 4 Edges (NW/SE + NE/SW)</option>
                                    <option value="nw_se">NW ↔ SE Axis Only</option>
                                    <option value="ne_sw">NE ↔ SW Axis Only</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Anti-Tessellation & Tone Equalizer */}
                    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-2.5 space-y-2.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 block">
                            2. Anti-Tessellation & Tone Equalizer
                        </span>

                        {/* 4-Way Corner Vertex Equalizer */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400" title="Eliminates 4-way grid cross dots where Top/Bottom/Left/Right diamond tips meet">
                                    4-Way Corner Vertex Equalizer
                                </span>
                                <span className="text-amber-300 font-mono">{settings.cornerEqualizer}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={settings.cornerEqualizer}
                                onChange={(e) => updateSetting('cornerEqualizer', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('cornerEqualizer', DEFAULT_SEAMLESS_SETTINGS.cornerEqualizer)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* Corner Radius */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400">Corner Apex Radius</span>
                                <span className="text-amber-300 font-mono">{settings.cornerRadius} px</span>
                            </div>
                            <input
                                type="range"
                                min={2}
                                max={12}
                                step={1}
                                value={settings.cornerRadius}
                                onChange={(e) => updateSetting('cornerRadius', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('cornerRadius', DEFAULT_SEAMLESS_SETTINGS.cornerRadius)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* OpenTS Luminance Leveling */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400" title="Removes dark or bright edge vignetting that creates visible grid repetition">
                                    Luminance / Shading Flattener
                                </span>
                                <span className="text-amber-300 font-mono">{settings.luminanceMatch}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={settings.luminanceMatch}
                                onChange={(e) => updateSetting('luminanceMatch', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('luminanceMatch', DEFAULT_SEAMLESS_SETTINGS.luminanceMatch)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* Chrominance Harmonizer */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400" title="Balances LowColor/HighColor tint across all selected tiles so no single tile stands out">
                                    Multi-Tile Color Harmonizer
                                </span>
                                <span className="text-amber-300 font-mono">{settings.chrominanceMatch}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={settings.chrominanceMatch}
                                onChange={(e) => updateSetting('chrominanceMatch', Number(e.target.value))}
                                onDoubleClick={() =>
                                    updateSetting('chrominanceMatch', DEFAULT_SEAMLESS_SETTINGS.chrominanceMatch)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* High-Frequency Grain Preservation */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold">
                                <span className="text-slate-400" title="Preserves crisp pixel texture grain across the seam so edges never look blurry">
                                    Crisp Texture Grain Retention
                                </span>
                                <span className="text-cyan-300 font-mono">{settings.detailPreservation}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={settings.detailPreservation}
                                onChange={(e) =>
                                    updateSetting('detailPreservation', Number(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateSetting('detailPreservation', DEFAULT_SEAMLESS_SETTINGS.detailPreservation)
                                }
                                title="Double-click to reset to default"
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Section 3: Checkboxes & Multi-Tile Options */}
                    <div className="bg-slate-900/75 border border-slate-800 rounded-xl p-2.5 grid grid-cols-3 gap-2 text-[9px] font-bold text-slate-300">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.stitchGridNeighbors}
                                onChange={(e) =>
                                    updateSetting('stitchGridNeighbors', e.target.checked)
                                }
                                className="w-3.5 h-3.5 rounded accent-emerald-500"
                            />
                            <span>Stitch Neighbors</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.wrapOuterPerimeter}
                                onChange={(e) =>
                                    updateSetting('wrapOuterPerimeter', e.target.checked)
                                }
                                className="w-3.5 h-3.5 rounded accent-emerald-500"
                            />
                            <span>Wrap Perimeter</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.quantizeToPalette}
                                onChange={(e) =>
                                    updateSetting('quantizeToPalette', e.target.checked)
                                }
                                className="w-3.5 h-3.5 rounded accent-emerald-500"
                            />
                            <span>Lock 256-PAL</span>
                        </label>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="flex items-center gap-2 pt-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setLiveViewportPreview(!liveViewportPreview)}
                            className={`py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                liveViewportPreview
                                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                            title="Preview seamless changes directly on the main canvas viewport"
                        >
                            <LucideEye className="w-3.5 h-3.5" />
                            <span>{liveViewportPreview ? 'Live View: ON' : 'Live View: OFF'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCommit}
                            disabled={targetTiles.length === 0 || isProcessing}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                        >
                            <LucideCheck className="w-4 h-4" />
                            <span>
                                Apply to {selectedTiles.length > 0 ? `${selectedTiles.length} Selected` : `All (${targetTiles.length})`}
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </DraggableContainer>
    );
};

