import React, { useState } from 'react';
import type { ThreeDTextureSettings } from '../../../types';
import {
    LucideChevronDown,
    LucideChevronRight,
    LucideMaximize,
    LucideRotateCcw,
} from 'lucide-react';

interface ThreeDTextureTransformSectionProps {
    settings: ThreeDTextureSettings;
    updateSetting: (key: keyof ThreeDTextureSettings, val: any, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDTextureTransformSection: React.FC<ThreeDTextureTransformSectionProps> = ({
    settings,
    updateSetting,
    onStartHistory,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleResetTextureTransform = () => {
        updateSetting('scale', 1, true);
        updateSetting('repeatX', 1);
        updateSetting('repeatY', 1);
        updateSetting('offsetX', 0);
        updateSetting('offsetY', 0);
        updateSetting('rotation', 0);
        updateSetting('magFilter', 'linear');
        updateSetting('minFilter', 'linear');
        updateSetting('anisotropy', 1);
    };

    const transformSliders: {
        label: string;
        key: keyof ThreeDTextureSettings;
        min: number;
        max: number;
        step: number;
        defaultVal: number;
    }[] = [
        { label: 'Repeat X', key: 'repeatX', min: 0.1, max: 10, step: 0.1, defaultVal: 1 },
        { label: 'Repeat Y', key: 'repeatY', min: 0.1, max: 10, step: 0.1, defaultVal: 1 },
        { label: 'Offset X', key: 'offsetX', min: -1, max: 1, step: 0.01, defaultVal: 0 },
        { label: 'Offset Y', key: 'offsetY', min: -1, max: 1, step: 0.01, defaultVal: 0 },
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
                        <LucideChevronDown className="w-4 h-4 text-teal-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <LucideMaximize className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-teal-400">
                        Texture Transform
                    </span>
                </div>
                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleResetTextureTransform}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                        title="Reset texture transform, filter & sharpness"
                    >
                        <LucideRotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3">
                    {/* Filtering & Sharpness (Anisotropy) */}
                    <div className="space-y-2.5 pb-2.5 border-b border-slate-800/80">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase text-slate-300 block">
                                    Mag Filter
                                </label>
                                <div className="flex bg-slate-900/90 rounded-lg p-1 border border-slate-700/80">
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('magFilter', 'nearest', true)}
                                        className={`flex-1 text-xs py-1 rounded-md font-bold uppercase transition-colors cursor-pointer ${
                                            settings.magFilter === 'nearest'
                                                ? 'bg-cyan-600 text-white shadow'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Pixel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('magFilter', 'linear', true)}
                                        className={`flex-1 text-xs py-1 rounded-md font-bold uppercase transition-colors cursor-pointer ${
                                            settings.magFilter === 'linear'
                                                ? 'bg-cyan-600 text-white shadow'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Smooth
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase text-slate-300 block">
                                    Min Filter
                                </label>
                                <div className="flex bg-slate-900/90 rounded-lg p-1 border border-slate-700/80">
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('minFilter', 'nearest', true)}
                                        className={`flex-1 text-xs py-1 rounded-md font-bold uppercase transition-colors cursor-pointer ${
                                            settings.minFilter === 'nearest'
                                                ? 'bg-cyan-600 text-white shadow'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Pixel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateSetting('minFilter', 'linear', true)}
                                        className={`flex-1 text-xs py-1 rounded-md font-bold uppercase transition-colors cursor-pointer ${
                                            settings.minFilter === 'linear'
                                                ? 'bg-cyan-600 text-white shadow'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Smooth
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold uppercase text-cyan-300">
                                    Anisotropy (Sharpness)
                                </label>
                                <span className="text-xs font-mono text-cyan-400 font-bold">
                                    {settings.anisotropy}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="16"
                                step="1"
                                value={settings.anisotropy}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSetting('anisotropy', parseInt(e.target.value, 10))}
                                onDoubleClick={() => updateSetting('anisotropy', 1, true)}
                                title="Double-click to reset to 1"
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Uniform Scale */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-300 uppercase">
                                Uniform Scale
                            </label>
                            <span className="text-xs font-mono text-emerald-400 font-bold">
                                {settings.scale.toFixed(2)}x
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={settings.scale}
                            onMouseDown={onStartHistory}
                            onChange={(e) => updateSetting('scale', parseFloat(e.target.value))}
                            onDoubleClick={() => updateSetting('scale', 1, true)}
                            title="Double-click to reset to 1"
                            className="w-full h-1.5 bg-slate-700 appearance-none accent-emerald-500 rounded-lg cursor-pointer"
                        />
                    </div>

                    {/* Repeat & Offset Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        {transformSliders.map((s) => {
                            const val = settings[s.key] as number;
                            return (
                                <div
                                    key={s.key}
                                    className="space-y-1 bg-slate-900/50 p-2 rounded-lg border border-slate-800"
                                >
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-300 uppercase">
                                            {s.label}
                                        </label>
                                        <span className="text-[11px] font-mono text-emerald-400">
                                            {val.toFixed(2)}
                                        </span>
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
                                        className="w-full h-1.5 bg-slate-700 appearance-none accent-emerald-500 rounded-lg cursor-pointer"
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Rotation */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-300 uppercase">
                                Rotation (Rad)
                            </label>
                            <span className="text-xs font-mono text-emerald-400">
                                {settings.rotation.toFixed(2)}
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={Math.PI * 2}
                            step={0.01}
                            value={settings.rotation}
                            onMouseDown={onStartHistory}
                            onChange={(e) => updateSetting('rotation', parseFloat(e.target.value))}
                            onDoubleClick={() => updateSetting('rotation', 0, true)}
                            title="Double-click to reset to 0"
                            className="w-full h-1.5 bg-slate-700 appearance-none accent-emerald-500 rounded-lg cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
