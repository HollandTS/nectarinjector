import React from 'react';
import type { ThreeDCliffShapingSettings } from '../../../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../../utils/threeDCliffPresets';

interface ThreeDCliffTopTransitionSubpanelProps {
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

export const ThreeDCliffTopTransitionSubpanel: React.FC<ThreeDCliffTopTransitionSubpanelProps> = ({
    cliff,
    updateCliff,
    updateCliffBatch,
    onStartHistory,
}) => {
    const topTrans = cliff.topGroundTransition ?? DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundTransition;
    const topFeather = cliff.topGroundFeather ?? DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundFeather;
    const topDrop = cliff.topGroundDrop ?? DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundDrop;
    const topNoise = cliff.topGroundNoise ?? DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundNoise;

    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-sky-500/30 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-300">
                    Top Ground / Plateau Rim Transition (No Mesh Deform)
                </span>
                <button
                    type="button"
                    onClick={() =>
                        updateCliffBatch(
                            {
                                enabled: true,
                                topGroundTransition: topTrans > 0 ? 0 : 8,
                            },
                            true
                        )
                    }
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                        topTrans > 0
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                    title="Blend the top flat ground dirt/grass smoothly over the upper cliff lip"
                >
                    {topTrans > 0 ? 'ACTIVE' : 'OFF'}
                </button>
            </div>

            <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    <span>Top Ground Spill / Blend Depth</span>
                    <span className="text-sky-300 font-mono tabular-nums">{topTrans}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="80"
                    step="1"
                    value={topTrans}
                    onMouseDown={onStartHistory}
                    onChange={(e) =>
                        updateCliffBatch({
                            enabled: true,
                            topGroundTransition: parseInt(e.target.value, 10),
                        })
                    }
                    onDoubleClick={() =>
                        updateCliff(
                            'topGroundTransition',
                            DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundTransition,
                            true
                        )
                    }
                    title="How far down from the top plateau the top ground texture & shading blend into the cliff wall (Double-click to reset)"
                    className="w-full accent-sky-500 cursor-pointer"
                />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                        <span>Rim Feather</span>
                        <span className="text-sky-300 font-mono tabular-nums">{topFeather}%</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="60"
                        step="1"
                        value={topFeather}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateCliffBatch({
                                enabled: true,
                                topGroundFeather: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateCliff(
                                'topGroundFeather',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundFeather,
                                true
                            )
                        }
                        title="Softness of the transition between top ground dirt and vertical cliff rock"
                        className="w-full accent-sky-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                        <span>Edge Breakup</span>
                        <span className="text-sky-300 font-mono tabular-nums">{topNoise}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={topNoise}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateCliffBatch({
                                enabled: true,
                                topGroundNoise: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateCliff(
                                'topGroundNoise',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundNoise,
                                true
                            )
                        }
                        title="Breaks up the straight horizontal top seam with natural dirt/rock variations"
                        className="w-full accent-sky-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                        <span>Rim Shift</span>
                        <span className="text-sky-300 font-mono tabular-nums">
                            {topDrop > 0 ? `+${topDrop}%` : `${topDrop}%`}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={topDrop}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateCliffBatch({
                                enabled: true,
                                topGroundDrop: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateCliff(
                                'topGroundDrop',
                                DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundDrop,
                                true
                            )
                        }
                        title="Shifts the top ground transition line higher or lower along the cliff wall"
                        className="w-full accent-sky-500 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
};
