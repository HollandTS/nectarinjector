import React from 'react';
import type { ThreeDCliffShapingSettings } from '../../../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../../utils/threeDCliffPresets';
import { LucideLayers, LucideRotateCcw, LucideSparkles } from 'lucide-react';

interface ThreeDCliffEmergeControlsProps {
    cliff: ThreeDCliffShapingSettings;
    updateCliff: <K extends keyof ThreeDCliffShapingSettings>(
        key: K,
        val: ThreeDCliffShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateCliffBatch: (updates: Partial<ThreeDCliffShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDCliffEmergeControls: React.FC<ThreeDCliffEmergeControlsProps> = ({
    cliff,
    updateCliff,
    updateCliffBatch,
    onStartHistory,
}) => {
    const heightThreshold = cliff.wallHeightThreshold ?? 65;
    const heightDissolve = cliff.wallHeightDissolve ?? 75;
    const heightSharpness = cliff.wallHeightSharpness ?? 65;
    const mixAmount = cliff.wallMixAmount ?? 100;
    const heightInvert = cliff.wallHeightInvert ?? false;
    const bumpStrength = cliff.wallBumpStrength ?? 1.3;
    const normalScale = cliff.wallNormalScale ?? 1.25;

    const handleResetEmerge = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateCliffBatch(
            {
                wallHeightThreshold: DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightThreshold ?? 65,
                wallHeightDissolve: DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightDissolve ?? 75,
                wallHeightSharpness: DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightSharpness ?? 65,
                wallMixAmount: DEFAULT_CLIFF_SHAPING_SETTINGS.wallMixAmount ?? 100,
                wallHeightInvert: DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightInvert ?? false,
                wallBumpStrength: DEFAULT_CLIFF_SHAPING_SETTINGS.wallBumpStrength ?? 1.3,
                wallNormalScale: DEFAULT_CLIFF_SHAPING_SETTINGS.wallNormalScale ?? 1.25,
            },
            true
        );
    };

    return (
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-amber-500/35 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 min-w-0">
                    <LucideSparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 truncate">
                        Cliff Emerge, Height Dissolve &amp; Bump Relief
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleResetEmerge}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Reset Cliff Rock Emerge, Dissolve & Bump Sliders"
                >
                    <LucideRotateCcw className="w-3 h-3" />
                </button>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
                Uses the Wall Height &amp; Bump maps so cliff rocks emerge out of the main ground texture (e.g. dirt → cliff rock) with zero mesh deformation.
            </p>

            {/* Primary Slider: How much cliff rock comes out of the wall */}
            <div className="bg-slate-950/80 p-2 rounded border border-amber-500/30 space-y-1">
                <div className="flex justify-between text-[10px] font-black uppercase text-amber-200">
                    <span>Cliff Rock Emerge Amount (Dirt → Rocks)</span>
                    <span className="text-amber-300 font-mono tabular-nums">{heightThreshold}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={heightThreshold}
                    onMouseDown={onStartHistory}
                    onChange={(e) => updateCliff('wallHeightThreshold', parseInt(e.target.value, 10))}
                    onDoubleClick={() =>
                        updateCliff(
                            'wallHeightThreshold',
                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightThreshold ?? 65,
                            true
                        )
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-semibold">
                    <span>0% (Main Dirt)</span>
                    <span>50% (Rock Ridges)</span>
                    <span>100% (Full Cliff Rock)</span>
                </div>
            </div>

            {/* Height Dissolve Strength & Edge Sharpness */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="How strongly the Wall Height Map drives the dissolve vs a flat opacity fade">
                            Height Map Dissolve
                        </span>
                        <span className="text-amber-300 font-mono tabular-nums">{heightDissolve}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={heightDissolve}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateCliff('wallHeightDissolve', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateCliff(
                                'wallHeightDissolve',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightDissolve ?? 75,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="Soft gradient blend vs crisp rock-to-dirt emergence edge">
                            Dissolve Edge Crispness
                        </span>
                        <span className="text-amber-300 font-mono tabular-nums">{heightSharpness}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={heightSharpness}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateCliff('wallHeightSharpness', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateCliff(
                                'wallHeightSharpness',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.wallHeightSharpness ?? 65,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Height Bump Relief & Normal Map Bump */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="3D surface bump lighting derived directly from the Wall Height / Depth Map (no vertex deformation)">
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
                        onChange={(e) => updateCliff('wallBumpStrength', parseFloat(e.target.value))}
                        onDoubleClick={() =>
                            updateCliff(
                                'wallBumpStrength',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.wallBumpStrength ?? 1.3,
                                true
                            )
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span title="Intensity of the Wall Normal Map">Normal Map Bump</span>
                        <span className="text-amber-300 font-mono tabular-nums">
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
                        onChange={(e) => updateCliff('wallNormalScale', parseFloat(e.target.value))}
                        onDoubleClick={() =>
                            updateCliff(
                                'wallNormalScale',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.wallNormalScale ?? 1.25,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Overall Opacity & Invert Height Mask */}
            <div className="grid grid-cols-2 gap-2 items-center pt-0.5">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Overall Wall Opacity</span>
                        <span className="text-amber-300 font-mono tabular-nums">{mixAmount}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={mixAmount}
                        onMouseDown={onStartHistory}
                        onChange={(e) => updateCliff('wallMixAmount', parseInt(e.target.value, 10))}
                        onDoubleClick={() =>
                            updateCliff(
                                'wallMixAmount',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.wallMixAmount ?? 100,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div className="flex items-center justify-between bg-slate-950/70 px-2 py-1.5 rounded border border-slate-800">
                    <span className="text-[9px] font-bold uppercase text-slate-300 flex items-center gap-1">
                        <LucideLayers className="w-3 h-3 text-amber-400" />
                        <span>Height Mask</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => updateCliff('wallHeightInvert', !heightInvert, true)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                            heightInvert
                                ? 'bg-amber-600 text-white'
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
