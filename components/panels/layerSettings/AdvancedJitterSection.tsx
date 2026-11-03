import React from 'react';
import { ProjectOverlay, JitterType, JitterWaveShape, JitterShape } from '../../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FilterSlider } from '../../ui/FilterSlider';
import { EdgeJitterControls } from './EdgeJitterControls';
import { LucideLoader2 } from 'lucide-react';

interface AdvancedJitterSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
    setShowDrawModal: (id: string) => void;
    activeLassoId?: string | null;
    setActiveLassoId?: (id: string | null) => void;
    activeInjectionEyedropperId?: string | null;
    setActiveInjectionEyedropperId?: (id: string | null) => void;
    activeInjectionTarget?: string;
    setActiveInjectionTarget?: (target: string) => void;
    handleApplyJitter?: (ov: ProjectOverlay) => void;
    handleUndoJitter?: (id: string) => void;
    bakingOverlayId?: string | null;
    jitterUndoHistory?: Record<string, any>;
}

export const AdvancedJitterSection: React.FC<AdvancedJitterSectionProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    setShowDrawModal,
    activeLassoId,
    setActiveLassoId,
    activeInjectionEyedropperId,
    setActiveInjectionEyedropperId,
    activeInjectionTarget,
    setActiveInjectionTarget,
    handleApplyJitter,
    handleUndoJitter,
    bakingOverlayId,
    jitterUndoHistory
}) => {
    const f = ov.filters;
    const isBaking = bakingOverlayId === ov.id;
    const hasActiveJitter = f.jitterType !== 'none' || Boolean(f.edgeJitterOnly) || (f.pixelNoise ?? 0) > 0 || ((f.edgeJitterAmount ?? 0) > 0);
    const canUndo = Boolean(jitterUndoHistory && jitterUndoHistory[ov.id]);

    return (
        <CollapsibleSection title="Advanced Jitter" titleColorClass="text-indigo-400" defaultExpanded={false}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-300 font-bold uppercase">Jitter Type</span>
                <select 
                    value={f.jitterType} 
                    onChange={(e) => updateFilter(ov.id, 'jitterType', e.target.value as JitterType)}
                    className="bg-black/60 border border-slate-700 rounded-lg px-2 py-1 text-xs text-indigo-300 font-bold focus:outline-none cursor-pointer"
                >
                    <option value="none">None</option>
                    <option value="edge">Edge</option>
                    <option value="noise">Noise</option>
                    <option value="pixel">Pixel</option>
                    <option value="stamp">Stamp</option>
                    <option value="offset">Offset</option>
                </select>
            </div>

            {f.jitterType === 'edge' && (
                <div className="pt-2 border-t border-slate-800/80">
                    <EdgeJitterControls 
                        ov={ov} 
                        updateFilter={updateFilter} 
                        onUpdateOverlay={onUpdateOverlay}
                        activeLassoId={activeLassoId}
                        setActiveLassoId={setActiveLassoId}
                        activeInjectionEyedropperId={activeInjectionEyedropperId}
                        setActiveInjectionEyedropperId={setActiveInjectionEyedropperId}
                        activeInjectionTarget={activeInjectionTarget}
                        setActiveInjectionTarget={setActiveInjectionTarget}
                    />
                </div>
            )}

            {f.jitterType !== 'none' && f.jitterType !== 'edge' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    <FilterSlider label="Strength" min={0} max={100} value={f.pixelNoise} defaultValue={0} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'pixelNoise', v)} />
                    <FilterSlider label="Size" min={1} max={100} value={f.jitterSize} defaultValue={10} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterSize', v)} />
                    
                    {/* Edge Only Toggle */}
                    <div className="flex items-center justify-between bg-black/30 p-1.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-300 font-bold uppercase">Edges Only</span>
                        <button
                            type="button"
                            onClick={() => updateFilter(ov.id, 'edgeJitterOnly', !f.edgeJitterOnly)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                                f.edgeJitterOnly ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                        >
                            {f.edgeJitterOnly ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {f.edgeJitterOnly && (
                        <FilterSlider 
                            label="Thickness" 
                            min={1} 
                            max={50} 
                            value={f.edgeJitterThickness ?? 6} 
                            defaultValue={6} 
                            onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                            onChange={v => updateFilter(ov.id, 'edgeJitterThickness', v)} 
                        />
                    )}

                    {f.jitterType === 'offset' && (
                        <div className="space-y-2 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-indigo-300 uppercase font-bold">Wave Shape</span>
                                <select 
                                    value={f.jitterWaveShape} 
                                    onChange={(e) => updateFilter(ov.id, 'jitterWaveShape', e.target.value as JitterWaveShape)}
                                    className="bg-black/60 border border-slate-700 rounded-lg px-2 py-1 text-xs text-indigo-300 font-bold"
                                >
                                    <option value="sine">Sine</option>
                                    <option value="square">Square</option>
                                    <option value="triangle">Triangle</option>
                                    <option value="sawtooth">Sawtooth</option>
                                </select>
                            </div>
                            <FilterSlider label="Offset Rot" min={0} max={360} value={f.jitterRotation} defaultValue={0} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterRotation', v)} />
                            <FilterSlider label="Width" min={1} max={100} value={f.jitterWidth} defaultValue={10} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterWidth', v)} />
                            <FilterSlider label="Zoom" min={1} max={500} value={f.jitterZoom} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterZoom', v)} />
                        </div>
                    )}

                    {f.jitterType === 'stamp' && (
                        <div className="space-y-2 p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-indigo-300 uppercase font-bold">Shape</span>
                                <div className="flex space-x-1">
                                    {(['circle', 'square', 'draw'] as JitterShape[]).map(sh => (
                                        <button 
                                            key={sh} 
                                            onClick={() => { updateFilter(ov.id, 'jitterShape', sh); if (sh === 'draw') setShowDrawModal(ov.id); }} 
                                            className={`px-2 py-1 rounded text-[10px] font-black uppercase ${f.jitterShape === sh ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                        >
                                            {sh}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <FilterSlider label="Count" min={1} max={200} value={f.jitterCount} defaultValue={10} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterCount', v)} />
                            <FilterSlider label="Opacity" min={0} max={100} value={f.jitterOpacity} defaultValue={100} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'jitterOpacity', v)} />
                        </div>
                    )}
                </div>
            )}

            {/* Apply and Undo Actions */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80 mt-2">
                <button
                    type="button"
                    onClick={() => handleApplyJitter && handleApplyJitter(ov)}
                    disabled={!hasActiveJitter || isBaking || !handleApplyJitter}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        hasActiveJitter && !isBaking && handleApplyJitter
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95 cursor-pointer'
                        : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                    title="Apply jitter to the image and reset settings"
                >
                    {isBaking ? (
                        <>
                            <LucideLoader2 size={12} className="animate-spin" />
                            <span>Applying...</span>
                        </>
                    ) : (
                        <span>Apply</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => handleUndoJitter && handleUndoJitter(ov.id)}
                    disabled={!canUndo || !handleUndoJitter}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                        canUndo && handleUndoJitter
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 active:scale-95 cursor-pointer'
                        : 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                    }`}
                    title="Undo applied jitter"
                >
                    Undo
                </button>
            </div>
        </CollapsibleSection>
    );
};
