import React, { useState } from 'react';
import type { ThreeDObject, ThreeDSlopeShapingSettings, ProjectOverlay } from '../../../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../../utils/threeDSlopePresets';
import { isProceduralPlaneUrl } from '../../../utils/layerTo3DPlaneUtils';
import { ThreeDSlopeMainDisplacementSubpanel } from './ThreeDSlopeMainDisplacementSubpanel';
import { ThreeDMeshSeamWeldControl } from './ThreeDMeshSeamWeldControl';
import {
    LucideChevronDown,
    LucideChevronRight,
    LucideMountainSnow,
    LucideRotateCcw,
} from 'lucide-react';

interface ThreeDSlopeMeshDisplacementSectionProps {
    object: ThreeDObject;
    overlays: ProjectOverlay[];
    slope: ThreeDSlopeShapingSettings;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    updateSlope: <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateSlopeBatch: (updates: Partial<ThreeDSlopeShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDSlopeMeshDisplacementSection: React.FC<
    ThreeDSlopeMeshDisplacementSectionProps
> = ({
    object,
    overlays,
    slope,
    onUpdateObject,
    updateSlope,
    updateSlopeBatch,
    onStartHistory,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const isProcPlane = isProceduralPlaneUrl(object.glbUrl);

    const hasAnyMeshDeformation =
        Math.abs(slope.slopeNormalPush ?? 0) > 1e-4 ||
        Math.abs(slope.slopeCurvature ?? 0) > 1e-4 ||
        Math.abs(slope.slopeDepthScale ?? 0) > 1e-4 ||
        (slope.crestBevel ?? 0) > 0.5 ||
        Boolean(slope.mainSlopeDisplacementEnabled && (Math.abs(slope.mainSlopeDepthScale ?? 0) > 1e-4 || Math.abs(slope.mainSlopeDepthBias ?? 0) > 1e-4)) ||
        Boolean(slope.dipsEnabled && Math.abs(slope.dipAmplitude ?? 0) > 1e-4);

    const handleZeroAllMeshDeformation = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateSlopeBatch(
            {
                subdivideLevel: 0,
                slopeNormalPush: 0,
                slopeCurvature: 0,
                slopeDepthScale: 0,
                crestBevel: 0,
                mainSlopeDisplacementEnabled: false,
                mainSlopeDepthScale: 0,
                mainSlopeDepthBias: 0,
                dipsEnabled: false,
                dipAmplitude: 0,
            },
            true
        );
    };

    return (
        <div className="bg-slate-950/75 rounded-lg border border-amber-500/30 overflow-hidden">
            {/* Collapsible Header for Optional Mesh Displacement & Shaping */}
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
                        4. Optional Slope Mesh Displacement &amp; Shaping
                    </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {hasAnyMeshDeformation ? (
                        <button
                            type="button"
                            onClick={handleZeroAllMeshDeformation}
                            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[9px] font-black uppercase cursor-pointer"
                            title="Reset all slope vertex deformations back to flat original mesh"
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
                        All controls below physically move slope vertices. Leave at 0 / OFF to keep your original 3D slope geometry untouched.
                    </p>

                    {/* 1. Ramp Profile Curvature, Vertex Depth Push & Corner Bevel */}
                    <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block">
                            Ramp Profile Curvature &amp; Vertex Depth Push
                        </span>

                        {!isProcPlane && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300">
                                    <span>GLB Slope Subdivision</span>
                                    <span className="text-teal-300 font-mono">Level {slope.subdivideLevel}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {[
                                        { lvl: 0, label: '0 (Raw)' },
                                        { lvl: 1, label: '1 (4x)' },
                                        { lvl: 2, label: '2 (16x)' },
                                        { lvl: 3, label: '3 (64x)' },
                                    ].map((item) => (
                                        <button
                                            key={item.lvl}
                                            type="button"
                                            onClick={() => updateSlope('subdivideLevel', item.lvl, true)}
                                            className={`py-1 rounded text-[10px] font-bold uppercase border cursor-pointer ${
                                                slope.subdivideLevel === item.lvl
                                                    ? 'bg-teal-600 border-teal-400 text-white'
                                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span title="Negative = Scooped Concave Ramp; Positive = Rounded Convex Hill">
                                        Scoop / Bulge Profile
                                    </span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeCurvature.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-5"
                                    max="5"
                                    step="0.05"
                                    value={slope.slopeCurvature}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeCurvature', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'slopeCurvature',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeCurvature,
                                            true
                                        )
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span title="Physically pushes slope vertices using the Slope Height/Depth Map">
                                        Slope Mesh Depth Push
                                    </span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeDepthScale.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="-6"
                                    max="6"
                                    step="0.05"
                                    value={slope.slopeDepthScale}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeDepthScale', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'slopeDepthScale',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeDepthScale,
                                            true
                                        )
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Crest &amp; Toe Corner Bevel</span>
                                    <span className="text-emerald-300 font-mono">{slope.crestBevel}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={slope.crestBevel}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('crestBevel', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'crestBevel',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.crestBevel,
                                            true
                                        )
                                    }
                                    className="w-full accent-emerald-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span title="Locks outer tile borders so adjacent slope tiles connect cleanly">
                                        Pin Tile Borders
                                    </span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.pinEdges}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={slope.pinEdges}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('pinEdges', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope('pinEdges', DEFAULT_SLOPE_SHAPING_SETTINGS.pinEdges, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Main Texture Displacement (Slopes Only) */}
                    <ThreeDSlopeMainDisplacementSubpanel
                        object={object}
                        overlays={overlays}
                        slope={slope}
                        onUpdateObject={onUpdateObject}
                        updateSlope={updateSlope}
                        updateSlopeBatch={updateSlopeBatch}
                        onStartHistory={onStartHistory}
                    />

                    {/* 3. Slope Dips, Gullies & Erosion Ruts (Mesh Depressions) */}
                    <div className="bg-slate-900/70 p-2.5 rounded-lg border border-teal-500/25 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-300">
                                Slope Dips, Hollows &amp; Erosion Ruts (Vertex Carve)
                            </span>
                            <button
                                type="button"
                                onClick={() => updateSlope('dipsEnabled', !slope.dipsEnabled, true)}
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                    slope.dipsEnabled
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                            >
                                {slope.dipsEnabled ? 'Dips ON' : 'OFF'}
                            </button>
                        </div>

                        {slope.dipsEnabled && (
                            <div className="space-y-2 pt-1">
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                        <span>Dip / Hollow Depth</span>
                                        <span className="text-teal-300 font-mono tabular-nums">
                                            {slope.dipAmplitude.toFixed(2)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="6"
                                        step="0.05"
                                        value={slope.dipAmplitude}
                                        onMouseDown={onStartHistory}
                                        onChange={(e) => updateSlope('dipAmplitude', parseFloat(e.target.value))}
                                        onDoubleClick={() =>
                                            updateSlope(
                                                'dipAmplitude',
                                                DEFAULT_SLOPE_SHAPING_SETTINGS.dipAmplitude,
                                                true
                                            )
                                        }
                                        className="w-full accent-teal-500 cursor-pointer"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                            <span>Spacing</span>
                                            <span className="text-teal-300 font-mono">
                                                {slope.dipFrequency.toFixed(1)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="12"
                                            step="0.1"
                                            value={slope.dipFrequency}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) => updateSlope('dipFrequency', parseFloat(e.target.value))}
                                            className="w-full accent-teal-500 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                            <span>Sharpness</span>
                                            <span className="text-teal-300 font-mono">{slope.dipSharpness}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={slope.dipSharpness}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) => updateSlope('dipSharpness', parseInt(e.target.value, 10))}
                                            className="w-full accent-teal-500 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                            <span>Gully Runoff</span>
                                            <span className="text-teal-300 font-mono">{slope.gullyRunoff}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={slope.gullyRunoff}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) => updateSlope('gullyRunoff', parseInt(e.target.value, 10))}
                                            className="w-full accent-teal-500 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <ThreeDMeshSeamWeldControl
                            weldVertices={slope.weldVertices ?? true}
                            weldTolerance={slope.weldTolerance ?? 35}
                            onChangeWeldVertices={(val) => updateSlope('weldVertices', val, true)}
                            onChangeWeldTolerance={(val) => updateSlope('weldTolerance', val)}
                            onStartHistory={onStartHistory}
                            accentColor="teal"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
