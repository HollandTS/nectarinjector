import React, { useState, useEffect } from 'react';
import type { ThreeDObject, ThreeDDisplacementSettings } from '../../../types';
import {
    DEFAULT_DISPLACEMENT_SETTINGS,
    generateDisplacementMapFromSource,
} from '../../../utils/threeDDisplacementHelper';
import { ThreeDColorHeightSculptSection } from './ThreeDColorHeightSculptSection';
import { CavityHeightGeneratorWindow } from '../../modals/CavityHeightGeneratorWindow';
import {
    LucideMountain,
    LucideSparkles,
    LucideRefreshCw,
    LucideRotateCcw,
    LucideChevronDown,
    LucideChevronRight,
    LucideDices,
} from 'lucide-react';

interface ThreeDDisplacementSectionProps {
    object: ThreeDObject;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDDisplacementSection: React.FC<ThreeDDisplacementSectionProps> = ({
    object,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isCavityWindowOpen, setIsCavityWindowOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(object.displacementMapUrl || null);
    const [isGenerating, setIsGenerating] = useState(false);

    const disp: ThreeDDisplacementSettings = {
        ...DEFAULT_DISPLACEMENT_SETTINGS,
        ...(object.displacementSettings || {}),
    };

    const updateDisp = (
        updates: Partial<ThreeDDisplacementSettings>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                displacementSettings: {
                    ...disp,
                    ...updates,
                },
            },
            pushHistory
        );
    };

    // Update live grayscale preview whenever displacement settings or texture changes
    useEffect(() => {
        let cancelled = false;
        const src = object.displacementMapUrl || object.textureUrl;
        if (!src || !disp.enabled) {
            setPreviewUrl(object.displacementMapUrl || null);
            return;
        }
        generateDisplacementMapFromSource(src, disp, 256).then((res) => {
            if (!cancelled && res) {
                setPreviewUrl(res.dataUrl);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [
        object.textureUrl,
        object.displacementMapUrl,
        disp.enabled,
        disp.invert,
        disp.contrast,
        disp.brightness,
        disp.blur,
        disp.blackPoint,
        disp.whitePoint,
        disp.terracing,
        disp.colorHeightRules,
        disp.colorBaseMix,
    ]);

    const handleGenerateFromTexture = async () => {
        const src = object.textureUrl;
        if (!src) return;
        setIsGenerating(true);
        try {
            const nextSettings: ThreeDDisplacementSettings = {
                ...disp,
                enabled: true,
            };
            const res = await generateDisplacementMapFromSource(src, nextSettings, 512);
            onUpdateObject(
                object.id,
                {
                    displacementSettings: nextSettings,
                },
                true
            );
            if (res) {
                setPreviewUrl(res.dataUrl);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResetDisplacement = () => {
        onUpdateObject(
            object.id,
            {
                displacementMapUrl: undefined,
                displacementSettings: { ...DEFAULT_DISPLACEMENT_SETTINGS },
            },
            true
        );
        setPreviewUrl(null);
    };

    const handleRandomizeTerrainSeed = () => {
        const nextSeed = Math.floor(Math.random() * 99999) + 1;
        updateDisp({ terrainEnabled: true, terrainSeed: nextSeed }, true);
    };

    return (
        <div className="bg-black/40 border border-slate-700/70 rounded-xl overflow-hidden">
            {/* Section Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <LucideMountain className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Displacement & Terrain
                    </span>
                </div>
                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleResetDisplacement}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/60 transition-colors cursor-pointer"
                        title="Reset displacement & terrain settings"
                    >
                        <LucideRotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => updateDisp({ enabled: !disp.enabled }, true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                            disp.enabled
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                    >
                        {disp.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3">
                    {/* Generate B&W Displacement Map from Texture Action */}
                    <div className="flex items-center space-x-2.5 bg-black/40 p-2.5 rounded-xl border border-slate-800">
                        <div className="w-12 h-12 rounded-lg bg-[#0d1117] border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Displacement Map Preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-[9px] text-slate-600 font-bold uppercase text-center px-1">
                                    No B&W Map
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-200 uppercase truncate">
                                    Greyscale Heightmap
                                </span>
                                <span className="text-[9px] text-emerald-400 font-mono">
                                    Light = +Y · Dark = -Y
                                </span>
                            </div>
                            <button
                                type="button"
                                disabled={!object.textureUrl || isGenerating}
                                onClick={handleGenerateFromTexture}
                                className="w-full bg-emerald-600/30 hover:bg-emerald-500/40 disabled:opacity-40 border border-emerald-500/40 text-emerald-200 py-1.5 px-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                                title="Generate black & white displacement map from the object's diffuse texture"
                            >
                                {isGenerating ? (
                                    <LucideRefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                                ) : (
                                    <LucideSparkles className="w-3.5 h-3.5 text-emerald-300" />
                                )}
                                <span>Generate B&W from Texture</span>
                            </button>
                            <button
                                type="button"
                                disabled={!object.textureUrl}
                                onClick={() => setIsCavityWindowOpen(true)}
                                className="w-full bg-gradient-to-r from-emerald-900/70 to-teal-900/70 hover:from-emerald-800/80 hover:to-teal-800/80 disabled:opacity-40 border border-emerald-400/50 text-emerald-200 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                                title="Open Dedicated Mechanical Cavity & Solid B/W Height Map Generator Window"
                            >
                                <LucideMountain className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Open Cavity & Solid B/W Studio</span>
                            </button>
                        </div>
                    </div>

                    <CavityHeightGeneratorWindow
                        isOpen={isCavityWindowOpen}
                        onClose={() => setIsCavityWindowOpen(false)}
                        object={object}
                        onUpdateObject={onUpdateObject}
                        onAppliedHeightMap={(heightDataUrl) => setPreviewUrl(heightDataUrl)}
                    />

                    {/* Selective Color-Targeted Height Sculptor (Raise Green Grass / Specific Colors + Blade Spikes) */}
                    <ThreeDColorHeightSculptSection
                        object={object}
                        disp={disp}
                        onUpdateDisp={updateDisp}
                        onUpdateObject={onUpdateObject}
                    />

                    {/* Advanced Greyscale Shaping Sliders */}
                    <div className="space-y-2.5 bg-black/30 p-3 rounded-xl border border-slate-800/80">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between text-[11px] font-bold uppercase text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                            <span>Greyscale Levels & Terracing</span>
                            {showAdvanced ? (
                                <LucideChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <LucideChevronRight className="w-3.5 h-3.5" />
                            )}
                        </button>

                        {showAdvanced && (
                            <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
                                {/* Contrast */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-bold text-slate-300">Greyscale Contrast</span>
                                        <span className="font-mono text-amber-400">{disp.contrast}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="300"
                                        step="5"
                                        value={disp.contrast}
                                        onChange={(e) =>
                                            updateDisp({ contrast: parseInt(e.target.value, 10), enabled: true })
                                        }
                                        onDoubleClick={() =>
                                            updateDisp({ contrast: DEFAULT_DISPLACEMENT_SETTINGS.contrast }, true)
                                        }
                                        title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.contrast}`}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                                {/* Brightness */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-bold text-slate-300">Greyscale Brightness</span>
                                        <span className="font-mono text-amber-400">
                                            {disp.brightness > 0 ? `+${disp.brightness}` : disp.brightness}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="100"
                                        step="2"
                                        value={disp.brightness}
                                        onChange={(e) =>
                                            updateDisp({ brightness: parseInt(e.target.value, 10), enabled: true })
                                        }
                                        onDoubleClick={() =>
                                            updateDisp({ brightness: DEFAULT_DISPLACEMENT_SETTINGS.brightness }, true)
                                        }
                                        title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.brightness}`}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                                {/* Black & White Clamping */}
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-slate-400">Low Floor Clip</span>
                                            <span className="font-mono text-slate-300">{disp.blackPoint}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="90"
                                            step="1"
                                            value={disp.blackPoint}
                                            onChange={(e) =>
                                                updateDisp({ blackPoint: parseInt(e.target.value, 10), enabled: true })
                                            }
                                            onDoubleClick={() =>
                                                updateDisp({ blackPoint: DEFAULT_DISPLACEMENT_SETTINGS.blackPoint }, true)
                                            }
                                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.blackPoint}`}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-slate-400">High Peak Clip</span>
                                            <span className="font-mono text-slate-300">{disp.whitePoint}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            step="1"
                                            value={disp.whitePoint}
                                            onChange={(e) =>
                                                updateDisp({ whitePoint: parseInt(e.target.value, 10), enabled: true })
                                            }
                                            onDoubleClick={() =>
                                                updateDisp({ whitePoint: DEFAULT_DISPLACEMENT_SETTINGS.whitePoint }, true)
                                            }
                                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.whitePoint}`}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-200"
                                        />
                                    </div>
                                </div>

                                {/* Terracing / Stepped Elevation */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="font-bold text-slate-300">Plateau Steps (Terracing)</span>
                                        <span className="font-mono text-purple-400">
                                            {disp.terracing === 0 ? 'Smooth' : `${disp.terracing} steps`}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="24"
                                        step="1"
                                        value={disp.terracing}
                                        onChange={(e) =>
                                            updateDisp({ terracing: parseInt(e.target.value, 10), enabled: true })
                                        }
                                        onDoubleClick={() =>
                                            updateDisp({ terracing: DEFAULT_DISPLACEMENT_SETTINGS.terracing }, true)
                                        }
                                        title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.terracing}`}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Random Terrain-ish Deformation Section */}
                    <div className="space-y-2.5 bg-black/30 p-3 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <LucideDices className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                                    Random Terrain Deformation
                                </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <button
                                    type="button"
                                    onClick={handleRandomizeTerrainSeed}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase transition-colors cursor-pointer"
                                    title="Generate new random terrain seed"
                                >
                                    Randomize
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateDisp({ terrainEnabled: !disp.terrainEnabled }, true)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                        disp.terrainEnabled
                                            ? 'bg-amber-600 text-white'
                                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}
                                >
                                    {disp.terrainEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        {/* Terrain Amplitude */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-300">Terrain Height (Amplitude)</span>
                                <span className="font-mono text-amber-400 font-bold">
                                    {disp.terrainAmplitude.toFixed(2)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="15"
                                step="0.1"
                                value={disp.terrainAmplitude}
                                onChange={(e) =>
                                    updateDisp({
                                        terrainAmplitude: parseFloat(e.target.value),
                                        terrainEnabled: true,
                                    })
                                }
                                onDoubleClick={() =>
                                    updateDisp(
                                        { terrainAmplitude: DEFAULT_DISPLACEMENT_SETTINGS.terrainAmplitude },
                                        true
                                    )
                                }
                                title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.terrainAmplitude}`}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* Terrain Frequency */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-300">Hill Frequency (Scale)</span>
                                <span className="font-mono text-amber-400 font-bold">
                                    {disp.terrainFrequency.toFixed(1)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.2"
                                max="12"
                                step="0.2"
                                value={disp.terrainFrequency}
                                onChange={(e) =>
                                    updateDisp({
                                        terrainFrequency: parseFloat(e.target.value),
                                        terrainEnabled: true,
                                    })
                                }
                                onDoubleClick={() =>
                                    updateDisp(
                                        { terrainFrequency: DEFAULT_DISPLACEMENT_SETTINGS.terrainFrequency },
                                        true
                                    )
                                }
                                title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.terrainFrequency}`}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        {/* Terrain Roughness / Detail */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-300">Terrain Roughness (Jaggedness)</span>
                                <span className="font-mono text-amber-400 font-bold">
                                    {Math.round(disp.terrainRoughness * 100)}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.02"
                                value={disp.terrainRoughness}
                                onChange={(e) =>
                                    updateDisp({
                                        terrainRoughness: parseFloat(e.target.value),
                                        terrainEnabled: true,
                                    })
                                }
                                onDoubleClick={() =>
                                    updateDisp(
                                        { terrainRoughness: DEFAULT_DISPLACEMENT_SETTINGS.terrainRoughness },
                                        true
                                    )
                                }
                                title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.terrainRoughness}`}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={disp.terrainRidgeMode}
                                    onChange={(e) =>
                                        updateDisp(
                                            { terrainRidgeMode: e.target.checked, terrainEnabled: true },
                                            true
                                        )
                                    }
                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-amber-500 cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-slate-300">
                                    Sharp Ridges & Craters Mode
                                </span>
                            </label>
                            <span className="text-[10px] font-mono text-slate-500">
                                Seed #{disp.terrainSeed}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
