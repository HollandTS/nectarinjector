import React, { useRef, useEffect } from 'react';
import type { TiledBrush, TiledBrushMode, TiledBrushShuffleMode, BrushResizeSampling } from '../../../types';
import { BRUSH_RESIZE_SAMPLING_OPTIONS } from '../../../utils/brushResizeSampling';
import { BrushSliders } from './BrushSliders';
import { LucideTrash2, LucideImage, LucideChevronDown, LucideChevronRight } from 'lucide-react';

interface BrushItemProps {
    brush: TiledBrush;
    isExpanded: boolean;
    onToggleExpand: () => void;
    autoScroll?: boolean;
    updateBrush: (brushId: string, updates: Partial<TiledBrush>) => void;
    removeBrush: (brushId: string) => void;
}

export const BrushItem: React.FC<BrushItemProps> = ({
    brush,
    isExpanded,
    onToggleExpand,
    autoScroll,
    updateBrush,
    removeBrush
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [autoScroll]);

    const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                updateBrush(brush.id, {
                    src: reader.result,
                    name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
                });
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isTiled = brush.tiled !== false && brush.tilingMode !== 'untiled';
    const isUntransformed = Boolean(brush.untransformed || brush.tilingMode === 'untransformed');

    return (
        <div
            ref={containerRef}
            className={`relative bg-slate-900/80 rounded-lg border p-2 space-y-2 transition-all ${
                isExpanded ? 'border-cyan-500/60 shadow-sm' : 'border-slate-700/80'
            }`}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleReplaceImage} 
                accept="image/png,image/jpeg,image/webp" 
                className="hidden" 
            />

            {/* Brush Header: clickable thumbnail to replace image, name, mode dropdown, collapse/expand, delete */}
            <div className="flex items-center space-x-2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-10 h-10 rounded bg-black/70 border border-slate-700 hover:border-cyan-400 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer group/thumb transition-all shadow-sm"
                    title="Click to replace brush image"
                >
                    <img
                        src={brush.src}
                        alt={brush.name}
                        className={`w-full h-full object-contain group-hover/thumb:scale-105 transition-transform ${brush.invert ? 'filter invert' : ''}`}
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <LucideImage className="w-3.5 h-3.5 text-cyan-300 drop-shadow" />
                    </div>
                </button>

                <div
                    onClick={onToggleExpand}
                    className="flex-1 min-w-0 cursor-pointer select-none"
                    title={isExpanded ? 'Click to collapse brush settings' : 'Click to expand brush settings'}
                >
                    <div className="flex items-center space-x-1">
                        {isExpanded ? (
                            <LucideChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        ) : (
                            <LucideChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <div className="text-[11px] font-bold text-slate-200 truncate" title={brush.name}>
                            {brush.name}
                        </div>
                    </div>
                    <div
                        onClick={e => e.stopPropagation()}
                        className="flex items-center space-x-1.5 mt-0.5"
                    >
                        <label className="text-[9px] text-slate-400 font-bold uppercase">Mode:</label>
                        <select
                            value={brush.mode}
                            onChange={e => updateBrush(brush.id, { mode: e.target.value as TiledBrushMode })}
                            className="bg-black/70 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="transparency">Transparency Brush</option>
                            <option value="coloring">Coloring Brush</option>
                            <option value="normal">Normal Brush</option>
                        </select>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onToggleExpand}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isExpanded
                            ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title={isExpanded ? 'Collapse brush settings' : 'Expand brush settings'}
                >
                    {isExpanded ? <LucideChevronDown size={13} /> : <LucideChevronRight size={13} />}
                </button>

                <button
                    type="button"
                    onClick={() => removeBrush(brush.id)}
                    className="p-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-lg border border-red-800/40 hover:text-red-200 transition-all cursor-pointer"
                    title="Delete brush"
                >
                    <LucideTrash2 size={13} />
                </button>
            </div>

            {isExpanded && (
                <div className="space-y-2 pt-1.5 border-t border-slate-800/80 animate-in fade-in duration-150">
                    {/* Shuffle Mode selector */}
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Shuffle Mode</span>
                        <select
                            value={brush.shuffleMode}
                            onChange={e => updateBrush(brush.id, { shuffleMode: e.target.value as TiledBrushShuffleMode })}
                            className="bg-black/60 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="standard">Standard</option>
                            <option value="chaos">Chaos (Rot & Flip)</option>
                            <option value="mirror_h">Mirror Horizontal</option>
                            <option value="mirror_v">Mirror Vertical</option>
                            <option value="mirror_both">Mirror Both</option>
                        </select>
                    </div>

                    {/* Resize Sampling selector */}
                    <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Resize Sampling</span>
                        <select
                            value={brush.resizeSampling ?? 'bicubic'}
                            onChange={e => updateBrush(brush.id, { resizeSampling: e.target.value as BrushResizeSampling })}
                            className="bg-black/60 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                            {BRUSH_RESIZE_SAMPLING_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} title={opt.description}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Checkboxes: Tiled, Untransformed, Invert */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/80">
                        <label className="flex items-center space-x-1.5 cursor-pointer group/chk" title="Checked: tiled across grid. Unchecked: untiled (single stamp across entire area).">
                            <input
                                type="checkbox"
                                checked={isTiled}
                                onChange={e => {
                                    const newTiled = e.target.checked;
                                    updateBrush(brush.id, {
                                        tiled: newTiled,
                                        tilingMode: newTiled ? (isUntransformed ? 'untransformed' : 'tiled') : 'untiled'
                                    });
                                }}
                                className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="text-[10px] font-bold text-slate-300 group-hover/chk:text-white uppercase tracking-wide">
                                Tiled
                            </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer group/chk" title="Checked: untransformed 2D brush image without isometric diamond/slope distortion.">
                            <input
                                type="checkbox"
                                checked={isUntransformed}
                                onChange={e => {
                                    const newUntransformed = e.target.checked;
                                    updateBrush(brush.id, {
                                        untransformed: newUntransformed,
                                        tilingMode: newUntransformed ? 'untransformed' : (isTiled ? 'tiled' : 'untiled')
                                    });
                                }}
                                className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="text-[10px] font-bold text-slate-300 group-hover/chk:text-white uppercase tracking-wide">
                                Untransformed
                            </span>
                        </label>

                        <label className="flex items-center space-x-1.5 cursor-pointer group/chk" title="Invert brush colors">
                            <input
                                type="checkbox"
                                checked={!!brush.invert}
                                onChange={e => updateBrush(brush.id, { invert: e.target.checked })}
                                className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="text-[10px] font-bold text-slate-300 group-hover/chk:text-white uppercase tracking-wide">
                                Invert
                            </span>
                        </label>
                    </div>

                    {/* Modularized Sliders (Core + Mode-specific) */}
                    <BrushSliders brush={brush} updateBrush={updateBrush} />
                </div>
            )}
        </div>
    );
};
