import React from 'react';
import type { ThreeDSlopeShapingSettings } from '../../../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../../utils/threeDSlopePresets';
import { LucideDroplets, LucideSparkles } from 'lucide-react';

interface ThreeDSlopeDipsDarkSpotsSubpanelProps {
    slope: ThreeDSlopeShapingSettings;
    updateSlope: <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    onStartHistory: () => void;
}

export const ThreeDSlopeDipsDarkSpotsSubpanel: React.FC<ThreeDSlopeDipsDarkSpotsSubpanelProps> = ({
    slope,
    updateSlope,
    onStartHistory,
}) => {
    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/25 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                    <LucideDroplets className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                        3. Darker Spots &amp; Dip Shading (No Mesh Deform)
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => updateSlope('darkSpotsEnabled', !slope.darkSpotsEnabled, true)}
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        slope.darkSpotsEnabled
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                >
                    {slope.darkSpotsEnabled ? 'Dark Spots ON' : 'OFF'}
                </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
                Adds organic darker soil/moisture patches across the slope in the shader without moving vertices.
            </p>

            {slope.darkSpotsEnabled && (
                <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Dark Spot Strength</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {slope.spotIntensity}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={slope.spotIntensity}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('spotIntensity', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSlope('spotIntensity', DEFAULT_SLOPE_SHAPING_SETTINGS.spotIntensity, true)
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Spot Coverage</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {slope.spotCoverage}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={slope.spotCoverage}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('spotCoverage', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSlope('spotCoverage', DEFAULT_SLOPE_SHAPING_SETTINGS.spotCoverage, true)
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Spot Scale / Size</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {slope.spotScale.toFixed(1)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="16"
                                step="0.2"
                                value={slope.spotScale}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('spotScale', parseFloat(e.target.value))}
                                onDoubleClick={() =>
                                    updateSlope('spotScale', DEFAULT_SLOPE_SHAPING_SETTINGS.spotScale, true)
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Patch Contrast</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {slope.spotContrast}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={slope.spotContrast}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('spotContrast', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSlope('spotContrast', DEFAULT_SLOPE_SHAPING_SETTINGS.spotContrast, true)
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                            <span title="Automatically darkens carved dips, concave hollows, and gullies if mesh displacement is used">
                                Auto-Darken Recessed Dips
                            </span>
                            <span className="text-amber-300 font-mono tabular-nums">
                                {slope.dipDarkening}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={slope.dipDarkening}
                            onMouseDown={onStartHistory}
                            onChange={(e) => updateSlope('dipDarkening', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSlope('dipDarkening', DEFAULT_SLOPE_SHAPING_SETTINGS.dipDarkening, true)
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center pt-1">
                        <div className="flex items-center justify-between bg-slate-900/80 px-2 py-1.5 rounded border border-slate-700/70">
                            <span className="text-[10px] font-bold uppercase text-slate-300">Spot Tint</span>
                            <input
                                type="color"
                                value={slope.spotTint || '#1f1914'}
                                onChange={(e) => updateSlope('spotTint', e.target.value, true)}
                                className="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
                                title="Color tint of darker spots and recessed dips"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span title="Positive = damp/glossy hollows; Negative = dry/matte soil">
                                    Damp / Dry
                                </span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {slope.spotWetness > 0 ? `+${slope.spotWetness}%` : `${slope.spotWetness}%`}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                step="2"
                                value={slope.spotWetness}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('spotWetness', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSlope('spotWetness', DEFAULT_SLOPE_SHAPING_SETTINGS.spotWetness, true)
                                }
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                            Seed: <span className="text-amber-300 font-mono">{slope.slopeSeed}</span>
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                updateSlope('slopeSeed', Math.floor(100 + Math.random() * 9000), true)
                            }
                            className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-bold uppercase cursor-pointer"
                        >
                            <LucideSparkles className="w-3 h-3" />
                            <span>Randomize Pattern</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
