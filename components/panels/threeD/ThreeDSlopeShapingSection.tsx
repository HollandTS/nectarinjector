import React, { useState } from 'react';
import type { ThreeDObject, ThreeDSlopeShapingSettings, ProjectOverlay } from '../../../types';
import {
    DEFAULT_SLOPE_SHAPING_SETTINGS,
    SLOPE_SHAPING_PRESETS,
} from '../../../utils/threeDSlopePresets';
import { ThreeDSlopeMaterialSubpanel } from './ThreeDSlopeMaterialSubpanel';
import { ThreeDSlopeDipsDarkSpotsSubpanel } from './ThreeDSlopeDipsDarkSpotsSubpanel';
import { ThreeDSlopeMeshDisplacementSection } from './ThreeDSlopeMeshDisplacementSection';
import {
    LucideTrendingDown,
    LucideChevronDown,
    LucideChevronRight,
    LucideRotateCcw,
    LucideBlend,
} from 'lucide-react';

interface ThreeDSlopeShapingSectionProps {
    object: ThreeDObject;
    overlays: ProjectOverlay[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    onOpenTransitionMixer?: () => void;
}

export const ThreeDSlopeShapingSection: React.FC<ThreeDSlopeShapingSectionProps> = ({
    object,
    overlays,
    onUpdateObject,
    onOpenTransitionMixer,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const slope: ThreeDSlopeShapingSettings = {
        ...DEFAULT_SLOPE_SHAPING_SETTINGS,
        ...(object.slopeShapingSettings || {}),
    };

    const updateSlope = <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                slopeShapingSettings: {
                    ...slope,
                    enabled: key === 'enabled' ? (val as boolean) : true,
                    [key]: val,
                },
            },
            pushHistory
        );
    };

    const updateSlopeBatch = (
        updates: Partial<ThreeDSlopeShapingSettings>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                slopeShapingSettings: {
                    ...slope,
                    ...updates,
                },
            },
            pushHistory
        );
    };

    const onStartHistory = () => {
        onUpdateObject(object.id, {}, true);
    };

    const handleResetAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateObject(
            object.id,
            {
                slopeShapingSettings: {
                    ...DEFAULT_SLOPE_SHAPING_SETTINGS,
                    enabled: slope.enabled,
                },
            },
            true
        );
    };

    return (
        <div className="bg-black/40 rounded-xl border border-teal-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-slate-900/60 hover:bg-slate-800/60 cursor-pointer select-none transition-colors"
            >
                <div className="flex items-center space-x-2 min-w-0">
                    {isOpen ? (
                        <LucideChevronDown className="w-4 h-4 text-teal-400 shrink-0" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                    <LucideTrendingDown className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-teal-300 truncate">
                        3D Slopes (Texture Emerge, Dissolve &amp; Shaping)
                    </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onOpenTransitionMixer && (
                        <button
                            type="button"
                            onClick={onOpenTransitionMixer}
                            className="p-1 rounded-md bg-fuchsia-950/60 hover:bg-fuchsia-900/80 text-fuchsia-300 border border-fuchsia-500/40 transition-colors cursor-pointer"
                            title="Open Material Transition Mixer (Main ↔ Slope & Cliff ↔ Slope Seams)"
                        >
                            <LucideBlend className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {slope.enabled && (
                        <button
                            type="button"
                            onClick={handleResetAll}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Reset Slope Settings"
                        >
                            <LucideRotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => updateSlope('enabled', !slope.enabled, true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            slope.enabled
                                ? 'bg-teal-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                        {slope.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="p-3 space-y-3 border-t border-slate-800/80 text-xs">
                    {/* Quick Non-Deforming Slope Style Presets */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Quick Slope Emerge Presets (Zero Mesh Deform)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {SLOPE_SHAPING_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => updateSlopeBatch(preset.settings, true)}
                                    title={preset.description}
                                    className="px-2 py-1.5 rounded-lg bg-slate-900/90 hover:bg-teal-950/50 border border-slate-700/80 hover:border-teal-500/50 text-left transition-all cursor-pointer group"
                                >
                                    <div className="text-[10px] font-black text-teal-300 group-hover:text-teal-200 truncate">
                                        {preset.label}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                        {preset.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 1. TOP PRIORITY: Slope Texture, Height Dissolve & Bump (No Mesh Deformation) */}
                    <ThreeDSlopeMaterialSubpanel
                        object={object}
                        slope={slope}
                        overlays={overlays}
                        onUpdateObject={onUpdateObject}
                        updateSlope={updateSlope}
                        updateSlopeBatch={updateSlopeBatch}
                        onStartHistory={onStartHistory}
                    />

                    {/* 2. Slope Angle Detection & Top/Bottom Ground Transitions (No Mesh Deformation) */}
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-emerald-500/25 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                                2. Slope Angle Band &amp; Ground Transitions
                            </span>
                            <button
                                type="button"
                                onClick={() => updateSlope('invertMask', !slope.invertMask, true)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                                    slope.invertMask
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                                title="Invert which angles receive the slope material"
                            >
                                {slope.invertMask ? 'Inverted' : 'Band Mode'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            Targets all slope directions between Min° (ignores flat ground) and Max° (ignores vertical cliffs), and dissolves smoothly at the top crest &amp; bottom toe.
                        </p>

                        <div className="grid grid-cols-3 gap-1.5">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Min Angle</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.minAngle}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="2"
                                    max="65"
                                    step="1"
                                    value={slope.minAngle}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('minAngle', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope('minAngle', DEFAULT_SLOPE_SHAPING_SETTINGS.minAngle, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Max Angle</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.maxAngle}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="15"
                                    max="88"
                                    step="1"
                                    value={slope.maxAngle}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('maxAngle', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope('maxAngle', DEFAULT_SLOPE_SHAPING_SETTINGS.maxAngle, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Angle Feather</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.feather}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="35"
                                    step="1"
                                    value={slope.feather}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('feather', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope('feather', DEFAULT_SLOPE_SHAPING_SETTINGS.feather, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Top Crest Blend</span>
                                    <span className="text-emerald-300 font-mono tabular-nums">
                                        {slope.crestTransition}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="70"
                                    step="1"
                                    value={slope.crestTransition}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('crestTransition', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'crestTransition',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.crestTransition,
                                            true
                                        )
                                    }
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Bottom Toe Blend</span>
                                    <span className="text-emerald-300 font-mono tabular-nums">
                                        {slope.toeTransition}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="70"
                                    step="1"
                                    value={slope.toeTransition}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('toeTransition', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'toeTransition',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.toeTransition,
                                            true
                                        )
                                    }
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Transition Feather</span>
                                    <span className="text-emerald-300 font-mono">{slope.transitionFeather}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    value={slope.transitionFeather}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('transitionFeather', parseInt(e.target.value, 10))}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Organic Breakup</span>
                                    <span className="text-emerald-300 font-mono">{slope.transitionNoise}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={slope.transitionNoise}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('transitionNoise', parseInt(e.target.value, 10))}
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Darker Spots & Dip Shading (Shader Only - No Mesh Deformation) */}
                    <ThreeDSlopeDipsDarkSpotsSubpanel
                        slope={slope}
                        updateSlope={updateSlope}
                        onStartHistory={onStartHistory}
                    />

                    {/* 4. BOTTOM: Optional Slope Mesh Displacement & Shaping (Collapsed by default) */}
                    <ThreeDSlopeMeshDisplacementSection
                        object={object}
                        overlays={overlays}
                        slope={slope}
                        onUpdateObject={onUpdateObject}
                        updateSlope={updateSlope}
                        updateSlopeBatch={updateSlopeBatch}
                        onStartHistory={onStartHistory}
                    />
                </div>
            )}
        </div>
    );
};
