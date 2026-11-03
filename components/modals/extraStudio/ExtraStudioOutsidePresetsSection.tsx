import React, { useMemo, useState } from 'react';
import {
    OUTSIDE_PIXEL_PRESETS,
    OutsidePresetCategory,
    OutsidePixelPreset,
    OutsidePixelPresetId,
    getOutsidePresetPreviewUrl,
} from '../../../utils/extraOutsidePixelPresets';
import type { OutsidePixelColorSource } from '../../../utils/extraOutsidePixelBaker';
import { ExtraStudioOutsideRandomizerBar } from './ExtraStudioOutsideRandomizerBar';
import { LucideSparkles, LucideRefreshCw, LucideCheck } from 'lucide-react';

interface ExtraStudioOutsidePresetsSectionProps {
    spreadPx: number;
    setSpreadPx: (val: number) => void;
    colorSource: OutsidePixelColorSource;
    setColorSource: (src: OutsidePixelColorSource) => void;
    seedOffset: number;
    setSeedOffset: React.Dispatch<React.SetStateAction<number>>;
    activePresetId: OutsidePixelPresetId | null;
    selectedPoolIds: Set<OutsidePixelPresetId>;
    onTogglePresetInPool: (id: OutsidePixelPresetId) => void;
    onSelectCategoryPresets: (presets: OutsidePixelPreset[]) => void;
    onClearPool: () => void;
    disabled: boolean;
    onApplyOutsidePreset: (preset: OutsidePixelPreset) => void;
    onApplyRandomizedPool: () => void;
}

export const ExtraStudioOutsidePresetsSection: React.FC<ExtraStudioOutsidePresetsSectionProps> = ({
    spreadPx,
    setSpreadPx,
    colorSource,
    setColorSource,
    setSeedOffset,
    activePresetId,
    selectedPoolIds,
    onTogglePresetInPool,
    onSelectCategoryPresets,
    onClearPool,
    disabled,
    onApplyOutsidePreset,
    onApplyRandomizedPool,
}) => {
    const [activeCategory, setActiveCategory] = useState<OutsidePresetCategory | 'all'>('oval_round');

    const previews = useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of OUTSIDE_PIXEL_PRESETS) {
            map[p.id] = getOutsidePresetPreviewUrl(p);
        }
        return map;
    }, []);

    const visiblePresets = useMemo(() => {
        if (activeCategory === 'all') return OUTSIDE_PIXEL_PRESETS;
        return OUTSIDE_PIXEL_PRESETS.filter((p) => p.category === activeCategory);
    }, [activeCategory]);

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <LucideSparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Outside Pixel Presets (Oval / Spray / Spread)</span>
                </span>
                <button
                    type="button"
                    onClick={() => setSeedOffset((prev) => prev + 1)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold uppercase text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Change random spray & preset assignment seed"
                >
                    <LucideRefreshCw className="w-2.5 h-2.5" />
                    <span>New Seed</span>
                </button>
            </div>

            {/* Spread Distance & Color Source */}
            <div className="space-y-1.5 bg-black/30 border border-slate-800/80 rounded-lg p-2">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-slate-400">
                        Pixel Spread Distance:
                    </span>
                    <span className="text-[10px] font-mono font-black text-cyan-400">
                        {spreadPx}px
                    </span>
                </div>
                <input
                    type="range"
                    min={3}
                    max={18}
                    step={1}
                    value={spreadPx}
                    onChange={(e) => setSpreadPx(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />

                <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400">
                        Spread Pixel Colors:
                    </span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => setColorSource('tile_edge')}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border cursor-pointer transition-all ${
                                colorSource === 'tile_edge'
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                    : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Samples colors directly from the tile's own diamond edge texture"
                        >
                            From Tile Texture
                        </button>
                        <button
                            type="button"
                            onClick={() => setColorSource('active_source')}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border cursor-pointer transition-all ${
                                colorSource === 'active_source'
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                                    : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Samples colors from the selected 3D/2D source layer (falls back to tile edge)"
                        >
                            From Active Layer
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs & Multi-Select Randomization Bar */}
            <ExtraStudioOutsideRandomizerBar
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                visiblePresets={visiblePresets}
                selectedPoolIds={selectedPoolIds}
                onSelectCategoryPresets={onSelectCategoryPresets}
                onClearPool={onClearPool}
                disabled={disabled}
                onApplyRandomizedPool={onApplyRandomizedPool}
            />

            {/* Categorized Presets Grid (Click card to apply immediately, or click checkbox to pick for randomization) */}
            <div className="grid grid-cols-2 gap-1.5 max-h-[195px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                {visiblePresets.map((preset) => {
                    const isSingleActive = activePresetId === preset.id;
                    const isCheckedInPool = selectedPoolIds.has(preset.id);
                    return (
                        <div
                            key={preset.id}
                            className={`p-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                                isCheckedInPool
                                    ? 'bg-teal-950/50 border-teal-400/70'
                                    : isSingleActive
                                    ? 'bg-cyan-950/50 border-cyan-400/70'
                                    : 'bg-black/40 hover:bg-slate-800/70 border-slate-800 hover:border-cyan-500/40'
                            }`}
                        >
                            {/* Checkbox for multi-select randomization */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePresetInPool(preset.id);
                                }}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                                    isCheckedInPool
                                        ? 'bg-teal-500 border-teal-300 text-slate-950'
                                        : 'bg-slate-900/90 border-slate-600 hover:border-cyan-400 text-transparent'
                                }`}
                                title="Check to include in Randomized Pool for selected tiles"
                            >
                                <LucideCheck className="w-3 h-3 stroke-[3]" />
                            </button>

                            {/* Click main area to apply this single preset immediately */}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onApplyOutsidePreset(preset)}
                                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer disabled:opacity-40"
                                title={`Apply "${preset.name}" to target tiles`}
                            >
                                <img
                                    src={previews[preset.id]}
                                    alt={preset.name}
                                    className="w-11 h-7 rounded border border-slate-700/80 shrink-0 object-cover"
                                    style={{ imageRendering: 'pixelated' }}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[9px] font-black uppercase text-cyan-200 truncate">
                                        {preset.name}
                                    </div>
                                    <div className="text-[8px] text-slate-400 truncate">
                                        {preset.subtitle}
                                    </div>
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
