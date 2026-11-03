import React from 'react';
import type { ThreeDCliffShapingSettings } from '../../../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../../utils/threeDCliffPresets';
import { ThreeDMeshSeamWeldControl } from './ThreeDMeshSeamWeldControl';
import { LucideDices } from 'lucide-react';

interface ThreeDCliffRockSculptSubpanelProps {
    cliff: ThreeDCliffShapingSettings;
    updateCliff: <K extends keyof ThreeDCliffShapingSettings>(
        key: K,
        val: ThreeDCliffShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateCliffBatch: (
        updates: Partial<ThreeDCliffShapingSettings>,
        pushHistory?: boolean
    ) => void;
    onStartHistory: () => void;
}

export const ThreeDCliffRockSculptSubpanel: React.FC<ThreeDCliffRockSculptSubpanelProps> = ({
    cliff,
    updateCliff,
    updateCliffBatch,
    onStartHistory,
}) => {
    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    4. Cliff Face Rock Sculpting
                </span>
                <button
                    type="button"
                    onClick={() =>
                        updateCliffBatch(
                            {
                                enabled: true,
                                cliffSeed: Math.floor(Math.random() * 99999),
                            },
                            true
                        )
                    }
                    className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[9px] font-bold uppercase cursor-pointer"
                    title="Randomize Rock Strata & Crag Seed"
                >
                    <LucideDices className="w-3 h-3" />
                    <span>Seed #{cliff.cliffSeed}</span>
                </button>
            </div>

            {/* Wall Normal Push + Overhang Lip + Talus Skirt */}
            <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    <span>Wall Normal Push (Bulge / Carve)</span>
                    <span className="text-amber-300 font-mono tabular-nums">
                        {cliff.wallNormalPush.toFixed(2)}
                    </span>
                </div>
                <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={cliff.wallNormalPush}
                    onMouseDown={onStartHistory}
                    onChange={(e) =>
                        updateCliffBatch({
                            enabled: true,
                            wallNormalPush: parseFloat(e.target.value),
                        })
                    }
                    onDoubleClick={() =>
                        updateCliff(
                            'wallNormalPush',
                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallNormalPush,
                            true
                        )
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        <span>Top Lip Overhang</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {cliff.overhangAmount.toFixed(2)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-4"
                        max="4"
                        step="0.05"
                        value={cliff.overhangAmount}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateCliffBatch({
                                enabled: true,
                                overhangAmount: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() =>
                            updateCliff(
                                'overhangAmount',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.overhangAmount,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        <span>Talus Base Flare</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {cliff.talusSkirtAmount.toFixed(2)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-4"
                        max="4"
                        step="0.05"
                        value={cliff.talusSkirtAmount}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateCliffBatch({
                                enabled: true,
                                talusSkirtAmount: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() =>
                            updateCliff(
                                'talusSkirtAmount',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.talusSkirtAmount,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Horizontal Sedimentary Rock Strata */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-200">
                        Horizontal Rock Strata Ledges
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            updateCliffBatch(
                                { enabled: true, strataEnabled: !cliff.strataEnabled },
                                true
                            )
                        }
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                            cliff.strataEnabled
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                        {cliff.strataEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                {cliff.strataEnabled && (
                    <div className="space-y-1.5 pl-1">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                    <span>Ledge Depth</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.strataAmplitude.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-4"
                                    max="4"
                                    step="0.05"
                                    value={cliff.strataAmplitude}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('strataAmplitude', parseFloat(e.target.value))
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'strataAmplitude',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.strataAmplitude,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                    <span>Layer Count</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.strataFrequency.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="16"
                                    step="0.5"
                                    value={cliff.strataFrequency}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('strataFrequency', parseFloat(e.target.value))
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'strataFrequency',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.strataFrequency,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                    <span>Step Sharpness</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.strataSharpness}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={cliff.strataSharpness}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('strataSharpness', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'strataSharpness',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.strataSharpness,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                    <span>Strata Tilt</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.strataTilt}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-45"
                                    max="45"
                                    step="1"
                                    value={cliff.strataTilt}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('strataTilt', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'strataTilt',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.strataTilt,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Vertical Crags & Fissure Columns */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-amber-200">
                        Vertical Rock Crags & Fissures
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            updateCliffBatch(
                                { enabled: true, cragEnabled: !cliff.cragEnabled },
                                true
                            )
                        }
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                            cliff.cragEnabled
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                        {cliff.cragEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                {cliff.cragEnabled && (
                    <div className="grid grid-cols-3 gap-1.5 pl-1">
                        <div>
                            <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                <span>Strength</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {cliff.cragAmplitude.toFixed(1)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-4"
                                max="4"
                                step="0.1"
                                value={cliff.cragAmplitude}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateCliff('cragAmplitude', parseFloat(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateCliff(
                                        'cragAmplitude',
                                        DEFAULT_CLIFF_SHAPING_SETTINGS.cragAmplitude,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                <span>Frequency</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {cliff.cragFrequency.toFixed(1)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="14"
                                step="0.5"
                                value={cliff.cragFrequency}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateCliff('cragFrequency', parseFloat(e.target.value))
                                }
                                onDoubleClick={() =>
                                    updateCliff(
                                        'cragFrequency',
                                        DEFAULT_CLIFF_SHAPING_SETTINGS.cragFrequency,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                <span>Ridge Cut</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {cliff.cragSharpness}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={cliff.cragSharpness}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateCliff('cragSharpness', parseInt(e.target.value, 10))
                                }
                                onDoubleClick={() =>
                                    updateCliff(
                                        'cragSharpness',
                                        DEFAULT_CLIFF_SHAPING_SETTINGS.cragSharpness,
                                        true
                                    )
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Pin Base / Tile Connection Edge */}
            <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    <span>Pin Base & Lip Tile Alignment</span>
                    <span className="text-amber-300 font-mono tabular-nums">
                        {cliff.pinBottomEdge}%
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={cliff.pinBottomEdge}
                    onMouseDown={onStartHistory}
                    onChange={(e) => updateCliff('pinBottomEdge', parseInt(e.target.value, 10))}
                    onDoubleClick={() =>
                        updateCliff(
                            'pinBottomEdge',
                            DEFAULT_CLIFF_SHAPING_SETTINGS.pinBottomEdge,
                            true
                        )
                    }
                    title="Locks the top lip and bottom boundary of the cliff model so injected cliff tiles connect cleanly"
                    className="w-full accent-amber-500 cursor-pointer"
                />
            </div>

            {/* Connected Mesh Seam Welding Control */}
            <ThreeDMeshSeamWeldControl
                weldVertices={cliff.weldVertices ?? true}
                weldTolerance={cliff.weldTolerance ?? 35}
                onChangeWeldVertices={(val) => updateCliff('weldVertices', val, true)}
                onChangeWeldTolerance={(val) => updateCliff('weldTolerance', val)}
                onStartHistory={onStartHistory}
                accentColor="amber"
            />
        </div>
    );
};
