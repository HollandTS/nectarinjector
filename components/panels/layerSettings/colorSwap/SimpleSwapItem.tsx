import React from 'react';
import type { ColorSwap } from '../../../../types';
import { FilterSlider } from '../../../ui/FilterSlider';
import { rgbToHex, hexToRgb } from '../../../../utils/colorUtils';

interface SimpleSwapItemProps {
    swap: ColorSwap;
    onUpdate: (updates: Partial<ColorSwap>) => void;
    onRemove: () => void;
    onStartChange?: () => void;
}

export const SimpleSwapItem: React.FC<SimpleSwapItemProps> = ({
    swap,
    onUpdate,
    onRemove,
    onStartChange
}) => {
    return (
        <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
            <div className="flex items-center space-x-2">
                <div className="flex flex-col items-center">
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase mb-0.5">Target</span>
                    <input 
                        type="color" 
                        value={swap.targetColor ? rgbToHex(swap.targetColor) : '#ffffff'} 
                        onChange={e => onUpdate({ targetColor: hexToRgb(e.target.value) })} 
                        className="w-6 h-6 rounded-lg bg-transparent border-none cursor-pointer" 
                    />
                </div>
                <span className="text-[10px] text-slate-600 font-bold">→</span>
                <div className="flex flex-col items-center">
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase mb-0.5">Replace</span>
                    <input 
                        type="color" 
                        value={swap.replaceColor ? rgbToHex(swap.replaceColor) : '#ffffff'} 
                        onChange={e => onUpdate({ replaceColor: hexToRgb(e.target.value) })} 
                        className="w-6 h-6 rounded-lg bg-transparent border-none cursor-pointer" 
                    />
                </div>
            </div>

            <FilterSlider 
                label="Tol" 
                min={0} 
                max={100} 
                value={swap.tolerance} 
                defaultValue={20} 
                onStartChange={onStartChange} 
                onChange={v => onUpdate({ tolerance: v })} 
                className="flex-grow mx-3" 
            />

            <button 
                type="button" 
                onClick={onRemove} 
                className="text-red-400 hover:text-red-300 p-1 rounded-md hover:bg-red-950/30 text-xs font-bold transition-all"
                title="Remove Swap"
            >
                ✕
            </button>
        </div>
    );
};
