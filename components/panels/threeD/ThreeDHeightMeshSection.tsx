import React, { useState } from 'react';
import type { ThreeDObject, ThreeDDisplacementSettings } from '../../../types';
import { DEFAULT_DISPLACEMENT_SETTINGS } from '../../../utils/threeDDisplacementHelper';
import {
    resolvePlaneTileCounts,
    computeTileLockedSubdivisions,
} from '../../../utils/threeDSeamlessTileHelper';
import { ThreeDMeshSeamWeldControl } from './ThreeDMeshSeamWeldControl';
import { ThreeDMeshSubdivisionSubpanel } from './ThreeDMeshSubdivisionSubpanel';
import {
    LucideChevronDown,
    LucideChevronRight,
    LucideGrid,
    LucideRotateCcw,
    LucideLock,
    LucideSparkles,
} from 'lucide-react';

interface ThreeDHeightMeshSectionProps {
    object: ThreeDObject;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDHeightMeshSection: React.FC<ThreeDHeightMeshSectionProps> = ({
    object,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const disp: ThreeDDisplacementSettings = {
        ...DEFAULT_DISPLACEMENT_SETTINGS,
        ...(object.displacementSettings || {}),
    };

    const { tilesX, tilesZ } = resolvePlaneTileCounts(object, disp);
    const tileLockEnabled = disp.tileLockEnabled ?? true;
    const tileNormalWrap = disp.tileNormalWrap ?? true;
    const tileSeamBlend = disp.tileSeamBlend ?? 35;

    const { segsX, segsZ } = computeTileLockedSubdivisions(
        disp.subdivisions || 96,
        tilesX,
        tilesZ,
        tileLockEnabled
    );

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

    const handleResetMeshControls = () => {
        updateDisp(
            {
                scale: DEFAULT_DISPLACEMENT_SETTINGS.scale,
                bias: DEFAULT_DISPLACEMENT_SETTINGS.bias,
                blur: DEFAULT_DISPLACEMENT_SETTINGS.blur,
                subdivisions: DEFAULT_DISPLACEMENT_SETTINGS.subdivisions,
                edgeFalloff: DEFAULT_DISPLACEMENT_SETTINGS.edgeFalloff,
                invert: DEFAULT_DISPLACEMENT_SETTINGS.invert,
                tileLockEnabled: DEFAULT_DISPLACEMENT_SETTINGS.tileLockEnabled ?? true,
                tileNormalWrap: DEFAULT_DISPLACEMENT_SETTINGS.tileNormalWrap ?? true,
                tileSeamBlend: DEFAULT_DISPLACEMENT_SETTINGS.tileSeamBlend ?? 35,
            },
            true
        );
    };

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            {/* Collapsible Header */}
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
                    <LucideGrid className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Height & Mesh Controls
                    </span>
                </div>
                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleResetMeshControls}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/60 transition-colors cursor-pointer"
                        title="Reset height & mesh controls"
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
                    {/* Mesh Subdivision & Tessellation (Flat & Smooth, Levels 0-4 + Bake) */}
                    <ThreeDMeshSubdivisionSubpanel
                        object={object}
                        onUpdateObject={onUpdateObject}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                            Mesh Elevation & Grid Resolution
                        </span>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={disp.invert}
                                onChange={(e) =>
                                    updateDisp({ invert: e.target.checked, enabled: true }, true)
                                }
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-emerald-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold uppercase text-slate-300">
                                Invert B&W
                            </span>
                        </label>
                    </div>

                    {/* Height Scale (Y Axis) */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300">Height Scale (Y-Axis)</span>
                            <span className="font-mono text-emerald-400 font-bold tabular-nums">
                                {disp.scale.toFixed(2)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-15"
                            max="15"
                            step="0.1"
                            value={disp.scale}
                            onChange={(e) =>
                                updateDisp({ scale: parseFloat(e.target.value), enabled: true })
                            }
                            onDoubleClick={() =>
                                updateDisp({ scale: DEFAULT_DISPLACEMENT_SETTINGS.scale }, true)
                            }
                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.scale}`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Vertical Offset / Bias */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300">Vertical Bias (Offset Y)</span>
                            <span className="font-mono text-emerald-400 font-bold tabular-nums">
                                {disp.bias.toFixed(2)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-8"
                            max="8"
                            step="0.1"
                            value={disp.bias}
                            onChange={(e) => updateDisp({ bias: parseFloat(e.target.value) })}
                            onDoubleClick={() =>
                                updateDisp({ bias: DEFAULT_DISPLACEMENT_SETTINGS.bias }, true)
                            }
                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.bias}`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Smoothing / Blur */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300">Height Smoothing (Blur)</span>
                            <span className="font-mono text-cyan-400 font-bold tabular-nums">
                                {disp.blur.toFixed(1)}px
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="12"
                            step="0.5"
                            value={disp.blur}
                            onChange={(e) =>
                                updateDisp({ blur: parseFloat(e.target.value), enabled: true })
                            }
                            onDoubleClick={() =>
                                updateDisp({ blur: DEFAULT_DISPLACEMENT_SETTINGS.blur }, true)
                            }
                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.blur}`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Mesh Subdivisions */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300">Mesh Subdivisions</span>
                            <span className="font-mono text-indigo-400 font-bold tabular-nums">
                                {segsX}×{segsZ}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="16"
                            max="256"
                            step="16"
                            value={disp.subdivisions}
                            onChange={(e) =>
                                updateDisp({ subdivisions: parseInt(e.target.value, 10) })
                            }
                            onDoubleClick={() =>
                                updateDisp({ subdivisions: DEFAULT_DISPLACEMENT_SETTINGS.subdivisions }, true)
                            }
                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.subdivisions}`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    {/* Flatten Plane Borders */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-300">Flatten Plane Borders</span>
                            <span className="font-mono text-cyan-400 font-bold tabular-nums">
                                {disp.edgeFalloff}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="2"
                            value={disp.edgeFalloff}
                            onChange={(e) =>
                                updateDisp({ edgeFalloff: parseInt(e.target.value, 10) })
                            }
                            onDoubleClick={() =>
                                updateDisp({ edgeFalloff: DEFAULT_DISPLACEMENT_SETTINGS.edgeFalloff }, true)
                            }
                            title={`Double-click to reset to ${DEFAULT_DISPLACEMENT_SETTINGS.edgeFalloff}`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Seamless 1x1 Diamond Tile Lock & Normal Wrap */}
                    <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <LucideLock className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                    Seamless Diamond Tile Lock ({tilesX}×{tilesZ})
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    updateDisp({ tileLockEnabled: !tileLockEnabled }, true)
                                }
                                className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                    tileLockEnabled
                                        ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/50'
                                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                                }`}
                                title="Locks mesh triangles, height seams, and terrain waves to each 1x1 diamond tile so injected tiles repeat without stripes"
                            >
                                <LucideLock className="w-3 h-3 shrink-0" />
                                <span>1×1 Tile Lock: {tileLockEnabled ? 'ON' : 'OFF'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    updateDisp({ tileNormalWrap: !tileNormalWrap }, true)
                                }
                                className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                    tileNormalWrap
                                        ? 'bg-cyan-600/25 text-cyan-300 border border-cyan-500/50'
                                        : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
                                }`}
                                title="Wraps vertex normals and PBR lighting across 1x1 tile edges so shading never creates seams"
                            >
                                <LucideSparkles className="w-3 h-3 shrink-0" />
                                <span>Normal Wrap: {tileNormalWrap ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>

                        {tileLockEnabled && (
                            <div className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-300">
                                        Tile Border Seam Blend
                                    </span>
                                    <span className="font-mono text-emerald-400 font-bold tabular-nums">
                                        {tileSeamBlend}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={tileSeamBlend}
                                    onChange={(e) =>
                                        updateDisp({
                                            tileSeamBlend: parseInt(e.target.value, 10),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateDisp(
                                            {
                                                tileSeamBlend:
                                                    DEFAULT_DISPLACEMENT_SETTINGS.tileSeamBlend ?? 35,
                                            },
                                            true
                                        )
                                    }
                                    title={`Double-click to reset to ${
                                        DEFAULT_DISPLACEMENT_SETTINGS.tileSeamBlend ?? 35
                                    }%`}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                        )}

                        <ThreeDMeshSeamWeldControl
                            weldVertices={disp.weldVertices ?? true}
                            weldTolerance={disp.weldTolerance ?? 35}
                            onChangeWeldVertices={(val) => updateDisp({ weldVertices: val }, true)}
                            onChangeWeldTolerance={(val) => updateDisp({ weldTolerance: val })}
                            accentColor="emerald"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
