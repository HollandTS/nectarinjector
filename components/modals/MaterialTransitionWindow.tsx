import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DraggableContainer from '../DraggableContainer';
import type {
    ThreeDObject,
    ThreeDTransitionPairSettings,
    ThreeDMaterialTransitionSettings,
} from '../../types';
import {
    MaterialTransitionPairKey,
    DEFAULT_MATERIAL_TRANSITION_SETTINGS,
    TRANSITION_STYLE_PRESETS,
    resolveMaterialTransitionSettings,
} from '../../utils/threeDMaterialTransitionHelper';
import {
    LucideBlend,
    LucideX,
    LucideMinus,
    LucideMaximize2,
    LucideRotateCcw,
} from 'lucide-react';

interface MaterialTransitionWindowProps {
    isOpen: boolean;
    onClose: () => void;
    object: ThreeDObject;
    initialPair?: MaterialTransitionPairKey;
    onUpdateObject: (
        id: string,
        updates: Partial<ThreeDObject>,
        shouldPushHistory?: boolean
    ) => void;
}

const PAIR_TABS: {
    key: MaterialTransitionPairKey;
    label: string;
    shortA: string;
    shortB: string;
    badgeColor: string;
}[] = [
    {
        key: 'mainCliff',
        label: 'Main ↔ Cliff',
        shortA: 'Main Texture',
        shortB: 'Cliff Wall',
        badgeColor: 'from-cyan-600/30 to-amber-600/30 border-amber-500/50 text-amber-200',
    },
    {
        key: 'mainSlope',
        label: 'Main ↔ Slope',
        shortA: 'Main Texture',
        shortB: 'Slope Texture',
        badgeColor: 'from-cyan-600/30 to-teal-600/30 border-teal-500/50 text-teal-200',
    },
    {
        key: 'cliffSlope',
        label: 'Cliff ↔ Slope',
        shortA: 'Cliff Wall',
        shortB: 'Slope Texture',
        badgeColor: 'from-amber-600/30 to-teal-600/30 border-emerald-500/50 text-emerald-200',
    },
];

export const MaterialTransitionWindow: React.FC<MaterialTransitionWindowProps> = ({
    isOpen,
    onClose,
    object,
    initialPair = 'mainCliff',
    onUpdateObject,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [activePair, setActivePair] = useState<MaterialTransitionPairKey>(initialPair);
    const [containerSize, setContainerSize] = useState({ width: 420, height: 640 });

    useEffect(() => {
        if (isOpen && initialPair) {
            setActivePair(initialPair);
        }
    }, [isOpen, initialPair]);

    if (!isOpen) return null;

    const transitions: ThreeDMaterialTransitionSettings = resolveMaterialTransitionSettings(
        object.transitionSettings
    );
    const pair: ThreeDTransitionPairSettings = transitions[activePair];
    const defaultPair: ThreeDTransitionPairSettings =
        DEFAULT_MATERIAL_TRANSITION_SETTINGS[activePair];
    const currentTab = PAIR_TABS.find((t) => t.key === activePair) || PAIR_TABS[0];

    const updatePair = <K extends keyof ThreeDTransitionPairSettings>(
        key: K,
        val: ThreeDTransitionPairSettings[K],
        pushHistory: boolean = false
    ) => {
        const nextPair: ThreeDTransitionPairSettings = {
            ...pair,
            enabled: key === 'enabled' ? (val as boolean) : true,
            [key]: val,
        };
        onUpdateObject(
            object.id,
            {
                transitionSettings: {
                    ...transitions,
                    [activePair]: nextPair,
                },
            },
            pushHistory
        );
    };

    const updatePairBatch = (
        updates: Partial<ThreeDTransitionPairSettings>,
        pushHistory: boolean = false
    ) => {
        onUpdateObject(
            object.id,
            {
                transitionSettings: {
                    ...transitions,
                    [activePair]: {
                        ...pair,
                        ...updates,
                    },
                },
            },
            pushHistory
        );
    };

    const handleResetPair = () => {
        onUpdateObject(
            object.id,
            {
                transitionSettings: {
                    ...transitions,
                    [activePair]: {
                        ...defaultPair,
                        enabled: pair.enabled,
                    },
                },
            },
            true
        );
    };

    const startHistory = () => onUpdateObject(object.id, {}, true);

    // Visual CSS preview gradient of the transition strip
    const brtMult = (pair.brightness ?? 92) / 100;
    const strokeAlpha = ((pair.strokeStrength ?? 35) / 100) * 0.85;

    const modalNode = (
        <DraggableContainer
            initialPos={{ x: Math.max(20, window.innerWidth - 835), y: 80 }}
            size={isMinimized ? { width: containerSize.width, height: 50 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={360}
            minHeight={isMinimized ? 50 : 420}
            className="bg-[#141921]/95 backdrop-blur-xl border border-fuchsia-500/40 rounded-2xl shadow-2xl z-[1250] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-700/80 bg-slate-900/90 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-300 shrink-0">
                        <LucideBlend className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
                            Material Transition Mixer
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                            Seam colors, strokes & blend for {object.name}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand' : 'Minimize'}
                    >
                        {isMinimized ? (
                            <LucideMaximize2 className="w-3.5 h-3.5" />
                        ) : (
                            <LucideMinus className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close Transition Mixer"
                    >
                        <LucideX className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-3.5 space-y-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700 text-xs">
                    {/* 1. Choose Between Which Two Materials */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-300 block">
                            1. Choose Between Which Textures
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                            {PAIR_TABS.map((tab) => {
                                const isSel = activePair === tab.key;
                                const isPairOn = transitions[tab.key].enabled;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActivePair(tab.key)}
                                        className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer relative ${
                                            isSel
                                                ? `bg-gradient-to-br ${tab.badgeColor} shadow-md`
                                                : 'bg-slate-900/80 border-slate-700/80 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <div className="text-[10px] font-black uppercase tracking-wide truncate">
                                            {tab.label}
                                        </div>
                                        <div className="text-[9px] opacity-80 font-bold uppercase mt-0.5">
                                            {isPairOn ? 'ACTIVE' : 'DEFAULT'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pair Enable Toggle & Reset */}
                    <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                        <div>
                            <div className="text-[11px] font-black uppercase text-white">
                                {currentTab.shortA} ↔ {currentTab.shortB}
                            </div>
                            <div className="text-[10px] text-slate-400">
                                Custom seam blend, tint & stroke lines
                            </div>
                        </div>
                        <div className="flex items-center space-x-1.5">
                            <button
                                type="button"
                                onClick={handleResetPair}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Reset this pair's transition sliders"
                            >
                                <LucideRotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => updatePair('enabled', !pair.enabled, true)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-colors cursor-pointer ${
                                    pair.enabled
                                        ? 'bg-fuchsia-600 text-white shadow-sm'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                                }`}
                            >
                                {pair.enabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>

                    {/* Live Visual Seam Preview Bar */}
                    <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                            <span>{currentTab.shortA}</span>
                            <span className="text-fuchsia-300">Transition Zone ({pair.thickness}%)</span>
                            <span>{currentTab.shortB}</span>
                        </div>
                        <div
                            className="h-5 w-full rounded-lg border border-slate-700/80 relative overflow-hidden"
                            style={{
                                background: `linear-gradient(90deg, #334155 0%, ${pair.tintColor} 50%, #0f766e 100%)`,
                                filter: `brightness(${brtMult}) contrast(${(pair.contrast ?? 110) / 100})`,
                            }}
                        >
                            {pair.strokeStrength > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center space-x-1">
                                    {Array.from({ length: Math.max(1, pair.strokeCount) }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-full"
                                            style={{
                                                width: `${Math.max(2, 10 - pair.strokeSharpness * 0.07)}px`,
                                                backgroundColor: pair.tintColor,
                                                opacity: strokeAlpha,
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Transition Style Presets */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            Quick Transition Presets
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                            {TRANSITION_STYLE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => updatePairBatch(preset.settings, true)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-fuchsia-950/40 border border-slate-700/80 hover:border-fuchsia-500/50 text-left transition-all cursor-pointer"
                                >
                                    <div className="text-[10px] font-black text-fuchsia-200 truncate">
                                        {preset.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                        {preset.subtitle}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Thickness, Softness & Mix Balance */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 block">
                            2. Seam Thickness, Softness & Mix Balance
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Band Thickness</span>
                                    <span className="text-cyan-300 font-mono">{pair.thickness}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="2"
                                    max="100"
                                    step="1"
                                    value={pair.thickness}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('thickness', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('thickness', defaultPair.thickness, true)
                                    }
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Edge Softness</span>
                                    <span className="text-cyan-300 font-mono">{pair.softness}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={pair.softness}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('softness', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('softness', defaultPair.softness, true)
                                    }
                                    className="w-full accent-cyan-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                <span>Mix Shift ({currentTab.shortA} ↔ {currentTab.shortB})</span>
                                <span className="text-cyan-300 font-mono">
                                    {pair.mixBias > 0 ? `+${pair.mixBias}%` : `${pair.mixBias}%`}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="-80"
                                max="80"
                                step="1"
                                value={pair.mixBias}
                                onMouseDown={startHistory}
                                onChange={(e) =>
                                    updatePair('mixBias', parseInt(e.target.value, 10))
                                }
                                onDoubleClick={() =>
                                    updatePair('mixBias', defaultPair.mixBias, true)
                                }
                                className="w-full accent-cyan-500 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* 3. Transition Color, Brightness & Contrast */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 block">
                            3. Seam Color Tint, Brightness & Contrast
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Seam Brightness</span>
                                    <span className="text-amber-300 font-mono">{pair.brightness}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="220"
                                    step="1"
                                    value={pair.brightness}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('brightness', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('brightness', defaultPair.brightness, true)
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Seam Contrast</span>
                                    <span className="text-amber-300 font-mono">{pair.contrast}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="220"
                                    step="1"
                                    value={pair.contrast}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('contrast', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('contrast', defaultPair.contrast, true)
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 pt-1">
                            <div className="flex items-center space-x-1.5 shrink-0">
                                <input
                                    type="color"
                                    value={pair.tintColor || '#3b3026'}
                                    onChange={(e) => updatePair('tintColor', e.target.value, true)}
                                    className="w-7 h-7 rounded cursor-pointer bg-transparent border border-slate-600"
                                    title="Transition Border Tint & Stroke Color"
                                />
                                <span className="text-[10px] font-bold uppercase text-slate-300">
                                    Tint
                                </span>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Tint Color Mix</span>
                                    <span className="text-amber-300 font-mono">{pair.tintMix}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={pair.tintMix}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('tintMix', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('tintMix', defaultPair.tintMix, true)
                                    }
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. Stroke Lines & Organic Seam Breakup */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-fuchsia-300 block">
                            4. Stroke Lines & Organic Seam Breakup
                        </span>

                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Stroke</span>
                                    <span className="text-fuchsia-300 font-mono">
                                        {pair.strokeStrength}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={pair.strokeStrength}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('strokeStrength', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('strokeStrength', defaultPair.strokeStrength, true)
                                    }
                                    className="w-full accent-fuchsia-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Lines</span>
                                    <span className="text-fuchsia-300 font-mono">
                                        {pair.strokeCount}x
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="8"
                                    step="1"
                                    value={pair.strokeCount}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('strokeCount', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('strokeCount', defaultPair.strokeCount, true)
                                    }
                                    className="w-full accent-fuchsia-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Sharpness</span>
                                    <span className="text-fuchsia-300 font-mono">
                                        {pair.strokeSharpness}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={pair.strokeSharpness}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('strokeSharpness', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair(
                                            'strokeSharpness',
                                            defaultPair.strokeSharpness,
                                            true
                                        )
                                    }
                                    className="w-full accent-fuchsia-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Organic Breakup</span>
                                    <span className="text-fuchsia-300 font-mono">
                                        {pair.noiseBreakup}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={pair.noiseBreakup}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('noiseBreakup', parseInt(e.target.value, 10))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('noiseBreakup', defaultPair.noiseBreakup, true)
                                    }
                                    className="w-full accent-fuchsia-500 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                                    <span>Breakup Scale</span>
                                    <span className="text-fuchsia-300 font-mono">
                                        {pair.noiseScale.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="25"
                                    step="0.5"
                                    value={pair.noiseScale}
                                    onMouseDown={startHistory}
                                    onChange={(e) =>
                                        updatePair('noiseScale', parseFloat(e.target.value))
                                    }
                                    onDoubleClick={() =>
                                        updatePair('noiseScale', defaultPair.noiseScale, true)
                                    }
                                    className="w-full accent-fuchsia-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DraggableContainer>
    );

    return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
