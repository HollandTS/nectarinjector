import React from 'react';
import {
    OUTSIDE_PRESET_CATEGORIES,
    OutsidePresetCategory,
    OutsidePixelPreset,
    OutsidePixelPresetId,
} from '../../../utils/extraOutsidePixelPresets';
import { LucideShuffle, LucideCheckSquare, LucideSquare } from 'lucide-react';

interface ExtraStudioOutsideRandomizerBarProps {
    activeCategory: OutsidePresetCategory | 'all';
    setActiveCategory: (cat: OutsidePresetCategory | 'all') => void;
    visiblePresets: OutsidePixelPreset[];
    selectedPoolIds: Set<OutsidePixelPresetId>;
    onSelectCategoryPresets: (presets: OutsidePixelPreset[]) => void;
    onClearPool: () => void;
    disabled: boolean;
    onApplyRandomizedPool: () => void;
}

export const ExtraStudioOutsideRandomizerBar: React.FC<ExtraStudioOutsideRandomizerBarProps> = ({
    activeCategory,
    setActiveCategory,
    visiblePresets,
    selectedPoolIds,
    onSelectCategoryPresets,
    onClearPool,
    disabled,
    onApplyRandomizedPool,
}) => {
    const allVisibleChecked =
        visiblePresets.length > 0 && visiblePresets.every((p) => selectedPoolIds.has(p.id));

    return (
        <div className="space-y-2">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1">
                {OUTSIDE_PRESET_CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide border cursor-pointer transition-all ${
                                isActive
                                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm'
                                    : 'bg-black/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                        >
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* Multi-Select Pool Controls & Apply Randomized Button */}
            <div className="flex items-center justify-between gap-1.5 bg-black/40 border border-slate-800/90 rounded-lg p-1.5">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onSelectCategoryPresets(visiblePresets)}
                        className="px-2 py-1 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold uppercase text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title={
                            allVisibleChecked
                                ? 'Uncheck presets in current category'
                                : 'Check all presets in current category for randomization'
                        }
                    >
                        {allVisibleChecked ? (
                            <LucideCheckSquare className="w-3 h-3 text-cyan-400" />
                        ) : (
                            <LucideSquare className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{allVisibleChecked ? 'Unpick View' : 'Pick Category'}</span>
                    </button>

                    {selectedPoolIds.size > 0 && (
                        <button
                            type="button"
                            onClick={onClearPool}
                            className="px-1.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[9px] font-bold uppercase text-slate-400 hover:text-white cursor-pointer"
                            title="Clear multi-selected preset pool"
                        >
                            Clear ({selectedPoolIds.size})
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    disabled={disabled || selectedPoolIds.size === 0}
                    onClick={onApplyRandomizedPool}
                    className="px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-40 text-white font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5 shadow cursor-pointer transition-all"
                    title="Randomly assigns one of the checked presets to each selected tile"
                >
                    <LucideShuffle className="w-3 h-3" />
                    <span>
                        Randomize Picked ({selectedPoolIds.size})
                    </span>
                </button>
            </div>
        </div>
    );
};
