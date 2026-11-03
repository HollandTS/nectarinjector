import React from 'react';
import { ProjectOverlay } from '../../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FilterSlider } from '../../ui/FilterSlider';
import { ShuffleModeControl } from './ShuffleModeControl';
import { LucideSparkles, LucideMaximize2, LucideRotateCcw } from 'lucide-react';

interface TilingSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
    handleBakeToSmart: (ov: ProjectOverlay) => void;
    handleRestoreTiled: (ov: ProjectOverlay) => void;
}

export const TilingSection: React.FC<TilingSectionProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    handleBakeToSmart,
    handleRestoreTiled,
}) => {
    const f = ov.filters;

    return (
        <CollapsibleSection title={ov.type === 'tiled' ? 'Tiling' : 'Smart Scaling'} titleColorClass="text-cyan-400">
            {/* 1. TOP: X-rep and Y-rep settings */}
            {ov.type === 'tiled' && (
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800/80">
                    <div>
                        <label className="text-[10px] text-slate-300 font-bold uppercase block mb-1">X-Rep (Horizontal)</label>
                        <input 
                            type="number" 
                            min="1" 
                            value={ov.repeatX} 
                            onChange={(e) => onUpdateOverlay(ov.id, { repeatX: Math.max(1, parseInt(e.target.value) || 1) })} 
                            className="bg-black/60 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono w-full focus:outline-none focus:border-cyan-500 font-bold" 
                        />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-300 font-bold uppercase block mb-1">Y-Rep (Vertical)</label>
                        <input 
                            type="number" 
                            min="1" 
                            value={ov.repeatY} 
                            onChange={(e) => onUpdateOverlay(ov.id, { repeatY: Math.max(1, parseInt(e.target.value) || 1) })} 
                            className="bg-black/60 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono w-full focus:outline-none focus:border-cyan-500 font-bold" 
                        />
                    </div>
                </div>
            )}

            {ov.type === 'smart' && (
                <div className="flex flex-col space-y-2 p-2 bg-black/30 rounded-lg border border-slate-800">
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-800 mb-1">
                        <button
                            onClick={() => onUpdateOverlay(ov.id, { isResizing: !ov.isResizing })}
                            className={`flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all border ${
                                ov.isResizing 
                                    ? 'bg-cyan-600/90 border-cyan-500 text-white shadow-[0_0_8px_rgba(34,211,238,0.3)]' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                            }`}
                        >
                            <LucideMaximize2 className="w-3 h-3" />
                            <span>{ov.isResizing ? 'Exit Resize' : 'Resize Layer'}</span>
                        </button>
                        <button
                            onClick={() => {
                                const updates: Partial<ProjectOverlay> = {};
                                if (ov.initialX !== undefined) updates.x = ov.initialX;
                                if (ov.initialY !== undefined) updates.y = ov.initialY;
                                if (ov.initialWidth !== undefined) updates.width = ov.initialWidth;
                                if (ov.initialHeight !== undefined) updates.height = ov.initialHeight;
                                onUpdateOverlay(ov.id, updates);
                            }}
                            className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 active:scale-95"
                        >
                            <LucideRotateCcw className="w-3 h-3 text-slate-400 group-hover:text-white" />
                            <span>Reset Pos</span>
                        </button>
                    </div>

                    <FilterSlider 
                        label="Rotation (Degrees)" 
                        min={0} 
                        max={360} 
                        step={1}
                        value={f.rotation ?? 0} 
                        defaultValue={0} 
                        onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                        onChange={v => updateFilter(ov.id, 'rotation', v)} 
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                        <label className="flex items-center space-x-2 cursor-pointer p-1 group/chk">
                            <input 
                                type="checkbox" 
                                checked={f.flipH ?? false} 
                                onChange={e => updateFilter(ov.id, 'flipH', e.target.checked)} 
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500" 
                            />
                            <span className="text-[10px] font-bold uppercase text-slate-300 group-hover/chk:text-white transition-colors">Flip H</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer p-1 group/chk">
                            <input 
                                type="checkbox" 
                                checked={f.flipV ?? false} 
                                onChange={e => updateFilter(ov.id, 'flipV', e.target.checked)} 
                                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500" 
                            />
                            <span className="text-[10px] font-bold uppercase text-slate-300 group-hover/chk:text-white transition-colors">Flip V</span>
                        </label>
                    </div>
                </div>
            )}

            <FilterSlider label="Footprint" min={10} max={2000} value={f.staticScale} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'staticScale', v)} />
            <FilterSlider label="Main Scale" min={10} max={500} value={f.mainScale} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'mainScale', v)} />

            {ov.type === 'tiled' && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <FilterSlider label="Zoom Spread" min={0} max={100} value={f.zoomRandomness} defaultValue={0} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'zoomRandomness', v)} />
                        <FilterSlider label="Scramble Positions" min={0} max={99999} value={f.scramblePositions} defaultValue={12345} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'scramblePositions', v)} />
                    </div>
                    <FilterSlider label="Canvas Zoom" min={50} max={800} value={f.canvasZoom} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'canvasZoom', v)} />
                    <ShuffleModeControl ov={ov} onUpdateOverlay={onUpdateOverlay} />
                </>
            )}

            {/* 3. BOTTOM: Render to smart layer and Restore button ALL THE WAY ON THE BOTTOM of tiling area */}
            <div className="flex items-center space-x-2 pt-2.5 border-t border-slate-800/80 mt-2">
                {ov.type === 'tiled' ? (
                    <button
                        type="button"
                        onClick={() => handleBakeToSmart(ov)}
                        className="flex-grow bg-cyan-600/35 hover:bg-cyan-600 border border-cyan-500/40 hover:border-cyan-400 text-white font-black text-xs uppercase py-1.5 px-3 rounded-lg tracking-wider transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                        <LucideSparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Render to Smart Layer</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="flex-grow bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black text-xs uppercase py-1.5 px-3 rounded-lg tracking-wider text-center cursor-not-allowed flex items-center justify-center space-x-1.5"
                    >
                        <span>Smart Layer Baked</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => handleRestoreTiled(ov)}
                    disabled={!ov.originalTiledBackup}
                    className={`font-black text-xs uppercase py-1.5 px-3 rounded-lg tracking-wider transition-all text-center flex items-center justify-center space-x-1.5 ${
                        ov.originalTiledBackup
                            ? 'bg-amber-600/35 hover:bg-amber-600 border border-amber-500/40 text-amber-300 cursor-pointer shadow-sm'
                            : 'bg-slate-800/30 border border-slate-700/40 text-slate-500 cursor-not-allowed'
                    }`}
                    title={ov.originalTiledBackup ? "Restore to original dynamic tiling layer" : "No original backup available"}
                >
                    <span>Restore</span>
                </button>
            </div>
        </CollapsibleSection>
    );
};
