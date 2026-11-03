import React, { useState } from 'react';
import type { SmartColorSwapItem } from '../../../../types';
import { FilterSlider } from '../../../ui/FilterSlider';
import { LucideSparkles, LucideChevronDown, LucideChevronRight } from 'lucide-react';
import { rgbToHex, hexToRgb } from '../../../../utils/colorUtils';

interface SmartSwapItemProps {
    swap: SmartColorSwapItem;
    index: number;
    onUpdate: (updates: Partial<SmartColorSwapItem>) => void;
    onRemove: () => void;
    isEyedropperActive: boolean;
    onToggleEyedropper: () => void;
}

export const SmartSwapItem: React.FC<SmartSwapItemProps> = ({
    swap,
    index,
    onUpdate,
    onRemove,
    isEyedropperActive,
    onToggleEyedropper
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const tc = swap.targetColor || { r: 255, g: 255, b: 255, a: 1 };
    const rc = swap.replaceColor || tc;

    return (
        <div className="space-y-2 p-2.5 bg-cyan-950/20 rounded-xl border border-cyan-800/40 hover:border-cyan-700/60 transition-all">
            <div className="flex items-center justify-between">
                <button 
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-1.5 text-left text-[10px] text-cyan-300 font-black uppercase hover:text-cyan-200 transition-colors"
                >
                    {isExpanded ? <LucideChevronDown className="w-3 h-3 text-cyan-400" /> : <LucideChevronRight className="w-3 h-3 text-slate-500" />}
                    <span>Smart Swap #{index + 1}</span>
                </button>

                <div className="flex items-center space-x-1.5">
                    <button 
                        type="button"
                        onClick={() => onUpdate({ enabled: !swap.enabled })}
                        className={`px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase transition-all ${
                            swap.enabled !== false 
                                ? 'bg-cyan-600 text-white shadow-sm' 
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {swap.enabled !== false ? 'ACTIVE' : 'OFF'}
                    </button>
                    <button 
                        type="button" 
                        onClick={onRemove} 
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 text-xs font-bold transition-all ml-1"
                        title="Remove Smart Swap"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Quick Colors Row */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-cyan-900/30">
                <div className="space-y-0.5">
                    <span className="text-[8.5px] text-slate-400 uppercase font-bold">Target</span>
                    <div className="flex items-center space-x-1.5">
                        <input 
                            type="color" 
                            value={rgbToHex(tc)} 
                            onChange={e => {
                                const newCol = hexToRgb(e.target.value);
                                onUpdate({ 
                                    targetColor: newCol,
                                    replaceColor: swap.replaceColor || newCol 
                                });
                            }} 
                            className="w-6 h-6 rounded bg-transparent border-none cursor-pointer" 
                        />
                        <button 
                            type="button"
                            onClick={onToggleEyedropper}
                            className={`p-1.5 rounded-lg border transition-all ${
                                isEyedropperActive 
                                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Sample color from viewport"
                        >
                            <LucideSparkles size={11} />
                        </button>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <span className="text-[8.5px] text-slate-400 uppercase font-bold">Replace</span>
                    <div className="flex items-center space-x-1.5">
                        <input 
                            type="color" 
                            value={rgbToHex(rc)} 
                            onChange={e => {
                                const newCol = hexToRgb(e.target.value);
                                onUpdate({ replaceColor: newCol });
                            }} 
                            className="w-6 h-6 rounded bg-transparent border-none cursor-pointer" 
                        />
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-2 pt-1 border-t border-cyan-900/20 animate-in slide-in-from-top-1 duration-150">
                    <FilterSlider 
                        label="Tolerance" 
                        min={0} 
                        max={100} 
                        value={swap.tolerance ?? 20} 
                        defaultValue={20} 
                        onChange={v => onUpdate({ tolerance: v })} 
                    />
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
                        <FilterSlider label="Hue" min={-180} max={180} value={swap.hue ?? 0} defaultValue={0} onChange={v => onUpdate({ hue: v })} />
                        <FilterSlider label="Sat" min={0} max={200} value={swap.saturation ?? 100} defaultValue={100} onChange={v => onUpdate({ saturation: v })} />
                        <FilterSlider label="Bri" min={0} max={200} value={swap.brightness ?? 100} defaultValue={100} onChange={v => onUpdate({ brightness: v })} />
                        <FilterSlider label="Sharp" min={0} max={100} value={swap.sharpening ?? 0} defaultValue={0} onChange={v => onUpdate({ sharpening: v })} />
                        <FilterSlider label="Smooth" min={0} max={100} value={swap.smoothing ?? 0} defaultValue={0} onChange={v => onUpdate({ smoothing: v })} />
                    </div>
                </div>
            )}
        </div>
    );
};
