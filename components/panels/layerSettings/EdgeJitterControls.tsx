import React from 'react';
import { ProjectOverlay } from '../../../types';
import { FilterSlider } from '../../ui/FilterSlider';
import { EdgeJitterOffsetControls } from './edgeJitter/EdgeJitterOffsetControls';
import { EdgeJitterColorRangeControls } from './edgeJitter/EdgeJitterColorRangeControls';

interface EdgeJitterControlsProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
    activeLassoId?: string | null;
    setActiveLassoId?: (id: string | null) => void;
    activeInjectionEyedropperId?: string | null;
    setActiveInjectionEyedropperId?: (id: string | null) => void;
    activeInjectionTarget?: string;
    setActiveInjectionTarget?: (target: string) => void;
}

export const EdgeJitterControls: React.FC<EdgeJitterControlsProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    activeLassoId,
    setActiveLassoId,
    activeInjectionEyedropperId,
    setActiveInjectionEyedropperId,
    activeInjectionTarget,
    setActiveInjectionTarget
}) => {
    const f = ov.filters;
    const currentMode = f.edgeJitterMode || 'pixel';

    return (
        <div className="space-y-2.5 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
            <FilterSlider 
                label="Amount" 
                min={0} 
                max={100} 
                value={f.edgeJitterAmount ?? 25} 
                defaultValue={25} 
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                onChange={v => updateFilter(ov.id, 'edgeJitterAmount', v)} 
            />
            
            <FilterSlider 
                label="Thickness" 
                min={1} 
                max={50} 
                value={f.edgeJitterThickness ?? 6} 
                defaultValue={6} 
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                onChange={v => updateFilter(ov.id, 'edgeJitterThickness', v)} 
            />

            {/* Mode selection */}
            <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-indigo-300 uppercase font-bold">Mode</span>
                <div className="flex space-x-1">
                    {(['pixel', 'noise', 'rough', 'offset'] as const).map(mode => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => updateFilter(ov.id, 'edgeJitterMode', mode)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                                currentMode === mode 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* Additional Options for Offset Mode */}
            {currentMode === 'offset' && (
                <EdgeJitterOffsetControls
                    ov={ov}
                    updateFilter={updateFilter}
                    onUpdateOverlay={onUpdateOverlay}
                />
            )}

            {/* Target selection */}
            <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-indigo-300 uppercase font-bold">Target</span>
                <div className="flex space-x-1">
                    <button
                        type="button"
                        onClick={() => updateFilter(ov.id, 'edgeJitterTarget', 'outer')}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                            (f.edgeJitterTarget || 'outer') === 'outer' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Outer Boundary
                    </button>
                    <button
                        type="button"
                        onClick={() => updateFilter(ov.id, 'edgeJitterTarget', 'all')}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                            f.edgeJitterTarget === 'all' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        All Edges
                    </button>
                </div>
            </div>

            <FilterSlider 
                label="Grain Size" 
                min={1} 
                max={30} 
                value={f.edgeJitterSize ?? 3} 
                defaultValue={3} 
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                onChange={v => updateFilter(ov.id, 'edgeJitterSize', v)} 
            />

            {/* Smoothening Slider */}
            <FilterSlider 
                label="Smoothening" 
                min={0} 
                max={100} 
                value={f.edgeJitterSmoothing ?? 0} 
                defaultValue={0} 
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)} 
                onChange={v => updateFilter(ov.id, 'edgeJitterSmoothing', v)} 
            />

            {/* Color Range Only Section */}
            <EdgeJitterColorRangeControls
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
    );
};
