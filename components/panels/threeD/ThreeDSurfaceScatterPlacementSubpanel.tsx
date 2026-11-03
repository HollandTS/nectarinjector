import React from 'react';
import type { ThreeDSurfaceScatterSettings } from '../../../types';
import { DEFAULT_SURFACE_SCATTER_SETTINGS } from '../../../utils/threeDSurfaceScatterPresets';
import { LucideDices } from 'lucide-react';

interface ThreeDSurfaceScatterPlacementSubpanelProps {
    scatter: ThreeDSurfaceScatterSettings;
    updateScatter: <K extends keyof ThreeDSurfaceScatterSettings>(
        key: K,
        val: ThreeDSurfaceScatterSettings[K],
        pushHistory?: boolean
    ) => void;
    updateScatterBatch: (
        updates: Partial<ThreeDSurfaceScatterSettings>,
        pushHistory?: boolean
    ) => void;
    onStartHistory: () => void;
}

export const ThreeDSurfaceScatterPlacementSubpanel: React.FC<
    ThreeDSurfaceScatterPlacementSubpanelProps
> = ({ scatter, updateScatter, updateScatterBatch, onStartHistory }) => {
    const randomizeSeed = () => {
        const nextSeed = Math.floor(Math.random() * 99999) + 1;
        updateScatterBatch({ enabled: true, seed: nextSeed }, true);
    };

    return (
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-cyan-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                    2. Amount, Density &amp; Top-Mesh Filtering
                </span>
                <button
                    type="button"
                    onClick={randomizeSeed}
                    className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-800/80 border border-cyan-500/40 text-[9px] font-black uppercase text-cyan-200 flex items-center space-x-1 transition-all cursor-pointer"
                    title="Randomize scatter pattern seed"
                >
                    <LucideDices className="w-3 h-3 text-cyan-400" />
                    <span>Seed #{scatter.seed}</span>
                </button>
            </div>

            {/* Distribution Mode Selector */}
            <div className="grid grid-cols-3 gap-1">
                {(
                    [
                        { id: 'grid_jitter', label: 'Jittered Turf' },
                        { id: 'clumped', label: 'Clumped Patches' },
                        { id: 'random', label: 'Pure Random' },
                    ] as const
                ).map((mode) => (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                            updateScatterBatch(
                                { enabled: true, distributionMode: mode.id },
                                true
                            )
                        }
                        className={`py-1 px-1.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            scatter.distributionMode === mode.id
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                        }`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Amount & Density Sliders */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Amount (Count)</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.amount}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="1500"
                        step="1"
                        value={scatter.amount}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                amount: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter('amount', DEFAULT_SURFACE_SCATTER_SETTINGS.amount, true)
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Density Boost</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.density}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="250"
                        step="5"
                        value={scatter.density}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                density: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter('density', DEFAULT_SURFACE_SCATTER_SETTINGS.density, true)
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Clump Strength, Clump Scale, Min Spacing & Edge Margin */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Clump / Patchiness</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.clumpStrength}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={scatter.clumpStrength}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                clumpStrength: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'clumpStrength',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.clumpStrength,
                                true
                            )
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Clump Scale</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.clumpScale.toFixed(1)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="16"
                        step="0.5"
                        value={scatter.clumpScale}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                clumpScale: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'clumpScale',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.clumpScale,
                                true
                            )
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Min Spacing</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.minSpacing}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={scatter.minSpacing}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                minSpacing: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'minSpacing',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.minSpacing,
                                true
                            )
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Border Margin</span>
                        <span className="text-cyan-300 font-mono tabular-nums">
                            {scatter.edgeMargin}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-25"
                        max="75"
                        step="1"
                        value={scatter.edgeMargin}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                edgeMargin: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'edgeMargin',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.edgeMargin,
                                true
                            )
                        }
                        title="Positive inset keeps grass/rocks inside tile borders; negative lets plugs overhang slightly"
                        className="w-full accent-cyan-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Top Mesh Slope & Elevation Filtering */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                    Top Surface Angle &amp; Height Filter (Avoid Steep Cliff Walls)
                </span>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Min Slope Angle</span>
                            <span className="text-emerald-300 font-mono tabular-nums">
                                {scatter.minSlopeAngle}°
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="85"
                            step="1"
                            value={scatter.minSlopeAngle}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    minSlopeAngle: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'minSlopeAngle',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.minSlopeAngle,
                                    true
                                )
                            }
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Max Slope Angle</span>
                            <span className="text-emerald-300 font-mono tabular-nums">
                                {scatter.maxSlopeAngle}°
                            </span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="90"
                            step="1"
                            value={scatter.maxSlopeAngle}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    maxSlopeAngle: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'maxSlopeAngle',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.maxSlopeAngle,
                                    true
                                )
                            }
                            title="Faces steeper than this angle (like vertical cliffs) will not receive grass/rocks"
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Min Elevation</span>
                            <span className="text-emerald-300 font-mono tabular-nums">
                                {scatter.minHeightPct}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="95"
                            step="1"
                            value={scatter.minHeightPct}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    minHeightPct: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'minHeightPct',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.minHeightPct,
                                    true
                                )
                            }
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Max Elevation</span>
                            <span className="text-emerald-300 font-mono tabular-nums">
                                {scatter.maxHeightPct}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            step="1"
                            value={scatter.maxHeightPct}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    maxHeightPct: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'maxHeightPct',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.maxHeightPct,
                                    true
                                )
                            }
                            className="w-full accent-emerald-500 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
