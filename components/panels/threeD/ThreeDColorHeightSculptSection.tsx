import React, { useState, useEffect, useRef } from 'react';
import type { ColorHeightRule, ThreeDDisplacementSettings, ThreeDObject } from '../../../types';
import {
    extractDominantColorsFromImage,
    rgbToHex,
    hexToRgb,
} from '../../../utils/colorHeightSculptHelper';
import {
    DEFAULT_PBR_GENERATOR_SETTINGS,
    generatePbrMapsFromDiffuse,
} from '../../../utils/threeDPbrGeneratorHelper';
import {
    LucidePipette,
    LucidePlus,
    LucideTrash2,
    LucideSparkles,
    LucideChevronDown,
    LucideChevronRight,
    LucideWand2,
} from 'lucide-react';

interface ThreeDColorHeightSculptSectionProps {
    object: ThreeDObject;
    disp: ThreeDDisplacementSettings;
    onUpdateDisp: (updates: Partial<ThreeDDisplacementSettings>, pushHistory?: boolean) => void;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDColorHeightSculptSection: React.FC<ThreeDColorHeightSculptSectionProps> = ({
    object,
    disp,
    onUpdateDisp,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [dominantSwatches, setDominantSwatches] = useState<{ r: number; g: number; b: number; hex: string }[]>([]);
    const [pickingForRuleId, setPickingForRuleId] = useState<string | null>(null);
    const [isSyncingNormals, setIsSyncingNormals] = useState(false);
    const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const rules: ColorHeightRule[] = disp.colorHeightRules || [];
    const baseMix = disp.colorBaseMix ?? 100;

    // Load texture into sampler canvas & extract dominant colors automatically
    useEffect(() => {
        if (!object.textureUrl) {
            setDominantSwatches([]);
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (cancelled) return;
            const swatches = extractDominantColorsFromImage(img, 8);
            setDominantSwatches(swatches);
        };
        img.src = object.textureUrl;
        return () => {
            cancelled = true;
        };
    }, [object.textureUrl]);

    const addColorRule = (
        rgb: { r: number; g: number; b: number },
        preset?: { label?: string; heightOffset?: number; tolerance?: number; bladeNoise?: number }
    ) => {
        const newRule: ColorHeightRule = {
            id: `crule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            label: preset?.label || rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase(),
            targetColor: { r: rgb.r, g: rgb.g, b: rgb.b },
            tolerance: preset?.tolerance ?? 28,
            softness: 15,
            heightOffset: preset?.heightOffset ?? 70,
            bladeNoise: preset?.bladeNoise ?? 35,
            enabled: true,
        };
        onUpdateDisp(
            {
                enabled: true,
                colorHeightRules: [...rules, newRule],
            },
            true
        );
    };

    const updateRule = (id: string, updates: Partial<ColorHeightRule>, pushHistory = false) => {
        const next = rules.map((r) => (r.id === id ? { ...r, ...updates } : r));
        onUpdateDisp({ enabled: true, colorHeightRules: next }, pushHistory);
    };

    const removeRule = (id: string) => {
        const next = rules.filter((r) => r.id !== id);
        onUpdateDisp({ colorHeightRules: next }, true);
        if (pickingForRuleId === id) setPickingForRuleId(null);
    };

    const handleCanvasPick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!object.textureUrl) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = samplerCanvasRef.current || document.createElement('canvas');
            samplerCanvasRef.current = c;
            c.width = img.width || 128;
            c.height = img.height || 128;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            const px = Math.min(c.width - 1, Math.floor(relX * c.width));
            const py = Math.min(c.height - 1, Math.floor(relY * c.height));
            const pixel = ctx.getImageData(px, py, 1, 1).data;
            const picked = { r: pixel[0], g: pixel[1], b: pixel[2] };

            if (pickingForRuleId && pickingForRuleId !== '__NEW__') {
                updateRule(
                    pickingForRuleId,
                    {
                        targetColor: picked,
                        label: rgbToHex(picked.r, picked.g, picked.b).toUpperCase(),
                    },
                    true
                );
                setPickingForRuleId(null);
            } else {
                addColorRule(picked);
                setPickingForRuleId(null);
            }
        };
        img.src = object.textureUrl;
    };

    // Also Bake Color Height + Blade Spikes into Normal & Height PBR Maps with one click
    const handleSyncToNormalAndHeightMaps = async () => {
        if (!object.textureUrl) return;
        setIsSyncingNormals(true);
        try {
            const pbrSettings = {
                ...DEFAULT_PBR_GENERATOR_SETTINGS,
                normalEnabled: true,
                normalStrength: 6.5,
                normalDetailBoost: 65,
                displacementEnabled: true,
                roughnessEnabled: false,
                metallicEnabled: false,
            };
            const suite = await generatePbrMapsFromDiffuse(
                object.textureUrl,
                pbrSettings,
                512,
                rules,
                baseMix
            );
            if (suite) {
                onUpdateObject(
                    object.id,
                    {
                        normalMapUrl: suite.normalMapUrl || object.normalMapUrl,
                        displacementMapUrl: suite.displacementMapUrl,
                        displacementSettings: {
                            ...disp,
                            enabled: true,
                        },
                    },
                    true
                );
            }
        } finally {
            setIsSyncingNormals(false);
        }
    };

    return (
        <div className="space-y-2.5 bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/30">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center space-x-1.5 text-left cursor-pointer"
                >
                    {isExpanded ? (
                        <LucideChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                        <LucideChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <LucidePipette className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                        Color-Targeted Height Sculptor
                    </span>
                </button>
                <div className="flex items-center space-x-1">
                    {rules.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                            {rules.filter((r) => r.enabled).length} Active
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setPickingForRuleId(pickingForRuleId ? null : '__NEW__')}
                        disabled={!object.textureUrl}
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center space-x-1 transition-all cursor-pointer ${
                            pickingForRuleId
                                ? 'bg-emerald-500 text-slate-950 shadow-md'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200'
                        }`}
                        title="Pick a color directly from the texture to make it higher or lower"
                    >
                        <LucidePipette className="w-3 h-3" />
                        <span>{pickingForRuleId ? 'Click Image...' : 'Pick Color'}</span>
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="space-y-2.5 pt-1">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        Target specific colors in your texture (like <span className="text-emerald-300 font-bold">green grass</span>) to push them up (+Y) or carve them down (-Y), and add <span className="text-emerald-300 font-bold">Blade Spikes</span> for 3D grass height & normals.
                    </p>

                    {/* Interactive Texture Eyedropper Preview when Picking is active */}
                    {pickingForRuleId && object.textureUrl && (
                        <div className="space-y-1 bg-black/60 p-2 rounded-lg border border-emerald-400/60">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-emerald-300 font-bold uppercase">
                                    Click anywhere on texture to sample color:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPickingForRuleId(null)}
                                    className="text-slate-400 hover:text-white text-[9px] uppercase font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div
                                onClick={handleCanvasPick}
                                className="relative w-full h-32 rounded border border-slate-700 overflow-hidden cursor-crosshair bg-slate-950"
                            >
                                <img
                                    src={object.textureUrl}
                                    alt="Pick Color from Texture"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>
                    )}

                    {/* Quick Presets & Dominant Texture Palette Swatches */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-slate-400">
                                Quick Add From Texture Colors / Presets:
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    addColorRule(
                                        { r: 76, g: 175, b: 80 },
                                        {
                                            label: '3D Grass Boost',
                                            heightOffset: 75,
                                            tolerance: 34,
                                            bladeNoise: 55,
                                        }
                                    )
                                }
                                className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[9px] font-black uppercase flex items-center space-x-1 cursor-pointer"
                                title="Add a preset rule that raises green grass shades and adds 3D grass blade spikes"
                            >
                                <LucideSparkles className="w-2.5 h-2.5 text-emerald-300" />
                                <span>+ Green Grass Preset</span>
                            </button>
                        </div>

                        {dominantSwatches.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                                {dominantSwatches.map((sw, idx) => (
                                    <button
                                        key={`${sw.hex}_${idx}`}
                                        type="button"
                                        onClick={() => addColorRule({ r: sw.r, g: sw.g, b: sw.b })}
                                        className="group flex items-center space-x-1 px-1.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400/60 transition-all cursor-pointer"
                                        title={`Click to control height of ${sw.hex}`}
                                    >
                                        <span
                                            className="w-3.5 h-3.5 rounded-sm border border-white/20 shrink-0"
                                            style={{ backgroundColor: sw.hex }}
                                        />
                                        <LucidePlus className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-300" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Base Greyscale vs Pure Color Rules Mix */}
                    {rules.length > 0 && (
                        <div className="space-y-1 bg-black/30 p-2 rounded-lg border border-slate-800">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-slate-300 uppercase">
                                    Base Luminance Mix
                                </span>
                                <span className="font-mono text-emerald-300 font-bold">
                                    {baseMix === 0
                                        ? '0% (Pure Color Rules Only)'
                                        : `${baseMix}%`}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={baseMix}
                                onChange={(e) =>
                                    onUpdateDisp({
                                        colorBaseMix: parseInt(e.target.value, 10),
                                        enabled: true,
                                    })
                                }
                                onDoubleClick={() =>
                                    onUpdateDisp({ colorBaseMix: 100 }, true)
                                }
                                title="Double-click to reset to 100%"
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="flex justify-between text-[9px] text-slate-500">
                                <span>0% = Flat except chosen colors</span>
                                <span>100% = B&W + Color Rules</span>
                            </div>
                        </div>
                    )}

                    {/* Active Color Height Rules List */}
                    {rules.length > 0 && (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                            {rules.map((rule) => {
                                const hex = rgbToHex(
                                    rule.targetColor.r,
                                    rule.targetColor.g,
                                    rule.targetColor.b
                                );
                                return (
                                    <div
                                        key={rule.id}
                                        className={`p-2.5 rounded-lg border space-y-2 transition-all ${
                                            rule.enabled
                                                ? 'bg-slate-900/90 border-emerald-500/40'
                                                : 'bg-slate-900/40 border-slate-800 opacity-60'
                                        }`}
                                    >
                                        {/* Top Row: Color Swatch, Picker, Label, Toggle, Delete */}
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={rule.enabled}
                                                    onChange={(e) =>
                                                        updateRule(rule.id, { enabled: e.target.checked }, true)
                                                    }
                                                    className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                                                />
                                                <input
                                                    type="color"
                                                    value={hex}
                                                    onChange={(e) => {
                                                        const rgb = hexToRgb(e.target.value);
                                                        updateRule(
                                                            rule.id,
                                                            {
                                                                targetColor: rgb,
                                                            },
                                                            true
                                                        );
                                                    }}
                                                    className="w-6 h-6 rounded border border-slate-600 bg-transparent cursor-pointer shrink-0"
                                                    title="Change target color"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setPickingForRuleId(
                                                            pickingForRuleId === rule.id ? null : rule.id
                                                        )
                                                    }
                                                    className={`p-1 rounded border text-[9px] cursor-pointer ${
                                                        pickingForRuleId === rule.id
                                                            ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                                                    }`}
                                                    title="Sample this color from the texture image"
                                                >
                                                    <LucidePipette className="w-3 h-3" />
                                                </button>
                                                <span className="text-[10px] font-bold text-slate-200 truncate">
                                                    {rule.label || hex.toUpperCase()}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeRule(rule.id)}
                                                className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                                title="Remove Color Height Rule"
                                            >
                                                <LucideTrash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Elevation Boost / Carve Slider */}
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-slate-300 font-bold">
                                                    Color Height (Raise / Carve)
                                                </span>
                                                <span
                                                    className={`font-mono font-bold ${
                                                        rule.heightOffset >= 0
                                                            ? 'text-emerald-400'
                                                            : 'text-rose-400'
                                                    }`}
                                                >
                                                    {rule.heightOffset > 0
                                                        ? `+${rule.heightOffset}% (Higher)`
                                                        : `${rule.heightOffset}% (Lower)`}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-100"
                                                max="100"
                                                step="2"
                                                value={rule.heightOffset}
                                                onChange={(e) =>
                                                    updateRule(rule.id, {
                                                        heightOffset: parseInt(e.target.value, 10),
                                                    })
                                                }
                                                onDoubleClick={() =>
                                                    updateRule(rule.id, { heightOffset: 70 }, true)
                                                }
                                                title="Double-click to reset to 70%"
                                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                        </div>

                                        {/* Tolerance & Grass Blade Spikes */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between items-center text-[9px]">
                                                    <span className="text-slate-400 font-bold">
                                                        Color Range (Tol)
                                                    </span>
                                                    <span className="font-mono text-slate-200">
                                                        {rule.tolerance}%
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="2"
                                                    max="85"
                                                    step="1"
                                                    value={rule.tolerance}
                                                    onChange={(e) =>
                                                        updateRule(rule.id, {
                                                            tolerance: parseInt(e.target.value, 10),
                                                        })
                                                    }
                                                    onDoubleClick={() =>
                                                        updateRule(rule.id, { tolerance: 28 }, true)
                                                    }
                                                    title="Double-click to reset to 28%"
                                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                />
                                            </div>

                                            <div className="space-y-0.5">
                                                <div className="flex justify-between items-center text-[9px]">
                                                    <span className="text-emerald-300 font-bold">
                                                        Grass / Blade Spikes
                                                    </span>
                                                    <span className="font-mono text-emerald-300">
                                                        {rule.bladeNoise}%
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="2"
                                                    value={rule.bladeNoise}
                                                    onChange={(e) =>
                                                        updateRule(rule.id, {
                                                            bladeNoise: parseInt(e.target.value, 10),
                                                        })
                                                    }
                                                    onDoubleClick={() =>
                                                        updateRule(rule.id, { bladeNoise: 35 }, true)
                                                    }
                                                    title="Double-click to reset to 35%"
                                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* One-click Sync to Normal Map & PBR Height Map */}
                    {rules.length > 0 && object.textureUrl && (
                        <button
                            type="button"
                            disabled={isSyncingNormals}
                            onClick={handleSyncToNormalAndHeightMaps}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-emerald-600/40 to-cyan-600/40 hover:from-emerald-500/50 hover:to-cyan-500/50 border border-emerald-400/50 text-emerald-100 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                            title="Generates a crisp Normal Map and Height Map directly from your Color Height Rules & Grass Blade Spikes"
                        >
                            <LucideWand2 className="w-3.5 h-3.5 text-emerald-300" />
                            <span>
                                {isSyncingNormals
                                    ? 'Baking Normal & Height Maps...'
                                    : 'Bake Color Height into Normal & Height Maps'}
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
