import React from 'react';
import { ProjectOverlay, JitterWaveShape } from '../../../../types';
import { FilterSlider } from '../../../ui/FilterSlider';

interface EdgeJitterOffsetControlsProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, isTemporary?: boolean) => void;
}

export const EdgeJitterOffsetControls: React.FC<EdgeJitterOffsetControlsProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay
}) => {
    const f = ov.filters;

    return (
        <div className="space-y-2 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-500/30">
            <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20">
                <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider">
                    Offset Wave & Angle
                </span>
                <select
                    value={f.edgeJitterWaveShape || 'sine'}
                    onChange={(e) => updateFilter(ov.id, 'edgeJitterWaveShape', e.target.value as JitterWaveShape)}
                    className="bg-black/60 border border-indigo-500/40 rounded px-2 py-0.5 text-[10px] text-indigo-200 font-bold focus:outline-none cursor-pointer"
                >
                    <option value="sine">Sine</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="sawtooth">Sawtooth</option>
                </select>
            </div>

            <FilterSlider
                label="Rotation"
                min={0}
                max={360}
                value={f.edgeJitterRotation ?? 0}
                defaultValue={0}
                unit="°"
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)}
                onChange={(v) => updateFilter(ov.id, 'edgeJitterRotation', v)}
            />

            <FilterSlider
                label="Frequency"
                min={1}
                max={50}
                value={f.edgeJitterFrequency ?? 10}
                defaultValue={10}
                onStartChange={() => onUpdateOverlay(ov.id, {}, true)}
                onChange={(v) => updateFilter(ov.id, 'edgeJitterFrequency', v)}
            />
        </div>
    );
};
