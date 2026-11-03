import React from 'react';
import {
    CavityHeightGeneratorSettings,
    DEFAULT_CAVITY_HEIGHT_SETTINGS,
    MECHANICAL_CAVITY_PRESETS,
} from '../../utils/cavityHeightGeneratorHelper';
import { LucideRotateCcw, LucideSparkles } from 'lucide-react';

interface CavityHeightSlidersPanelProps {
    settings: CavityHeightGeneratorSettings;
    updateSetting: <K extends keyof CavityHeightGeneratorSettings>(
        key: K,
        value: CavityHeightGeneratorSettings[K]
    ) => void;
    applyPreset: (presetSettings: Partial<CavityHeightGeneratorSettings>) => void;
}

export const CavityHeightSlidersPanel: React.FC<CavityHeightSlidersPanelProps> = ({
    settings,
    updateSetting,
    applyPreset,
}) => {
    return (
        <>
            {/* Quick Mechanical Cavity Presets */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
                        <LucideSparkles className="w-3.5 h-3.5" />
                        <span>Mechanical & Cavity Presets</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => applyPreset(DEFAULT_CAVITY_HEIGHT_SETTINGS)}
                        className="flex items-center space-x-1 text-[10px] font-bold uppercase text-slate-400 hover:text-white cursor-pointer"
                        title="Reset all sliders to default"
                    >
                        <LucideRotateCcw className="w-3 h-3" />
                        <span>Reset Defaults</span>
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {MECHANICAL_CAVITY_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset.settings)}
                            className="px-2 py-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-500/50 text-left transition-all cursor-pointer"
                            title={preset.description}
                        >
                            <div className="text-[10px] font-black text-emerald-300 uppercase truncate">
                                {preset.name}
                            </div>
                            <div className="text-[8.5px] text-slate-400 truncate">
                                {preset.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detection Mode Selector */}
            <div className="grid grid-cols-4 gap-1.5 bg-black/40 p-2 rounded-xl border border-slate-800">
                {(
                    [
                        { id: 'hybrid_cavity', label: 'Hybrid Cavity + B/W' },
                        { id: 'binary_solid', label: 'Pure Solid B/W' },
                        { id: 'local_valley', label: 'Panel Seams Only' },
                        { id: 'luminance_levels', label: 'Luminance Clamp' },
                    ] as { id: CavityHeightGeneratorSettings['mode']; label: string }[]
                ).map((m) => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => updateSetting('mode', m.id)}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-tight border transition-all cursor-pointer ${
                            settings.mode === m.id
                                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* 2-Column Advanced Controls Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Left Column: Cavity & Groove Detection + Solid B/W Thresholds */}
                <div className="bg-black/40 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
                        1. Cavity Isolation & Solid B/W Cutoff
                    </div>

                    {/* Black Cavity Cutoff Threshold */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Cavity Cutoff (Black Floor)
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                                {settings.blackThreshold}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="95"
                            step="1"
                            value={settings.blackThreshold}
                            onChange={(e) => updateSetting('blackThreshold', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('blackThreshold', DEFAULT_CAVITY_HEIGHT_SETTINGS.blackThreshold)
                            }
                            title="Double-click to reset. Controls which dark grooves become solid black."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Solid B/W Edge Hardness */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Solid B/W Hardness
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                                {settings.transitionHardness === 100
                                    ? '100% (Pure Binary)'
                                    : `${settings.transitionHardness}%`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={settings.transitionHardness}
                            onChange={(e) => updateSetting('transitionHardness', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting(
                                    'transitionHardness',
                                    DEFAULT_CAVITY_HEIGHT_SETTINGS.transitionHardness
                                )
                            }
                            title="Double-click to reset. 100% forces pure solid black & white with zero grey."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* White Plate Clip */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Solid White Plate Ceiling
                            </span>
                            <span className="font-mono text-emerald-400 font-bold">
                                {settings.whiteClip}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="15"
                            max="100"
                            step="1"
                            value={settings.whiteClip}
                            onChange={(e) => updateSetting('whiteClip', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('whiteClip', DEFAULT_CAVITY_HEIGHT_SETTINGS.whiteClip)
                            }
                            title="Double-click to reset. Flattens upper metal surfaces to pure solid white."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>

                    {/* Local Cavity Sensitivity */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-300 uppercase">
                                Local Cavity Sensitivity
                            </span>
                            <span className="font-mono text-cyan-300">{settings.cavitySensitivity}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="2"
                            value={settings.cavitySensitivity}
                            onChange={(e) => updateSetting('cavitySensitivity', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting(
                                    'cavitySensitivity',
                                    DEFAULT_CAVITY_HEIGHT_SETTINGS.cavitySensitivity
                                )
                            }
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Cavity Search Radius */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-300 uppercase">
                                Cavity / Seam Width Radius
                            </span>
                            <span className="font-mono text-cyan-300">{settings.cavityRadius}px</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="16"
                            step="1"
                            value={settings.cavityRadius}
                            onChange={(e) => updateSetting('cavityRadius', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('cavityRadius', DEFAULT_CAVITY_HEIGHT_SETTINGS.cavityRadius)
                            }
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Dark Seam Crease Weight */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-300 uppercase">
                                Fine Seam / Groove Boost
                            </span>
                            <span className="font-mono text-cyan-300">{settings.seamEdgeWeight}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="2"
                            value={settings.seamEdgeWeight}
                            onChange={(e) => updateSetting('seamEdgeWeight', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('seamEdgeWeight', DEFAULT_CAVITY_HEIGHT_SETTINGS.seamEdgeWeight)
                            }
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>

                {/* Right Column: Morphological Cavity Shaping, Despeckle & Bevel */}
                <div className="bg-black/40 border border-slate-800 rounded-xl p-3 space-y-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 border-b border-slate-800 pb-1">
                        2. Cavity Shaping, Clean-Up & Bevel
                    </div>

                    {/* Widen / Narrow Black Cavities */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Cavity Expand / Choke
                            </span>
                            <span className="font-mono text-amber-300 font-bold">
                                {settings.cavityWidthOffset > 0
                                    ? `+${settings.cavityWidthOffset}px (Wider)`
                                    : settings.cavityWidthOffset < 0
                                    ? `${settings.cavityWidthOffset}px (Thinner)`
                                    : '0px'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-4"
                            max="4"
                            step="1"
                            value={settings.cavityWidthOffset}
                            onChange={(e) => updateSetting('cavityWidthOffset', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting(
                                    'cavityWidthOffset',
                                    DEFAULT_CAVITY_HEIGHT_SETTINGS.cavityWidthOffset
                                )
                            }
                            title="Double-click to reset. Positive widens black cavities; negative narrows them."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>

                    {/* Plate Surface Despeckle (Remove tiny rust/dirt dots on flat plates) */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Clean Surface Grit (Despeckle)
                            </span>
                            <span className="font-mono text-amber-300 font-bold">
                                {settings.despeckle === 0 ? 'Off' : `${settings.despeckle}x Pass`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="4"
                            step="1"
                            value={settings.despeckle}
                            onChange={(e) => updateSetting('despeckle', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('despeckle', DEFAULT_CAVITY_HEIGHT_SETTINGS.despeckle)
                            }
                            title="Double-click to reset. Removes small dark specks on metal plates so only real cavities stay black."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>

                    {/* Post-Threshold Wall Bevel Blur */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-200 uppercase">
                                Cavity Edge Bevel (Wall Slope)
                            </span>
                            <span className="font-mono text-amber-300 font-bold">
                                {settings.bevelBlur === 0 ? '0px (Sharp B/W)' : `${settings.bevelBlur}px`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="8"
                            step="0.5"
                            value={settings.bevelBlur}
                            onChange={(e) => updateSetting('bevelBlur', parseFloat(e.target.value))}
                            onDoubleClick={() =>
                                updateSetting('bevelBlur', DEFAULT_CAVITY_HEIGHT_SETTINGS.bevelBlur)
                            }
                            title="Double-click to reset. 0 = pure razor-sharp black & white; >0 = smooth beveled cavity walls."
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>

                    {/* Contrast & Brightness */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9.5px]">
                                <span className="font-bold text-slate-300 uppercase">Pre-Contrast</span>
                                <span className="font-mono text-slate-200">{settings.contrast}%</span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="300"
                                step="5"
                                value={settings.contrast}
                                onChange={(e) => updateSetting('contrast', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSetting('contrast', DEFAULT_CAVITY_HEIGHT_SETTINGS.contrast)
                                }
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9.5px]">
                                <span className="font-bold text-slate-300 uppercase">Bias / Lift</span>
                                <span className="font-mono text-slate-200">
                                    {settings.brightness > 0 ? `+${settings.brightness}` : settings.brightness}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-80"
                                max="80"
                                step="2"
                                value={settings.brightness}
                                onChange={(e) => updateSetting('brightness', parseInt(e.target.value, 10))}
                                onDoubleClick={() =>
                                    updateSetting('brightness', DEFAULT_CAVITY_HEIGHT_SETTINGS.brightness)
                                }
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                            />
                        </div>
                    </div>

                    {/* Stepped Mechanical Tiers */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                            <span className="font-bold text-slate-300 uppercase">
                                Stepped Depth Tiers
                            </span>
                            <span className="font-mono text-purple-300">
                                {settings.terracingSteps === 0
                                    ? 'Off'
                                    : `${settings.terracingSteps} Levels`}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="8"
                            step="1"
                            value={settings.terracingSteps}
                            onChange={(e) => updateSetting('terracingSteps', parseInt(e.target.value, 10))}
                            onDoubleClick={() =>
                                updateSetting('terracingSteps', DEFAULT_CAVITY_HEIGHT_SETTINGS.terracingSteps)
                            }
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    {/* Invert & Normal Sync Checkboxes */}
                    <div className="pt-1 space-y-1.5 border-t border-slate-800/80">
                        <label className="flex items-center space-x-2 cursor-pointer text-[10px] font-bold uppercase text-slate-300">
                            <input
                                type="checkbox"
                                checked={settings.invert}
                                onChange={(e) => updateSetting('invert', e.target.checked)}
                                className="rounded accent-emerald-500 cursor-pointer"
                            />
                            <span>Invert (Make Cavities White / Plates Black)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer text-[10px] font-bold uppercase text-blue-300">
                            <input
                                type="checkbox"
                                checked={settings.syncNormalMap}
                                onChange={(e) => updateSetting('syncNormalMap', e.target.checked)}
                                className="rounded accent-blue-500 cursor-pointer"
                            />
                            <span>Also Sync Normal Map from Cavity Edges</span>
                        </label>
                    </div>
                </div>
            </div>
        </>
    );
};
