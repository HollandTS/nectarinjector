import React from 'react';
import { PRESET_BRUSHES, BrushPreset } from '../../../utils/brushPresets';

interface BrushPresetPickerProps {
    onSelectPreset: (preset: BrushPreset) => void;
    onClose: () => void;
}

export const BrushPresetPicker: React.FC<BrushPresetPickerProps> = ({ onSelectPreset, onClose }) => {
    return (
        <div className="p-2 bg-black/70 rounded-lg border border-cyan-500/30 space-y-2 animate-in fade-in duration-150">
            <div className="flex justify-between items-center text-[10px] font-bold text-cyan-300 uppercase tracking-wide">
                <span>Choose Preset Brush</span>
                <button 
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
                >
                    ✕
                </button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[190px] overflow-y-auto pr-1">
                {PRESET_BRUSHES.map(preset => (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => onSelectPreset(preset)}
                        className="flex flex-col items-center bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 rounded-lg p-1.5 transition-all text-center group cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded bg-black/60 border border-slate-800 overflow-hidden flex items-center justify-center mb-1">
                            <img
                                src={preset.path}
                                alt={preset.name}
                                className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                            />
                        </div>
                        <span className="text-[9px] font-medium text-slate-300 group-hover:text-cyan-300 truncate w-full">
                            {preset.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
