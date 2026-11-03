import React, { useState, useEffect } from 'react';
import { LucideLayers, LucideBox, LucideLoader2 } from 'lucide-react';
import type { ProjectOverlay } from '../../../types';
import { getLinkedGroups } from '../../../utils/layerLinkUtils';

interface ThreeDLayerToPlaneSectionProps {
    overlays: ProjectOverlay[];
    onConvertLayerToPlane: (layerOrGroupId: string) => Promise<void> | void;
    isConverting?: boolean;
}

export const ThreeDLayerToPlaneSection: React.FC<ThreeDLayerToPlaneSectionProps> = ({
    overlays,
    onConvertLayerToPlane,
    isConverting = false,
}) => {
    const linkedGroups = getLinkedGroups(overlays);
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');

    useEffect(() => {
        if (!selectedTargetId && overlays.length > 0) {
            if (linkedGroups.length > 0) {
                setSelectedTargetId(linkedGroups[0].id);
            } else {
                setSelectedTargetId(overlays[overlays.length - 1].id);
            }
        } else if (
            selectedTargetId &&
            !overlays.some((o) => o.id === selectedTargetId) &&
            !linkedGroups.some((g) => g.id === selectedTargetId)
        ) {
            setSelectedTargetId(overlays[overlays.length - 1]?.id || '');
        }
    }, [overlays, linkedGroups, selectedTargetId]);

    if (overlays.length === 0) return null;

    return (
        <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <LucideLayers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Layer to 3D Plane
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                    Un-Transform UV
                </span>
            </div>

            <div className="flex items-center space-x-2">
                <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    disabled={isConverting}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                >
                    {linkedGroups.length > 0 && (
                        <optgroup label="Linked Layers">
                            {linkedGroups.map((grp) => (
                                <option key={grp.id} value={grp.id}>
                                    🔗 {grp.name} ({grp.layers.length} layers)
                                </option>
                            ))}
                        </optgroup>
                    )}
                    <optgroup label="Individual Layers">
                        {[...overlays].reverse().map((ov) => (
                            <option key={ov.id} value={ov.id}>
                                {ov.name || ov.id} ({ov.repeatX || 1}×{ov.repeatY || 1} {ov.type})
                            </option>
                        ))}
                    </optgroup>
                </select>

                <button
                    type="button"
                    disabled={!selectedTargetId || isConverting}
                    onClick={() => {
                        if (selectedTargetId) {
                            onConvertLayerToPlane(selectedTargetId);
                        }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-1.5 shadow-md border border-indigo-400/30 shrink-0 cursor-pointer"
                    title="Bake high-res layer, un-transform isometric diamond to flat UV texture, and spawn 3D plane"
                >
                    {isConverting ? (
                        <LucideLoader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <LucideBox className="w-3.5 h-3.5" />
                    )}
                    <span>To 3D Plane</span>
                </button>
            </div>
        </div>
    );
};
