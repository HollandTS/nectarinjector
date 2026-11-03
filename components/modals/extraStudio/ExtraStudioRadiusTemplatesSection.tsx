import React from 'react';
import { EXTRA_IMAGE_TEMPLATES, ExtraTemplatePreset } from '../../../utils/extraImageTemplates';
import { LucideSliders } from 'lucide-react';

interface ExtraStudioRadiusTemplatesSectionProps {
    searchRadiusPx: number;
    setSearchRadiusPx: (val: number) => void;
    disabled: boolean;
    onApplyPresetBake: (preset: ExtraTemplatePreset) => void;
}

export const ExtraStudioRadiusTemplatesSection: React.FC<ExtraStudioRadiusTemplatesSectionProps> = ({
    searchRadiusPx,
    setSearchRadiusPx,
    disabled,
    onApplyPresetBake,
}) => {
    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <LucideSliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Object Root Scan Radius</span>
                </span>
                <span className="text-[11px] font-mono font-black text-emerald-400">
                    {searchRadiusPx}px
                </span>
            </div>
            <input
                type="range"
                min={0}
                max={80}
                step={2}
                value={searchRadiusPx}
                onChange={(e) => setSearchRadiusPx(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <p className="text-[10px] text-slate-400 leading-relaxed">
                Scans for individual 3D/2D objects whose base root is within <b>{searchRadiusPx}px</b> of the tile diamond, masks out all other objects, and bakes each matched object&apos;s full silhouette without rectangular cutoffs.
            </p>

            <div className="pt-1 space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Quick Scan Radius Presets
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                    {EXTRA_IMAGE_TEMPLATES.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onApplyPresetBake(preset)}
                            className="p-2 rounded-lg bg-black/40 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-left transition-all cursor-pointer disabled:opacity-40"
                        >
                            <div className="text-[10px] font-black uppercase text-emerald-300 truncate">
                                {preset.name}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate">
                                {preset.subtitle}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
