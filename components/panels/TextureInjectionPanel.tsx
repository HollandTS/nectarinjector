
import React from 'react';
import DraggableContainer from '../DraggableContainer';
import { FilterSlider } from '../ui/FilterSlider';
import { rgbToHex, hexToRgb, rgbToHsl, colorDistance } from '../../utils/colorUtils';
import type { ProjectOverlay, MaskGroup, RgbaColor, ThreeDObject } from '../../types';
import { Layers, MousePointer2, Lasso, Plus, Trash2, Settings2, Sparkles, Eye, Palette, Ban, Maximize2, X } from 'lucide-react';
import { TilePaletteModal } from '../modals/TilePaletteModal';
import { OriginalColorModal } from '../modals/OriginalColorModal';
import type { CanvasImage, OriginalColorSettings } from '../../types';
import { extractPaletteFromImages } from '../../utils/paletteUtils';
import { getLinkedGroups, isLinkedGroupId } from '../../utils/layerLinkUtils';
import { makeThreeDTargetId, isThreeDTargetId } from '../../utils/threeDInjectionUtils';
import { ALL_LAYERS_TARGET_ID, isAllLayersTargetId } from '../../utils/allLayersInjectionHelper';
import { getSceneGroups, isSceneGroupId } from '../../utils/sceneGroupUtils';

interface TextureInjectionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    activeOverlay: ProjectOverlay | null;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>) => void;
    allOverlays: ProjectOverlay[];
    threeDObjects?: ThreeDObject[];
    setOpenSettingsId: (id: string | null) => void;
    activeInjectionTarget: string;
    setActiveInjectionTarget: (t: string) => void;
    activeMaskGroupId: string | null;
    setActiveMaskGroupId: (id: string | null) => void;
    activeTransitionGroupId: string | null;
    setActiveTransitionGroupId: (id: string | null) => void;
    activeSecondaryGroupId: string | null;
    setActiveSecondaryGroupId: (id: string | null) => void;
    activeExtraGroupId: string | null;
    setActiveExtraGroupId: (id: string | null) => void;
    isEyedropperActive: boolean;
    setIsEyedropperActive: (v: boolean) => void;
    isGlobalEyedropperActive: boolean;
    setIsGlobalEyedropperActive: (v: boolean) => void;
    isLassoActive: boolean;
    setIsLassoActive: (v: boolean) => void;
    onApplyMaskToImages: (ov: ProjectOverlay) => Promise<void>;
    onBakeSmartOverlay: (id: string) => void;
    onUndo: () => void;
    onUndoInjection: () => void;
    onUndoOriginalColor: () => void;
    onApplyOriginalColorAdjustment: (settings: OriginalColorSettings) => void;
    canUndo: boolean;
    canUndoInjection: boolean;
    canUndoOriginalColor: boolean;
    previewMaskId: string | null;
    setPreviewMaskId: (id: string | null) => void;
    previewGroupIds: string[];
    setPreviewGroupIds: (ids: string[]) => void;
    selectedImages: CanvasImage[];
    onOpenPalette: (groupId: string) => void;
    transparencyColor: RgbaColor | null;
    tolerance: number;
    pickedColor: RgbaColor | null;
}

export const TextureInjectionPanel: React.FC<TextureInjectionPanelProps> = ({
    isOpen, onClose, activeOverlay, onUpdateOverlay, allOverlays, threeDObjects = [], setOpenSettingsId,
    activeInjectionTarget, setActiveInjectionTarget,
    activeMaskGroupId, setActiveMaskGroupId,
    activeTransitionGroupId, setActiveTransitionGroupId,
    activeSecondaryGroupId, setActiveSecondaryGroupId,
    activeExtraGroupId, setActiveExtraGroupId,
    isEyedropperActive, setIsEyedropperActive,
    isGlobalEyedropperActive, setIsGlobalEyedropperActive,
    isLassoActive, setIsLassoActive,
    onApplyMaskToImages, onBakeSmartOverlay, onUndo, onUndoInjection, onUndoOriginalColor, onApplyOriginalColorAdjustment,
    canUndo, canUndoInjection, canUndoOriginalColor,
    previewMaskId, setPreviewMaskId,
    previewGroupIds, setPreviewGroupIds,
    selectedImages, onOpenPalette,
    transparencyColor, tolerance, pickedColor
}) => {
    const [divideMode, setDivideMode] = React.useState<'brightness' | 'hue'>('brightness');
    const [activeTab, setActiveTab] = React.useState<'color' | 'depth'>('color');
    const [panelSize, setPanelSize] = React.useState({ width: 450, height: 600 });
    const [isOriginalColorModalOpen, setIsOriginalColorModalOpen] = React.useState(false);

    if (!activeOverlay) {
        return (
            <div className="fixed top-20 right-4 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl z-[6000] flex flex-col overflow-hidden" style={{ display: isOpen ? 'flex' : 'none' }}>
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                    <h2 className="text-sm font-bold text-slate-200">Texture Injection</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors"><X size={16} className="text-slate-400" /></button>
                </div>
                <div className="p-8 text-center">
                    <p className="text-slate-400 text-sm">No overlay selected.</p>
                    <p className="text-slate-500 text-xs mt-2">Add or select an overlay from the Layer Stack to begin.</p>
                </div>
            </div>
        );
    }

    const f = activeOverlay.filters;
    const linkedGroups = getLinkedGroups(allOverlays);
    const sceneGroups = getSceneGroups(allOverlays, threeDObjects, selectedImages);

    const autoDivideColors = async () => {
        if (f.maskGroups.length < 2) return;

        // 1. Get all colors from the palette (selected images)
        const paletteColors = await extractPaletteFromImages(selectedImages);
        
        // 2. Identify excluded colors (colors already in groups marked as excluded)
        const excludedGroups = f.maskGroups.filter(g => g.isExcludedFromAutoDivide);
        const excludedColorKeys = new Set(excludedGroups.flatMap(g => g.colors.map(c => `${c.r},${c.g},${c.b}`)));

        // 3. Filter palette colors to remove excluded ones
        let availableColors = paletteColors.filter(c => {
            if (excludedColorKeys.has(`${c.r},${c.g},${c.b}`)) return false;
            return true;
        });

        if (availableColors.length === 0) return;

        // 4. Sort available colors
        if (divideMode === 'brightness') {
            availableColors.sort((a, b) => b.l - a.l); // Brightest first
        } else {
            availableColors.sort((a, b) => a.h - b.h); // Hue order
        }

        // 5. Distribute colors among non-excluded groups
        const targetGroups = f.maskGroups.filter(g => !g.isExcludedFromAutoDivide);
        if (targetGroups.length === 0) return;

        const numGroups = targetGroups.length;
        const nextGroups = f.maskGroups.map((group) => {
            if (group.isExcludedFromAutoDivide) return group;

            const gIdx = targetGroups.findIndex(tg => tg.id === group.id);
            const start = Math.floor((gIdx / numGroups) * availableColors.length);
            const end = Math.floor(((gIdx + 1) / numGroups) * availableColors.length);
            const groupColors = availableColors.slice(start, end).map(({ r, g, b, a }) => ({ r, g, b, a }));
            
            return { ...group, colors: groupColors };
        });

        onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: nextGroups } });
    };

    const toggleGroupPreview = (groupId: string) => {
        if (previewGroupIds.includes(groupId)) {
            const next = previewGroupIds.filter(id => id !== groupId);
            setPreviewGroupIds(next);
            if (next.length === 0 && previewMaskId === activeOverlay.id) {
                setPreviewMaskId(null);
            }
        } else {
            const next = [...previewGroupIds, groupId];
            setPreviewGroupIds(next);
            if (previewMaskId !== activeOverlay.id) {
                setPreviewMaskId(activeOverlay.id);
            }
        }
    };

    const toggleAllPreview = () => {
        if (previewMaskId === activeOverlay.id) {
            setPreviewMaskId(null);
            setPreviewGroupIds([]);
        } else {
            setPreviewMaskId(activeOverlay.id);
            setPreviewGroupIds(f.maskGroups.map(g => g.id));
        }
    };

    const addMaskGroup = () => {
        const newGroup: MaskGroup = { id: `group-${Date.now()}`, colors: [], tolerance: 5 };
        onUpdateOverlay(activeOverlay.id, {
            filters: { 
                ...f, 
                maskGroups: [...f.maskGroups, newGroup], 
                maskOverlayIds: [...(f.maskOverlayIds || []), null],
                activeMaskGroupId: newGroup.id, 
                maskToColor: true 
            }
        });
        setActiveMaskGroupId(newGroup.id);
    };

    const removeMaskGroup = (id: string) => {
        const idx = f.maskGroups.findIndex(g => g.id === id);
        if (idx === -1) return;
        const nextGroups = f.maskGroups.filter(g => g.id !== id);
        const nextIds = (f.maskOverlayIds || []).filter((_, i) => i !== idx);
        onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: nextGroups, maskOverlayIds: nextIds } });
    };

    const renderGroup = (
        group: MaskGroup,
        idx: number,
        activeId: string | null,
        setActiveId: (id: string | null) => void,
        targetType: string,
        layerId: string | null,
        onLayerChange: (id: string | null) => void
    ) => (
        <div 
            key={group.id} 
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${activeId === group.id ? 'bg-white/10 border-emerald-500/50' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
            onClick={() => {
                setActiveId(group.id);
                setActiveInjectionTarget(targetType);
            }}
        >
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Group {String.fromCharCode(65 + idx)}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            const next = f.maskGroups.map(g => g.id === group.id ? { ...g, isExcludedFromAutoDivide: !g.isExcludedFromAutoDivide } : g);
                            onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: next } });
                        }}
                        className={`p-1 rounded transition-all ${group.isExcludedFromAutoDivide ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/20 hover:text-white/40 border border-transparent'}`}
                        title={group.isExcludedFromAutoDivide ? "Excluded from Auto-Divide" : "Include in Auto-Divide"}
                    >
                        <Ban className="w-2.5 h-2.5" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            const next = f.maskGroups.map(g => g.id === group.id ? { ...g, isExcludedFromDepth: !g.isExcludedFromDepth } : g);
                            onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: next } });
                        }}
                        className={`p-1 rounded transition-all ${group.isExcludedFromDepth ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-white/5 text-white/20 hover:text-white/40 border border-transparent'}`}
                        title={group.isExcludedFromDepth ? "Excluded from Depth Injection" : "Include in Depth Injection"}
                    >
                        <Maximize2 className="w-2.5 h-2.5" />
                    </button>
                </div>
                <div className="flex items-center space-x-1">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveId(group.id);
                            setActiveInjectionTarget(targetType);
                            setIsEyedropperActive(!isEyedropperActive || activeId !== group.id || activeInjectionTarget !== targetType);
                            setIsLassoActive(false);
                        }}
                        className={`p-1 rounded-md border transition-all ${(isEyedropperActive && activeId === group.id && activeInjectionTarget === targetType) ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                        title="Pick colors"
                    >
                        <MousePointer2 className="w-2.5 h-2.5" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveId(group.id);
                            setActiveInjectionTarget(targetType);
                            setIsLassoActive(!isLassoActive || activeId !== group.id || activeInjectionTarget !== targetType);
                            setIsEyedropperActive(false);
                        }}
                        className={`p-1 rounded-md border transition-all ${(isLassoActive && activeId === group.id && activeInjectionTarget === targetType) ? 'bg-purple-500 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                        title="Lasso colors"
                    >
                        <Lasso className="w-2.5 h-2.5" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleGroupPreview(group.id);
                        }}
                        className={`p-1 rounded-md border transition-all ${previewGroupIds.includes(group.id) ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                        title="Toggle Group Preview"
                    >
                        <Eye className="w-2.5 h-2.5" />
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenPalette(group.id);
                        }}
                        className="p-1 rounded-md border bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-emerald-500/50 transition-all"
                        title="Pick from tile palette"
                    >
                        <Palette className="w-2.5 h-2.5" />
                    </button>
                    {idx > 1 && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                removeMaskGroup(group.id);
                            }}
                            className="p-1 text-red-400/50 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-2.5 h-2.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
                {group.colors.map((c, cIdx) => (
                    <div 
                        key={cIdx} 
                        className="w-3 h-3 rounded-full border border-white/20 cursor-pointer hover:border-red-400 transition-colors" 
                        style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextColors = group.colors.filter((_, i) => i !== cIdx);
                            const nextGroups = f.maskGroups.map(g => g.id === group.id ? { ...g, colors: nextColors } : g);
                            onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: nextGroups } });
                        }}
                        title="Click to remove color"
                    />
                ))}
                {group.colors.length > 0 && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            const nextGroups = f.maskGroups.map(g => g.id === group.id ? { ...g, colors: [] } : g);
                            onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: nextGroups } });
                        }}
                        className="w-3 h-3 rounded-full border border-red-400/50 text-red-400/50 hover:text-red-400 hover:border-red-400 flex items-center justify-center text-[6px] transition-colors"
                        title="Clear all colors"
                    >
                        ✕
                    </button>
                )}
                {group.colors.length === 0 && <span className="text-[8px] uppercase opacity-30">No colors picked</span>}
            </div>

            <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                    <span className="text-[8px] font-black uppercase text-white/30">Target Layer</span>
                    <select 
                        value={layerId || ''} 
                        onChange={e => onLayerChange(e.target.value || null)}
                        className="bg-black/40 text-[9px] font-bold uppercase rounded-lg border border-white/10 p-1 outline-none w-full"
                    >
                        <option value="">Default (Current Overlay)</option>
                        <optgroup label="Combined Stack">
                            <option value={ALL_LAYERS_TARGET_ID}>✨ All Layers (3D + Visible 2D Stack)</option>
                        </optgroup>
                        {sceneGroups.length > 0 && (
                            <optgroup label="Scene Groups">
                                {sceneGroups.map(sg => (
                                    <option key={sg.id} value={sg.id}>
                                        📁 {sg.name} ({sg.overlays.length + sg.threeDObjects.length + sg.images.length} items)
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {threeDObjects.length > 0 && (
                            <optgroup label="3D Objects">
                                <option value={makeThreeDTargetId('all')}>🧊 All 3D Objects (Scene)</option>
                                {threeDObjects.map(obj => (
                                    <option key={obj.id} value={makeThreeDTargetId(obj.id)}>🧊 {obj.name}</option>
                                ))}
                            </optgroup>
                        )}
                        {linkedGroups.length > 0 && (
                            <optgroup label="Linked Layers">
                                {linkedGroups.map(lg => (
                                    <option key={lg.id} value={lg.id}>🔗 {lg.name} ({lg.layers.length} layers)</option>
                                ))}
                            </optgroup>
                        )}
                        <optgroup label="Individual Layers">
                            {allOverlays.filter(o => !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id) && !isSceneGroupId(o.id)).map(o => (
                                <option key={o.id} value={o.id}>{o.name} {o.id === activeOverlay.id ? '(Current)' : ''}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <FilterSlider 
                    label="Tol" 
                    min={0} max={100} 
                    value={group.tolerance} 
                    defaultValue={0}
                    onChange={v => {
                        const next = f.maskGroups.map(g => g.id === group.id ? { ...g, tolerance: v } : g);
                        onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: next } });
                    }} 
                />

                {(isThreeDTargetId(layerId) || isAllLayersTargetId(layerId) || isSceneGroupId(layerId) || (!layerId && (isThreeDTargetId(activeOverlay.id) || isThreeDTargetId(activeOverlay.src) || isAllLayersTargetId(activeOverlay.id) || isAllLayersTargetId(activeOverlay.src) || isSceneGroupId(activeOverlay.id) || isSceneGroupId(activeOverlay.src)))) && (
                    <div className="pt-1 border-t border-cyan-500/20 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-cyan-400 tracking-wider">
                                🧊 3D Border Height Overhang
                            </span>
                            <span className="text-[8px] font-mono text-cyan-300/70">
                                {group.threeDElevation ?? 0}px
                            </span>
                        </div>
                        <FilterSlider 
                            label="Height" 
                            min={0} max={100} 
                            value={group.threeDElevation ?? 0} 
                            defaultValue={0}
                            onChange={v => {
                                const next = f.maskGroups.map(g => g.id === group.id ? { ...g, threeDElevation: v } : g);
                                onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskGroups: next } });
                            }} 
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div style={{ display: isOpen ? 'block' : 'none' }}>
            <DraggableContainer 
                initialPos={{ x: 100, y: 100 }} 
                resizable={true}
                size={panelSize}
                onResize={setPanelSize}
                minWidth={400}
                minHeight={400}
                className="bg-[#0d1117]/95 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col z-[1000] max-h-[90vh] overflow-hidden"
            >
            <div className="p-4 border-b border-white/5 flex justify-between items-center drag-handle cursor-move bg-white/5">
                <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Configuring Overlay</span>
                        <select 
                            value={activeOverlay.id}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (isLinkedGroupId(val)) {
                                    const grp = linkedGroups.find(g => g.id === val);
                                    if (grp && grp.layers[0]) setOpenSettingsId(grp.layers[0].id);
                                } else {
                                    setOpenSettingsId(val);
                                }
                            }}
                            className="bg-transparent text-[10px] font-bold uppercase text-white outline-none cursor-pointer hover:text-emerald-400 transition-colors"
                        >
                            <optgroup label="Combined Stack" className="bg-[#0d1117]">
                                <option value={ALL_LAYERS_TARGET_ID} className="bg-[#0d1117] text-emerald-300">✨ All Layers (3D + Visible 2D Stack)</option>
                            </optgroup>
                            {sceneGroups.length > 0 && (
                                <optgroup label="Scene Groups" className="bg-[#0d1117]">
                                    {sceneGroups.map(sg => (
                                        <option key={sg.id} value={sg.id} className="bg-[#0d1117] text-emerald-300">
                                            📁 {sg.name} (Group)
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {threeDObjects.length > 0 && (
                                <optgroup label="3D Objects" className="bg-[#0d1117]">
                                    <option value={makeThreeDTargetId('all')} className="bg-[#0d1117] text-cyan-300">🧊 All 3D Objects (Scene)</option>
                                    {threeDObjects.map(obj => (
                                        <option key={obj.id} value={makeThreeDTargetId(obj.id)} className="bg-[#0d1117] text-cyan-300">🧊 {obj.name}</option>
                                    ))}
                                </optgroup>
                            )}
                            {linkedGroups.length > 0 && (
                                <optgroup label="Linked Layers" className="bg-[#0d1117]">
                                    {linkedGroups.map(lg => (
                                        <option key={lg.id} value={lg.id} className="bg-[#0d1117] text-sky-400">🔗 {lg.name} (Linked)</option>
                                    ))}
                                </optgroup>
                            )}
                            <optgroup label="Individual Layers" className="bg-[#0d1117]">
                                {allOverlays.filter(o => !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id) && !isSceneGroupId(o.id)).map(o => (
                                    <option key={o.id} value={o.id} className="bg-[#0d1117]">{o.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={toggleAllPreview} 
                        className={`px-3 py-1 border text-[8px] font-black uppercase rounded-lg transition-all active:scale-95 ${previewMaskId === activeOverlay.id ? 'bg-cyan-500 border-cyan-300 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                    >
                        Preview
                    </button>
                    <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">✕</button>
                </div>
            </div>

            <div className="flex border-b border-white/5 bg-black/20">
                <button 
                    onClick={() => setActiveTab('color')}
                    className={`flex-grow py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'color' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5' : 'text-white/30 hover:text-white/60'}`}
                >
                    Color Groups
                </button>
                <button 
                    onClick={() => setActiveTab('depth')}
                    className={`flex-grow py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'depth' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/5' : 'text-white/30 hover:text-white/60'}`}
                >
                    Depth Injection
                </button>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto scrollbar-hide flex-grow">
                {activeTab === 'color' ? (
                    <>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Color Groups</span>
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => onUpdateOverlay(activeOverlay.id, { filters: { ...f, globalMode: !f.globalMode } })}
                                        className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${f.globalMode ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-white/30'}`}
                                        title="Apply to all pixels regardless of color"
                                    >
                                        Global Mode
                                    </button>
                                    {f.maskGroups.length > 1 && (
                                        <div className="flex items-center bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                                            <button 
                                                onClick={autoDivideColors}
                                                className="px-2 py-1 hover:bg-white/10 text-[8px] font-black uppercase text-emerald-400 border-r border-white/10 transition-all active:scale-95"
                                                title="Divide all current colors among groups"
                                            >
                                                Auto-Divide
                                            </button>
                                            <select 
                                                value={divideMode}
                                                onChange={(e) => setDivideMode(e.target.value as 'brightness' | 'hue')}
                                                className="bg-transparent text-[8px] font-bold uppercase text-white/60 px-1 outline-none cursor-pointer"
                                            >
                                                <option value="brightness" className="bg-[#0d1117]">Bri</option>
                                                <option value="hue" className="bg-[#0d1117]">Hue</option>
                                            </select>
                                        </div>
                                    )}
                                    <button 
                                        onClick={addMaskGroup}
                                        className="flex items-center space-x-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span className="text-[8px] font-bold uppercase">Add Group</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {f.maskGroups.map((group, idx) => renderGroup(
                                    group, 
                                    idx, 
                                    activeMaskGroupId, 
                                    setActiveMaskGroupId, 
                                    `mask-${idx}`, 
                                    (f.maskOverlayIds || [])[idx] || null, 
                                    (id) => {
                                        const nextIds = [...(f.maskOverlayIds || [])];
                                        nextIds[idx] = id;
                                        onUpdateOverlay(activeOverlay.id, { filters: { ...f, maskOverlayIds: nextIds } });
                                    }
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Transition Injection</span>
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col space-y-1">
                                        <span className="text-[8px] font-black uppercase text-white/30">Group 1</span>
                                        <select 
                                            value={f.transitionGroupAId || ''} 
                                            onChange={e => onUpdateOverlay(activeOverlay.id, { filters: { ...f, transitionGroupAId: e.target.value || null } })}
                                            className="bg-black/40 text-[9px] font-bold uppercase rounded-lg border border-white/10 p-1 outline-none"
                                        >
                                            <option value="">None</option>
                                            {f.maskGroups.map((g, i) => (
                                                <option key={g.id} value={g.id}>Group {String.fromCharCode(65 + i)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <span className="text-[8px] font-black uppercase text-white/30">Group 2</span>
                                        <select 
                                            value={f.transitionGroupBId || ''} 
                                            onChange={e => onUpdateOverlay(activeOverlay.id, { filters: { ...f, transitionGroupBId: e.target.value || null } })}
                                            className="bg-black/40 text-[9px] font-bold uppercase rounded-lg border border-white/10 p-1 outline-none"
                                        >
                                            <option value="">None</option>
                                            {f.maskGroups.map((g, i) => (
                                                <option key={g.id} value={g.id}>Group {String.fromCharCode(65 + i)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col space-y-1">
                                    <span className="text-[8px] font-black uppercase text-white/30">Transition Layer</span>
                                    <select 
                                        value={f.transitionOverlayId || ''} 
                                        onChange={e => onUpdateOverlay(activeOverlay.id, { filters: { ...f, transitionOverlayId: e.target.value || null } })}
                                        className="bg-black/40 text-[9px] font-bold uppercase rounded-lg border border-white/10 p-1 outline-none w-full"
                                    >
                                        <option value="">None</option>
                                        <optgroup label="Combined Stack">
                                            <option value={ALL_LAYERS_TARGET_ID}>✨ All Layers (3D + Visible 2D Stack)</option>
                                        </optgroup>
                                        {threeDObjects.length > 0 && (
                                            <optgroup label="3D Objects">
                                                <option value={makeThreeDTargetId('all')}>🧊 All 3D Objects (Scene)</option>
                                                {threeDObjects.map(obj => (
                                                    <option key={obj.id} value={makeThreeDTargetId(obj.id)}>🧊 {obj.name}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {linkedGroups.length > 0 && (
                                            <optgroup label="Linked Layers">
                                                {linkedGroups.map(lg => (
                                                    <option key={lg.id} value={lg.id}>🔗 {lg.name} ({lg.layers.length} layers)</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="Individual Layers">
                                            {allOverlays.filter(o => o.id !== activeOverlay.id && !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id)).map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FilterSlider label="Thickness" min={1} max={50} value={f.contourThickness} defaultValue={5} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, contourThickness: v } })} />
                                    <FilterSlider label="Feather" min={0} max={40} value={f.contourFeather} defaultValue={2} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, contourFeather: v } })} />
                                </div>
                                <FilterSlider label="Noise" min={0} max={20} value={f.contourNoise} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, contourNoise: v } })} />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Depth Settings</span>
                            <button 
                                onClick={() => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, enabled: !f.depthSettings.enabled } } })}
                                className={`px-3 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${f.depthSettings.enabled ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-white/5 border-white/10 text-white/30'}`}
                            >
                                {f.depthSettings.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>

                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Original Tile Adjustment</span>
                                <button 
                                    onClick={() => setIsOriginalColorModalOpen(true)}
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[10px] font-black uppercase text-white"
                                >
                                    <Palette className="w-3 h-3 text-cyan-400" />
                                    <span>Original Colors</span>
                                </button>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <span className="text-[8px] font-black uppercase text-white/30">Injection Strength (Blend with Original)</span>
                                <FilterSlider 
                                    label="Strength" 
                                    min={0} max={100} 
                                    value={f.injectionStrength} 
                                    defaultValue={100} 
                                    onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, injectionStrength: v } })} 
                                />
                            </div>

                            <div className="flex flex-col space-y-1">
                                <span className="text-[8px] font-black uppercase text-white/30">Depth Source Layer</span>
                                <select 
                                    value={f.depthSettings.depthOverlayId || ''} 
                                    onChange={e => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, depthOverlayId: e.target.value || null } } })}
                                    className="bg-black/40 text-[9px] font-bold uppercase rounded-lg border border-white/10 p-1 outline-none w-full"
                                >
                                    <option value="base">Base Image (Original Tile)</option>
                                    <option value="">None</option>
                                    <optgroup label="Combined Stack">
                                        <option value={ALL_LAYERS_TARGET_ID}>✨ All Layers (3D + Visible 2D Stack)</option>
                                    </optgroup>
                                    {threeDObjects.length > 0 && (
                                        <optgroup label="3D Objects">
                                            <option value={makeThreeDTargetId('all')}>🧊 All 3D Objects (Scene)</option>
                                            {threeDObjects.map(obj => (
                                                <option key={obj.id} value={makeThreeDTargetId(obj.id)}>🧊 {obj.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {linkedGroups.length > 0 && (
                                        <optgroup label="Linked Layers">
                                            {linkedGroups.map(lg => (
                                                <option key={lg.id} value={lg.id}>🔗 {lg.name} ({lg.layers.length} layers)</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    <optgroup label="Individual Layers">
                                        {allOverlays.filter(o => !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id)).map(o => (
                                            <option key={o.id} value={o.id}>{o.name} {o.id === activeOverlay.id ? '(Current)' : ''}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FilterSlider label="Blend" min={0} max={100} value={f.depthSettings.blendStrength} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, blendStrength: v } } })} />
                                <FilterSlider label="Hue" min={-180} max={180} value={f.depthSettings.hueShift} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, hueShift: v } } })} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <FilterSlider label="Sat" min={0} max={200} value={f.depthSettings.saturationShift} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, saturationShift: v } } })} />
                                <FilterSlider label="Val" min={0} max={200} value={f.depthSettings.valueShift} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, valueShift: v } } })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FilterSlider label="Bri" min={0} max={200} value={f.depthSettings.brightness} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, brightness: v } } })} />
                                <FilterSlider label="Con" min={0} max={200} value={f.depthSettings.contrast} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, contrast: v } } })} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Depth Adjustments</span>
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FilterSlider label="Black" min={0} max={100} value={f.depthSettings.blackLevel} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, blackLevel: v } } })} />
                                    <FilterSlider label="White" min={0} max={100} value={f.depthSettings.whiteLevel} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, whiteLevel: v } } })} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Invert Depth</span>
                                    <button 
                                        onClick={() => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, invert: !f.depthSettings.invert } } })}
                                        className={`px-3 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${f.depthSettings.invert ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-white/30'}`}
                                    >
                                        {f.depthSettings.invert ? 'Inverted' : 'Normal'}
                                    </button>
                                </div>
                                <FilterSlider label="Luminance" min={0} max={100} value={f.depthSettings.luminanceInfluence} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, luminanceInfluence: v } } })} />
                                <FilterSlider label="Smoothing" min={0} max={100} value={f.depthSettings.smartSmoothing} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, smartSmoothing: v } } })} />
                                <FilterSlider label="Posterize" min={0} max={100} value={f.depthSettings.posterize} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, posterize: v } } })} />
                                <FilterSlider label="Tolerance" min={0} max={100} value={f.depthSettings.depthTolerance} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, depthTolerance: v } } })} />
                                <FilterSlider label="Slope Comp" min={0} max={100} value={f.depthSettings.slopeCompensation} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, slopeCompensation: v } } })} />
                                <FilterSlider label="Edge Enhance" min={0} max={100} value={f.depthSettings.edgeEnhancement} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, edgeEnhancement: v } } })} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Color Adjustments</span>
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4">
                                <FilterSlider label="Greys" min={0} max={200} value={f.depthSettings.greyAdjustment} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, greyAdjustment: v } } })} />
                                <FilterSlider label="Greens" min={0} max={200} value={f.depthSettings.greenAdjustment} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, greenAdjustment: v } } })} />
                                <FilterSlider label="Browns" min={0} max={200} value={f.depthSettings.brownAdjustment} defaultValue={100} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, brownAdjustment: v } } })} />
                                <FilterSlider label="Smoothness" min={0} max={100} value={f.depthSettings.colorSmoothness} defaultValue={0} onChange={v => onUpdateOverlay(activeOverlay.id, { filters: { ...f, depthSettings: { ...f.depthSettings, colorSmoothness: v } } })} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex space-x-2 pt-6 border-t border-white/5">
                    {activeOverlay.type === 'smart' && (
                        <button 
                            onClick={() => {
                                setPreviewMaskId(null);
                                setPreviewGroupIds([]);
                                onBakeSmartOverlay(activeOverlay.id);
                            }} 
                            className="flex-grow bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white text-[10px] font-black uppercase py-3 rounded-2xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
                        >
                            Bake to Tiles
                        </button>
                    )}
                    {activeOverlay.type === 'tiled' && (
                        <button 
                            onClick={() => {
                                setPreviewMaskId(null);
                                setPreviewGroupIds([]);
                                onApplyMaskToImages(activeOverlay);
                            }} 
                            className="flex-grow bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 text-white text-[10px] font-black uppercase py-3 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                        >
                            Apply Permanent
                        </button>
                    )}
                    <button 
                        onClick={onUndoInjection} 
                        disabled={!canUndoInjection}
                        className={`px-4 border text-[10px] font-black uppercase py-3 rounded-2xl transition-all active:scale-95 ${canUndoInjection ? 'border-orange-500/30 bg-orange-900/20 text-orange-400 hover:bg-orange-900/40' : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'}`}
                        title="Undo Texture Injection"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={toggleAllPreview} 
                        className={`px-6 border text-[10px] font-black uppercase py-3 rounded-2xl transition-all active:scale-95 ${previewMaskId === activeOverlay.id ? 'bg-cyan-500 border-cyan-300 text-white shadow-lg shadow-cyan-900/20' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                    >
                        Preview
                    </button>
                </div>
            </div>

            <OriginalColorModal 
                isOpen={isOriginalColorModalOpen}
                onClose={() => setIsOriginalColorModalOpen(false)}
                onApply={(settings) => {
                    onApplyOriginalColorAdjustment(settings);
                    setIsOriginalColorModalOpen(false);
                }}
                onUndo={onUndoOriginalColor}
                canUndo={canUndoOriginalColor}
                isEyedropperActive={isGlobalEyedropperActive}
                setIsEyedropperActive={setIsGlobalEyedropperActive}
                pickedColor={pickedColor}
            />
        </DraggableContainer>
        </div>
    );
};
