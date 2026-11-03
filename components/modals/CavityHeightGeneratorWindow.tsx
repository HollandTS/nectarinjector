import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DraggableContainer from '../DraggableContainer';
import type { ThreeDObject, ProjectOverlay } from '../../types';
import {
    CavityHeightGeneratorSettings,
    DEFAULT_CAVITY_HEIGHT_SETTINGS,
    generateCavityHeightMapFromUrl,
} from '../../utils/cavityHeightGeneratorHelper';
import { DEFAULT_DISPLACEMENT_SETTINGS } from '../../utils/threeDDisplacementHelper';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../utils/threeDCliffPresets';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../utils/threeDSlopePresets';
import { CavityHeightSlidersPanel } from './CavityHeightSlidersPanel';
import {
    LucideMountain,
    LucideX,
    LucideMinus,
    LucideMaximize2,
    LucideCheck,
    LucideDownload,
    LucideLayers,
    LucideTrendingDown,
} from 'lucide-react';

export type CavityTargetChannel = 'main' | 'cliff' | 'slope';

interface CavityHeightGeneratorWindowProps {
    isOpen: boolean;
    onClose: () => void;
    object: ThreeDObject;
    overlays?: ProjectOverlay[];
    initialTargetChannel?: CavityTargetChannel;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    onAppliedHeightMap?: (
        heightDataUrl: string,
        normalDataUrl?: string,
        targetChannel?: CavityTargetChannel
    ) => void;
}

type PreviewViewMode = 'split' | 'height_only' | 'diffuse_only' | 'normal_preview';

function getChannelSavedSettings(
    object: ThreeDObject,
    channel: CavityTargetChannel
): CavityHeightGeneratorSettings {
    const raw =
        channel === 'cliff'
            ? object.cliffCavityHeightSettings
            : channel === 'slope'
            ? object.slopeCavityHeightSettings
            : object.cavityHeightGeneratorSettings;
    return {
        ...DEFAULT_CAVITY_HEIGHT_SETTINGS,
        ...(raw || {}),
    };
}

function resolveChannelSourceUrl(
    object: ThreeDObject,
    channel: CavityTargetChannel,
    overlays: ProjectOverlay[] = []
): string | undefined {
    const findOverlaySrc = (overlayId?: string): string | undefined => {
        if (!overlayId) return undefined;
        const ov = overlays.find((o) => o.id === overlayId);
        return ov?.src;
    };

    if (channel === 'cliff') {
        const cliff = object.cliffShapingSettings;
        return (
            cliff?.wallTextureUrl ||
            findOverlaySrc(cliff?.wallOverlayId) ||
            object.textureUrl ||
            findOverlaySrc(object.textureOverlayId)
        );
    }
    if (channel === 'slope') {
        const slope = object.slopeShapingSettings;
        return (
            slope?.slopeTextureUrl ||
            findOverlaySrc(slope?.slopeOverlayId) ||
            object.textureUrl ||
            findOverlaySrc(object.textureOverlayId)
        );
    }
    return object.textureUrl || findOverlaySrc(object.textureOverlayId);
}

export const CavityHeightGeneratorWindow: React.FC<CavityHeightGeneratorWindowProps> = ({
    isOpen,
    onClose,
    object,
    overlays = [],
    initialTargetChannel = 'main',
    onUpdateObject,
    onAppliedHeightMap,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 590, height: 720 });
    const [viewMode, setViewMode] = useState<PreviewViewMode>('split');
    const [liveApplyTo3D, setLiveApplyTo3D] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [targetChannel, setTargetChannel] = useState<CavityTargetChannel>(initialTargetChannel);

    // Sync target channel when window opens with a specific requested channel
    useEffect(() => {
        if (isOpen) {
            setTargetChannel(initialTargetChannel);
        }
    }, [isOpen, initialTargetChannel]);

    const [settings, setSettings] = useState<CavityHeightGeneratorSettings>(() =>
        getChannelSavedSettings(object, initialTargetChannel)
    );

    const [previewHeightUrl, setPreviewHeightUrl] = useState<string | null>(
        object.displacementMapUrl || null
    );
    const [previewNormalUrl, setPreviewNormalUrl] = useState<string | null>(
        object.normalMapUrl || null
    );

    // Sync settings when switching selected 3D object or target channel
    useEffect(() => {
        setSettings(getChannelSavedSettings(object, targetChannel));
        if (targetChannel === 'cliff') {
            setPreviewHeightUrl(object.cliffShapingSettings?.wallDepthMapUrl || null);
            setPreviewNormalUrl(object.cliffShapingSettings?.wallNormalMapUrl || null);
        } else if (targetChannel === 'slope') {
            setPreviewHeightUrl(object.slopeShapingSettings?.slopeDepthMapUrl || null);
            setPreviewNormalUrl(object.slopeShapingSettings?.slopeNormalMapUrl || null);
        } else {
            setPreviewHeightUrl(object.displacementMapUrl || null);
            setPreviewNormalUrl(object.normalMapUrl || null);
        }
    }, [object.id, targetChannel]);

    const persistChannelSettings = (next: CavityHeightGeneratorSettings) => {
        if (targetChannel === 'cliff') {
            onUpdateObject(object.id, { cliffCavityHeightSettings: next }, false);
        } else if (targetChannel === 'slope') {
            onUpdateObject(object.id, { slopeCavityHeightSettings: next }, false);
        } else {
            onUpdateObject(object.id, { cavityHeightGeneratorSettings: next }, false);
        }
    };

    const updateSetting = <K extends keyof CavityHeightGeneratorSettings>(
        key: K,
        value: CavityHeightGeneratorSettings[K]
    ) => {
        const next = { ...settings, [key]: value };
        setSettings(next);
        persistChannelSettings(next);
    };

    const applyPreset = (presetSettings: Partial<CavityHeightGeneratorSettings>) => {
        const next = { ...settings, ...presetSettings };
        setSettings(next);
        persistChannelSettings(next);
    };

    const activeSourceUrl = resolveChannelSourceUrl(object, targetChannel, overlays);

    const buildChannelUpdates = (
        heightDataUrl: string,
        normalDataUrl: string | undefined,
        currentSettings: CavityHeightGeneratorSettings
    ): Partial<ThreeDObject> => {
        if (targetChannel === 'cliff') {
            const curCliff = {
                ...DEFAULT_CLIFF_SHAPING_SETTINGS,
                ...(object.cliffShapingSettings || {}),
                wallDepthMapUrl: heightDataUrl,
            };
            if (currentSettings.syncNormalMap && normalDataUrl) {
                curCliff.wallNormalMapUrl = normalDataUrl;
            }
            return {
                cliffCavityHeightSettings: currentSettings,
                cliffShapingSettings: curCliff,
            };
        }

        if (targetChannel === 'slope') {
            const curSlope = {
                ...DEFAULT_SLOPE_SHAPING_SETTINGS,
                ...(object.slopeShapingSettings || {}),
                slopeDepthMapUrl: heightDataUrl,
            };
            if (currentSettings.syncNormalMap && normalDataUrl) {
                curSlope.slopeNormalMapUrl = normalDataUrl;
            }
            const updates: Partial<ThreeDObject> = {
                slopeCavityHeightSettings: currentSettings,
                slopeShapingSettings: curSlope,
            };
            if (!curSlope.slopeTextureUrl && !curSlope.slopeOverlayId) {
                updates.displacementMapUrl = heightDataUrl;
            }
            return updates;
        }

        // Default: 'main' PBR / Displacement channel
        const updates: Partial<ThreeDObject> = {
            displacementMapUrl: heightDataUrl,
            cavityHeightGeneratorSettings: currentSettings,
        };
        if (currentSettings.syncNormalMap && normalDataUrl) {
            updates.normalMapUrl = normalDataUrl;
        }
        return updates;
    };

    // Live preview calculation inside the dedicated window (does NOT overwrite 3D maps unless liveApplyTo3D is checked)
    useEffect(() => {
        if (!isOpen || !activeSourceUrl) return;
        let cancelled = false;

        const timer = setTimeout(async () => {
            const res = await generateCavityHeightMapFromUrl(
                activeSourceUrl,
                settings,
                384,
                targetChannel === 'main' ? object.displacementSettings?.colorHeightRules : undefined,
                targetChannel === 'main' ? (object.displacementSettings?.colorBaseMix ?? 100) : 100
            );
            if (!cancelled && res) {
                setPreviewHeightUrl(res.heightDataUrl);
                if (res.normalDataUrl) {
                    setPreviewNormalUrl(res.normalDataUrl);
                }
                if (liveApplyTo3D) {
                    const updates = buildChannelUpdates(res.heightDataUrl, res.normalDataUrl, settings);
                    onUpdateObject(object.id, updates, false);
                    onAppliedHeightMap?.(res.heightDataUrl, res.normalDataUrl, targetChannel);
                }
            }
        }, 70);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        isOpen,
        activeSourceUrl,
        targetChannel,
        settings,
        liveApplyTo3D,
        object.displacementSettings?.colorHeightRules,
        object.displacementSettings?.colorBaseMix,
    ]);

    const handleApplyHighRes = async () => {
        if (!activeSourceUrl) return;
        setIsGenerating(true);
        try {
            const res = await generateCavityHeightMapFromUrl(
                activeSourceUrl,
                settings,
                512,
                targetChannel === 'main' ? object.displacementSettings?.colorHeightRules : undefined,
                targetChannel === 'main' ? (object.displacementSettings?.colorBaseMix ?? 100) : 100
            );
            if (!res) return;
            setPreviewHeightUrl(res.heightDataUrl);
            if (res.normalDataUrl) {
                setPreviewNormalUrl(res.normalDataUrl);
            }

            const updates = buildChannelUpdates(res.heightDataUrl, res.normalDataUrl, settings);
            onUpdateObject(object.id, updates, true);
            onAppliedHeightMap?.(res.heightDataUrl, res.normalDataUrl, targetChannel);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadHeightMap = () => {
        if (!previewHeightUrl) return;
        const a = document.createElement('a');
        a.href = previewHeightUrl;
        a.download = `${(object.name || 'surface').replace(/\.[^/.]+$/, '')}_${targetChannel}_cavity_heightmap.png`;
        a.click();
    };

    if (!isOpen || typeof document === 'undefined') return null;

    const channelLabel =
        targetChannel === 'cliff'
            ? 'Steep Cliff Wall Depth'
            : targetChannel === 'slope'
            ? 'Slope Ramp Depth'
            : 'Main PBR Height Map';

    return createPortal(
        <DraggableContainer
            initialPos={{ x: Math.max(20, window.innerWidth - 995), y: 55 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={480}
            minHeight={isMinimized ? 52 : 520}
            className="bg-[#11161d]/98 backdrop-blur-xl border border-emerald-500/50 rounded-2xl shadow-2xl z-[1250] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Draggable Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-900/90 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <LucideMountain className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-300 leading-tight">
                            Cavity & Solid B/W Height Map Studio
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Target: <span className="text-white font-bold">{channelLabel}</span> · White Plates (+Y) & Solid Black Cavities (-Y)
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand Window' : 'Minimize Window'}
                    >
                        {isMinimized ? <LucideMaximize2 className="w-4 h-4" /> : <LucideMinus className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close Height Map Generator Window"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-3.5 space-y-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Target Channel Switcher: Main PBR vs Cliff Wall vs Slope Ramp */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setTargetChannel('main')}
                            className={`py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                                targetChannel === 'main'
                                    ? 'bg-cyan-600/30 border-cyan-400 text-cyan-200 shadow'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideLayers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>1. Main PBR Height</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTargetChannel('cliff')}
                            className={`py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                                targetChannel === 'cliff'
                                    ? 'bg-amber-600/30 border-amber-400 text-amber-200 shadow'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideMountain className="w-3.5 h-3.5 text-amber-400" />
                            <span>2. Cliff Wall Depth</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTargetChannel('slope')}
                            className={`py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 border transition-all cursor-pointer ${
                                targetChannel === 'slope'
                                    ? 'bg-teal-600/30 border-teal-400 text-teal-200 shadow'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideTrendingDown className="w-3.5 h-3.5 text-teal-400" />
                            <span>3. Slope Ramp Depth</span>
                        </button>
                    </div>

                    {/* Large Interactive Preview Viewport */}
                    <div className="bg-black/70 border border-slate-700/80 rounded-xl p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center space-x-1">
                                {(
                                    [
                                        { id: 'split', label: 'Side-by-Side' },
                                        { id: 'height_only', label: 'Large Height B/W' },
                                        { id: 'diffuse_only', label: 'Source Diffuse' },
                                        { id: 'normal_preview', label: 'Synced Normal' },
                                    ] as { id: PreviewViewMode; label: string }[]
                                ).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setViewMode(tab.id)}
                                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            viewMode === tab.id
                                                ? 'bg-emerald-600 text-white shadow'
                                                : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-1.5 cursor-pointer select-none text-[10px] font-bold uppercase text-emerald-300">
                                    <input
                                        type="checkbox"
                                        checked={liveApplyTo3D}
                                        onChange={(e) => setLiveApplyTo3D(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-800 accent-emerald-500 cursor-pointer"
                                    />
                                    <span>Live Push to 3D</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleDownloadHeightMap}
                                    disabled={!previewHeightUrl}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold uppercase flex items-center space-x-1 cursor-pointer"
                                    title="Download PNG Height Map"
                                >
                                    <LucideDownload className="w-3 h-3 text-emerald-400" />
                                    <span>PNG</span>
                                </button>
                            </div>
                        </div>

                        {/* Large Image Display Area */}
                        <div className="w-full h-56 rounded-lg bg-[#090d12] border border-slate-800 overflow-hidden flex items-center justify-center relative">
                            {!activeSourceUrl ? (
                                <span className="text-xs text-slate-500 font-bold uppercase text-center px-4">
                                    {targetChannel === 'cliff'
                                        ? 'Load a Wall Diffuse Texture (or Main Texture) first'
                                        : targetChannel === 'slope'
                                        ? 'Load a Slope Diffuse Texture (or Main Texture) first'
                                        : 'Load a Diffuse Texture on the 3D Object first'}
                                </span>
                            ) : viewMode === 'split' ? (
                                <div className="grid grid-cols-2 gap-2 w-full h-full p-2">
                                    <div className="relative w-full h-full rounded border border-slate-800 overflow-hidden bg-black flex items-center justify-center">
                                        <img
                                            src={activeSourceUrl}
                                            alt="Diffuse Source"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-black uppercase text-cyan-300 border border-cyan-500/30">
                                            {targetChannel === 'cliff'
                                                ? 'Cliff Wall Source'
                                                : targetChannel === 'slope'
                                                ? 'Slope Source'
                                                : 'Main Diffuse'}
                                        </span>
                                    </div>
                                    <div className="relative w-full h-full rounded border border-emerald-500/40 overflow-hidden bg-black flex items-center justify-center">
                                        {previewHeightUrl && (
                                            <img
                                                src={previewHeightUrl}
                                                alt="Synthesized Cavity Height Map"
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        )}
                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-black uppercase text-emerald-300 border border-emerald-500/30">
                                            Cavity Height Map (B/W)
                                        </span>
                                    </div>
                                </div>
                            ) : viewMode === 'height_only' ? (
                                <div className="relative w-full h-full p-2 flex items-center justify-center">
                                    {previewHeightUrl && (
                                        <img
                                            src={previewHeightUrl}
                                            alt="Large Cavity Height Map"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-black uppercase text-emerald-300 border border-emerald-500/40">
                                        White = Solid Plate (+Y) · Black = Deep Cavity (-Y)
                                    </span>
                                </div>
                            ) : viewMode === 'diffuse_only' ? (
                                <div className="relative w-full h-full p-2 flex items-center justify-center">
                                    <img
                                        src={activeSourceUrl}
                                        alt="Diffuse Texture"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="relative w-full h-full p-2 flex items-center justify-center">
                                    {previewNormalUrl ? (
                                        <img
                                            src={previewNormalUrl}
                                            alt="Normal Map from Cavity Height"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <span className="text-xs text-slate-500">Enable Sync Normal Map below</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Extracted Sliders & Presets Panel */}
                    <CavityHeightSlidersPanel
                        settings={settings}
                        updateSetting={updateSetting}
                        applyPreset={applyPreset}
                    />

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] text-slate-400">
                            Tip: Double-click any slider to reset it to default.
                        </span>
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                disabled={!activeSourceUrl || isGenerating}
                                onClick={handleApplyHighRes}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                            >
                                <LucideCheck className="w-4 h-4" />
                                <span>
                                    {isGenerating
                                        ? 'Baking Height Map...'
                                        : `Apply to ${channelLabel}${settings.syncNormalMap ? ' + Normal' : ''}`}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DraggableContainer>,
        document.body
    );
};
