import React from 'react';
import type { ThreeDSurfaceScatterSettings } from '../../../types';
import { DEFAULT_SURFACE_SCATTER_SETTINGS } from '../../../utils/threeDSurfaceScatterPresets';

interface ThreeDSurfaceScatterTransformColorSubpanelProps {
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

export const ThreeDSurfaceScatterTransformColorSubpanel: React.FC<
    ThreeDSurfaceScatterTransformColorSubpanelProps
> = ({ scatter, updateScatter, updateScatterBatch, onStartHistory }) => {
    return (
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-amber-500/25 space-y-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block">
                3. Random Rotation, Scale, Normal Align &amp; Color
            </span>

            {/* Scale Controls */}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Base Scale</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.baseScale.toFixed(2)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.05"
                        max="3.5"
                        step="0.02"
                        value={scatter.baseScale}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                baseScale: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'baseScale',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.baseScale,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Min Scale %</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.randomScaleMin}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="5"
                        value={scatter.randomScaleMin}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                randomScaleMin: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'randomScaleMin',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.randomScaleMin,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Max Scale %</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.randomScaleMax}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="15"
                        max="300"
                        step="5"
                        value={scatter.randomScaleMax}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                randomScaleMax: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'randomScaleMax',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.randomScaleMax,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Axis Scale Multipliers (Width X, Height Y, Depth Z) */}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Width (X)</span>
                        <span className="text-amber-300 font-mono">
                            {scatter.scaleX.toFixed(2)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.05"
                        value={scatter.scaleX}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                scaleX: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() => updateScatter('scaleX', 1.0, true)}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Height (Y)</span>
                        <span className="text-amber-300 font-mono">
                            {scatter.scaleY.toFixed(2)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.05"
                        value={scatter.scaleY}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                scaleY: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() => updateScatter('scaleY', 1.0, true)}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Depth (Z)</span>
                        <span className="text-amber-300 font-mono">
                            {scatter.scaleZ.toFixed(2)}x
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.05"
                        value={scatter.scaleZ}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                scaleZ: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() => updateScatter('scaleZ', 1.0, true)}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
            </div>

            {/* Rotation & Surface Alignment Sliders */}
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80">
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Random Y Rot</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.randomRotationY}°
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={scatter.randomRotationY}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                randomRotationY: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'randomRotationY',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.randomRotationY,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Random X/Z Tilt</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.randomTiltXZ}°
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="60"
                        step="1"
                        value={scatter.randomTiltXZ}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                randomTiltXZ: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'randomTiltXZ',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.randomTiltXZ,
                                true
                            )
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Align To Normal</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.alignToNormal}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={scatter.alignToNormal}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                alignToNormal: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'alignToNormal',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.alignToNormal,
                                true
                            )
                        }
                        title="0% = stand straight up vertically, 100% = tilt perpendicular to terrain slope"
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                        <span>Ground Sink (Y)</span>
                        <span className="text-amber-300 font-mono tabular-nums">
                            {scatter.sinkOffset.toFixed(2)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.01"
                        value={scatter.sinkOffset}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            updateScatterBatch({
                                enabled: true,
                                sinkOffset: parseFloat(e.target.value),
                            })
                        }
                        onDoubleClick={() =>
                            updateScatter(
                                'sinkOffset',
                                DEFAULT_SURFACE_SCATTER_SETTINGS.sinkOffset,
                                true
                            )
                        }
                        title="Embeds grass/rocks slightly into the ground so roots never float on slopes"
                        className="w-full accent-amber-500 cursor-pointer"
                    />
                </div>
            </div>

            {/* Color & Brightness Variation + Base Mesh Toggle */}
            <div className="pt-1.5 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Color Jitter</span>
                            <span className="text-amber-300 font-mono tabular-nums">
                                {scatter.colorVariation}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={scatter.colorVariation}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    colorVariation: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'colorVariation',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.colorVariation,
                                    true
                                )
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span>Brightness Jitter</span>
                            <span className="text-amber-300 font-mono tabular-nums">
                                {scatter.brightnessVariation}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={scatter.brightnessVariation}
                            onMouseDown={onStartHistory}
                            onChange={(e) =>
                                updateScatterBatch({
                                    enabled: true,
                                    brightnessVariation: parseInt(e.target.value, 10),
                                })
                            }
                            onDoubleClick={() =>
                                updateScatter(
                                    'brightnessVariation',
                                    DEFAULT_SURFACE_SCATTER_SETTINGS.brightnessVariation,
                                    true
                                )
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Color Tint & Hide Base Plane Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center space-x-2 flex-1">
                        <input
                            type="color"
                            value={scatter.tintColor || '#ffffff'}
                            onChange={(e) =>
                                updateScatterBatch(
                                    { enabled: true, tintColor: e.target.value },
                                    true
                                )
                            }
                            className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer shrink-0"
                            title="Global tint color for scattered instances"
                        />
                        <div className="flex-1">
                            <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                <span>Tint Mix</span>
                                <span className="text-amber-300 font-mono">
                                    {scatter.tintStrength}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={scatter.tintStrength}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateScatterBatch({
                                        enabled: true,
                                        tintStrength: parseInt(e.target.value, 10),
                                    })
                                }
                                onDoubleClick={() => updateScatter('tintStrength', 0, true)}
                                className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                        <label
                            className="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700/80 cursor-pointer select-none shrink-0"
                            title="Hide the base plane/mesh so only the scattered 3D models are visible"
                        >
                            <input
                                type="checkbox"
                                checked={Boolean(scatter.hideBaseMesh)}
                                onChange={(e) =>
                                    updateScatter('hideBaseMesh', e.target.checked, true)
                                }
                                className="accent-emerald-500 rounded cursor-pointer"
                            />
                            <span className="text-[9px] font-bold uppercase text-slate-300">
                                Hide Base Plane
                            </span>
                        </label>

                        <label
                            className={`flex items-center space-x-1.5 px-2 py-1 rounded border cursor-pointer select-none shrink-0 transition-colors ${
                                scatter.hideBaseMesh && scatter.holdoutMask
                                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                    : 'bg-slate-900 border-slate-700/80 text-slate-300'
                            }`}
                            title="Holdout: when Hide Base Plane is checked, the hidden base plane still acts as a depth mask (holdout), masking any part of the scattered objects behind/underneath it"
                        >
                            <input
                                type="checkbox"
                                checked={Boolean(scatter.holdoutMask)}
                                onChange={(e) =>
                                    updateScatter('holdoutMask', e.target.checked, true)
                                }
                                className="accent-emerald-500 rounded cursor-pointer"
                            />
                            <span className="text-[9px] font-bold uppercase">
                                Holdout
                            </span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};
