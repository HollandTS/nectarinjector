import React from 'react';
import { ProjectOverlay } from '../../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FilterSlider } from '../../ui/FilterSlider';
import { LucideLoader2 } from 'lucide-react';

interface ColorFiltersSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
    handleApplyColorFilters: (ov: ProjectOverlay) => void;
    handleUndoColorFilters: (id: string) => void;
    bakingOverlayId: string | null;
    filterUndoHistory: Record<string, any>;
}

export const ColorFiltersSection: React.FC<ColorFiltersSectionProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    handleApplyColorFilters,
    handleUndoColorFilters,
    bakingOverlayId,
    filterUndoHistory
}) => {
    const f = ov.filters;

    return (
        <CollapsibleSection title="Colors & Filters" titleColorClass="text-amber-400">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <FilterSlider label="Bright" min={0} max={200} value={f.brightness} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'brightness', v)} />
                <FilterSlider label="Contrast" min={0} max={200} value={f.contrast} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'contrast', v)} />
                <FilterSlider label="Saturation" min={0} max={200} value={f.saturation} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'saturation', v)} />
                <FilterSlider label="Hue Shift" min={-180} max={180} value={f.hue} defaultValue={0} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'hue', v)} />
            </div>

            {/* Advanced Dynamic Smoothing & Sharpening Suite */}
            <div className="border-t border-slate-800/80 pt-2 mt-1 space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">Aesthetic Polish</p>
                    <span className="text-[9px] font-black font-mono text-cyan-400 uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                        {f.masterSharpSmooth < 0 ? 'Smart Smooth' : f.masterSharpSmooth > 0 ? 'Advanced Sharpen' : 'Balanced'}
                    </span>
                </div>
                
                <div className="space-y-2 bg-black/40 p-2 rounded-lg border border-slate-800">
                    <FilterSlider 
                        label="Master Sharp / Smooth" 
                        min={-100} 
                        max={100} 
                        value={f.masterSharpSmooth ?? 0} 
                        defaultValue={0} 
                        onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                        onChange={v => updateFilter(ov.id, 'masterSharpSmooth', v)} 
                    />
                    <FilterSlider 
                        label="Balance Colors" 
                        min={0} 
                        max={100} 
                        value={f.balanceColors ?? 0} 
                        defaultValue={0} 
                        onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                        onChange={v => updateFilter(ov.id, 'balanceColors', v)} 
                    />
                    
                    {/* Smart/Bilateral Smoothing Fields */}
                    {(f.masterSharpSmooth < 0 || f.smartSmoothStrength > 0) && (
                        <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-slate-800/50 animate-in fade-in duration-150">
                            <div className="col-span-2">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bilateral Polish (Edge-Preserving)</p>
                            </div>
                            <FilterSlider 
                                label="Smooth Strength" 
                                min={0} 
                                max={100} 
                                value={f.smartSmoothStrength ?? (f.masterSharpSmooth < 0 ? Math.abs(f.masterSharpSmooth) : 0)} 
                                defaultValue={50} 
                                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                onChange={v => updateFilter(ov.id, 'smartSmoothStrength', v)} 
                            />
                            <FilterSlider 
                                label="Smooth Radius (px)" 
                                min={1} 
                                max={5} 
                                value={f.smartSmoothRadius ?? 2} 
                                defaultValue={2} 
                                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                onChange={v => updateFilter(ov.id, 'smartSmoothRadius', v)} 
                            />
                            <div className="col-span-2">
                                <FilterSlider 
                                    label="Edge Edge-Detection Threshold" 
                                    min={1} 
                                    max={100} 
                                    value={f.smartSmoothTolerance ?? 30} 
                                    defaultValue={30} 
                                    onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                    onChange={v => updateFilter(ov.id, 'smartSmoothTolerance', v)} 
                                />
                            </div>
                        </div>
                    )}

                    {/* Advanced Sharpening Fields */}
                    {(f.masterSharpSmooth > 0 || f.sharpen > 0) && (
                        <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-slate-800/50 animate-in fade-in duration-150">
                            <div className="col-span-2">
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unsharp Mask (High-Freq Detail)</p>
                            </div>
                            <FilterSlider 
                                label="Sharpen Strength" 
                                min={0} 
                                max={100} 
                                value={f.sharpen ?? (f.masterSharpSmooth > 0 ? f.masterSharpSmooth : 0)} 
                                defaultValue={0} 
                                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                onChange={v => updateFilter(ov.id, 'sharpen', v)} 
                            />
                            <FilterSlider 
                                label="Sharpen Radius (px)" 
                                min={0.1} 
                                max={5} 
                                step={0.1}
                                value={f.sharpenRadius ?? 1.5} 
                                defaultValue={1.5} 
                                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                onChange={v => updateFilter(ov.id, 'sharpenRadius', v)} 
                            />
                            <div className="col-span-2">
                                <FilterSlider 
                                    label="Contrast Noise Gate (Thres)" 
                                    min={0} 
                                    max={100} 
                                    value={f.sharpenThreshold ?? 5} 
                                    defaultValue={5} 
                                    onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                                    onChange={v => updateFilter(ov.id, 'sharpenThreshold', v)} 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Apply and Undo Actions */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80 mt-1">
                <button
                    type="button"
                    onClick={() => handleApplyColorFilters(ov)}
                    disabled={
                        (
                            (f.blur ?? 0) === 0 && 
                            (f.sharpen ?? 0) === 0 && 
                            (f.masterSharpSmooth ?? 0) === 0 && 
                            (f.smartSmoothStrength ?? 0) === 0 && 
                            (f.balanceColors ?? 0) === 0 && 
                            (f.brightness ?? 100) === 100 && 
                            (f.contrast ?? 100) === 100 && 
                            (f.saturation ?? 100) === 100 && 
                            (f.hue ?? 0) === 0
                        ) || bakingOverlayId === ov.id
                    }
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        !(
                            (f.blur ?? 0) === 0 && 
                            (f.sharpen ?? 0) === 0 && 
                            (f.masterSharpSmooth ?? 0) === 0 && 
                            (f.smartSmoothStrength ?? 0) === 0 && 
                            (f.balanceColors ?? 0) === 0 && 
                            (f.brightness ?? 100) === 100 && 
                            (f.contrast ?? 100) === 100 && 
                            (f.saturation ?? 100) === 100 && 
                            (f.hue ?? 0) === 0
                        ) && bakingOverlayId !== ov.id
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md active:scale-95'
                        : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                    title="Permanently bake current color and filter settings into the layer"
                >
                    {bakingOverlayId === ov.id ? (
                        <>
                            <LucideLoader2 size={12} className="animate-spin" />
                            <span>Baking...</span>
                        </>
                    ) : (
                        <span>Apply</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => handleUndoColorFilters(ov.id)}
                    disabled={!filterUndoHistory[ov.id]}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        filterUndoHistory[ov.id]
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 active:scale-95'
                        : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                    }`}
                    title="Undo the last applied filter bake"
                >
                    Undo
                </button>
            </div>
        </CollapsibleSection>
    );
};
