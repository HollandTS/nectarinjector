import React, { useState } from 'react';
import type { ThreeDObject, ThreeDSlopeShapingSettings, ProjectOverlay } from '../../../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from '../../../utils/threeDSlopePresets';
import { getLinkedGroups } from '../../../utils/layerLinkUtils';
import {
    DEFAULT_PBR_GENERATOR_SETTINGS,
    generatePbrMapsFromDiffuse,
} from '../../../utils/threeDPbrGeneratorHelper';
import { ThreeDPbrQuickBundleImport } from './ThreeDPbrQuickBundleImport';
import { ThreeDSlopeEmergeControls } from './ThreeDSlopeEmergeControls';
import { CavityHeightGeneratorWindow } from '../../modals/CavityHeightGeneratorWindow';
import {
    LucideImage,
    LucideLayers,
    LucideWand2,
    LucideTrash2,
    LucideLoader2,
    LucideBox,
    LucideMountain,
} from 'lucide-react';

interface ThreeDSlopeMaterialSubpanelProps {
    object: ThreeDObject;
    slope: ThreeDSlopeShapingSettings;
    overlays: ProjectOverlay[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    updateSlope: <K extends keyof ThreeDSlopeShapingSettings>(
        key: K,
        val: ThreeDSlopeShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateSlopeBatch: (updates: Partial<ThreeDSlopeShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDSlopeMaterialSubpanel: React.FC<ThreeDSlopeMaterialSubpanelProps> = ({
    object,
    slope,
    overlays,
    onUpdateObject,
    updateSlope,
    updateSlopeBatch,
    onStartHistory,
}) => {
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isCavityModalOpen, setIsCavityModalOpen] = useState(false);
    const linkedGroups = getLinkedGroups(overlays);

    const slopeDiffuseRef = React.createRef<HTMLInputElement>();
    const slopeNormalRef = React.createRef<HTMLInputElement>();
    const slopeRoughRef = React.createRef<HTMLInputElement>();
    const slopeDepthRef = React.createRef<HTMLInputElement>();

    const handleFileUpload = (
        key: 'slopeTextureUrl' | 'slopeNormalMapUrl' | 'slopeRoughnessMapUrl' | 'slopeDepthMapUrl',
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        updateSlope(key, url, true);
        e.target.value = '';
    };

    const resolveSlopeSourceForPbr = (): string | undefined => {
        if (slope.slopeTextureUrl) return slope.slopeTextureUrl;
        if (slope.slopeOverlayId) {
            const ov = overlays.find((o) => o.id === slope.slopeOverlayId);
            if (ov?.src) return ov.src;
        }
        return undefined;
    };

    const handleAutoSynthesizeSlopePbr = async () => {
        const srcUrl = resolveSlopeSourceForPbr();
        if (!srcUrl) return;
        setIsSynthesizing(true);
        try {
            const suite = await generatePbrMapsFromDiffuse(
                srcUrl,
                {
                    ...DEFAULT_PBR_GENERATOR_SETTINGS,
                    normalStrength: 3.5,
                    roughnessContrast: 125,
                    displacementContrast: 130,
                },
                512
            );
            if (!suite) return;

            const updates: Partial<ThreeDSlopeShapingSettings> = {};
            if (suite.normalMapUrl) updates.slopeNormalMapUrl = suite.normalMapUrl;
            if (suite.roughnessMapUrl) updates.slopeRoughnessMapUrl = suite.roughnessMapUrl;
            if (suite.displacementMapUrl) updates.slopeDepthMapUrl = suite.displacementMapUrl;
            updateSlopeBatch(updates, true);
        } finally {
            setIsSynthesizing(false);
        }
    };

    const canSynthesize = !!resolveSlopeSourceForPbr();

    const mapSlots: {
        label: string;
        key: 'slopeTextureUrl' | 'slopeDepthMapUrl' | 'slopeNormalMapUrl' | 'slopeRoughnessMapUrl';
        ref: React.RefObject<HTMLInputElement | null>;
        badgeClass: string;
    }[] = [
        {
            label: 'Slope Diffuse Texture',
            key: 'slopeTextureUrl',
            ref: slopeDiffuseRef,
            badgeClass: 'border-teal-500/30 bg-teal-950/20 text-teal-200',
        },
        {
            label: 'Slope Depth / Height Map',
            key: 'slopeDepthMapUrl',
            ref: slopeDepthRef,
            badgeClass: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
        },
        {
            label: 'Slope Normal Map',
            key: 'slopeNormalMapUrl',
            ref: slopeNormalRef,
            badgeClass: 'border-blue-500/30 bg-blue-950/20 text-blue-200',
        },
        {
            label: 'Slope Roughness Map',
            key: 'slopeRoughnessMapUrl',
            ref: slopeRoughRef,
            badgeClass: 'border-slate-600/50 bg-slate-900/40 text-slate-300',
        },
    ];

    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-teal-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">
                    1. Slope Texture, Height Dissolve &amp; Bump (No Mesh Deform)
                </span>
                <button
                    type="button"
                    onClick={() => updateSlope('dualTextureEnabled', !slope.dualTextureEnabled, true)}
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        slope.dualTextureEnabled
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                >
                    {slope.dualTextureEnabled ? 'Slope PBR ON' : 'OFF'}
                </button>
            </div>

            {slope.dualTextureEnabled && (
                <>
                    {/* Quick .ZIP or Multi-Image PBR Bundle Auto-Loader for Ramp Slopes */}
                    <ThreeDPbrQuickBundleImport
                        label="Load Slope PBR .ZIP or Multi-Images"
                        subtitle="Auto-assigns Slope _albedo, _height, _normal, _roughness (Zero mesh deformation)"
                        accentColor="teal"
                        onBundleParsed={(bundle) => {
                            const updates: Partial<ThreeDSlopeShapingSettings> = {
                                enabled: true,
                                dualTextureEnabled: true,
                            };
                            if (bundle.textureUrl) updates.slopeTextureUrl = bundle.textureUrl;
                            if (bundle.displacementMapUrl) updates.slopeDepthMapUrl = bundle.displacementMapUrl;
                            if (bundle.normalMapUrl) updates.slopeNormalMapUrl = bundle.normalMapUrl;
                            if (bundle.roughnessMapUrl) updates.slopeRoughnessMapUrl = bundle.roughnessMapUrl;
                            updateSlopeBatch(updates, true);
                        }}
                    />

                    {/* Convenient Top-Level Emerge, Height Dissolve & Bump Controls */}
                    <ThreeDSlopeEmergeControls
                        slope={slope}
                        updateSlope={updateSlope}
                        updateSlopeBatch={updateSlopeBatch}
                        onStartHistory={onStartHistory}
                    />

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-teal-200/80 flex items-center space-x-1">
                            <LucideLayers className="w-3 h-3 text-teal-400" />
                            <span>Pick Active 2D Layer as Slope Texture</span>
                        </label>
                        <select
                            value={slope.slopeOverlayId || 'none'}
                            onChange={(e) =>
                                updateSlope(
                                    'slopeOverlayId',
                                    e.target.value === 'none' ? undefined : e.target.value,
                                    true
                                )
                            }
                            className="w-full bg-[#161b22] border border-slate-700 rounded-lg text-xs text-white px-2 py-1.5 font-bold focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                            <option value="none">Use Uploaded Slope Texture Below</option>
                            {linkedGroups.length > 0 && (
                                <optgroup label="Linked Layers">
                                    {linkedGroups.map((lg) => (
                                        <option key={lg.id} value={lg.id}>
                                            {lg.name} ({lg.layers.length} layers)
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            <optgroup label="Individual Tiled Layers">
                                {overlays
                                    .filter((ov) => ov.type === 'tiled')
                                    .map((ov, i) => (
                                        <option key={ov.id} value={ov.id}>
                                            {ov.name || `Tiling Layer ${i + 1}`}
                                        </option>
                                    ))}
                            </optgroup>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                        {mapSlots.map((slot) => {
                            const val = slope[slot.key];
                            return (
                                <div
                                    key={slot.key}
                                    className={`border ${slot.badgeClass} px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wide truncate">
                                            {slot.label}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono truncate">
                                            {val ? 'Loaded' : 'Empty'}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1 shrink-0">
                                        {val && (
                                            <button
                                                type="button"
                                                onClick={() => updateSlope(slot.key, undefined, true)}
                                                className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-slate-800 cursor-pointer"
                                                title="Clear Map"
                                            >
                                                <LucideTrash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => slot.ref.current?.click()}
                                            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase text-white px-2 py-1 rounded border border-slate-600 cursor-pointer whitespace-nowrap"
                                        >
                                            <LucideImage className="w-3 h-3 text-teal-400" />
                                            <span>Load</span>
                                        </button>
                                        <input
                                            type="file"
                                            ref={slot.ref}
                                            onChange={(e) => handleFileUpload(slot.key, e)}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        disabled={!canSynthesize || isSynthesizing}
                        onClick={handleAutoSynthesizeSlopePbr}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                            !canSynthesize
                                ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-teal-600/25 hover:bg-teal-600/40 border-teal-500/50 text-teal-200 shadow-sm'
                        }`}
                        title="Auto-generate Slope Normal, Slope Roughness, and Slope Depth maps from the Slope Diffuse texture or selected 2D Layer"
                    >
                        {isSynthesizing ? (
                            <LucideLoader2 className="w-3.5 h-3.5 animate-spin text-teal-300" />
                        ) : (
                            <LucideWand2 className="w-3.5 h-3.5 text-teal-400" />
                        )}
                        <span>Auto-Generate Slope PBR + Depth Maps</span>
                    </button>

                    {/* Dedicated Cavity & Solid B/W Height Studio for Slopes */}
                    <button
                        type="button"
                        onClick={() => setIsCavityModalOpen(true)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                        title="Open external Cavity & Solid B/W Height Studio for Slope Ramp Depth"
                    >
                        <LucideMountain className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Slope Cavity & Solid B/W Height Studio...</span>
                    </button>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <div className="flex items-center space-x-1.5">
                            <LucideBox className="w-3.5 h-3.5 text-teal-400" />
                            <span
                                className="text-[10px] font-bold uppercase text-slate-300"
                                title="Projects slope textures in 3D space so diagonal ramps never stretch"
                            >
                                Triplanar Slope Projection
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => updateSlope('slopeTriplanar', !slope.slopeTriplanar, true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                slope.slopeTriplanar
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                        >
                            {slope.slopeTriplanar ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    <div className="space-y-2 pt-1">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Slope Texture Scale</span>
                                <span className="text-teal-300 font-mono tabular-nums">
                                    {slope.slopeScale.toFixed(2)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="8"
                                step="0.05"
                                value={slope.slopeScale}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateSlope('slopeScale', parseFloat(e.target.value))}
                                onDoubleClick={() =>
                                    updateSlope('slopeScale', DEFAULT_SLOPE_SHAPING_SETTINGS.slopeScale, true)
                                }
                                className="w-full accent-teal-500 cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Repeat X</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeRepeatX.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="8"
                                    step="0.1"
                                    value={slope.slopeRepeatX}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeRepeatX', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope('slopeRepeatX', DEFAULT_SLOPE_SHAPING_SETTINGS.slopeRepeatX, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Repeat Y</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeRepeatY.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="8"
                                    step="0.1"
                                    value={slope.slopeRepeatY}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeRepeatY', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope('slopeRepeatY', DEFAULT_SLOPE_SHAPING_SETTINGS.slopeRepeatY, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Slope Brightness</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeBrightness}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    step="1"
                                    value={slope.slopeBrightness}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeBrightness', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'slopeBrightness',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeBrightness,
                                            true
                                        )
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Slope Contrast</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeContrast}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    step="1"
                                    value={slope.slopeContrast}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeContrast', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateSlope('slopeContrast', DEFAULT_SLOPE_SHAPING_SETTINGS.slopeContrast, true)
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Slope Normal Bump</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeNormalScale.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.05"
                                    value={slope.slopeNormalScale}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeNormalScale', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'slopeNormalScale',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeNormalScale,
                                            true
                                        )
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Slope Roughness</span>
                                    <span className="text-teal-300 font-mono tabular-nums">
                                        {slope.slopeRoughness.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="1"
                                    step="0.02"
                                    value={slope.slopeRoughness}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateSlope('slopeRoughness', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateSlope(
                                            'slopeRoughness',
                                            DEFAULT_SLOPE_SHAPING_SETTINGS.slopeRoughness,
                                            true
                                        )
                                    }
                                    className="w-full accent-teal-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            <CavityHeightGeneratorWindow
                isOpen={isCavityModalOpen}
                onClose={() => setIsCavityModalOpen(false)}
                object={object}
                overlays={overlays}
                initialTargetChannel="slope"
                onUpdateObject={onUpdateObject}
            />
        </div>
    );
};
