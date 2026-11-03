import React, { useState } from 'react';
import type {
    ThreeDObject,
    ThreeDSurfaceScatterSettings,
    ThreeDSurfaceScatterItem,
} from '../../../types';
import {
    DEFAULT_SURFACE_SCATTER_SETTINGS,
    SURFACE_SCATTER_PRESETS,
} from '../../../utils/threeDSurfaceScatterPresets';
import { STOCK_3D_OBJECTS } from '../../../utils/stockAssetsHelper';
import { ThreeDSurfaceScatterModelsSubpanel } from './ThreeDSurfaceScatterModelsSubpanel';
import { ThreeDSurfaceScatterPlacementSubpanel } from './ThreeDSurfaceScatterPlacementSubpanel';
import { ThreeDSurfaceScatterTransformColorSubpanel } from './ThreeDSurfaceScatterTransformColorSubpanel';
import {
    LucideSprout,
    LucideChevronDown,
    LucideChevronRight,
    LucideRotateCcw,
} from 'lucide-react';

interface ThreeDSurfaceScatterSectionProps {
    object: ThreeDObject;
    onUpdateObject: (
        id: string,
        updates: Partial<ThreeDObject>,
        shouldPushHistory?: boolean
    ) => void;
}

export const ThreeDSurfaceScatterSection: React.FC<
    ThreeDSurfaceScatterSectionProps
> = ({ object, onUpdateObject }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const scatter: ThreeDSurfaceScatterSettings = {
        ...DEFAULT_SURFACE_SCATTER_SETTINGS,
        ...(object.surfaceScatterSettings || {}),
        items: object.surfaceScatterSettings?.items || [],
    };

    const ensureDefaultStockItemIfEmpty = (
        currentItems: ThreeDSurfaceScatterItem[],
        presetId?: string
    ): ThreeDSurfaceScatterItem[] => {
        if (currentItems.length > 0) return currentItems;
        const isRockPreset = presetId === 'scattered_rocks_pebbles';
        const preferred = STOCK_3D_OBJECTS.find((st) =>
            isRockPreset
                ? st.fileName.toLowerCase().includes('rock')
                : st.fileName.toLowerCase().includes('grass')
        ) || STOCK_3D_OBJECTS.find((st) => !st.fileName.toLowerCase().includes('slope'));

        if (!preferred) return currentItems;
        return [
            {
                id: `scatter-item-${Date.now()}`,
                name: preferred.name,
                glbUrl: preferred.url,
                enabled: true,
                weight: 100,
                scaleMultiplier: 1.0,
                yOffset: 0,
            },
        ];
    };

    const updateScatter = <K extends keyof ThreeDSurfaceScatterSettings>(
        key: K,
        val: ThreeDSurfaceScatterSettings[K],
        pushHistory: boolean = false
    ) => {
        const nextEnabled = key === 'enabled' ? (val as boolean) : true;
        const nextItems =
            nextEnabled && scatter.items.length === 0
                ? ensureDefaultStockItemIfEmpty(scatter.items)
                : scatter.items;

        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...scatter,
                    items: nextItems,
                    enabled: nextEnabled,
                    [key]: val,
                },
            },
            pushHistory
        );
    };

    const updateScatterBatch = (
        updates: Partial<ThreeDSurfaceScatterSettings>,
        pushHistory: boolean = false,
        presetId?: string
    ) => {
        const nextItems =
            updates.items !== undefined
                ? updates.items
                : ensureDefaultStockItemIfEmpty(scatter.items, presetId);
        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...scatter,
                    ...updates,
                    items: nextItems,
                },
            },
            pushHistory
        );
    };

    const handleAddScatterItem = (glbUrl: string, name: string) => {
        const cleanName = name.replace(/\.[^/.]+$/, '');
        const newItem: ThreeDSurfaceScatterItem = {
            id: `scatter-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: cleanName,
            glbUrl,
            enabled: true,
            weight: 100,
            scaleMultiplier: 1.0,
            yOffset: 0,
        };
        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...scatter,
                    enabled: true,
                    items: [...scatter.items, newItem],
                },
            },
            true
        );
    };

    const handleUpdateScatterItem = (
        itemId: string,
        updates: Partial<ThreeDSurfaceScatterItem>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...scatter,
                    enabled: true,
                    items: scatter.items.map((it) =>
                        it.id === itemId ? { ...it, ...updates } : it
                    ),
                },
            },
            pushHistory
        );
    };

    const handleRemoveScatterItem = (itemId: string) => {
        const remaining = scatter.items.filter((it) => it.id !== itemId);
        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...scatter,
                    items: remaining,
                    enabled: remaining.length > 0 ? scatter.enabled : false,
                },
            },
            true
        );
    };

    const handleResetAllScatter = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateObject(
            object.id,
            {
                surfaceScatterSettings: {
                    ...DEFAULT_SURFACE_SCATTER_SETTINGS,
                    enabled: scatter.enabled,
                    items: scatter.items.map((it) => ({
                        ...it,
                        weight: 100,
                        scaleMultiplier: 1.0,
                        yOffset: 0,
                    })),
                },
            },
            true
        );
    };

    const startHistory = () => onUpdateObject(object.id, {}, true);

    return (
        <div className="bg-black/40 rounded-xl border border-emerald-500/40 overflow-hidden">
            {/* Collapsible Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2 min-w-0">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <LucideSprout className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 truncate">
                        3D Surface Scatter (Grass, Rocks &amp; Array)
                    </span>
                </div>
                <div
                    className="flex items-center space-x-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {scatter.enabled && (
                        <button
                            type="button"
                            onClick={handleResetAllScatter}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Reset Surface Scatter sliders while keeping loaded 3D models"
                        >
                            <LucideRotateCcw className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => updateScatter('enabled', !scatter.enabled, true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                            scatter.enabled
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                    >
                        {scatter.enabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3 text-xs">
                    {/* Quick Surface Scatter Style Presets */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                            Quick Surface Scatter Presets (Locked To Parent Plane)
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                            {SURFACE_SCATTER_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() =>
                                        updateScatterBatch(preset.overrides, true, preset.id)
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-950/50 border border-slate-700/80 hover:border-emerald-500/50 text-left transition-all cursor-pointer"
                                    title={preset.subtitle}
                                >
                                    <div className="text-[10px] font-black uppercase text-emerald-200 truncate">
                                        {preset.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                        {preset.subtitle}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 1. Scattered 3D Models Manager */}
                    <ThreeDSurfaceScatterModelsSubpanel
                        scatter={scatter}
                        onAddScatterItem={handleAddScatterItem}
                        onUpdateScatterItem={handleUpdateScatterItem}
                        onRemoveScatterItem={handleRemoveScatterItem}
                        onStartHistory={startHistory}
                    />

                    {/* 2. Placement Amount, Density, Clumping & Top-Surface Filtering */}
                    <ThreeDSurfaceScatterPlacementSubpanel
                        scatter={scatter}
                        updateScatter={updateScatter}
                        updateScatterBatch={updateScatterBatch}
                        onStartHistory={startHistory}
                    />

                    {/* 3. Random Rotation, Scale, Normal Alignment & Color Jitter */}
                    <ThreeDSurfaceScatterTransformColorSubpanel
                        scatter={scatter}
                        updateScatter={updateScatter}
                        updateScatterBatch={updateScatterBatch}
                        onStartHistory={startHistory}
                    />
                </div>
            )}
        </div>
    );
};
