import React from 'react';
import { ProjectOverlay, TileType } from '../../../types';
import { CollapsibleSection } from './CollapsibleSection';
import { FilterSlider } from '../../ui/FilterSlider';

interface TransformSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
}

export const TransformSection: React.FC<TransformSectionProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay
}) => {
    const f = ov.filters;

    return (
        <CollapsibleSection title="Transform" titleColorClass="text-emerald-400" defaultExpanded={false}>
            {ov.type === 'tiled' && (
                <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tile Style</label>
                    <select 
                        value={f.tileType} 
                        onChange={(e) => updateFilter(ov.id, 'tileType', e.target.value as TileType)}
                        className="w-full bg-black/60 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                    >
                        <option value="flat">Standard Flat</option>
                        <option value="slope_se">Slope (South-East)</option>
                        <option value="slope_sw">Slope (South-West)</option>
                    </select>
                </div>
            )}
            <div className="flex items-center space-x-2">
                <button 
                    type="button"
                    onClick={() => updateFilter(ov.id, 'flipH', !f.flipH)} 
                    className={`flex-1 text-xs font-black py-1.5 rounded-lg border transition-all ${
                        f.flipH ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Flip X
                </button>
                <button 
                    type="button"
                    onClick={() => updateFilter(ov.id, 'flipV', !f.flipV)} 
                    className={`flex-1 text-xs font-black py-1.5 rounded-lg border transition-all ${
                        f.flipV ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Flip Y
                </button>
            </div>
            <FilterSlider label="Rotation" min={0} max={360} value={f.rotation} defaultValue={0} onStartChange={() => onUpdateOverlay(ov.id, {}, true)} onChange={v => updateFilter(ov.id, 'rotation', v)} />
        </CollapsibleSection>
    );
};

