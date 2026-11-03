import React, { useState } from 'react';
import type { ThreeDObject, ThreeDCliffShapingSettings, ProjectOverlay } from '../../../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from '../../../utils/threeDCliffPresets';
import { getLinkedGroups } from '../../../utils/layerLinkUtils';
import {
    DEFAULT_PBR_GENERATOR_SETTINGS,
    generatePbrMapsFromDiffuse,
} from '../../../utils/threeDPbrGeneratorHelper';
import { ThreeDPbrQuickBundleImport } from './ThreeDPbrQuickBundleImport';
import { ThreeDCliffEmergeControls } from './ThreeDCliffEmergeControls';
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

interface ThreeDCliffWallMaterialSubpanelProps {
    object: ThreeDObject;
    cliff: ThreeDCliffShapingSettings;
    overlays: ProjectOverlay[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    updateCliff: <K extends keyof ThreeDCliffShapingSettings>(
        key: K,
        val: ThreeDCliffShapingSettings[K],
        pushHistory?: boolean
    ) => void;
    updateCliffBatch: (updates: Partial<ThreeDCliffShapingSettings>, pushHistory?: boolean) => void;
    onStartHistory: () => void;
}

export const ThreeDCliffWallMaterialSubpanel: React.FC<ThreeDCliffWallMaterialSubpanelProps> = ({
    object,
    cliff,
    overlays,
    onUpdateObject,
    updateCliff,
    updateCliffBatch,
    onStartHistory,
}) => {
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isCavityModalOpen, setIsCavityModalOpen] = useState(false);
    const linkedGroups = getLinkedGroups(overlays);

    const wallDiffuseRef = React.createRef<HTMLInputElement>();
    const wallNormalRef = React.createRef<HTMLInputElement>();
    const wallRoughRef = React.createRef<HTMLInputElement>();
    const wallDepthRef = React.createRef<HTMLInputElement>();

    const handleFileUpload = (
        key: 'wallTextureUrl' | 'wallNormalMapUrl' | 'wallRoughnessMapUrl' | 'wallDepthMapUrl',
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        updateCliffBatch(
            {
                enabled: true,
                dualTextureEnabled: true,
                [key]: url,
            },
            true
        );
        e.target.value = '';
    };

    const resolveWallSourceForPbr = (): string | undefined => {
        if (cliff.wallTextureUrl) return cliff.wallTextureUrl;
        if (cliff.wallOverlayId) {
            const ov = overlays.find((o) => o.id === cliff.wallOverlayId);
            if (ov?.src) return ov.src;
        }
        return undefined;
    };

    const handleAutoSynthesizeWallPbr = async () => {
        const srcUrl = resolveWallSourceForPbr();
        if (!srcUrl) return;
        setIsSynthesizing(true);
        try {
            const suite = await generatePbrMapsFromDiffuse(
                srcUrl,
                {
                    ...DEFAULT_PBR_GENERATOR_SETTINGS,
                    normalStrength: 4.5,
                    roughnessContrast: 135,
                    displacementContrast: 140,
                },
                512
            );
            if (!suite) return;

            const updates: Partial<ThreeDCliffShapingSettings> = {
                enabled: true,
                dualTextureEnabled: true,
            };
            if (suite.normalMapUrl) updates.wallNormalMapUrl = suite.normalMapUrl;
            if (suite.roughnessMapUrl) updates.wallRoughnessMapUrl = suite.roughnessMapUrl;
            if (suite.displacementMapUrl) updates.wallDepthMapUrl = suite.displacementMapUrl;
            updateCliffBatch(updates, true);
        } finally {
            setIsSynthesizing(false);
        }
    };

    const canSynthesize = !!resolveWallSourceForPbr();

    const mapSlots: {
        label: string;
        key: 'wallTextureUrl' | 'wallDepthMapUrl' | 'wallNormalMapUrl' | 'wallRoughnessMapUrl';
        ref: React.RefObject<HTMLInputElement | null>;
        badgeClass: string;
    }[] = [
        {
            label: 'Wall Diffuse Texture',
            key: 'wallTextureUrl',
            ref: wallDiffuseRef,
            badgeClass: 'border-amber-500/30 bg-amber-950/20 text-amber-200',
        },
        {
            label: 'Wall Depth / Height Map',
            key: 'wallDepthMapUrl',
            ref: wallDepthRef,
            badgeClass: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
        },
        {
            label: 'Wall Normal Map',
            key: 'wallNormalMapUrl',
            ref: wallNormalRef,
            badgeClass: 'border-blue-500/30 bg-blue-950/20 text-blue-200',
        },
        {
            label: 'Wall Roughness Map',
            key: 'wallRoughnessMapUrl',
            ref: wallRoughRef,
            badgeClass: 'border-slate-600/50 bg-slate-900/40 text-slate-300',
        },
    ];

    return (
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/25 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    1. Cliff Wall Texture, Height Dissolve &amp; Bump (No Mesh Deform)
                </span>
                <button
                    type="button"
                    onClick={() =>
                        updateCliffBatch(
                            {
                                dualTextureEnabled: !cliff.dualTextureEnabled,
                            },
                            true
                        )
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                        cliff.dualTextureEnabled
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                >
                    {cliff.dualTextureEnabled ? 'Wall PBR ON' : 'OFF'}
                </button>
            </div>

            {cliff.dualTextureEnabled && (
                <>
                    {/* Quick .ZIP or Multi-Image PBR Bundle Auto-Loader for Steep Cliff Wall */}
                    <ThreeDPbrQuickBundleImport
                        label="Load Wall PBR .ZIP or Multi-Images"
                        subtitle="Auto-assigns Wall _albedo, _height, _normal, _roughness (Zero mesh deformation)"
                        accentColor="amber"
                        onBundleParsed={(bundle) => {
                            const updates: Partial<ThreeDCliffShapingSettings> = {
                                enabled: true,
                                dualTextureEnabled: true,
                            };
                            if (bundle.textureUrl) updates.wallTextureUrl = bundle.textureUrl;
                            if (bundle.displacementMapUrl) updates.wallDepthMapUrl = bundle.displacementMapUrl;
                            if (bundle.normalMapUrl) updates.wallNormalMapUrl = bundle.normalMapUrl;
                            if (bundle.roughnessMapUrl) updates.wallRoughnessMapUrl = bundle.roughnessMapUrl;
                            updateCliffBatch(updates, true);
                        }}
                    />

                    {/* Convenient Top-Level Emerge, Height Dissolve & Bump Controls */}
                    <ThreeDCliffEmergeControls
                        cliff={cliff}
                        updateCliff={updateCliff}
                        updateCliffBatch={updateCliffBatch}
                        onStartHistory={onStartHistory}
                    />

                    {/* Active 2D Layer Picker for Cliff Wall */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-amber-200/80 flex items-center space-x-1">
                            <LucideLayers className="w-3 h-3 text-amber-400" />
                            <span>Pick Active 2D Layer as Wall Texture</span>
                        </label>
                        <select
                            value={cliff.wallOverlayId || 'none'}
                            onChange={(e) => {
                                const nextId = e.target.value === 'none' ? undefined : e.target.value;
                                updateCliffBatch(
                                    {
                                        enabled: true,
                                        dualTextureEnabled: true,
                                        wallOverlayId: nextId,
                                    },
                                    true
                                );
                            }}
                            className="w-full bg-[#161b22] border border-slate-700 rounded-lg text-xs text-white px-2 py-1.5 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                            <option value="none">Use Uploaded Wall Texture Below</option>
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

                    {/* 4 Wall Map Slots */}
                    <div className="grid grid-cols-1 gap-1.5">
                        {mapSlots.map((slot) => {
                            const val = cliff[slot.key];
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
                                                onClick={() => updateCliff(slot.key, undefined, true)}
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
                                            <LucideImage className="w-3 h-3 text-amber-400" />
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

                    {/* One-Click Auto-Generate Wall PBR + Depth */}
                    <button
                        type="button"
                        disabled={!canSynthesize || isSynthesizing}
                        onClick={handleAutoSynthesizeWallPbr}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                            !canSynthesize
                                ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-amber-600/25 hover:bg-amber-600/40 border-amber-500/50 text-amber-200 shadow-sm'
                        }`}
                        title="Auto-generate Wall Normal, Wall Roughness, and Wall Depth maps from the Wall Diffuse texture or selected 2D Layer"
                    >
                        {isSynthesizing ? (
                            <LucideLoader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        ) : (
                            <LucideWand2 className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Auto-Generate Wall PBR + Depth Maps</span>
                    </button>

                    {/* Dedicated Cavity & Solid B/W Height Studio for Cliff Wall */}
                    <button
                        type="button"
                        onClick={() => setIsCavityModalOpen(true)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                        title="Open external Cavity & Solid B/W Height Studio for Steep Cliff Wall Depth"
                    >
                        <LucideMountain className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Wall Cavity & Solid B/W Height Studio...</span>
                    </button>

                    {/* Triplanar Projection Toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <div className="flex items-center space-x-1.5">
                            <LucideBox className="w-3.5 h-3.5 text-amber-400" />
                            <span
                                className="text-[10px] font-bold uppercase text-slate-300"
                                title="Projects cliff wall textures in 3D box space so vertical faces never stretch"
                            >
                                Triplanar Wall Projection (No Stretch)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => updateCliff('wallTriplanar', !cliff.wallTriplanar, true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                cliff.wallTriplanar
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                        >
                            {cliff.wallTriplanar ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    {/* Wall UV Scale / Repeat / Normal / Roughness / Color Sliders */}
                    <div className="space-y-2 pt-1">
                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-amber-200 mb-0.5">
                                <span>Wall Texture Coverage Boost</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {cliff.wallCoverageBoost ?? 45}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={cliff.wallCoverageBoost ?? 45}
                                onMouseDown={onStartHistory}
                                onChange={(e) =>
                                    updateCliffBatch({
                                        enabled: true,
                                        wallCoverageBoost: parseInt(e.target.value, 10),
                                    })
                                }
                                onDoubleClick={() =>
                                    updateCliff(
                                        'wallCoverageBoost',
                                        DEFAULT_CLIFF_SHAPING_SETTINGS.wallCoverageBoost ?? 45,
                                        true
                                    )
                                }
                                title="Boosts steep cliff wall texture visibility so the vertical cliff image always comes through clearly"
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Wall Texture Scale</span>
                                <span className="text-amber-300 font-mono tabular-nums">
                                    {cliff.wallScale.toFixed(2)}x
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="8"
                                step="0.05"
                                value={cliff.wallScale}
                                onMouseDown={onStartHistory}
                                onChange={(e) => updateCliff('wallScale', parseFloat(e.target.value))}
                                onDoubleClick={() =>
                                    updateCliff('wallScale', DEFAULT_CLIFF_SHAPING_SETTINGS.wallScale, true)
                                }
                                title="Double-click to reset Wall Texture Scale"
                                className="w-full accent-amber-500 cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Repeat X</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallRepeatX.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.2"
                                    max="6"
                                    step="0.1"
                                    value={cliff.wallRepeatX}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallRepeatX', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateCliff('wallRepeatX', DEFAULT_CLIFF_SHAPING_SETTINGS.wallRepeatX, true)
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Repeat Y</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallRepeatY.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.2"
                                    max="6"
                                    step="0.1"
                                    value={cliff.wallRepeatY}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallRepeatY', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateCliff('wallRepeatY', DEFAULT_CLIFF_SHAPING_SETTINGS.wallRepeatY, true)
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Wall Bump</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallNormalScale.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.05"
                                    value={cliff.wallNormalScale}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallNormalScale', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'wallNormalScale',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallNormalScale,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Wall Rough</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallRoughness.toFixed(2)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.02"
                                    value={cliff.wallRoughness}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallRoughness', parseFloat(e.target.value))}
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'wallRoughness',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallRoughness,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Wall Bright</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallBrightness}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    step="1"
                                    value={cliff.wallBrightness}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallBrightness', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'wallBrightness',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallBrightness,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                                    <span>Wall Contrast</span>
                                    <span className="text-amber-300 font-mono tabular-nums">
                                        {cliff.wallContrast}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="200"
                                    step="1"
                                    value={cliff.wallContrast}
                                    onMouseDown={onStartHistory}
                                    onChange={(e) => updateCliff('wallContrast', parseInt(e.target.value, 10))}
                                    onDoubleClick={() =>
                                        updateCliff(
                                            'wallContrast',
                                            DEFAULT_CLIFF_SHAPING_SETTINGS.wallContrast,
                                            true
                                        )
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
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
                initialTargetChannel="cliff"
                onUpdateObject={onUpdateObject}
            />
        </div>
    );
};
