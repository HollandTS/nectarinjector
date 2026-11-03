import React, { useState } from 'react';
import type { ThreeDObject, ThreeDCliffShapingSettings, ProjectOverlay } from '../../../types';
import {
    DEFAULT_CLIFF_SHAPING_SETTINGS,
    CLIFF_STYLE_PRESETS,
} from '../../../utils/threeDCliffPresets';
import { ThreeDCliffWallMaterialSubpanel } from './ThreeDCliffWallMaterialSubpanel';
import { ThreeDCliffTopTransitionSubpanel } from './ThreeDCliffTopTransitionSubpanel';
import { ThreeDCliffMeshDisplacementSection } from './ThreeDCliffMeshDisplacementSection';
import {
    LucideMountain,
    LucideChevronDown,
    LucideChevronRight,
    LucideRotateCcw,
    LucideBlend,
} from 'lucide-react';

interface ThreeDCliffShapingSectionProps {
    object: ThreeDObject;
    overlays: ProjectOverlay[];
    onUpdateObject: (
        id: string,
        updates: Partial<ThreeDObject>,
        shouldPushHistory?: boolean
    ) => void;
    onOpenTransitionMixer?: () => void;
}

export const ThreeDCliffShapingSection: React.FC<ThreeDCliffShapingSectionProps> = ({
    object,
    overlays,
    onUpdateObject,
    onOpenTransitionMixer,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const cliff: ThreeDCliffShapingSettings = {
        ...DEFAULT_CLIFF_SHAPING_SETTINGS,
        ...(object.cliffShapingSettings || {}),
    };

    const updateCliff = <K extends keyof ThreeDCliffShapingSettings>(
        key: K,
        val: ThreeDCliffShapingSettings[K],
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                cliffShapingSettings: {
                    ...cliff,
                    enabled: key === 'enabled' ? (val as boolean) : true,
                    [key]: val,
                },
            },
            pushHistory
        );
    };

    const updateCliffBatch = (
        updates: Partial<ThreeDCliffShapingSettings>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                cliffShapingSettings: {
                    ...cliff,
                    ...updates,
                },
            },
            pushHistory
        );
    };

    const startHistory = () => onUpdateObject(object.id, {}, true);

    const handleResetAllCliff = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateObject(
            object.id,
            {
                cliffShapingSettings: {
                    ...DEFAULT_CLIFF_SHAPING_SETTINGS,
                    enabled: cliff.enabled,
                    wallTextureUrl: cliff.wallTextureUrl,
                    wallOverlayId: cliff.wallOverlayId,
                    wallNormalMapUrl: cliff.wallNormalMapUrl,
                    wallRoughnessMapUrl: cliff.wallRoughnessMapUrl,
                    wallDepthMapUrl: cliff.wallDepthMapUrl,
                },
            },
            true
        );
    };

    return (
        <div className="bg-black/40 rounded-xl border border-amber-500/40 overflow-hidden">
            {/* Collapsible Section Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2 min-w-0">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <LucideMountain className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 truncate">
                        3D Cliffs (Texture Emerge, Dissolve &amp; Shaping)
                    </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onOpenTransitionMixer && (
                        <button
                            type="button"
                            onClick={onOpenTransitionMixer}
                            className="p-1 rounded-md bg-fuchsia-950/60 hover:bg-fuchsia-900/80 text-fuchsia-300 border border-fuchsia-500/40 transition-colors cursor-pointer"
                            title="Open Material Transition Mixer (Main ↔ Cliff Seam)"
                        >
                            <LucideBlend className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {cliff.enabled && (
                        <button
                            type="button"
                            onClick={handleResetAllCliff}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Reset Cliff Settings while keeping loaded wall textures"
                        >
                            <LucideRotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => updateCliff('enabled', !cliff.enabled, true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                            cliff.enabled
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                    >
                        {cliff.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3 text-xs">
                    {/* Quick Non-Deforming Cliff Style Presets */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                Quick Cliff Emerge Presets (Zero Mesh Deform)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {CLIFF_STYLE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => updateCliffBatch(preset.overrides, true)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-amber-950/50 border border-slate-700/80 hover:border-amber-500/50 text-left transition-all cursor-pointer"
                                    title={preset.subtitle}
                                >
                                    <div className="text-[10px] font-black uppercase text-amber-200 truncate">
                                        {preset.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                        {preset.subtitle}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 1. TOP PRIORITY: Cliff Wall Texture, Height Dissolve & Bump (No Mesh Deformation) */}
                    <ThreeDCliffWallMaterialSubpanel
                        object={object}
                        cliff={cliff}
                        overlays={overlays}
                        onUpdateObject={onUpdateObject}
                        updateCliff={updateCliff}
                        updateCliffBatch={updateCliffBatch}
                        onStartHistory={startHistory}
                    />

                    {/* 2. Cliff Angle Detection & Top Ground / Plateau Rim Transition (No Mesh Deformation) */}
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-cyan-500/25 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                                2. Cliff Angle Split &amp; Top Ground Transition
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    updateCliff('invertSlopeMask', !cliff.invertSlopeMask, true)
                                }
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer ${
                                    cliff.invertSlopeMask
                                        ? 'bg-cyan-600 text-white'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                                title="Swap Flat Top vs Steep Wall assignment"
                            >
                                {cliff.invertSlopeMask ? 'Swapped' : 'Normal'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Cliff Angle Threshold</span>
                                    <span className="text-cyan-300 font-mono tabular-nums">
                                        {cliff.slopeThreshold}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="85"
                                    step="1"
                                    value={cliff.slopeThreshold}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updateCliffBatch({
                                            enabled: true,
                                            slopeThreshold: parseInt(e.target.value, 10),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'slopeThreshold',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.slopeThreshold,
                                            true
                                        )
                                    }
                                    title="Faces steeper than this angle are treated as vertical cliff walls (Double-click to reset)"
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Angle Feather</span>
                                    <span className="text-cyan-300 font-mono tabular-nums">
                                        {cliff.slopeFeather}°
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="45"
                                    step="1"
                                    value={cliff.slopeFeather}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updateCliffBatch({
                                            enabled: true,
                                            slopeFeather: parseInt(e.target.value, 10),
                                        })
                                    }
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'slopeFeather',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.slopeFeather,
                                            true
                                        )
                                    }
                                    title="Smooth blend zone between flat ground plane and vertical cliff wall"
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Top Ground / Plateau Rim Transition */}
                        <ThreeDCliffTopTransitionSubpanel
                            cliff={cliff}
                            updateCliff={updateCliff}
                            updateCliffBatch={updateCliffBatch}
                            onStartHistory={startHistory}
                        />
                    </div>

                    {/* 3. BOTTOM: Optional Cliff Mesh Displacement & Rock Sculpting (Collapsed by default) */}
                    <ThreeDCliffMeshDisplacementSection
                        cliff={cliff}
                        updateCliff={updateCliff}
                        updateCliffBatch={updateCliffBatch}
                        onStartHistory={startHistory}
                    />
                </div>
            )}
        </div>
    );
};
