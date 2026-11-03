import React, { useState } from 'react';
import type { ThreeDObject } from '../../../types';
import { buildMaterialCopyPayload } from '../../../utils/threeDNectarStorage';
import { LucideCopy, LucideCheck, LucideSparkles } from 'lucide-react';

interface ThreeDCopyMaterialSectionProps {
    object: ThreeDObject;
    allObjects: ThreeDObject[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDCopyMaterialSection: React.FC<ThreeDCopyMaterialSectionProps> = ({
    object,
    allObjects,
    onUpdateObject,
}) => {
    const otherObjects = allObjects.filter((o) => o.id !== object.id);
    const [sourceId, setSourceId] = useState<string>('');
    const [includeDisplacement, setIncludeDisplacement] = useState<boolean>(true);
    const [copiedFlash, setCopiedFlash] = useState<boolean>(false);

    if (otherObjects.length === 0) {
        return null;
    }

    const effectiveSourceId =
        sourceId && otherObjects.some((o) => o.id === sourceId)
            ? sourceId
            : otherObjects[0]?.id || '';

    const sourceObj = otherObjects.find((o) => o.id === effectiveSourceId);

    const handleCopyMaterial = () => {
        if (!sourceObj) return;
        const payload = buildMaterialCopyPayload(sourceObj, includeDisplacement);
        onUpdateObject(object.id, payload, true);
        setCopiedFlash(true);
        setTimeout(() => setCopiedFlash(false), 1600);
    };

    return (
        <div className="p-3 bg-indigo-950/25 rounded-xl border border-indigo-500/35 space-y-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                    <LucideSparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                        Get Material From Model
                    </span>
                </div>
                <span className="text-[10px] font-mono text-indigo-400/80">
                    All PBR Maps & Settings
                </span>
            </div>

            <div className="flex items-center space-x-2">
                <select
                    value={effectiveSourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="flex-1 min-w-0 bg-[#161b22] border border-slate-700 rounded-lg text-xs text-white px-2.5 py-1.5 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
                >
                    {otherObjects.map((o) => {
                        const mapCount = [
                            o.textureUrl,
                            o.normalMapUrl,
                            o.metallicMapUrl,
                            o.roughnessMapUrl,
                            o.displacementMapUrl,
                        ].filter(Boolean).length;
                        return (
                            <option key={o.id} value={o.id}>
                                {o.name} ({mapCount} PBR map{mapCount === 1 ? '' : 's'})
                            </option>
                        );
                    })}
                </select>

                <button
                    type="button"
                    onClick={handleCopyMaterial}
                    disabled={!sourceObj}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                        copiedFlash
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/30'
                    }`}
                    title="Copy Diffuse, Normal, Metallic, Roughness, Displacement & Material Settings from the selected 3D object"
                >
                    {copiedFlash ? (
                        <>
                            <LucideCheck className="w-3.5 h-3.5" />
                            <span>Applied!</span>
                        </>
                    ) : (
                        <>
                            <LucideCopy className="w-3.5 h-3.5" />
                            <span>Apply Material</span>
                        </>
                    )}
                </button>
            </div>

            <label className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer select-none pt-0.5">
                <input
                    type="checkbox"
                    checked={includeDisplacement}
                    onChange={(e) => setIncludeDisplacement(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Include Displacement Map & Height Settings</span>
            </label>
        </div>
    );
};
