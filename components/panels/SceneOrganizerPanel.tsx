import React, { useState } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { CanvasImage, ProjectOverlay, ThreeDObject } from '../../types';
import {
    buildUnifiedSceneList,
    applySceneHierarchyOrder,
    SceneHierarchyEntry,
} from '../../utils/sceneOrderHelper';
import { SceneGroupControls } from './SceneGroupControls';
import {
    LucideLayers,
    LucideBox,
    LucideGrid,
    LucideArrowUp,
    LucideArrowDown,
    LucideChevronsUp,
    LucideChevronsDown,
    LucideEye,
    LucideEyeOff,
    LucideMinus,
    LucideMaximize2,
    LucideX,
    LucideGripVertical,
    LucideFolder,
} from 'lucide-react';

interface SceneOrganizerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    overlays: ProjectOverlay[];
    threeDObjects: ThreeDObject[];
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    selectedThreeDObjectId: string | null;
    setSelectedThreeDObjectId: (id: string | null) => void;
    openSettingsId: string | null;
    setOpenSettingsId: (id: string | null) => void;
    showThreeDObjects: boolean;
    setShowThreeDObjects: (v: boolean) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
    onUpdateThreeDObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    onApplyHierarchy: (
        nextOverlays: ProjectOverlay[],
        nextThreeDObjects: ThreeDObject[],
        nextImages: CanvasImage[]
    ) => void;
}

export const SceneOrganizerPanel: React.FC<SceneOrganizerPanelProps> = ({
    isOpen,
    onClose,
    overlays,
    threeDObjects,
    images,
    selectedImageIds,
    setSelectedImageIds,
    selectedThreeDObjectId,
    setSelectedThreeDObjectId,
    openSettingsId,
    setOpenSettingsId,
    showThreeDObjects,
    setShowThreeDObjects,
    onUpdateOverlay,
    onUpdateThreeDObject,
    onApplyHierarchy,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [groupTiles, setGroupTiles] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'layer' | '3d' | 'tile'>('all');
    const [draggedUid, setDraggedUid] = useState<string | null>(null);
    const [dragOverUid, setDragOverUid] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 390, height: 590 });
    const [checkedUids, setCheckedUids] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const fullList = buildUnifiedSceneList(overlays, threeDObjects, images, groupTiles);

    const visibleList = fullList.filter((item) => {
        if (filterType === 'all') return true;
        if (filterType === 'layer') return item.itemType === 'layer';
        if (filterType === '3d') return item.itemType === '3d';
        if (filterType === 'tile') return item.itemType === 'tile' || item.itemType === 'tiles-group';
        return true;
    });

    // Compute selected items for Create Group: either explicitly checked via row checkboxes or currently active/selected
    const effectiveCheckedUids = new Set(checkedUids);
    fullList.forEach((entry) => {
        if (checkedUids.size === 0) {
            if (entry.itemType === 'layer' && openSettingsId === entry.id) effectiveCheckedUids.add(entry.uid);
            if (entry.itemType === '3d' && selectedThreeDObjectId === entry.id) effectiveCheckedUids.add(entry.uid);
            if (entry.itemType === 'tile' && selectedImageIds.has(entry.id)) effectiveCheckedUids.add(entry.uid);
            if (entry.itemType === 'tiles-group' && images.length > 0 && selectedImageIds.size === images.length) {
                effectiveCheckedUids.add(entry.uid);
            }
        }
    });

    const checkedOverlayIds: string[] = [];
    const checkedThreeDIds: string[] = [];
    const checkedImageIdSet = new Set<string>();

    fullList.forEach((entry) => {
        if (!effectiveCheckedUids.has(entry.uid)) return;
        if (entry.itemType === 'layer') checkedOverlayIds.push(entry.id);
        else if (entry.itemType === '3d') checkedThreeDIds.push(entry.id);
        else if (entry.itemType === 'tile') checkedImageIdSet.add(entry.id);
        else if (entry.itemType === 'tiles-group') {
            images.forEach((img) => checkedImageIdSet.add(img.id));
        }
    });
    const checkedImageIds = Array.from(checkedImageIdSet);
    const totalCheckedCount =
        checkedOverlayIds.length + checkedThreeDIds.length + checkedImageIds.length;

    const toggleEntryChecked = (entry: SceneHierarchyEntry) => {
        setCheckedUids((prev) => {
            const next = new Set(prev);
            if (next.has(entry.uid)) next.delete(entry.uid);
            else next.add(entry.uid);
            return next;
        });
    };

    const moveItemByUid = (uid: string, action: 'top' | 'up' | 'down' | 'bottom') => {
        const idx = fullList.findIndex((item) => item.uid === uid);
        if (idx === -1) return;

        const reordered = [...fullList];
        const [item] = reordered.splice(idx, 1);

        let targetIdx = idx;
        if (action === 'top') targetIdx = 0;
        else if (action === 'bottom') targetIdx = reordered.length;
        else if (action === 'up') targetIdx = Math.max(0, idx - 1);
        else if (action === 'down') targetIdx = Math.min(reordered.length, idx + 1);

        reordered.splice(targetIdx, 0, item);

        const { nextOverlays, nextThreeDObjects, nextImages } = applySceneHierarchyOrder(
            reordered,
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
    };

    const handleDropOnItem = (targetUid: string) => {
        if (!draggedUid || draggedUid === targetUid) {
            setDraggedUid(null);
            setDragOverUid(null);
            return;
        }
        const fromIdx = fullList.findIndex((i) => i.uid === draggedUid);
        const toIdx = fullList.findIndex((i) => i.uid === targetUid);
        if (fromIdx === -1 || toIdx === -1) {
            setDraggedUid(null);
            setDragOverUid(null);
            return;
        }

        const reordered = [...fullList];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);

        const { nextOverlays, nextThreeDObjects, nextImages } = applySceneHierarchyOrder(
            reordered,
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
        setDraggedUid(null);
        setDragOverUid(null);
    };

    const handleQuickPreset = (preset: '3d-top' | 'layers-top' | 'tiles-top') => {
        const sorted = [...fullList].sort((a, b) => {
            const rank = (entry: SceneHierarchyEntry) => {
                if (preset === '3d-top') {
                    if (entry.itemType === '3d') return 3;
                    if (entry.itemType === 'layer') return 2;
                    return 1;
                }
                if (preset === 'layers-top') {
                    if (entry.itemType === 'layer') return 3;
                    if (entry.itemType === '3d') return 2;
                    return 1;
                }
                // tiles-top
                if (entry.itemType === 'tile' || entry.itemType === 'tiles-group') return 3;
                if (entry.itemType === '3d') return 2;
                return 1;
            };
            const rDiff = rank(b) - rank(a);
            if (rDiff !== 0) return rDiff;
            return b.stackOrder - a.stackOrder;
        });

        const { nextOverlays, nextThreeDObjects, nextImages } = applySceneHierarchyOrder(
            sorted,
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
    };

    const handleSelectEntry = (entry: SceneHierarchyEntry) => {
        toggleEntryChecked(entry);
        if (entry.itemType === 'layer') {
            setOpenSettingsId(openSettingsId === entry.id ? null : entry.id);
        } else if (entry.itemType === '3d') {
            setSelectedThreeDObjectId(entry.id);
        } else if (entry.itemType === 'tile') {
            setSelectedImageIds(new Set([entry.id]));
        } else if (entry.itemType === 'tiles-group') {
            setSelectedImageIds(new Set(images.map((i) => i.id)));
        }
    };

    const isEntrySelected = (entry: SceneHierarchyEntry): boolean => {
        if (effectiveCheckedUids.has(entry.uid)) return true;
        if (entry.itemType === 'layer') return openSettingsId === entry.id;
        if (entry.itemType === '3d') return selectedThreeDObjectId === entry.id;
        if (entry.itemType === 'tile') return selectedImageIds.has(entry.id);
        if (entry.itemType === 'tiles-group')
            return images.length > 0 && selectedImageIds.size === images.length;
        return false;
    };

    return (
        <DraggableContainer
            initialPos={{ x: Math.max(20, Math.round(window.innerWidth / 2 - 195)), y: 68 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={350}
            minHeight={isMinimized ? 52 : 360}
            className="bg-[#161b22]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[1200] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 bg-slate-900/80 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <LucideLayers className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                            Scene Order Organizer
                        </h2>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Order, group & save layers, 3D objects & tiles
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand Window' : 'Minimize Window'}
                    >
                        {isMinimized ? (
                            <LucideMaximize2 className="w-4 h-4" />
                        ) : (
                            <LucideMinus className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close Scene Organizer"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col overflow-hidden">
                    <SceneGroupControls
                        overlays={overlays}
                        threeDObjects={threeDObjects}
                        images={images}
                        checkedOverlayIds={checkedOverlayIds}
                        checkedThreeDIds={checkedThreeDIds}
                        checkedImageIds={checkedImageIds}
                        totalCheckedCount={totalCheckedCount}
                        onClearChecked={() => setCheckedUids(new Set())}
                        onApplyHierarchy={onApplyHierarchy}
                    />
                    {/* Top Quick Presets & Group Tiles Toggle */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 space-y-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Quick Stack Presets
                            </span>
                            <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={groupTiles}
                                    onChange={(e) => setGroupTiles(e.target.checked)}
                                    className="w-3 h-3 rounded border-slate-700 bg-slate-900 accent-amber-500 cursor-pointer"
                                />
                                <span className="text-[9px] font-bold uppercase text-amber-300">
                                    Group Isotiles
                                </span>
                            </label>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleQuickPreset('3d-top')}
                                className="py-1.5 px-2 rounded-lg bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/40 text-purple-300 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                title="Bring all 3D Objects to the very top"
                            >
                                3D on Top
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickPreset('layers-top')}
                                className="py-1.5 px-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 border border-cyan-500/40 text-cyan-300 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                title="Bring all 2D Layers to the very top"
                            >
                                Layers Top
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickPreset('tiles-top')}
                                className="py-1.5 px-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/40 text-amber-300 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                title="Bring all Isotiles to the very top"
                            >
                                Tiles Top
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
                        {(
                            [
                                { id: 'all', label: `All (${fullList.length})` },
                                { id: '3d', label: `3D (${threeDObjects.length})` },
                                { id: 'layer', label: `Layers (${overlays.length})` },
                                { id: 'tile', label: `Tiles (${images.length})` },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilterType(tab.id)}
                                className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    filterType === tab.id
                                        ? 'bg-emerald-600 text-white shadow'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Top-to-Bottom Stack List */}
                    <div className="flex items-center justify-between px-1 shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                            ▲ Top of Canvas (In Front)
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                            Drag rows to reorder
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                        {visibleList.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    No Items in Scene
                                </p>
                            </div>
                        ) : (
                            visibleList.map((entry, idx) => {
                                const isSelected = isEntrySelected(entry);
                                const isDragTarget = dragOverUid === entry.uid && draggedUid !== entry.uid;

                                const badgeStyle =
                                    entry.itemType === '3d'
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                        : entry.itemType === 'layer'
                                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                                return (
                                    <div
                                        key={entry.uid}
                                        draggable
                                        onDragStart={() => setDraggedUid(entry.uid)}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (dragOverUid !== entry.uid) {
                                                setDragOverUid(entry.uid);
                                            }
                                        }}
                                        onDragEnd={() => {
                                            setDraggedUid(null);
                                            setDragOverUid(null);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleDropOnItem(entry.uid);
                                        }}
                                        onClick={() => handleSelectEntry(entry)}
                                        className={`p-2 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer select-none ${
                                            isDragTarget
                                                ? 'border-emerald-400 bg-emerald-950/30 shadow-lg'
                                                : isSelected
                                                ? 'bg-slate-800/90 border-emerald-500/60 shadow-md'
                                                : 'bg-[#1c2128]/90 border-slate-700/50 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={effectiveCheckedUids.has(entry.uid)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleEntryChecked(entry);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 accent-emerald-500 cursor-pointer shrink-0"
                                                    title="Select for grouping"
                                                />
                                                <LucideGripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0 cursor-grab" />
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 flex items-center gap-1 ${badgeStyle}`}
                                                >
                                                    {entry.itemType === '3d' && (
                                                        <LucideBox className="w-2.5 h-2.5" />
                                                    )}
                                                    {entry.itemType === 'layer' && (
                                                        <LucideLayers className="w-2.5 h-2.5" />
                                                    )}
                                                    {(entry.itemType === 'tile' ||
                                                        entry.itemType === 'tiles-group') && (
                                                        <LucideGrid className="w-2.5 h-2.5" />
                                                    )}
                                                    <span>
                                                        {entry.itemType === '3d'
                                                            ? '3D'
                                                            : entry.itemType === 'layer'
                                                            ? 'Layer'
                                                            : 'Tiles'}
                                                    </span>
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-[11px] font-bold text-white truncate">
                                                            {entry.name}
                                                        </span>
                                                        {entry.sceneGroupName && (
                                                            <span
                                                                className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8px] font-black uppercase tracking-wider shrink-0 flex items-center gap-0.5"
                                                                title={`Grouped in "${entry.sceneGroupName}"`}
                                                            >
                                                                <LucideFolder className="w-2 h-2" />
                                                                {entry.sceneGroupName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[8px] text-slate-400 font-mono">
                                                        {entry.subLabel} · Z:{Math.round(entry.stackOrder)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Ordering & Visibility Controls */}
                                            <div
                                                className="flex items-center space-x-0.5 shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {entry.itemType === 'layer' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onUpdateOverlay(entry.id, {
                                                                isVisible: !entry.isVisible,
                                                            })
                                                        }
                                                        className={`p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer ${
                                                            entry.isVisible
                                                                ? 'text-cyan-400'
                                                                : 'text-slate-600'
                                                        }`}
                                                        title={
                                                            entry.isVisible
                                                                ? 'Hide Layer'
                                                                : 'Show Layer'
                                                        }
                                                    >
                                                        {entry.isVisible ? (
                                                            <LucideEye className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <LucideEyeOff className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                )}
                                                {entry.itemType === '3d' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setShowThreeDObjects(!showThreeDObjects)
                                                        }
                                                        className={`p-1 rounded hover:bg-slate-700 transition-colors cursor-pointer ${
                                                            showThreeDObjects
                                                                ? 'text-purple-400'
                                                                : 'text-slate-600'
                                                        }`}
                                                        title={
                                                            showThreeDObjects
                                                                ? 'Hide 3D Objects'
                                                                : 'Show 3D Objects'
                                                        }
                                                    >
                                                        {showThreeDObjects ? (
                                                            <LucideEye className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <LucideEyeOff className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => moveItemByUid(entry.uid, 'top')}
                                                    disabled={idx === 0 && filterType === 'all'}
                                                    className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700/70 disabled:opacity-30 transition-colors cursor-pointer"
                                                    title="Bring to Front (Very Top)"
                                                >
                                                    <LucideChevronsUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveItemByUid(entry.uid, 'up')}
                                                    disabled={idx === 0 && filterType === 'all'}
                                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 transition-colors cursor-pointer"
                                                    title="Move Up 1 Level"
                                                >
                                                    <LucideArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveItemByUid(entry.uid, 'down')}
                                                    disabled={
                                                        idx === visibleList.length - 1 &&
                                                        filterType === 'all'
                                                    }
                                                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 transition-colors cursor-pointer"
                                                    title="Move Down 1 Level"
                                                >
                                                    <LucideArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveItemByUid(entry.uid, 'bottom')}
                                                    disabled={
                                                        idx === visibleList.length - 1 &&
                                                        filterType === 'all'
                                                    }
                                                    className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700/70 disabled:opacity-30 transition-colors cursor-pointer"
                                                    title="Send to Back (Very Bottom)"
                                                >
                                                    <LucideChevronsDown className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inline Opacity Slider for 3D Objects & 2D Layers */}
                                        {(entry.itemType === '3d' || entry.itemType === 'layer') && (
                                            <div
                                                className="flex items-center space-x-2 pl-6 pr-1 pt-0.5"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="text-[8px] font-black uppercase text-slate-400 w-12">
                                                    Opacity
                                                </span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    value={Math.round(entry.opacity ?? 100)}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (entry.itemType === '3d') {
                                                            onUpdateThreeDObject(entry.id, {
                                                                opacity: val,
                                                            });
                                                        } else {
                                                            onUpdateOverlay(entry.id, {
                                                                opacity: val,
                                                            });
                                                        }
                                                    }}
                                                    className={`flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${
                                                        entry.itemType === '3d'
                                                            ? 'accent-purple-500'
                                                            : 'accent-cyan-500'
                                                    }`}
                                                />
                                                <span className="text-[9px] font-mono text-slate-300 w-8 text-right">
                                                    {Math.round(entry.opacity ?? 100)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="flex items-center justify-between px-1 shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            ▼ Bottom of Canvas (Behind)
                        </span>
                        <span className="text-[9px] text-slate-500">
                            {fullList.length} total items
                        </span>
                    </div>
                </div>
            )}
        </DraggableContainer>
    );
};
