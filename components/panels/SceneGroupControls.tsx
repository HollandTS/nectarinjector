import React, { useRef, useState } from 'react';
import type { CanvasImage, ProjectOverlay, ThreeDObject } from '../../types';
import {
    getSceneGroups,
    createSceneGroupFromSelection,
    updateSceneGroupProperties,
    ungroupSceneGroup,
    saveSceneGroupToFile,
    loadSceneGroupFromFile,
    SceneGroupInfo,
} from '../../utils/sceneGroupUtils';
import { CreateSceneGroupModal } from '../modals/CreateSceneGroupModal';
import {
    LucideFolderPlus,
    LucideFolderOpen,
    LucideFolder,
    LucideDownload,
    LucideUnlink,
    LucideMove,
} from 'lucide-react';

interface SceneGroupControlsProps {
    overlays: ProjectOverlay[];
    threeDObjects: ThreeDObject[];
    images: CanvasImage[];
    checkedOverlayIds: string[];
    checkedThreeDIds: string[];
    checkedImageIds: string[];
    totalCheckedCount: number;
    onClearChecked: () => void;
    onApplyHierarchy: (
        nextOverlays: ProjectOverlay[],
        nextThreeDObjects: ThreeDObject[],
        nextImages: CanvasImage[]
    ) => void;
}

export const SceneGroupControls: React.FC<SceneGroupControlsProps> = ({
    overlays,
    threeDObjects,
    images,
    checkedOverlayIds,
    checkedThreeDIds,
    checkedImageIds,
    totalCheckedCount,
    onClearChecked,
    onApplyHierarchy,
}) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sceneGroups = getSceneGroups(overlays, threeDObjects, images);

    const handleConfirmCreateGroup = (groupName: string, moveTogether: boolean) => {
        const selectedUids = new Set<string>();
        checkedOverlayIds.forEach((id) => selectedUids.add(`layer:${id}`));
        checkedThreeDIds.forEach((id) => selectedUids.add(`3d:${id}`));
        checkedImageIds.forEach((id) => selectedUids.add(`tile:${id}`));

        const { nextOverlays, nextThreeDObjects, nextImages } = createSceneGroupFromSelection(
            selectedUids,
            groupName,
            moveTogether,
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
        setIsCreateModalOpen(false);
        onClearChecked();
    };

    const handleToggleMoveTogether = (groupId: string, currentVal: boolean) => {
        const { nextOverlays, nextThreeDObjects, nextImages } = updateSceneGroupProperties(
            groupId,
            { moveTogether: !currentVal },
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
    };

    const handleUngroup = (groupId: string) => {
        const { nextOverlays, nextThreeDObjects, nextImages } = ungroupSceneGroup(
            groupId,
            overlays,
            threeDObjects,
            images
        );
        onApplyHierarchy(nextOverlays, nextThreeDObjects, nextImages);
    };

    const handleSaveGroup = async (group: SceneGroupInfo) => {
        try {
            setStatusMessage('Saving .nectargroup...');
            await saveSceneGroupToFile(group);
            setStatusMessage(null);
        } catch (err: any) {
            setStatusMessage(`Save failed: ${err?.message || 'Error'}`);
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const handleLoadGroupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        try {
            setStatusMessage('Loading .nectargroup...');
            const loaded = await loadSceneGroupFromFile(file);
            onApplyHierarchy(
                [...overlays, ...loaded.overlays],
                [...threeDObjects, ...loaded.threeDObjects],
                [...images, ...loaded.images]
            );
            setStatusMessage(`Loaded "${loaded.groupName}"`);
            setTimeout(() => setStatusMessage(null), 2500);
        } catch (err: any) {
            setStatusMessage(`Load failed: ${err?.message || 'Invalid file'}`);
            setTimeout(() => setStatusMessage(null), 3500);
        }
    };

    return (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2 shrink-0">
            <input
                ref={fileInputRef}
                type="file"
                accept=".nectargroup,.zip"
                onChange={handleLoadGroupFile}
                className="hidden"
            />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5">
                    <LucideFolder className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                        Scene Groups
                    </span>
                    {totalCheckedCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8px] font-bold">
                            {totalCheckedCount} selected
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-1">
                    <button
                        type="button"
                        disabled={totalCheckedCount === 0}
                        onClick={() => setIsCreateModalOpen(true)}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
                            totalCheckedCount > 0
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50 shadow-md shadow-emerald-950/50 cursor-pointer'
                                : 'bg-slate-800/60 text-slate-500 border-slate-700/50 opacity-50 cursor-not-allowed'
                        }`}
                        title={
                            totalCheckedCount > 0
                                ? 'Create a Scene Group from the selected items'
                                : 'Select any layer, 3D object, or tile below to enable Create Group'
                        }
                    >
                        <LucideFolderPlus className="w-3 h-3" />
                        <span>Create Group</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        title="Load a saved .nectargroup file into the scene"
                    >
                        <LucideFolderOpen className="w-3 h-3 text-emerald-400" />
                        <span>Load</span>
                    </button>
                </div>
            </div>

            {statusMessage && (
                <div className="text-[9px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2 py-1">
                    {statusMessage}
                </div>
            )}

            {sceneGroups.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80 max-h-28 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                    {sceneGroups.map((sg) => (
                        <div
                            key={sg.id}
                            className="flex items-center justify-between gap-1.5 bg-[#141920] border border-emerald-500/30 rounded-lg px-2 py-1.5"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                    <span className="text-[10px] font-black text-emerald-300 truncate">
                                        {sg.name}
                                    </span>
                                    <span className="text-[8px] font-mono text-slate-400 shrink-0">
                                        ({sg.overlays.length}L · {sg.threeDObjects.length} 3D · {sg.images.length}T)
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                                {/* Move Together Checkbox */}
                                <label
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800/90 hover:bg-slate-800 border border-slate-700 cursor-pointer select-none"
                                    title="When checked, dragging any layer, 3D object, or tile in this group moves the entire group together"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sg.moveTogether}
                                        onChange={() =>
                                            handleToggleMoveTogether(sg.id, sg.moveTogether)
                                        }
                                        className="w-3 h-3 rounded border-slate-600 bg-slate-900 accent-emerald-500 cursor-pointer"
                                    />
                                    <LucideMove className="w-2.5 h-2.5 text-emerald-400" />
                                    <span className="text-[8px] font-black uppercase text-slate-200">
                                        Move Together
                                    </span>
                                </label>

                                {/* Save .nectargroup */}
                                <button
                                    type="button"
                                    onClick={() => handleSaveGroup(sg)}
                                    className="p-1 rounded bg-emerald-950/60 hover:bg-emerald-800/70 text-emerald-300 hover:text-white border border-emerald-500/30 transition-colors cursor-pointer"
                                    title="Save group as .nectargroup file"
                                >
                                    <LucideDownload className="w-3 h-3" />
                                </button>

                                {/* Ungroup */}
                                <button
                                    type="button"
                                    onClick={() => handleUngroup(sg.id)}
                                    className="p-1 rounded bg-slate-800 hover:bg-red-950/70 text-slate-400 hover:text-red-300 border border-slate-700 transition-colors cursor-pointer"
                                    title="Ungroup items (keeps items in place)"
                                >
                                    <LucideUnlink className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateSceneGroupModal
                isOpen={isCreateModalOpen}
                itemCount={totalCheckedCount}
                defaultName={`Scene Group ${sceneGroups.length + 1}`}
                onConfirm={handleConfirmCreateGroup}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    );
};
