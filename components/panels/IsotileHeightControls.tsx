import React from 'react';
import { LucideArrowUp, LucideArrowDown, LucideRotateCcw, LucideWand2 } from 'lucide-react';
import type { CanvasImage } from '../../types';

interface IsotileHeightControlsProps {
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    cellHeight: number;
    autoSlopeSnap: boolean;
    onToggleAutoSlopeSnap: (enabled: boolean) => void;
    onAdjustHeightLevel: (delta: number) => void;
    onResetHeightLevel: () => void;
    onAutoMatchRampHeights: () => void;
}

export const IsotileHeightControls: React.FC<IsotileHeightControlsProps> = ({
    images,
    selectedImageIds,
    cellHeight,
    autoSlopeSnap,
    onToggleAutoSlopeSnap,
    onAdjustHeightLevel,
    onResetHeightLevel,
    onAutoMatchRampHeights,
}) => {
    const selectedTiles = images.filter(img => selectedImageIds.has(img.id));
    const hasSelection = selectedTiles.length > 0;
    const stepPx = cellHeight / 2;

    const currentLevelText = (() => {
        if (!hasSelection) return 'None';
        const levels = Array.from(new Set(selectedTiles.map(t => t.heightLevel ?? 0)));
        if (levels.length === 1) {
            const lv = levels[0];
            return `Lv ${lv >= 0 ? `+${lv}` : lv} (${lv * -stepPx}px Y)`;
        }
        return `Mixed (${Math.min(...levels)}..${Math.max(...levels)})`;
    })();

    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    Slope / Fake Height
                </span>
                <span className="text-[9px] font-mono tabular-nums text-amber-400 font-bold truncate">
                    {currentLevelText}
                </span>
            </div>

            <div className="grid grid-cols-4 gap-1">
                <button
                    type="button"
                    onClick={() => onAdjustHeightLevel(-1)}
                    disabled={!hasSelection}
                    className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title={`Lower selected tile height level by 1 (+${stepPx}px screen Y)`}
                >
                    <LucideArrowDown className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Lv -1</span>
                </button>
                <button
                    type="button"
                    onClick={() => onAdjustHeightLevel(1)}
                    disabled={!hasSelection}
                    className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title={`Raise selected tile height level by 1 (-${stepPx}px screen Y to match ramp top)`}
                >
                    <LucideArrowUp className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Lv +1</span>
                </button>
                <button
                    type="button"
                    onClick={onResetHeightLevel}
                    disabled={!hasSelection}
                    className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Reset selected tile height level to 0 (ground level)"
                >
                    <LucideRotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Lv 0</span>
                </button>
                <button
                    type="button"
                    onClick={onAutoMatchRampHeights}
                    disabled={images.length < 2}
                    className="py-1.5 px-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/40 text-amber-300 hover:text-white text-[9px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Auto-match height levels of selected (or all) tiles to adjacent WAE ramp slopes"
                >
                    <LucideWand2 className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Auto</span>
                </button>
            </div>

            <label className="flex items-center justify-between pt-0.5 cursor-pointer select-none text-[9px] text-slate-300 hover:text-white">
                <span className="truncate pr-2">Auto-elevate when snapping to ramps</span>
                <input
                    type="checkbox"
                    checked={autoSlopeSnap}
                    onChange={(e) => onToggleAutoSlopeSnap(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer shrink-0"
                />
            </label>
        </div>
    );
};
