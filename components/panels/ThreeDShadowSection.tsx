import React, { useState } from 'react';
import type { ThreeDObject, ThreeDShadowSettings, ProjectOverlay } from '../../types';
import { DEFAULT_SHADOW_SETTINGS } from '../../utils/threeDShadowHelper';
import { getLinkedGroups } from '../../utils/layerLinkUtils';
import { LucideSun, LucideChevronDown, LucideChevronRight, LucideRotateCcw } from 'lucide-react';

interface ThreeDShadowSectionProps {
    object: ThreeDObject;
    overlays: ProjectOverlay[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>) => void;
}

export const ThreeDShadowSection: React.FC<ThreeDShadowSectionProps> = ({
    object,
    overlays,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const shadow: ThreeDShadowSettings = object.shadowSettings || DEFAULT_SHADOW_SETTINGS;
    const isEnabled = shadow.enabled !== false;
    const linkedGroups = getLinkedGroups(overlays);

    const updateShadow = (updates: Partial<ThreeDShadowSettings>) => {
        onUpdateObject(object.id, {
            shadowSettings: {
                ...shadow,
                ...updates,
            },
        });
    };

    const handleReset = () => {
        onUpdateObject(object.id, {
            shadowSettings: {
                ...DEFAULT_SHADOW_SETTINGS,
                targetLayerId: shadow.targetLayerId,
            },
        });
    };

    const transformRows: {
        label: string;
        key: keyof ThreeDShadowSettings;
        min: number;
        max: number;
        step: number;
        defaultVal: number;
    }[] = [
        { label: 'Height (Y)', key: 'offsetY', min: -100, max: 100, step: 0.5, defaultVal: 0 },
        { label: 'Offset X', key: 'offsetX', min: -100, max: 100, step: 0.5, defaultVal: 0 },
        { label: 'Offset Z', key: 'offsetZ', min: -100, max: 100, step: 0.5, defaultVal: 0 },
        { label: 'Tilt X (°)', key: 'rotationX', min: -90, max: 90, step: 1, defaultVal: 0 },
        { label: 'Tilt Z (°)', key: 'rotationZ', min: -90, max: 90, step: 1, defaultVal: 0 },
        { label: 'Scale', key: 'scale', min: 0.2, max: 5, step: 0.1, defaultVal: 1 },
    ];

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            {/* Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    <LucideSun className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                        3D Shadow Settings
                    </span>
                </div>
                <div className="flex items-center space-x-2.5" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => updateShadow({ enabled: e.target.checked })}
                            className="w-4 h-4 rounded bg-black/60 border border-slate-600 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                        />
                        <span className="text-[11px] text-slate-200 font-bold uppercase">
                            Cast
                        </span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-slate-400 hover:text-white"
                    >
                        {isExpanded ? (
                            <LucideChevronDown className="w-4 h-4" />
                        ) : (
                            <LucideChevronRight className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3.5">
                    {!isEnabled ? (
                        <div className="text-xs text-slate-400 text-center py-2 italic">
                            Shadow casting is disabled for this object.
                        </div>
                    ) : (
                        <>
                            {/* Target Layer */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] uppercase text-slate-300 font-bold">
                                        Target Layer
                                    </label>
                                    <span className="text-amber-400 text-[10px] font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                                        {shadow.targetLayerId === 'ground' || !shadow.targetLayerId
                                            ? 'Ground Plane'
                                            : linkedGroups.find((g) => g.id === shadow.targetLayerId)?.name ||
                                              overlays.find((o) => o.id === shadow.targetLayerId)?.name ||
                                              'Custom Layer'}
                                    </span>
                                </div>
                                <select
                                    value={shadow.targetLayerId || 'ground'}
                                    onChange={(e) => updateShadow({ targetLayerId: e.target.value })}
                                    className="w-full bg-[#161b22] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                                >
                                    <option value="ground">Ground Plane (y = 0)</option>
                                    {linkedGroups.length > 0 && (
                                        <optgroup label="Linked Layers">
                                            {linkedGroups.map((lg) => (
                                                <option key={lg.id} value={lg.id}>
                                                    🔗 {lg.name} ({lg.layers.length} layers)
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Individual Layers">
                                        {overlays.map((ov, index) => (
                                            <option key={ov.id} value={ov.id}>
                                                {ov.name || `Layer ${index + 1}`} ({ov.placement || 'layer'})
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Opacity and Blur */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                                    <div className="flex justify-between items-center text-[11px] font-bold uppercase">
                                        <span className="text-slate-300">Opacity</span>
                                        <span className="text-amber-400 font-mono">
                                            {Math.round((shadow.opacity ?? 0.5) * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={shadow.opacity ?? 0.5}
                                        onChange={(e) => updateShadow({ opacity: parseFloat(e.target.value) })}
                                        onDoubleClick={() =>
                                            updateShadow({ opacity: DEFAULT_SHADOW_SETTINGS.opacity })
                                        }
                                        title={`Double-click to reset to ${DEFAULT_SHADOW_SETTINGS.opacity}`}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>
                                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                                    <div className="flex justify-between items-center text-[11px] font-bold uppercase">
                                        <span className="text-slate-300">Soft Blur</span>
                                        <span className="text-amber-400 font-mono">
                                            {(shadow.blur ?? 2).toFixed(1)}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={shadow.blur ?? 2}
                                        onChange={(e) => updateShadow({ blur: parseFloat(e.target.value) })}
                                        onDoubleClick={() =>
                                            updateShadow({ blur: DEFAULT_SHADOW_SETTINGS.blur })
                                        }
                                        title={`Double-click to reset to ${DEFAULT_SHADOW_SETTINGS.blur}`}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Shadow Transform & Offset */}
                            <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] uppercase font-extrabold text-slate-300 tracking-wider">
                                        Shadow Transform & Offset
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors"
                                        title="Reset shadow transforms to default"
                                    >
                                        <LucideRotateCcw className="w-3 h-3" />
                                        <span>Reset</span>
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {transformRows.map((row) => {
                                        const val = (shadow[row.key] as number | undefined) ?? row.defaultVal;
                                        return (
                                            <div key={row.key} className="flex items-center space-x-2.5">
                                                <span className="text-[11px] text-slate-300 w-20 uppercase font-bold truncate">
                                                    {row.label}
                                                </span>
                                                <input
                                                    type="range"
                                                    min={row.min}
                                                    max={row.max}
                                                    step={row.step}
                                                    value={val}
                                                    onChange={(e) =>
                                                        updateShadow({ [row.key]: parseFloat(e.target.value) })
                                                    }
                                                    onDoubleClick={() =>
                                                        updateShadow({ [row.key]: row.defaultVal })
                                                    }
                                                    title={`Double-click to reset to ${row.defaultVal}`}
                                                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <input
                                                    type="number"
                                                    step={row.step}
                                                    value={Number(val.toFixed(2))}
                                                    onChange={(e) =>
                                                        updateShadow({
                                                            [row.key]: parseFloat(e.target.value) || row.defaultVal,
                                                        })
                                                    }
                                                    className="w-16 bg-black/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 px-2 py-1 text-right focus:outline-none focus:border-amber-500"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
