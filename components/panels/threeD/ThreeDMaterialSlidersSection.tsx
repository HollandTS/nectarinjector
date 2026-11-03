import React, { useState } from 'react';
import type { ThreeDTextureSettings } from '../../../types';
import {
    LucideSliders,
    LucideRotateCcw,
    LucideChevronDown,
    LucideChevronRight,
} from 'lucide-react';

interface ThreeDMaterialSlidersSectionProps {
    settings: ThreeDTextureSettings;
    updateSetting: (key: keyof ThreeDTextureSettings, val: any, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDMaterialSlidersSection: React.FC<ThreeDMaterialSlidersSectionProps> = ({
    settings,
    updateSetting,
    onStartHistory,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleResetSurfaceAndColor = () => {
        updateSetting('brightness', 100, true);
        updateSetting('contrast', 100);
        updateSetting('saturation', 100);
        updateSetting('hue', 0);
        updateSetting('metallic', 0);
        updateSetting('roughness', 1);
        updateSetting('normalScale', 1);
    };

    const materialSliders: {
        label: string;
        key: keyof ThreeDTextureSettings;
        min: number;
        max: number;
        step: number;
        defaultVal: number;
        color: string;
        accent: string;
    }[] = [
        { label: 'Brightness', key: 'brightness', min: 0, max: 200, step: 1, defaultVal: 100, color: 'text-amber-300', accent: 'accent-amber-500' },
        { label: 'Contrast', key: 'contrast', min: 0, max: 200, step: 1, defaultVal: 100, color: 'text-orange-300', accent: 'accent-orange-500' },
        { label: 'Saturation', key: 'saturation', min: 0, max: 200, step: 1, defaultVal: 100, color: 'text-pink-300', accent: 'accent-pink-500' },
        { label: 'Hue Shift', key: 'hue', min: -180, max: 180, step: 1, defaultVal: 0, color: 'text-purple-300', accent: 'accent-purple-500' },
        { label: 'Metallic', key: 'metallic', min: 0, max: 1, step: 0.01, defaultVal: 0, color: 'text-slate-200', accent: 'accent-slate-400' },
        { label: 'Roughness', key: 'roughness', min: 0, max: 1, step: 0.01, defaultVal: 1, color: 'text-amber-400', accent: 'accent-amber-500' },
        { label: 'Normal Scale', key: 'normalScale', min: 0, max: 5, step: 0.1, defaultVal: 1, color: 'text-blue-300', accent: 'accent-blue-500' },
    ];

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            {/* Collapsible Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-pink-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <LucideSliders className="w-4 h-4 text-pink-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-pink-400">
                        Surface & Color
                    </span>
                </div>
                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleResetSurfaceAndColor}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Reset surface & color properties"
                    >
                        <LucideRotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-2.5">
                    {materialSliders.map((s) => {
                        const val = settings[s.key] as number;
                        return (
                            <div key={s.key} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className={`text-xs font-bold uppercase ${s.color}`}>
                                        {s.label}
                                    </label>
                                    <input
                                        type="number"
                                        step={s.step}
                                        value={Number(val.toFixed(2))}
                                        onChange={(e) =>
                                            updateSetting(s.key, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-white px-2 py-0.5 text-right focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <input
                                    type="range"
                                    min={s.min}
                                    max={s.max}
                                    step={s.step}
                                    value={val}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSetting(s.key, parseFloat(e.target.value))}
                                    onDoubleClick={() => updateSetting(s.key, s.defaultVal, true)}
                                    title={`Double-click to reset to ${s.defaultVal}`}
                                    className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${s.accent}`}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
