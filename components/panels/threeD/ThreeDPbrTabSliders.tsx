import React from 'react';
import {
    PbrGeneratorSettings,
    DEFAULT_PBR_GENERATOR_SETTINGS,
} from '../../../utils/threeDPbrGeneratorHelper';
import { LucideMountain } from 'lucide-react';

export type PbrMapTab = 'normal' | 'roughness' | 'metallic' | 'displacement';

interface ThreeDPbrTabSlidersProps {
    activeTab: PbrMapTab;
    settings: PbrGeneratorSettings;
    updateSetting: <K extends keyof PbrGeneratorSettings>(
        key: K,
        value: PbrGeneratorSettings[K],
        applyTo3D?: boolean
    ) => void;
    onApplySingleMap: (tab: PbrMapTab) => void;
    onOpenCavityWindow?: () => void;
}

export const ThreeDPbrTabSliders: React.FC<ThreeDPbrTabSlidersProps> = ({
    activeTab,
    settings,
    updateSetting,
    onApplySingleMap,
    onOpenCavityWindow,
}) => {
    if (activeTab === 'normal') {
        return (
            <div className="space-y-2.5 bg-blue-950/15 border border-blue-500/20 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-blue-300 tracking-wider">
                        Normal Map Sliders
                    </span>
                    <button
                        type="button"
                        onClick={() => onApplySingleMap('normal')}
                        className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold uppercase cursor-pointer"
                    >
                        Apply Normal
                    </button>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Bump Strength</span>
                        <span className="text-blue-300 font-mono">{settings.normalStrength.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0.2"
                        max="16"
                        step="0.2"
                        value={settings.normalStrength}
                        onChange={(e) => updateSetting('normalStrength', parseFloat(e.target.value), true)}
                        onDoubleClick={() =>
                            updateSetting('normalStrength', DEFAULT_PBR_GENERATOR_SETTINGS.normalStrength, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.normalStrength}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Fine Micro-Detail Boost</span>
                        <span className="text-blue-300 font-mono">{settings.normalDetailBoost}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={settings.normalDetailBoost}
                        onChange={(e) => updateSetting('normalDetailBoost', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting(
                                'normalDetailBoost',
                                DEFAULT_PBR_GENERATOR_SETTINGS.normalDetailBoost,
                                true
                            )
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.normalDetailBoost}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Surface Smoothing (Blur)</span>
                        <span className="text-blue-300 font-mono">{settings.normalBlur.toFixed(1)}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={settings.normalBlur}
                        onChange={(e) => updateSetting('normalBlur', parseFloat(e.target.value), true)}
                        onDoubleClick={() =>
                            updateSetting('normalBlur', DEFAULT_PBR_GENERATOR_SETTINGS.normalBlur, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.normalBlur}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div className="flex items-center space-x-3 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-300 font-bold uppercase">
                        <input
                            type="checkbox"
                            checked={settings.normalInvertX}
                            onChange={(e) => updateSetting('normalInvertX', e.target.checked, true)}
                            className="rounded accent-blue-500"
                        />
                        <span>Invert X (R)</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-300 font-bold uppercase">
                        <input
                            type="checkbox"
                            checked={settings.normalInvertY}
                            onChange={(e) => updateSetting('normalInvertY', e.target.checked, true)}
                            className="rounded accent-blue-500"
                        />
                        <span>Invert Y (G)</span>
                    </label>
                </div>
            </div>
        );
    }

    if (activeTab === 'roughness') {
        return (
            <div className="space-y-2.5 bg-amber-950/15 border border-amber-500/20 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider">
                        Roughness Map Sliders
                    </span>
                    <button
                        type="button"
                        onClick={() => onApplySingleMap('roughness')}
                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold uppercase cursor-pointer"
                    >
                        Apply Roughness
                    </button>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Base Roughness Offset</span>
                        <span className="text-amber-300 font-mono">
                            {settings.roughnessBase > 0 ? `+${settings.roughnessBase}` : settings.roughnessBase}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-100"
                        max="100"
                        step="2"
                        value={settings.roughnessBase}
                        onChange={(e) => updateSetting('roughnessBase', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting('roughnessBase', DEFAULT_PBR_GENERATOR_SETTINGS.roughnessBase, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.roughnessBase}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Roughness Contrast</span>
                        <span className="text-amber-300 font-mono">{settings.roughnessContrast}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="300"
                        step="5"
                        value={settings.roughnessContrast}
                        onChange={(e) => updateSetting('roughnessContrast', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting(
                                'roughnessContrast',
                                DEFAULT_PBR_GENERATOR_SETTINGS.roughnessContrast,
                                true
                            )
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.roughnessContrast}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Edge / Cavity Grit</span>
                        <span className="text-amber-300 font-mono">{settings.roughnessEdgeWear}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={settings.roughnessEdgeWear}
                        onChange={(e) => updateSetting('roughnessEdgeWear', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting(
                                'roughnessEdgeWear',
                                DEFAULT_PBR_GENERATOR_SETTINGS.roughnessEdgeWear,
                                true
                            )
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.roughnessEdgeWear}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Blur / Softness</span>
                        <span className="text-amber-300 font-mono">{settings.roughnessBlur.toFixed(1)}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={settings.roughnessBlur}
                        onChange={(e) => updateSetting('roughnessBlur', parseFloat(e.target.value), true)}
                        onDoubleClick={() =>
                            updateSetting('roughnessBlur', DEFAULT_PBR_GENERATOR_SETTINGS.roughnessBlur, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.roughnessBlur}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-300 font-bold uppercase pt-1">
                    <input
                        type="checkbox"
                        checked={settings.roughnessInvert}
                        onChange={(e) => updateSetting('roughnessInvert', e.target.checked, true)}
                        className="rounded accent-amber-500"
                    />
                    <span>Invert (Dark Crevices = Rougher)</span>
                </label>
            </div>
        );
    }

    if (activeTab === 'metallic') {
        return (
            <div className="space-y-2.5 bg-slate-900/60 border border-slate-600/30 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider">
                        Metallic Map Sliders
                    </span>
                    <button
                        type="button"
                        onClick={() => onApplySingleMap('metallic')}
                        className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-white text-[9px] font-bold uppercase cursor-pointer"
                    >
                        Apply Metallic
                    </button>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Metal Highlight Threshold</span>
                        <span className="text-slate-200 font-mono">{settings.metallicThreshold}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="2"
                        value={settings.metallicThreshold}
                        onChange={(e) => updateSetting('metallicThreshold', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting(
                                'metallicThreshold',
                                DEFAULT_PBR_GENERATOR_SETTINGS.metallicThreshold,
                                true
                            )
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.metallicThreshold}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Metallic Base Bias</span>
                        <span className="text-slate-200 font-mono">
                            {settings.metallicBase > 0 ? `+${settings.metallicBase}` : settings.metallicBase}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-100"
                        max="100"
                        step="2"
                        value={settings.metallicBase}
                        onChange={(e) => updateSetting('metallicBase', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting('metallicBase', DEFAULT_PBR_GENERATOR_SETTINGS.metallicBase, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.metallicBase}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Metallic Contrast</span>
                        <span className="text-slate-200 font-mono">{settings.metallicContrast}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="300"
                        step="5"
                        value={settings.metallicContrast}
                        onChange={(e) => updateSetting('metallicContrast', parseInt(e.target.value, 10), true)}
                        onDoubleClick={() =>
                            updateSetting('metallicContrast', DEFAULT_PBR_GENERATOR_SETTINGS.metallicContrast, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.metallicContrast}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                        <span className="text-slate-300 font-bold uppercase">Blur / Softness</span>
                        <span className="text-slate-200 font-mono">{settings.metallicBlur.toFixed(1)}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.5"
                        value={settings.metallicBlur}
                        onChange={(e) => updateSetting('metallicBlur', parseFloat(e.target.value), true)}
                        onDoubleClick={() =>
                            updateSetting('metallicBlur', DEFAULT_PBR_GENERATOR_SETTINGS.metallicBlur, true)
                        }
                        title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.metallicBlur}`}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-300"
                    />
                </div>

                <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-300 font-bold uppercase pt-1">
                    <input
                        type="checkbox"
                        checked={settings.metallicInvert}
                        onChange={(e) => updateSetting('metallicInvert', e.target.checked, true)}
                        className="rounded accent-slate-300"
                    />
                    <span>Invert Metallic Mask</span>
                </label>
            </div>
        );
    }

    return (
        <div className="space-y-2.5 bg-emerald-950/15 border border-emerald-500/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                    Displacement / Height Sliders
                </span>
                <button
                    type="button"
                    onClick={() => onApplySingleMap('displacement')}
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold uppercase cursor-pointer"
                >
                    Apply Height Map
                </button>
            </div>

            {onOpenCavityWindow && (
                <button
                    type="button"
                    onClick={onOpenCavityWindow}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-emerald-600/40 to-teal-600/40 hover:from-emerald-500/50 hover:to-teal-500/50 border border-emerald-400/60 text-emerald-100 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow transition-all cursor-pointer"
                    title="Open Dedicated Mechanical Cavity & Solid B/W Height Map Generator Window with Large Preview"
                >
                    <LucideMountain className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Open Cavity & Solid B/W Height Studio</span>
                </button>
            )}

            <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-300 font-bold uppercase">Height Contrast</span>
                    <span className="text-emerald-300 font-mono">{settings.displacementContrast}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="300"
                    step="5"
                    value={settings.displacementContrast}
                    onChange={(e) => updateSetting('displacementContrast', parseInt(e.target.value, 10), true)}
                    onDoubleClick={() =>
                        updateSetting(
                            'displacementContrast',
                            DEFAULT_PBR_GENERATOR_SETTINGS.displacementContrast,
                            true
                        )
                    }
                    title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.displacementContrast}`}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
            </div>

            <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-300 font-bold uppercase">Height Brightness</span>
                    <span className="text-emerald-300 font-mono">
                        {settings.displacementBrightness > 0
                            ? `+${settings.displacementBrightness}`
                            : settings.displacementBrightness}
                        %
                    </span>
                </div>
                <input
                    type="range"
                    min="-100"
                    max="100"
                    step="2"
                    value={settings.displacementBrightness}
                    onChange={(e) => updateSetting('displacementBrightness', parseInt(e.target.value, 10), true)}
                    onDoubleClick={() =>
                        updateSetting(
                            'displacementBrightness',
                            DEFAULT_PBR_GENERATOR_SETTINGS.displacementBrightness,
                            true
                        )
                    }
                    title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.displacementBrightness}`}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
            </div>

            <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-300 font-bold uppercase">Elevation Smoothing (Blur)</span>
                    <span className="text-emerald-300 font-mono">{settings.displacementBlur.toFixed(1)}px</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="12"
                    step="0.5"
                    value={settings.displacementBlur}
                    onChange={(e) => updateSetting('displacementBlur', parseFloat(e.target.value), true)}
                    onDoubleClick={() =>
                        updateSetting('displacementBlur', DEFAULT_PBR_GENERATOR_SETTINGS.displacementBlur, true)
                    }
                    title={`Double-click to reset to ${DEFAULT_PBR_GENERATOR_SETTINGS.displacementBlur}`}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
            </div>

            <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-300 font-bold uppercase pt-1">
                <input
                    type="checkbox"
                    checked={settings.displacementInvert}
                    onChange={(e) => updateSetting('displacementInvert', e.target.checked, true)}
                    className="rounded accent-emerald-500"
                />
                <span>Invert Height (Dark = High, Light = Low)</span>
            </label>
        </div>
    );
};
