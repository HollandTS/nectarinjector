
import React from 'react';

interface FilterSliderProps {
    label: string;
    min: number;
    max: number;
    value: number;
    defaultValue?: number;
    onChange: (v: number) => void;
    onStartChange?: () => void;
    className?: string;
}

export const FilterSlider: React.FC<FilterSliderProps> = ({ 
    label, min, max, value, defaultValue, onChange, onStartChange, className = '' 
}) => {
    const safeVal = (value !== undefined && value !== null && !isNaN(value)) 
        ? value 
        : (defaultValue !== undefined ? defaultValue : (min ?? 0));

    return (
        <div className={className}>
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
                <input 
                    type="number" 
                    value={safeVal} 
                    onFocus={() => onStartChange?.()}
                    onChange={e => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)));
                    }}
                    className="bg-black/60 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono w-12 text-right focus:outline-none focus:border-cyan-500 font-bold"
                />
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={safeVal} 
                onMouseDown={() => onStartChange?.()}
                onChange={e => onChange(parseInt(e.target.value))} 
                onDoubleClick={() => {
                    onStartChange?.();
                    defaultValue !== undefined && onChange(defaultValue);
                }} 
                className="w-full h-1 bg-slate-800 appearance-none accent-cyan-500 rounded cursor-pointer" 
                title="Double-click to reset" 
            />
        </div>
    );
};
