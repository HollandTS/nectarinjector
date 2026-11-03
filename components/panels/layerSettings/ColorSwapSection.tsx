import React, { useState } from 'react';
import type { ProjectOverlay, CanvasImage, SmartColorSwapItem, TileColorSwapItem } from '../../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { LucidePlus, LucideSparkles, LucidePalette } from 'lucide-react';
import { SimpleSwapItem } from './colorSwap/SimpleSwapItem';
import { SmartSwapItem } from './colorSwap/SmartSwapItem';
import { TileSwapItem } from './colorSwap/TileSwapItem';
import { createDefaultSmartSwap } from '../../../utils/smartColorSwapHelper';
import { createDefaultTileSwap, extractPaletteFromTiles } from '../../../utils/tileColorMatchHelper';

interface ColorSwapSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
    showSmartColorSwap?: string | null;
    setShowSmartColorSwap?: (id: string | null) => void;
    activeInjectionEyedropperId: string | null;
    setActiveInjectionEyedropperId: (id: string | null) => void;
    activeInjectionTarget: string;
    setActiveInjectionTarget: (target: any) => void;
    handleApplyColorSwaps: (ov: ProjectOverlay, mode: 'normal' | 'smart' | 'tile' | 'all') => void;
    handleUndoColorFilters: (id: string) => void;
    bakingOverlayId: string | null;
    filterUndoHistory: Record<string, any>;
    addColorSwap: (id: string) => void;
    updateColorSwap: (id: string, swapId: string, updates: any) => void;
    removeColorSwap: (id: string, swapId: string) => void;
    selectedImageIds?: Set<string>;
    images?: CanvasImage[];
}

export const ColorSwapSection: React.FC<ColorSwapSectionProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    activeInjectionEyedropperId,
    setActiveInjectionEyedropperId,
    activeInjectionTarget,
    setActiveInjectionTarget,
    handleApplyColorSwaps,
    handleUndoColorFilters,
    bakingOverlayId,
    filterUndoHistory,
    addColorSwap,
    updateColorSwap,
    removeColorSwap,
    selectedImageIds = new Set(),
    images = []
}) => {
    const f = ov.filters;
    const [samplingTileSwapId, setSamplingTileSwapId] = useState<string | null>(null);

    // Selected tiles count
    const selectedTiles = images.filter(img => selectedImageIds.has(img.id));
    const selectedCount = selectedTiles.length;

    // Smart swaps list
    const smartSwaps: SmartColorSwapItem[] = f.smartColorSwaps || (f.smartColorSwapSettings && f.smartColorSwapEnabled ? [{
        id: 'smart-swap-legacy',
        enabled: true,
        ...f.smartColorSwapSettings
    }] : []);

    const tileSwaps: TileColorSwapItem[] = f.tileColorSwaps || [];
    const simpleSwaps = f.colorSwaps || [];
    const hasAnySwaps = simpleSwaps.length > 0 || smartSwaps.length > 0 || tileSwaps.length > 0 || !!(f.targetColor && f.replaceColor);

    // Add Smart Swap
    const handleAddSmartSwap = () => {
        const newSwap = createDefaultSmartSwap();
        const nextList = [...smartSwaps, newSwap];
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                smartColorSwaps: nextList,
                smartColorSwapEnabled: true
            }
        });
    };

    const handleUpdateSmartSwap = (swapId: string, updates: Partial<SmartColorSwapItem>) => {
        const nextList = smartSwaps.map(s => s.id === swapId ? { ...s, ...updates } : s);
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                smartColorSwaps: nextList,
                smartColorSwapEnabled: true
            }
        });
    };

    const handleRemoveSmartSwap = (swapId: string) => {
        const nextList = smartSwaps.filter(s => s.id !== swapId);
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                smartColorSwaps: nextList,
                smartColorSwapEnabled: nextList.length > 0
            }
        });
    };

    // Add Tile Swap (Tile Match)
    const handleAddTileMatch = async () => {
        let extractedColors: any[] = [];
        if (selectedTiles.length > 0) {
            extractedColors = await extractPaletteFromTiles(selectedTiles);
        }
        const newSwap = createDefaultTileSwap(
            selectedTiles.map(t => t.id),
            extractedColors
        );
        const nextList = [...tileSwaps, newSwap];
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                tileColorSwaps: nextList
            }
        });
    };

    const handleUpdateTileSwap = (swapId: string, updates: Partial<TileColorSwapItem>) => {
        const nextList = tileSwaps.map(s => s.id === swapId ? { ...s, ...updates } : s);
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                tileColorSwaps: nextList
            }
        });
    };

    const handleRemoveTileSwap = (swapId: string) => {
        const nextList = tileSwaps.filter(s => s.id !== swapId);
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                tileColorSwaps: nextList
            }
        });
    };

    const handleResampleTileSwap = async (swapId: string) => {
        if (selectedTiles.length === 0) return;
        setSamplingTileSwapId(swapId);
        try {
            const extractedColors = await extractPaletteFromTiles(selectedTiles);
            handleUpdateTileSwap(swapId, {
                selectedTileIds: selectedTiles.map(t => t.id),
                colors: extractedColors,
                name: `Match (${selectedTiles.length} tiles)`
            });
        } finally {
            setSamplingTileSwapId(null);
        }
    };

    return (
        <CollapsibleSection title="Color Swap" titleColorClass="text-cyan-400" defaultExpanded={false}>
            {/* Top Action Bar with 3 Swaps */}
            <div className="flex flex-col space-y-2 pb-2.5 border-b border-slate-800">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Swaps</span>
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        {/* 1. Simple Swap */}
                        <button 
                            type="button"
                            onClick={() => addColorSwap(ov.id)} 
                            className="flex items-center space-x-1 text-[9.5px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg text-slate-200 font-bold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Add a simple 1:1 color swap"
                        >
                            <LucidePlus className="w-3 h-3 text-slate-400" />
                            <span>+ simple swap</span>
                        </button>

                        {/* 2. Smart Swap */}
                        <button 
                            type="button"
                            onClick={handleAddSmartSwap}
                            className="flex items-center space-x-1 text-[9.5px] bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 hover:border-cyan-500 px-2 py-1 rounded-lg font-black transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Add a smart color swap with hue, saturation, brightness, and smoothing adjustments"
                        >
                            <LucideSparkles className="w-3 h-3 text-cyan-400" />
                            <span>+ Smart swap</span>
                        </button>

                        {/* 3. Tile Match */}
                        <button 
                            type="button"
                            onClick={handleAddTileMatch}
                            className="flex items-center space-x-1 text-[9.5px] bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 hover:border-emerald-500 px-2 py-1 rounded-lg font-black transition-all cursor-pointer shadow-xs active:scale-95"
                            title={selectedCount > 0 ? `Match layer colors to ${selectedCount} selected tiles` : "Match layer colors to all tiles currently selected"}
                        >
                            <LucidePalette className="w-3 h-3 text-emerald-400" />
                            <span>+ tile match</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* List of Simple Swaps */}
            {simpleSwaps.length > 0 && (
                <div className="space-y-1.5 pt-1">
                    <span className="text-[8.5px] text-slate-400 uppercase font-bold tracking-wider">Simple Swaps</span>
                    {simpleSwaps.map(swap => (
                        <SimpleSwapItem 
                            key={swap.id}
                            swap={swap}
                            onUpdate={(updates) => updateColorSwap(ov.id, swap.id, updates)}
                            onRemove={() => removeColorSwap(ov.id, swap.id)}
                            onStartChange={() => onUpdateOverlay(ov.id, {}, true)}
                        />
                    ))}
                </div>
            )}

            {/* List of Smart Swaps */}
            {smartSwaps.length > 0 && (
                <div className="space-y-2 pt-1">
                    <span className="text-[8.5px] text-cyan-400 uppercase font-black tracking-wider">Smart Swaps</span>
                    {smartSwaps.map((swap, idx) => (
                        <SmartSwapItem 
                            key={swap.id || `smart-${idx}`}
                            swap={swap}
                            index={idx}
                            onUpdate={(updates) => handleUpdateSmartSwap(swap.id, updates)}
                            onRemove={() => handleRemoveSmartSwap(swap.id)}
                            isEyedropperActive={activeInjectionEyedropperId === ov.id && activeInjectionTarget === `smartSwap-${swap.id}`}
                            onToggleEyedropper={() => {
                                const target = `smartSwap-${swap.id}`;
                                const isActive = activeInjectionEyedropperId === ov.id && activeInjectionTarget === target;
                                setActiveInjectionEyedropperId(isActive ? null : ov.id);
                                setActiveInjectionTarget(target);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* List of Tile Swaps */}
            {tileSwaps.length > 0 && (
                <div className="space-y-2 pt-1">
                    <span className="text-[8.5px] text-emerald-400 uppercase font-black tracking-wider">Tile Swaps</span>
                    {tileSwaps.map((swap, idx) => (
                        <TileSwapItem 
                            key={swap.id || `tile-${idx}`}
                            swap={swap}
                            index={idx}
                            selectedTilesCount={selectedCount}
                            onUpdate={(updates) => handleUpdateTileSwap(swap.id, updates)}
                            onRemove={() => handleRemoveTileSwap(swap.id)}
                            onResampleFromSelectedTiles={() => handleResampleTileSwap(swap.id)}
                            isSampling={samplingTileSwapId === swap.id}
                        />
                    ))}
                </div>
            )}

            {/* Empty State Help */}
            {!hasAnySwaps && (
                <div className="py-2.5 px-3 bg-black/20 rounded-xl border border-dashed border-slate-800 text-center space-y-1">
                    <p className="text-[9px] text-slate-400 font-bold">No color swaps added yet</p>
                    <p className="text-[7.5px] text-slate-600">
                        Use + simple swap for direct replacements, + Smart swap for hue/saturation tuning, or + tile match to match colors to selected tiles.
                    </p>
                </div>
            )}

            {/* Baking Action Footer */}
            {hasAnySwaps && (
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80 mt-2">
                    <button
                        type="button"
                        onClick={() => handleApplyColorSwaps(ov, 'all')}
                        disabled={bakingOverlayId === ov.id}
                        className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-black active:scale-95 text-white shadow-md text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                        {bakingOverlayId === ov.id ? 'Baking...' : 'Apply Swaps'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleUndoColorFilters(ov.id)}
                        disabled={!filterUndoHistory[ov.id]}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            filterUndoHistory[ov.id]
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 active:scale-95'
                            : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                        }`}
                    >
                        Undo
                    </button>
                </div>
            )}
        </CollapsibleSection>
    );
};
