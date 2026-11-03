import React, { useState } from 'react';
import type { HandBrushSettings } from '../../types';
import { FilterSlider } from '../ui/FilterSlider';
import { LucidePalette, LucideChevronDown, LucideChevronRight, LucideRotateCcw } from 'lucide-react';

interface HandBrushNormalColoringSectionProps {
    settings: HandBrushSettings;
    onUpdateSettings: (updates: Partial<HandBrushSettings>) => void;
}

export const HandBrushNormalColoringSection: React.FC<HandBrushNormalColoringSectionProps> = ({
    settings,
    onUpdateSettings,
}) => {
    // Collapsed by default so the panel never gets overcrowded
    const [isOpen, setIsOpen] = useState(false);

    const normalHue = settings.normalHue ?? 0;
    const normalSaturation = settings.normalSaturation ?? 100;
    const normalBrightness = settings.normalBrightness ?? 100;
    const normalTransparency = settings.normalTransparency ?? 0;

    const isModified =
        normalHue !== 0 ||
        normalSaturation !== 100 ||
        normalBrightness !== 100 ||
        normalTransparency !== 0;

    const handleResetAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateSettings({
            normalHue: 0,
            normalSaturation: 100,
            normalBrightness: 100,
            normalTransparency: 0,
        });
    };

    return (
        <div className="bg-cyan-950/20 border border-cyan-800/50 rounded-xl overflow-hidden">
            <div
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center justify-between px-2.5 py-2 cursor-pointer hover:bg-cyan-900/20 transition-colors select-none"
            >
                <div className="flex items-center space-x-1.5 text-[10px] font-black text-cyan-300 uppercase tracking-wide">
                    {isOpen ? (
                        <LucideChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                        <LucideChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <LucidePalette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Coloring & Transparency</span>
                    {isModified && (
                        <span className="text-[8px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1 py-0.2 rounded">
                            Active
                        </span>
                    )}
                </div>

                {isModified && (
                    <button
                        type="button"
                        onClick={handleResetAll}
                        className="flex items-center space-x-0.5 text-[9px] font-bold text-slate-400 hover:text-cyan-300 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 cursor-pointer"
                        title="Reset Hue, Saturation, Brightness & Transparency"
                    >
                        <LucideRotateCcw className="w-2.5 h-2.5" />
                        <span>Reset</span>
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="space-y-1.5 px-2.5 pb-2.5 pt-1 border-t border-cyan-800/30">
                    <FilterSlider
                        label="Hue"
                        min={-180}
                        max={180}
                        value={normalHue}
                        defaultValue={0}
                        onChange={(v) => onUpdateSettings({ normalHue: v })}
                    />
                    <FilterSlider
                        label="Sat"
                        min={0}
                        max={200}
                        value={normalSaturation}
                        defaultValue={100}
                        onChange={(v) => onUpdateSettings({ normalSaturation: v })}
                    />
                    <FilterSlider
                        label="Bright"
                        min={0}
                        max={200}
                        value={normalBrightness}
                        defaultValue={100}
                        onChange={(v) => onUpdateSettings({ normalBrightness: v })}
                    />
                    <FilterSlider
                        label="Transparency"
                        min={0}
                        max={100}
                        value={normalTransparency}
                        defaultValue={0}
                        onChange={(v) => onUpdateSettings({ normalTransparency: v })}
                    />
                </div>
            )}
        </div>
    );
};
