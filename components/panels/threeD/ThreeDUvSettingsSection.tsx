import React, { useState } from 'react';
import type { ThreeDObject, ProjectOverlay } from '../../../types';
import { getLinkedGroups } from '../../../utils/layerLinkUtils';
import {
    LucideChevronDown,
    LucideChevronRight,
    LucideSparkles,
    LucideLayers,
} from 'lucide-react';

interface ThreeDUvSettingsSectionProps {
    object: ThreeDObject;
    overlays: ProjectOverlay[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDUvSettingsSection: React.FC<ThreeDUvSettingsSectionProps> = ({
    object,
    overlays,
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const linkedGroups = getLinkedGroups(overlays);

    const toggleUV = () => {
        onUpdateObject(
            object.id,
            {
                uvMapping: object.uvMapping === 'smart' ? 'default' : 'smart',
            },
            true
        );
    };

    const handleOverlaySelect = (overlayId: string) => {
        onUpdateObject(
            object.id,
            {
                textureOverlayId: overlayId === 'none' ? undefined : overlayId,
            },
            true
        );
    };

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            {/* Collapsible Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-indigo-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <LucideSparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                        UV Settings
                    </span>
                </div>
                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={toggleUV}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                            object.uvMapping === 'smart'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                        }`}
                        title="Toggle Smart UV Mapping"
                    >
                        {object.uvMapping === 'smart' ? 'Smart UV' : 'Default UV'}
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                            <LucideSparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs font-bold uppercase text-slate-300">
                                Smart UV Mapping
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={toggleUV}
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                                object.uvMapping === 'smart'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            }`}
                        >
                            {object.uvMapping === 'smart' ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <label className="text-[11px] font-bold uppercase text-indigo-300 flex items-center space-x-1.5">
                            <LucideLayers className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Layer Override (Diffuse)</span>
                        </label>
                        <select
                            value={object.textureOverlayId || 'none'}
                            onChange={(e) => handleOverlaySelect(e.target.value)}
                            className="w-full bg-[#161b22] border border-slate-700 rounded-lg text-xs text-white px-2.5 py-1.5 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="none">Use Placed Diffuse Map</option>
                            {linkedGroups.length > 0 && (
                                <optgroup label="Linked Layers">
                                    {linkedGroups.map((lg) => (
                                        <option key={lg.id} value={lg.id}>
                                            🔗 {lg.name} ({lg.layers.length} layers)
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            <optgroup label="Individual Layers">
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
                </div>
            )}
        </div>
    );
};
