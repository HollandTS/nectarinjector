import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ThreeDObject } from '../../../types';
import {
    PbrGeneratorSettings,
    DEFAULT_PBR_GENERATOR_SETTINGS,
    generatePbrMapsFromDiffuse,
    GeneratedPbrSuite,
} from '../../../utils/threeDPbrGeneratorHelper';
import { DEFAULT_DISPLACEMENT_SETTINGS } from '../../../utils/threeDDisplacementHelper';
import { ThreeDPbrTabSliders, PbrMapTab } from './ThreeDPbrTabSliders';
import { CavityHeightGeneratorWindow } from '../../modals/CavityHeightGeneratorWindow';
import {
    LucideWand2,
    LucideChevronDown,
    LucideChevronUp,
    LucideLoader2,
    LucideRotateCcw,
    LucideCheck,
    LucideMountain,
} from 'lucide-react';

interface ThreeDPbrGeneratorToolProps {
    object: ThreeDObject;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDPbrGeneratorTool: React.FC<ThreeDPbrGeneratorToolProps> = ({
    object,
    onUpdateObject,
}) => {
    // Keep PBR Map Synthesizer open by default so user never has to keep re-opening it
    const [isOpen, setIsOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<PbrMapTab>('normal');
    const [isCavityWindowOpen, setIsCavityWindowOpen] = useState(false);

    const [settings, setSettings] = useState<PbrGeneratorSettings>(() => ({
        ...DEFAULT_PBR_GENERATOR_SETTINGS,
        ...(object.pbrGeneratorSettings || {}),
    }));
    const [isGenerating, setIsGenerating] = useState(false);
    const [liveUpdate, setLiveUpdate] = useState(true);
    const [previews, setPreviews] = useState<GeneratedPbrSuite>({});

    // Track whether the user actively adjusted a slider (as opposed to merely mounting/opening the panel)
    const userAdjustedMapRef = useRef<PbrMapTab | 'all' | null>(null);

    const diffuseSource = object.textureUrl;

    // Sync saved settings when switching between 3D objects without triggering map regeneration on the 3D object
    useEffect(() => {
        userAdjustedMapRef.current = null;
        setSettings({
            ...DEFAULT_PBR_GENERATOR_SETTINGS,
            ...(object.pbrGeneratorSettings || {}),
        });
    }, [object.id]);

    const updateSetting = <K extends keyof PbrGeneratorSettings>(
        key: K,
        value: PbrGeneratorSettings[K],
        applyTo3D: boolean = false
    ) => {
        if (applyTo3D) {
            if (key.startsWith('normal')) userAdjustedMapRef.current = 'normal';
            else if (key.startsWith('roughness')) userAdjustedMapRef.current = 'roughness';
            else if (key.startsWith('metallic')) userAdjustedMapRef.current = 'metallic';
            else if (key.startsWith('displacement')) userAdjustedMapRef.current = 'displacement';
            else userAdjustedMapRef.current = 'all';
        }
        const next = { ...settings, [key]: value };
        setSettings(next);
        onUpdateObject(object.id, { pbrGeneratorSettings: next }, false);
    };

    // Keep preview thumbnails updated when open, and ONLY push to the 3D object when the user actively moves a slider
    useEffect(() => {
        if (!isOpen || !diffuseSource) return;
        let cancelled = false;
        const targetToApply = userAdjustedMapRef.current;

        const timer = setTimeout(async () => {
            const suite = await generatePbrMapsFromDiffuse(
                diffuseSource,
                settings,
                256,
                object.displacementSettings?.colorHeightRules,
                object.displacementSettings?.colorBaseMix ?? 100
            );
            if (!cancelled && suite) {
                setPreviews(suite);
                // Only overwrite 3D object maps if the user actively moved a slider while Live Update is enabled
                if (liveUpdate && targetToApply) {
                    userAdjustedMapRef.current = null;
                    const updates: Partial<ThreeDObject> = {
                        pbrGeneratorSettings: settings,
                    };
                    if (
                        (targetToApply === 'normal' || targetToApply === 'all') &&
                        settings.normalEnabled &&
                        suite.normalMapUrl
                    ) {
                        updates.normalMapUrl = suite.normalMapUrl;
                    }
                    if (
                        (targetToApply === 'roughness' || targetToApply === 'all') &&
                        settings.roughnessEnabled &&
                        suite.roughnessMapUrl
                    ) {
                        updates.roughnessMapUrl = suite.roughnessMapUrl;
                    }
                    if (
                        (targetToApply === 'metallic' || targetToApply === 'all') &&
                        settings.metallicEnabled &&
                        suite.metallicMapUrl
                    ) {
                        updates.metallicMapUrl = suite.metallicMapUrl;
                    }
                    if (
                        (targetToApply === 'displacement' || targetToApply === 'all') &&
                        settings.displacementEnabled &&
                        suite.displacementMapUrl
                    ) {
                        updates.displacementMapUrl = suite.displacementMapUrl;
                    }
                    if (Object.keys(updates).length > 1) {
                        onUpdateObject(object.id, updates, false);
                    }
                }
            }
        }, 90);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        isOpen,
        diffuseSource,
        settings,
        liveUpdate,
        object.displacementSettings?.colorHeightRules,
        object.displacementSettings?.colorBaseMix,
    ]);

    const handleGenerateAll = async (onlyMissing: boolean = false) => {
        if (!diffuseSource) return;
        setIsGenerating(true);
        try {
            const suite = await generatePbrMapsFromDiffuse(
                diffuseSource,
                settings,
                512,
                object.displacementSettings?.colorHeightRules,
                object.displacementSettings?.colorBaseMix ?? 100
            );
            if (!suite) return;
            setPreviews(suite);

            const updates: Partial<ThreeDObject> = {
                pbrGeneratorSettings: settings,
            };

            if (settings.normalEnabled && suite.normalMapUrl && (!onlyMissing || !object.normalMapUrl)) {
                updates.normalMapUrl = suite.normalMapUrl;
            }
            if (settings.roughnessEnabled && suite.roughnessMapUrl && (!onlyMissing || !object.roughnessMapUrl)) {
                updates.roughnessMapUrl = suite.roughnessMapUrl;
            }
            if (settings.metallicEnabled && suite.metallicMapUrl && (!onlyMissing || !object.metallicMapUrl)) {
                updates.metallicMapUrl = suite.metallicMapUrl;
            }
            if (settings.displacementEnabled && suite.displacementMapUrl && (!onlyMissing || !object.displacementMapUrl)) {
                updates.displacementMapUrl = suite.displacementMapUrl;
            }

            if (Object.keys(updates).length > 0) {
                onUpdateObject(object.id, updates, true);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApplySingleMap = async (tab: PbrMapTab) => {
        if (!diffuseSource) return;
        setIsGenerating(true);
        try {
            const suite = await generatePbrMapsFromDiffuse(
                diffuseSource,
                settings,
                512,
                object.displacementSettings?.colorHeightRules,
                object.displacementSettings?.colorBaseMix ?? 100
            );
            if (!suite) return;
            setPreviews(suite);

            if (tab === 'normal' && suite.normalMapUrl) {
                onUpdateObject(object.id, { normalMapUrl: suite.normalMapUrl, pbrGeneratorSettings: settings }, true);
            } else if (tab === 'roughness' && suite.roughnessMapUrl) {
                onUpdateObject(object.id, { roughnessMapUrl: suite.roughnessMapUrl, pbrGeneratorSettings: settings }, true);
            } else if (tab === 'metallic' && suite.metallicMapUrl) {
                onUpdateObject(object.id, { metallicMapUrl: suite.metallicMapUrl, pbrGeneratorSettings: settings }, true);
            } else if (tab === 'displacement' && suite.displacementMapUrl) {
                onUpdateObject(
                    object.id,
                    {
                        displacementMapUrl: suite.displacementMapUrl,
                        pbrGeneratorSettings: settings,
                    },
                    true
                );
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const missingCount = [
        !object.normalMapUrl,
        !object.roughnessMapUrl,
        !object.metallicMapUrl,
        !object.displacementMapUrl,
    ].filter(Boolean).length;

    return (
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {/* Main Trigger Bar inside PBR Texture Maps */}
            <div className="flex items-center space-x-1.5">
                <button
                    type="button"
                    disabled={!diffuseSource || isGenerating}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                        !diffuseSource
                            ? 'bg-slate-800/50 border-slate-700/40 text-slate-500 cursor-not-allowed'
                            : isOpen
                            ? 'bg-gradient-to-r from-cyan-600/30 to-indigo-600/30 border-cyan-400/60 text-cyan-200 shadow-lg shadow-cyan-950/30'
                            : 'bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 hover:from-cyan-900/60 hover:to-indigo-900/60 border-cyan-500/40 text-cyan-300'
                    }`}
                    title={
                        diffuseSource
                            ? 'PBR Map Synthesizer (Normal, Roughness, Metallic, Displacement)'
                            : 'Requires a Diffuse / Albedo Map first'
                    }
                >
                    <span className="flex items-center space-x-1.5">
                        <LucideWand2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>PBR Map Synthesizer</span>
                    </span>
                    <span className="flex items-center space-x-1">
                        {missingCount > 0 && (
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                                {missingCount} Missing
                            </span>
                        )}
                        {isOpen ? (
                            <LucideChevronUp className="w-3.5 h-3.5" />
                        ) : (
                            <LucideChevronDown className="w-3.5 h-3.5" />
                        )}
                    </span>
                </button>

                {diffuseSource && (
                    <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => handleGenerateAll(missingCount > 0 && missingCount < 4)}
                        className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider border border-emerald-400/40 shadow-md transition-all cursor-pointer shrink-0 flex items-center space-x-1"
                        title="Auto-Generate PBR Maps from Diffuse Texture"
                    >
                        {isGenerating ? (
                            <LucideLoader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <LucideCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{missingCount > 0 && missingCount < 4 ? 'Fill Missing' : 'Auto All'}</span>
                    </button>
                )}
            </div>

            {/* Dedicated Cavity & Solid B/W Height Map Generator Window Launcher */}
            {diffuseSource && (
                <button
                    type="button"
                    onClick={() => setIsCavityWindowOpen(true)}
                    className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-900/70 to-teal-900/70 hover:from-emerald-800/80 hover:to-teal-800/80 border border-emerald-400/50 text-emerald-200 text-[10.5px] font-black uppercase tracking-wider flex items-center justify-between shadow-md transition-all cursor-pointer"
                    title="Open Dedicated Mechanical Cavity & Solid B/W Height Map Studio Window with Large Preview"
                >
                    <span className="flex items-center space-x-1.5">
                        <LucideMountain className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Cavity & Solid B/W Height Generator</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                        Open Window
                    </span>
                </button>
            )}

            {isOpen && diffuseSource && (
                <div className="bg-[#0d1117]/95 border border-cyan-500/30 rounded-xl p-3 space-y-3">
                    {/* Top Actions: Live Sync + Generate Buttons */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                        <label
                            className="flex items-center space-x-1.5 cursor-pointer select-none"
                            title="When checked, moving a slider immediately updates that map on the 3D object. Opening this panel never overwrites your maps."
                        >
                            <input
                                type="checkbox"
                                checked={liveUpdate}
                                onChange={(e) => setLiveUpdate(e.target.checked)}
                                className="rounded border-slate-700 bg-slate-800 text-cyan-500 accent-cyan-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold uppercase text-slate-300">
                                Live Slider Sync
                            </span>
                        </label>
                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={() => {
                                    userAdjustedMapRef.current = 'all';
                                    setSettings(DEFAULT_PBR_GENERATOR_SETTINGS);
                                    onUpdateObject(
                                        object.id,
                                        { pbrGeneratorSettings: DEFAULT_PBR_GENERATOR_SETTINGS },
                                        false
                                    );
                                }}
                                className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors cursor-pointer"
                                title="Reset All PBR Generator Sliders"
                            >
                                <LucideRotateCcw className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => handleGenerateAll(false)}
                                className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Bake Checked (512px)
                            </button>
                        </div>
                    </div>

                    {/* 4-Map Preview Strip & Tab Selector */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {(
                            [
                                {
                                    id: 'normal' as PbrMapTab,
                                    label: 'Normal',
                                    preview: object.normalMapUrl || previews.normalMapUrl,
                                    enabled: settings.normalEnabled,
                                    toggleKey: 'normalEnabled' as const,
                                    accent: 'border-blue-500 text-blue-300',
                                },
                                {
                                    id: 'roughness' as PbrMapTab,
                                    label: 'Rough',
                                    preview: object.roughnessMapUrl || previews.roughnessMapUrl,
                                    enabled: settings.roughnessEnabled,
                                    toggleKey: 'roughnessEnabled' as const,
                                    accent: 'border-amber-500 text-amber-300',
                                },
                                {
                                    id: 'metallic' as PbrMapTab,
                                    label: 'Metal',
                                    preview: object.metallicMapUrl || previews.metallicMapUrl,
                                    enabled: settings.metallicEnabled,
                                    toggleKey: 'metallicEnabled' as const,
                                    accent: 'border-slate-400 text-slate-200',
                                },
                                {
                                    id: 'displacement' as PbrMapTab,
                                    label: 'Height',
                                    preview: object.displacementMapUrl || previews.displacementMapUrl,
                                    enabled: settings.displacementEnabled,
                                    toggleKey: 'displacementEnabled' as const,
                                    accent: 'border-emerald-500 text-emerald-300',
                                },
                            ]
                        ).map((tab) => {
                            const isSelected = activeTab === tab.id;
                            return (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`rounded-lg p-1.5 border cursor-pointer transition-all flex flex-col items-center space-y-1 ${
                                        isSelected
                                            ? `${tab.accent} bg-slate-800/90 shadow-md`
                                            : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="w-full h-11 rounded bg-black/60 border border-slate-800 overflow-hidden relative flex items-center justify-center">
                                        {tab.preview ? (
                                            <img
                                                src={tab.preview}
                                                alt={tab.label}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-[8px] text-slate-600 uppercase font-bold">
                                                None
                                            </span>
                                        )}
                                        <input
                                            type="checkbox"
                                            checked={tab.enabled}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateSetting(tab.toggleKey, e.target.checked, false)}
                                            className="absolute top-1 right-1 w-3 h-3 rounded accent-cyan-500 cursor-pointer"
                                            title={`Include ${tab.label} Map when baking`}
                                        />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-tight">
                                        {tab.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Per-Map Sliders */}
                    <ThreeDPbrTabSliders
                        activeTab={activeTab}
                        settings={settings}
                        updateSetting={updateSetting}
                        onApplySingleMap={handleApplySingleMap}
                        onOpenCavityWindow={() => setIsCavityWindowOpen(true)}
                    />
                </div>
            )}

            <CavityHeightGeneratorWindow
                isOpen={isCavityWindowOpen}
                onClose={() => setIsCavityWindowOpen(false)}
                object={object}
                onUpdateObject={onUpdateObject}
                onAppliedHeightMap={(heightDataUrl, normalDataUrl) => {
                    setPreviews((prev) => ({
                        ...prev,
                        displacementMapUrl: heightDataUrl,
                        ...(normalDataUrl ? { normalMapUrl: normalDataUrl } : {}),
                    }));
                }}
            />
        </div>
    );
};
