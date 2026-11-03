import React, { useState } from 'react';
import type { ThreeDObject, ThreeDSlopeShapingSettings, ProjectOverlay } from '../../../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../../utils/threeDSlopePresets';
import { CavityHeightGeneratorWindow } from '../../modals/CavityHeightGeneratorWindow';
import { LucideMountainSnow, LucideRotateCcw, LucideMountain } from 'lucide-react';

interface ThreeDSlopeMainDisplacementSubpanelProps {
    object: ThreeDObject;
    overlays?: ProjectOverlay[];
    slope: ThreeDSlopeShapingSettings;
    onUpdateObject?: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    updateSlope: <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateSlopeBatch: (updates: Partial<ThreeDSlopeShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDSlopeMainDisplacementSubpanel: React.FC<
    ThreeDSlopeMainDisplacementSubpanelProps
> = ({ object, overlays = [], slope, onUpdateObject, updateSlope, updateSlopeBatch, onStartHistory }) => {
    const [isCavityModalOpen, setIsCavityModalOpen] = useState(false);
    const enabled = slope.mainSlopeDisplacementEnabled ?? false;
    const depthScale = slope.mainSlopeDepthScale ?? 0;
    const depthBias = slope.mainSlopeDepthBias ?? 0;
    const depthContrast = slope.mainSlopeDepthContrast ?? 120;
    const depthBlur = slope.mainSlopeDepthBlur ?? 1;
    const depthInvert = slope.mainSlopeDepthInvert ?? false;
    const dispMode = slope.mainSlopeDisplacementMode ?? 'normal';
    const triplanar = slope.mainSlopeTriplanar ?? true;

    const sourceBadge = object.displacementMapUrl
        ? 'Main Height / Displacement Map'
        : object.textureOverlayId
        ? 'Main Linked 2D Layer'
        : object.textureUrl
        ? 'Main Diffuse Texture'
        : 'Embedded GLB Texture';

    const handleResetMainDisp = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateSlopeBatch(
            {
                mainSlopeDepthScale: 0,
                mainSlopeDepthBias: 0,
                mainSlopeDepthContrast: DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthContrast ?? 120,
                mainSlopeDepthBlur: DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthBlur ?? 1,
                mainSlopeDepthInvert: DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthInvert ?? false,
                mainSlopeDisplacementMode:
                    DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDisplacementMode ?? 'normal',
                mainSlopeTriplanar: DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeTriplanar ?? true,
            },
            true
        );
    };

    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 min-w-0">
                    <LucideMountainSnow className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 truncate">
                        Main Texture Displacement (Slopes Only)
                    </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                    {enabled && (
                        <button
                            type="button"
                            onClick={handleResetMainDisp}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Reset Main Texture Slope Displacement"
                        >
                            <LucideRotateCcw className="w-3 h-3" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => updateSlope('mainSlopeDisplacementEnabled', !enabled, true)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                            enabled
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                        {enabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
                Displaces the object&apos;s main texture ({sourceBadge}) strictly on the slope ramp faces, leaving flat top &amp; bottom ground untouched.
            </p>

            {enabled && (
                <div className="space-y-2 pt-0.5">
                    {/* Direction & Projection Row */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Push Axis</span>
                            <button
                                type="button"
                                onClick={() =>
                                    updateSlope(
                                        'mainSlopeDisplacementMode',
                                        dispMode === 'normal' ? 'vertical' : 'normal',
                                        true
                                    )
                                }
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] font-black uppercase text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                                title="Normal pushes perpendicular to the ramp face; Vertical pushes along the Y axis"
                            >
                                {dispMode === 'normal' ? 'Slope Normal' : 'Vertical Y'}
                            </button>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Sampling</span>
                            <button
                                type="button"
                                onClick={() =>
                                    updateSlope('mainSlopeTriplanar', !triplanar, true)
                                }
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                                    triplanar
                                        ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-200'
                                        : 'bg-slate-800 border border-slate-700 text-slate-300'
                                }`}
                                title="Planar/Triplanar avoids UV stretching on steep ramps; Mesh UV follows exact vertex UVs"
                            >
                                {triplanar ? 'Planar (No Stretch)' : 'Mesh UVs'}
                            </button>
                        </div>
                    </div>

                    {/* Main Texture Depth Scale & Bias */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Main Depth Scale</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {depthScale.toFixed(2)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-8"
                                max="8"
                                step="0.05"
                                value={depthScale}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateSlope('mainSlopeDepthScale', parseFloat(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateSlope(
                                        'mainSlopeDepthScale',
                                        DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthScale ?? 1.5,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Slope Height Bias</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {depthBias.toFixed(2)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-4"
                                max="4"
                                step="0.05"
                                value={depthBias}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateSlope('mainSlopeDepthBias', parseFloat(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateSlope(
                                        'mainSlopeDepthBias',
                                        DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthBias ?? 0,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Contrast, Blur & Invert */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Depth Contrast</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {depthContrast}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="300"
                                step="5"
                                value={depthContrast}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateSlope('mainSlopeDepthContrast', parseInt(e.target.value, 10))
                                }
                                onDoubleClick={() =>
                                    updateSlope(
                                        'mainSlopeDepthContrast',
                                        DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthContrast ?? 120,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Depth Smoothing</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {depthBlur.toFixed(1)}px
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.5"
                                value={depthBlur}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateSlope('mainSlopeDepthBlur', parseFloat(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateSlope(
                                        'mainSlopeDepthBlur',
                                        DEFAULT_SLOPE_SHAPING_SETTINGS.mainSlopeDepthBlur ?? 1,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                            Invert Main Texture B&amp;W on Slopes
                        </span>
                        <button
                            type="button"
                            onClick={() => updateSlope('mainSlopeDepthInvert', !depthInvert, true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                                depthInvert
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                        >
                            {depthInvert ? 'Inverted' : 'Normal'}
                        </button>
                    </div>
                    {onUpdateObject && (
                        <button
                            type="button"
                            onClick={() => setIsCavityModalOpen(true)}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                            title="Open external Cavity & Solid B/W Height Studio for Slopes"
                        >
                            <LucideMountain className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Slope Cavity & Solid B/W Height Studio...</span>
                        </button>
                    )}
                </div>
            )}

            {onUpdateObject && (
                <CavityHeightGeneratorWindow
                    isOpen={isCavityModalOpen}
                    onClose={() => setIsCavityModalOpen(false)}
                    object={object}
                    overlays={overlays}
                    initialTargetChannel="slope"
                    onUpdateObject={onUpdateObject}
                />
            )}
        </div>
    );
};
