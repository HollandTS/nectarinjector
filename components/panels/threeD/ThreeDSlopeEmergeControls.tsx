import React from 'react';
import type { ThreeDSlopeShapingSettings } from '../../../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../../utils/threeDSlopePresets';
import { LucideLayers, LucideRotateCcw, LucideSparkles } from 'lucide-react';

interface ThreeDSlopeEmergeControlsProps {
    slope: ThreeDSlopeShapingSettings;
    updateSlope: <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateSlopeBatch: (updates: Partial<ThreeDSlopeShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDSlopeEmergeControls: React.FC<ThreeDSlopeEmergeControlsProps> = ({
    slope,
    updateSlope,
    updateSlopeBatch,
    onStartHistory,
}) => {
    const heightThreshold = slope.slopeHeightThreshold ?? 60;
    const heightDissolve = slope.slopeHeightDissolve ?? 75;
    const heightSharpness = slope.slopeHeightSharpness ?? 65;
    const mixAmount = slope.slopeMixAmount ?? 100;
    const heightInvert = slope.slopeHeightInvert ?? false;
    const bumpStrength = slope.slopeBumpStrength ?? 1.25;
    const normalScale = slope.slopeNormalScale ?? 1.25;

    const handleResetEmerge = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateSlopeBatch(
            {
                slopeHeightThreshold: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightThreshold ?? 60,
                slopeHeightDissolve: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightDissolve ?? 75,
                slopeHeightSharpness: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightSharpness ?? 65,
                slopeMixAmount: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeMixAmount ?? 100,
                slopeHeightInvert: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightInvert ?? false,
                slopeBumpStrength: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeBumpStrength ?? 1.25,
                slopeNormalScale: DEFAULT_SLOPE_SHAPING_SETTINGS.slopeNormalScale ?? 1.25,
            },
            true
        );
    };

    return (
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-teal-500/35 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 min-w-0">
                    <LucideSparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-200 truncate">
                        Slope Emerge, Height Dissolve &amp; Bump Relief
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleResetEmerge}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Reset Rock Emerge, Dissolve & Bump Sliders"
                >
                    <LucideRotateCcw className="w-3 h-3" />
                </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
                Uses the Slope Height &amp; Bump maps so rocks emerge out of the main ground texture (e.g. dirt → rocks) with zero mesh deformation.
            </p>

            {/* Primary Slider: How much rock comes out of the slope */}
            <div className="bg-slate-950/80 p-2 rounded border border-teal-500/30 space-y-1">
                <div className="flex justify-between text-[10px] font-black uppercase text-teal-200">
                    <span>Rock Emerge Amount (Dirt → Rocks)</span>
                    <span className="text-teal-300 font-mono tabular-nums">{heightThreshold}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={heightThreshold}
                    onMouseDown={onStartHistory}
                    onChange={(e) => updateSlope('slopeHeightThreshold', parseInt(e.target.value, 10))}
                    onDoubleClick={() =>
                        updateSlope(
                            'slopeHeightThreshold',
                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightThreshold ?? 60,
                            true
                        )
                    }
                    className="w-full accent-teal-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-semibold">
                    <span>0% (Main Dirt)</span>
                    <span>50% (Rock Peaks)</span>
                    <span>100% (Full Rock)</span>
                </div>
            </div>

            {/* Height Dissolve Strength & Edge Sharpness */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="How strongly the Slope Height Map drives the dissolve vs a flat opacity fade">
                            Height Map Dissolve
                        </span>
                        <span className="text-teal-300 font-mono tabular-nums">{heightDissolve}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={heightDissolve}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateSlope('slopeHeightDissolve', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateSlope(
                                'slopeHeightDissolve',
                                DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightDissolve ?? 75,
                                true
                            )
                        }
                        className="w-full accent-teal-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="Soft gradient blend vs crisp rock-to-dirt emergence edge">
                            Dissolve Edge Crispness
                        </span>
                        <span className="text-teal-300 font-mono tabular-nums">{heightSharpness}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={heightSharpness}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateSlope('slopeHeightSharpness', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateSlope(
                                'slopeHeightSharpness',
                                DEFAULT_SLOPE_SHAPING_SETTINGS.slopeHeightSharpness ?? 65,
                                true
                            )
                        }
                        className="w-full accent-teal-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Height Bump Relief & Normal Map Bump */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="3D surface bump lighting derived directly from the Slope Height / Depth Map (no vertex deformation)">
                            Height Map Bump
                        </span>
                        <span className="text-emerald-300 font-mono tabular-nums">
                            {bumpStrength.toFixed(2)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.05"
                        value={bumpStrength}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateSlope('slopeBumpStrength', parseFloat(e.target.value))}
                        onDoubleClick={() =>
                            updateSlope(
                                'slopeBumpStrength',
                                DEFAULT_SLOPE_SHAPING_SETTINGS.slopeBumpStrength ?? 1.25,
                                true
                            )
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="Intensity of the Slope Normal Map">Normal Map Bump</span>
                        <span className="text-teal-300 font-mono tabular-nums">
                            {normalScale.toFixed(2)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.05"
                        value={normalScale}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateSlope('slopeNormalScale', parseFloat(e.target.value))}
                        onDoubleClick={() =>
                            updateSlope(
                                'slopeNormalScale',
                                DEFAULT_SLOPE_SHAPING_SETTINGS.slopeNormalScale ?? 1.25,
                                true
                            )
                        }
                        className="w-full accent-teal-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Overall Opacity & Invert Height Mask */}
            <div className="grid grid-cols-2 gap-2 items-center pt-0.5">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Overall Slope Opacity</span>
                        <span className="text-teal-300 font-mono tabular-nums">{mixAmount}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={mixAmount}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateSlope('slopeMixAmount', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateSlope(
                                'slopeMixAmount',
                                DEFAULT_SLOPE_SHAPING_SETTINGS.slopeMixAmount ?? 100,
                                true
                            )
                        }
                        className="w-full accent-teal-500 cursor-pointer"
                    />
                </div>
                <div className="flex items-center justify-between bg-slate-950/70 px-2 py-1.5 rounded border border-slate-800">
                    <span className="text-[9px] font-bold uppercase text-slate-300 flex items-center gap-1">
                        <LucideLayers className="w-3 h-3 text-teal-400" />
                        <span>Height Mask</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => updateSlope('slopeHeightInvert', !heightInvert, true)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                            heightInvert
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                        title="Invert which height values emerge first (White = High vs Black = High)"
                    >
                        {heightInvert ? 'Inverted' : 'Bright First'}
                    </button>
                </div>
            </div>
        </div>
    );
};
