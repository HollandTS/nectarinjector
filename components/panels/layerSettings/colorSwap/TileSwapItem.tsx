import React, { useState } from 'react';
import type { TileColorSwapItem } from '../../../../types';
import { FilterSlider } from '../../../ui/FilterSlider';
import { LucidePalette, LucideRotateCcw, LucideCheck, LucideChevronDown, LucideChevronRight } from 'lucide-react';
import { rgbToHex } from '../../../../utils/colorUtils';

interface TileSwapItemProps {
    swap: TileColorSwapItem;
    index: number;
    selectedTilesCount: number;
    onUpdate: (updates: Partial<TileColorSwapItem>) => void;
    onRemove: () => void;
    onResampleFromSelectedTiles: () => void;
    isSampling?: boolean;
}

export const TileSwapItem: React.FC<TileSwapItemProps> = ({
    swap,
    index,
    selectedTilesCount,
    onUpdate,
    onRemove,
    onResampleFromSelectedTiles,
    isSampling = false
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const colors = swap.colors || [];

    return (
        <div className="space-y-2 p-2.5 bg-emerald-950/20 rounded-xl border border-emerald-800/40 hover:border-emerald-700/60 transition-all">
            <div className="flex items-center justify-between">
                <button 
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-1.5 text-left text-[10px] text-emerald-300 font-black uppercase hover:text-emerald-200 transition-colors"
                >
                    {isExpanded ? <LucideChevronDown className="w-3 h-3 text-emerald-400" /> : <LucideChevronRight className="w-3 h-3 text-slate-500" />}
                    <span>Tile Match #{index + 1}</span>
                </button>

                <div className="flex items-center space-x-1.5">
                    <button 
                        type="button"
                        onClick={() => onUpdate({ enabled: !swap.enabled })}
                        className={`px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase transition-all ${
                            swap.enabled !== false 
                                ? 'bg-emerald-600 text-white shadow-sm' 
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {swap.enabled !== false ? 'ACTIVE' : 'OFF'}
                    </button>
                    <button 
                        type="button" 
                        onClick={onRemove} 
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 text-xs font-bold transition-all ml-1"
                        title="Remove Tile Swap"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Info and Re-sample row */}
            <div className="flex items-center justify-between pt-1 border-t border-emerald-900/30">
                <div className="flex flex-col">
                    <span className="text-[8.5px] font-bold text-emerald-400/90">
                        {colors.length > 0 
                            ? `Matched to ${swap.selectedTileIds?.length || selectedTilesCount || 1} tile${(swap.selectedTileIds?.length || selectedTilesCount || 1) !== 1 ? 's' : ''} (${colors.length} colors)` 
                            : (selectedTilesCount > 0 ? `${selectedTilesCount} tile${selectedTilesCount !== 1 ? 's' : ''} selected` : 'Select tiles on canvas')}
                    </span>
                    {colors.length === 0 && (
                        <span className="text-[7.5px] text-slate-500">
                            Click match to extract colors from selected tiles
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onResampleFromSelectedTiles}
                    disabled={isSampling || selectedTilesCount === 0}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${
                        selectedTilesCount > 0 && !isSampling
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                    title={selectedTilesCount > 0 ? "Extract colors from currently selected tiles" : "Select one or more tiles on the canvas first"}
                >
                    <LucidePalette className="w-2.5 h-2.5" />
                    <span>{isSampling ? 'Matching...' : (colors.length > 0 ? 'Re-sample' : 'Match Tiles')}</span>
                </button>
            </div>

            {isExpanded && (
                <div className="space-y-2 pt-1 border-t border-emerald-900/20 animate-in slide-in-from-top-1 duration-150">
                    <FilterSlider 
                        label="Strength" 
                        min={0} 
                        max={100} 
                        value={swap.strength ?? 100} 
                        defaultValue={100} 
                        onChange={v => onUpdate({ strength: v })} 
                    />

                    {/* Palette swatches preview */}
                    {colors.length > 0 && (
                        <div className="space-y-1">
                            <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">
                                Matched Palette Preview ({Math.min(colors.length, 36)} of {colors.length})
                            </span>
                            <div className="flex flex-wrap gap-1 p-1.5 bg-black/40 rounded-lg max-h-16 overflow-y-auto border border-emerald-950/60">
                                {colors.slice(0, 36).map((c, i) => (
                                    <div 
                                        key={`tile-color-${i}`} 
                                        className="w-3.5 h-3.5 rounded-sm border border-black/40 shadow-xs" 
                                        style={{ backgroundColor: rgbToHex(c) }}
                                        title={`rgb(${c.r}, ${c.g}, ${c.b})`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
