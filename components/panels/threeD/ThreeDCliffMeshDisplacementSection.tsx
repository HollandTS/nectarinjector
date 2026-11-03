import React, { useState } from 'react';
import type { ThreeDCliffShapingSettings } from '../../../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../../utils/threeDCliffPresets';
import { ThreeDCliffRockSculptSubpanel } from './ThreeDCliffRockSculptSubpanel';
import {
    LucideChevronDown,
    LucideChevronRight,
    LucideMountainSnow,
    LucideRotateCcw,
} from 'lucide-react';

interface ThreeDCliffMeshDisplacementSectionProps {
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

export const ThreeDCliffMeshDisplacementSection: React.FC<
    ThreeDCliffMeshDisplacementSectionProps
> = ({ cliff, updateCliff, updateCliffBatch, onStartHistory }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const hasAnyMeshDeformation =
        Math.abs(cliff.wallNormalPush ?? 0) > 1e-4 ||
        Math.abs(cliff.wallDepthScale ?? 0) > 1e-4 ||
        Math.abs(cliff.flatTopDepthScale ?? 0) > 1e-4 ||
        (Boolean(cliff.strataEnabled) && Math.abs(cliff.strataAmplitude ?? 0) > 1e-4) ||
        (Boolean(cliff.cragEnabled) && Math.abs(cliff.cragAmplitude ?? 0) > 1e-4) ||
        Math.abs(cliff.overhangAmount ?? 0) > 1e-4 ||
        Math.abs(cliff.talusSkirtAmount ?? 0) > 1e-4 ||
        (cliff.topGroundBevel ?? 0) > 0.5;

    const handleZeroAllMeshDeformation = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateCliffBatch(
            {
                subdivideLevel: 0,
                wallNormalPush: 0,
                wallDepthScale: 0,
                flatTopDepthScale: 0,
                topGroundBevel: 0,
                strataEnabled: false,
                strataAmplitude: 0,
                cragEnabled: false,
                cragAmplitude: 0,
                overhangAmount: 0,
                talusSkirtAmount: 0,
            },
            true
        );
    };

    return (
        <div className="bg-slate-950/75 rounded-lg border border-amber-500/30 overflow-hidden">
            {/* Collapsible Header for Optional Cliff Mesh Displacement & Shaping */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-2.5 py-2 bg-slate-900/80 hover:bg-slate-800/80 cursor-pointer select-none transition-colors"
            >
                <div className="flex items-center space-x-1.5 min-w-0">
                    {isExpanded ? (
                        <LucideChevronDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                        <LucideChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <LucideMountainSnow className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 truncate">
                        3. Optional Cliff Mesh Displacement &amp; Rock Sculpting
                    </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {hasAnyMeshDeformation ? (
                        <button
                            type="button"
                            onClick={handleZeroAllMeshDeformation}
                            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[9px] font-black uppercase cursor-pointer"
                            title="Reset all cliff vertex deformations back to flat original mesh"
                        >
                            <LucideRotateCcw className="w-2.5 h-2.5" />
                            <span>Flatten Mesh</span>
                        </button>
                    ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-bold uppercase">
                            No Deform
                        </span>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-2.5 space-y-2.5 border-t border-slate-800/80">
                    <p className="text-[10px] text-slate-400 leading-tight">
                        All controls below physically move cliff vertices. Leave at 0 / OFF to keep your original 3D cliff geometry untouched.
                    </p>

                    {/* 1. Angle-Aware Height / PBR Depth Displacement & Mesh Subdivision */}
                    <div className="bg-slate-900/70 p-2.5 rounded-lg border border-emerald-500/25 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                                Cliff Wall &amp; Top Mesh Depth Extrusion
                            </span>
                            <div className="flex items-center space-x-1">
                                {[0, 1, 2, 3].map((lvl) => (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() =>
                                            updateCliffBatch(
                                                { enabled: true, subdivideLevel: lvl },
                                                true
                                            )
                                        }
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase cursor-pointer ${
                                            cliff.subdivideLevel === lvl
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                                        }`}
                                        title={`Subdivide GLB cliff triangles (${Math.pow(4, lvl)}x density)`}
                                    >
                                        {lvl === 0 ? 'Base' : `${lvl}x Sub`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Wall Depth Push</span>
                                    <span className="text-emerald-300 font-mono tabular-nums">
                                        {cliff.wallDepthScale.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-8"
                                    max="8"
                                    step="0.1"
                                    value={cliff.wallDepthScale}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliffBatch({
                                            enabled: true,
                                            wallDepthScale: parseFloat(e.target.value),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'wallDepthScale',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallDepthScale,
                                            true
                                        )
                                    }
                                    title="Extrudes vertical cliff faces outward along their 3D surface normal using the Wall Depth/Height map"
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Flat Top Depth (Y)</span>
                                    <span className="text-emerald-300 font-mono tabular-nums">
                                        {cliff.flatTopDepthScale.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-6"
                                    max="6"
                                    step="0.1"
                                    value={cliff.flatTopDepthScale}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliffBatch({
                                            enabled: true,
                                            flatTopDepthScale: parseFloat(e.target.value),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'flatTopDepthScale',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.flatTopDepthScale,
                                            true
                                        )
                                    }
                                    title="Separately controls height displacement on flat horizontal plateau surfaces"
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Contrast</span>
                                    <span className="text-emerald-300 font-mono">
                                        {cliff.wallDepthContrast}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="300"
                                    step="5"
                                    value={cliff.wallDepthContrast}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('wallDepthContrast', parseInt(e.target.value, 10))
                                    }
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Smooth</span>
                                    <span className="text-emerald-300 font-mono">
                                        {cliff.wallDepthBlur}px
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={cliff.wallDepthBlur}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliff('wallDepthBlur', parseFloat(e.target.value))
                                    }
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Top Lip Bevel</span>
                                    <span className="text-sky-300 font-mono">
                                        {cliff.topGroundBevel ?? 0}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={cliff.topGroundBevel ?? 0}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) =>
                                        updateCliffBatch({
                                            enabled: true,
                                            topGroundBevel: parseInt(e.target.value, 10),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'topGroundBevel',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.topGroundBevel,
                                            true
                                        )
                                    }
                                    className="w-full accent-sky-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Cliff Wall Normal-Push, Rock Strata & Vertical Crag Sculpting */}
                    <ThreeDCliffRockSculptSubpanel
                        cliff={cliff}
                        updateCliff={updateCliff}
                        updateCliffBatch={updateCliffBatch}
                        onStartHistory={onStartHistory}
                    />
                </div>
            )}
        </div>
    );
};
