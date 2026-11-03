import React from 'react';
import type { ThreeDObject, ThreeDSubdivisionSettings } from '../../../types';
import {
    DEFAULT_SUBDIVISION_SETTINGS,
    getLiveModelMeshStats,
} from '../../../utils/threeDSubdivisionHelper';
import { isProceduralPlaneUrl } from '../../../utils/layerTo3DPlaneUtils';
import {
    LucideGrid,
    LucideSparkles,
    LucideCheckCircle2,
    LucideRotateCcw,
} from 'lucide-react';

interface ThreeDMeshSubdivisionSubpanelProps {
    object: ThreeDObject;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

const SUBDIVISION_LEVELS: { level: number; label: string; mult: string }[] = [
    { level: 0, label: '0', mult: 'Base' },
    { level: 1, label: '1', mult: '4×' },
    { level: 2, label: '2', mult: '16×' },
    { level: 3, label: '3', mult: '64×' },
    { level: 4, label: '4', mult: '256×' },
];

export const ThreeDMeshSubdivisionSubpanel: React.FC<ThreeDMeshSubdivisionSubpanelProps> = ({
    object,
    onUpdateObject,
}) => {
    const isProcPlane = isProceduralPlaneUrl(object.glbUrl);
    const subdiv: ThreeDSubdivisionSettings = {
        ...DEFAULT_SUBDIVISION_SETTINGS,
        ...(object.subdivisionSettings || {}),
    };

    const stats = getLiveModelMeshStats(object.id);

    const updateSubdiv = (
        updates: Partial<ThreeDSubdivisionSettings>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                subdivisionSettings: {
                    ...subdiv,
                    ...updates,
                },
            },
            pushHistory
        );
    };

    const handleBakeSubdivision = () => {
        if (subdiv.level <= 0) return;
        const nextBakeVersion = (subdiv.bakeVersion ?? 0) + 1;
        onUpdateObject(
            object.id,
            {
                subdivisionSettings: {
                    ...subdiv,
                    level: 0,
                    bakeVersion: nextBakeVersion,
                    bakedBaseTriangles: stats?.activeTriangles,
                    bakedBaseVertices: stats?.activeVertices,
                },
            },
            true
        );
    };

    const handleResetSubdivision = () => {
        updateSubdiv(
            {
                level: DEFAULT_SUBDIVISION_SETTINGS.level,
                mode: DEFAULT_SUBDIVISION_SETTINGS.mode,
                smoothStrength: DEFAULT_SUBDIVISION_SETTINGS.smoothStrength,
                creaseAngle: DEFAULT_SUBDIVISION_SETTINGS.creaseAngle,
            },
            true
        );
    };

    return (
        <div className="bg-[#0d1117]/90 rounded-xl border border-indigo-500/30 p-3 space-y-2.5">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                    <LucideGrid className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-[11px] font-bold text-indigo-300 truncate">
                        Mesh Subdivision & Tessellation
                    </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleResetSubdivision}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Reset subdivision level and smoothing"
                    >
                        <LucideRotateCcw className="w-3 h-3" />
                    </button>
                    {!isProcPlane && subdiv.level > 0 && (
                        <button
                            type="button"
                            onClick={handleBakeSubdivision}
                            className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            title="Permanently commit current subdivided mesh as Level 0 base geometry"
                        >
                            <LucideCheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Bake Subdivision</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Mode Switcher: Flat Tessellate vs Smooth Subdivide */}
            {!isProcPlane && (
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800">
                    <button
                        type="button"
                        onClick={() => updateSubdiv({ mode: 'flat' }, true)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center space-x-1.5 ${
                            subdiv.mode === 'flat'
                                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Splits each triangle into 4^L sub-triangles while keeping crisp flat surfaces for sharp PBR displacement"
                    >
                        <LucideGrid className="w-3 h-3 shrink-0" />
                        <span>Flat Tessellate</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSubdiv({ mode: 'smooth' }, true)}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center space-x-1.5 ${
                            subdiv.mode === 'smooth'
                                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Subdivides and smoothly rounds organic surfaces while protecting sharp creases and UV seams"
                    >
                        <LucideSparkles className="w-3 h-3 shrink-0" />
                        <span>Smooth Subdivide</span>
                    </button>
                </div>
            )}

            {/* Non-Destructive Subdivision Level Selector (0 to 4) */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Subdivision Level</span>
                    <span className="font-mono text-indigo-400 tabular-nums">
                        Level {subdiv.level} · {Math.pow(4, subdiv.level)}× Tris
                    </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {SUBDIVISION_LEVELS.map((item) => {
                        const isActive = subdiv.level === item.level;
                        return (
                            <button
                                key={item.level}
                                type="button"
                                onClick={() => updateSubdiv({ level: item.level }, true)}
                                className={`py-1.5 px-1 rounded-lg border text-center transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                    isActive
                                        ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                                }`}
                                title={`Subdivision Level ${item.level} (${item.mult} triangle density)`}
                            >
                                <div className="text-[11px] font-mono tabular-nums leading-tight">
                                    L{item.level}
                                </div>
                                <div className="text-[9px] opacity-80 font-mono tabular-nums leading-tight">
                                    {item.mult}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Smooth Subdivision Controls (Strength & Crease Protection) */}
            {!isProcPlane && subdiv.mode === 'smooth' && subdiv.level > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-300">Smooth Rounding Strength</span>
                            <span className="font-mono text-indigo-400 tabular-nums">
                                {subdiv.smoothStrength}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={subdiv.smoothStrength}
                            onChange={(e) =>
                                updateSubdiv({ smoothStrength: parseInt(e.target.value, 10) })
                            }
                            onDoubleClick={() =>
                                updateSubdiv(
                                    { smoothStrength: DEFAULT_SUBDIVISION_SETTINGS.smoothStrength },
                                    true
                                )
                            }
                            title={`Double-click to reset to ${DEFAULT_SUBDIVISION_SETTINGS.smoothStrength}%`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="font-semibold text-slate-300">Keep Sharp Creases Above</span>
                            <span className="font-mono text-cyan-400 tabular-nums">
                                {subdiv.creaseAngle}°
                            </span>
                        </div>
                        <input
                            type="range"
                            min="15"
                            max="180"
                            step="5"
                            value={subdiv.creaseAngle}
                            onChange={(e) =>
                                updateSubdiv({ creaseAngle: parseInt(e.target.value, 10) })
                            }
                            onDoubleClick={() =>
                                updateSubdiv(
                                    { creaseAngle: DEFAULT_SUBDIVISION_SETTINGS.creaseAngle },
                                    true
                                )
                            }
                            title={`Double-click to reset to ${DEFAULT_SUBDIVISION_SETTINGS.creaseAngle}°`}
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>
            )}

            {/* Live Unboxed Telemetry Readout */}
            {stats && (
                <div className="pt-1.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 font-mono tabular-nums">
                    <div>
                        <span>Base {stats.baseTriangles.toLocaleString()} tris</span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-indigo-300 font-semibold">
                            Active {stats.activeTriangles.toLocaleString()} tris
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{stats.activeVertices.toLocaleString()} verts</span>
                    </div>
                    {stats.clampedByBudget && (
                        <span className="text-amber-400">
                            Max triangle budget reached
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
