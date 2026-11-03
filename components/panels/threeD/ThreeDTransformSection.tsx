import React, { useState } from 'react';
import type { ThreeDObject } from '../../../types';
import { isProceduralPlaneUrl } from '../../../utils/layerTo3DPlaneUtils';
import { computeNextThreeDObjectScale } from '../../../utils/threeDTransformHelper';
import { LucideChevronDown, LucideChevronRight, LucideRotateCcw, LucideMove3d } from 'lucide-react';

interface ThreeDTransformSectionProps {
    object: ThreeDObject;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDTransformSection: React.FC<ThreeDTransformSectionProps> = ({
    object,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleResetTransform = () => {
        onUpdateObject(
            object.id,
            {
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: { x: 1, y: 1, z: 1 },
                opacity: 100,
            },
            true
        );
    };

    const axisBadgeColor: Record<'x' | 'y' | 'z', string> = {
        x: 'text-rose-400 bg-rose-950/50 border-rose-700/40',
        y: 'text-emerald-400 bg-emerald-950/50 border-emerald-700/40',
        z: 'text-cyan-400 bg-cyan-950/50 border-cyan-700/40',
    };

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    <LucideMove3d className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                        Object Transform
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleResetTransform();
                        }}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        title="Reset position, rotation, and scale"
                    >
                        <LucideRotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                    </button>
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-4">
                    {/* Position XYZ */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                                Position
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                                XYZ World
                            </span>
                        </div>
                        <div className="space-y-2">
                            {(['x', 'y', 'z'] as const).map((axis) => (
                                <div key={`pos-${axis}`} className="flex items-center space-x-2.5">
                                    <span
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black uppercase border ${axisBadgeColor[axis]}`}
                                    >
                                        {axis}
                                    </span>
                                    <input
                                        type="range"
                                        min="-500"
                                        max="500"
                                        step="0.1"
                                        value={object.position[axis]}
                                        onChange={(e) =>
                                            onUpdateObject(object.id, {
                                                position: {
                                                    ...object.position,
                                                    [axis]: parseFloat(e.target.value),
                                                },
                                            })
                                        }
                                        onDoubleClick={() =>
                                            onUpdateObject(
                                                object.id,
                                                {
                                                    position: {
                                                        ...object.position,
                                                        [axis]: 0,
                                                    },
                                                },
                                                true
                                            )
                                        }
                                        title="Double-click to reset to 0"
                                        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={Number(object.position[axis].toFixed(2))}
                                        onChange={(e) =>
                                            onUpdateObject(object.id, {
                                                position: {
                                                    ...object.position,
                                                    [axis]: parseFloat(e.target.value) || 0,
                                                },
                                            })
                                        }
                                        className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 px-2 py-1 text-right focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rotation XYZ */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                                Rotation
                            </span>
                            <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/40">
                                Radians
                            </span>
                        </div>
                        <div className="space-y-2">
                            {(['x', 'y', 'z'] as const).map((axis) => (
                                <div key={`rot-${axis}`} className="flex items-center space-x-2.5">
                                    <span
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black uppercase border ${axisBadgeColor[axis]}`}
                                    >
                                        {axis}
                                    </span>
                                    <input
                                        type="range"
                                        min="-6.28"
                                        max="6.28"
                                        step="0.01"
                                        value={object.rotation[axis]}
                                        onChange={(e) =>
                                            onUpdateObject(object.id, {
                                                rotation: {
                                                    ...object.rotation,
                                                    [axis]: parseFloat(e.target.value),
                                                },
                                            })
                                        }
                                        onDoubleClick={() =>
                                            onUpdateObject(
                                                object.id,
                                                {
                                                    rotation: {
                                                        ...object.rotation,
                                                        [axis]: 0,
                                                    },
                                                },
                                                true
                                            )
                                        }
                                        title="Double-click to reset to 0"
                                        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={Number(object.rotation[axis].toFixed(2))}
                                        onChange={(e) =>
                                            onUpdateObject(object.id, {
                                                rotation: {
                                                    ...object.rotation,
                                                    [axis]: parseFloat(e.target.value) || 0,
                                                },
                                            })
                                        }
                                        className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 px-2 py-1 text-right focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Uniform Scale */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                                Uniform Scale
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                {object.scale.x.toFixed(2)}x
                            </span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                            <span className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-black uppercase border text-emerald-400 bg-emerald-950/50 border-emerald-700/40">
                                S
                            </span>
                            <input
                                type="range"
                                min="0.01"
                                max="100"
                                step="0.05"
                                value={Math.min(100, object.scale.x)}
                                onChange={(e) => {
                                    const s = Math.max(0.01, parseFloat(e.target.value) || 0.01);
                                    const mult = s / Math.max(0.01, object.scale.x);
                                    const nextScale = computeNextThreeDObjectScale(
                                        object.scale,
                                        'xyz',
                                        mult,
                                        isProceduralPlaneUrl(object.glbUrl)
                                    );
                                    onUpdateObject(object.id, { scale: nextScale });
                                }}
                                onDoubleClick={() =>
                                    onUpdateObject(object.id, { scale: { x: 1, y: 1, z: 1 } }, true)
                                }
                                title="Double-click to reset to 1"
                                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <input
                                type="number"
                                step="0.1"
                                min="0.01"
                                value={Number(object.scale.x.toFixed(2))}
                                onChange={(e) => {
                                    const s = Math.max(0.01, parseFloat(e.target.value) || 0.01);
                                    const mult = s / Math.max(0.01, object.scale.x);
                                    const nextScale = computeNextThreeDObjectScale(
                                        object.scale,
                                        'xyz',
                                        mult,
                                        isProceduralPlaneUrl(object.glbUrl)
                                    );
                                    onUpdateObject(object.id, { scale: nextScale });
                                }}
                                className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 px-2 py-1 text-right focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Opacity / Transparency */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                                Opacity
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                                {Math.round(object.opacity ?? 100)}%
                            </span>
                        </div>
                        <div className="flex items-center space-x-2.5">
                            <span className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-black uppercase border text-amber-400 bg-amber-950/50 border-amber-700/40">
                                α
                            </span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={object.opacity ?? 100}
                                onMouseDown={() => onUpdateObject(object.id, {}, true)}
                                onChange={(e) =>
                                    onUpdateObject(object.id, {
                                        opacity: parseFloat(e.target.value),
                                    })
                                }
                                onDoubleClick={() =>
                                    onUpdateObject(object.id, { opacity: 100 }, true)
                                }
                                title="Double-click to reset to 100%"
                                className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <input
                                type="number"
                                step="1"
                                min="0"
                                max="100"
                                value={Math.round(object.opacity ?? 100)}
                                onChange={(e) => {
                                    const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                    onUpdateObject(object.id, { opacity: val });
                                }}
                                className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 px-2 py-1 text-right focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
