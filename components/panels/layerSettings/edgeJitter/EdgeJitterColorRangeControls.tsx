import React from 'react';
import { ProjectOverlay, RgbaColor } from '../../../../types';
import { FilterSlider } from '../../../ui/FilterSlider';
import { Lasso, Pipette, X, Trash2 } from 'lucide-react';
import { rgbToHex } from '../../../../utils/colorUtils';

interface EdgeJitterColorRangeControlsProps {
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

export const EdgeJitterColorRangeControls: React.FC<EdgeJitterColorRangeControlsProps> = ({
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
    const isColorRangeOnly = Boolean(f.edgeJitterColorRangeOnly);
    const colors = f.edgeJitterColors || [];

    const isLassoActive = activeLassoId === ov.id && activeInjectionTarget === 'edgeJitterColorRange';
    const isEyedropperActive = activeInjectionEyedropperId === ov.id && activeInjectionTarget === 'edgeJitterColorRange';

    const handleToggleLasso = () => {
        if (!setActiveLassoId || !setActiveInjectionTarget) return;
        if (isLassoActive) {
            setActiveLassoId(null);
            setActiveInjectionTarget('mask');
        } else {
            setActiveInjectionEyedropperId?.(null);
            setActiveInjectionTarget('edgeJitterColorRange');
            setActiveLassoId(ov.id);
        }
    };

    const handleToggleEyedropper = () => {
        if (!setActiveInjectionEyedropperId || !setActiveInjectionTarget) return;
        if (isEyedropperActive) {
            setActiveInjectionEyedropperId(null);
            setActiveInjectionTarget('mask');
        } else {
            setActiveLassoId?.(null);
            setActiveInjectionTarget('edgeJitterColorRange');
            setActiveInjectionEyedropperId(ov.id);
        }
    };

    const handleRemoveColor = (indexToRemove: number) => {
        const nextColors = colors.filter((_, idx) => idx !== indexToRemove);
        updateFilter(ov.id, 'edgeJitterColors', nextColors);
    };

    const handleClearAllColors = () => {
        updateFilter(ov.id, 'edgeJitterColors', []);
    };

    return (
        <div className="space-y-2.5 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/30">
            {/* Checkbox: Color range only */}
            <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isColorRangeOnly}
                        onChange={(e) => updateFilter(ov.id, 'edgeJitterColorRangeOnly', e.target.checked)}
                        className="rounded bg-black/60 border-purple-500/40 text-purple-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="text-[10px] text-purple-200 uppercase font-black tracking-wider">
                        Color Range Only
                    </span>
                </label>

                {isColorRangeOnly && (
                    <div className="flex items-center space-x-1">
                        <button
                            type="button"
                            onClick={handleToggleLasso}
                            className={`p-1 rounded-lg border transition-all flex items-center space-x-1 text-[10px] font-bold ${
                                isLassoActive
                                    ? 'bg-purple-600 border-purple-400 text-white shadow-md animate-pulse'
                                    : 'bg-slate-800/80 border-slate-700 text-purple-300 hover:text-white hover:bg-slate-700'
                            }`}
                            title="Draw a lasso around colors on the canvas to add to jitter range"
                        >
                            <Lasso className="w-3 h-3" />
                            <span>Lasso</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleEyedropper}
                            className={`p-1 rounded-lg border transition-all flex items-center space-x-1 text-[10px] font-bold ${
                                isEyedropperActive
                                    ? 'bg-purple-600 border-purple-400 text-white shadow-md animate-pulse'
                                    : 'bg-slate-800/80 border-slate-700 text-purple-300 hover:text-white hover:bg-slate-700'
                            }`}
                            title="Click a color on the canvas to add to jitter range"
                        >
                            <Pipette className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

            {isColorRangeOnly && (
                <div className="space-y-2 pt-1 border-t border-purple-500/20">
                    {/* Picked Colors Swatches */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] text-purple-300/80 uppercase font-bold">
                                Picked Colors ({colors.length})
                            </span>
                            {colors.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearAllColors}
                                    className="text-[9px] text-red-400 hover:text-red-300 flex items-center space-x-0.5"
                                    title="Clear all selected colors"
                                >
                                    <Trash2 size={10} />
                                    <span>Clear</span>
                                </button>
                            )}
                        </div>

                        {colors.length === 0 ? (
                            <div className="text-[10px] text-slate-400 italic bg-black/30 p-2 rounded-lg border border-slate-800/80 text-center">
                                Use the Lasso or Pipette tool to pick colors from canvas
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-black/40 rounded-lg border border-slate-800">
                                {colors.map((c, idx) => {
                                    const hex = rgbToHex(c);
                                    return (
                                        <button
                                            key={`${c.r}-${c.g}-${c.b}-${idx}`}
                                            type="button"
                                            onClick={() => handleRemoveColor(idx)}
                                            className="group relative flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-red-500 transition-all cursor-pointer"
                                            title={`Click to remove rgb(${c.r},${c.g},${c.b})`}
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full border border-white/30 shadow-inner"
                                                style={{ backgroundColor: hex }}
                                            />
                                            <span className="text-[9px] font-mono text-slate-300">
                                                {hex}
                                            </span>
                                            <X size={10} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <FilterSlider
                        label="Color Tolerance"
                        min={1}
                        max={60}
                        value={f.edgeJitterColorTolerance ?? 20}
                        defaultValue={20}
                        onStartChange={() => onUpdateOverlay(ov.id, {}, true)}
                        onChange={(v) => updateFilter(ov.id, 'edgeJitterColorTolerance', v)}
                    />
                </div>
            )}
        </div>
    );
};
