import React, { useState } from 'react';
import type { ThreeDObject } from '../../../types';
import { ThreeDPbrGeneratorTool } from './ThreeDPbrGeneratorTool';
import { ThreeDCopyMaterialSection } from './ThreeDCopyMaterialSection';
import { ThreeDPbrQuickBundleImport } from './ThreeDPbrQuickBundleImport';
import { CavityHeightGeneratorWindow } from '../../modals/CavityHeightGeneratorWindow';
import { DEFAULT_DISPLACEMENT_SETTINGS } from '../../../utils/threeDDisplacementHelper';
import {
    LucideImage,
    LucideTrash2,
    LucideChevronDown,
    LucideChevronRight,
    LucideLayers,
    LucideMountain,
} from 'lucide-react';

interface ThreeDPbrMapsSectionProps {
    object: ThreeDObject;
    allObjects?: ThreeDObject[];
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
}

export const ThreeDPbrMapsSection: React.FC<ThreeDPbrMapsSectionProps> = ({
    object,
    allObjects = [],
    onUpdateObject,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isCavityModalOpen, setIsCavityModalOpen] = useState(false);

    const pbrMaps: {
        label: string;
        key: keyof ThreeDObject;
        colorClass: string;
    }[] = [
        { label: 'Diffuse / Albedo Map', key: 'textureUrl', colorClass: 'border-cyan-500/30 text-cyan-300 bg-cyan-950/20' },
        { label: 'Displacement / Height Map', key: 'displacementMapUrl', colorClass: 'border-emerald-500/30 text-emerald-300 bg-emerald-950/20' },
        { label: 'Normal Map', key: 'normalMapUrl', colorClass: 'border-blue-500/30 text-blue-300 bg-blue-950/20' },
        { label: 'Metallic Map', key: 'metallicMapUrl', colorClass: 'border-slate-500/30 text-slate-300 bg-slate-900/40' },
        { label: 'Roughness Map', key: 'roughnessMapUrl', colorClass: 'border-amber-500/30 text-amber-300 bg-amber-950/20' },
    ];

    const loadedCount = pbrMaps.filter((m) => !!object[m.key]).length;

    return (
        <div className="bg-black/40 rounded-xl border border-slate-700/70 overflow-hidden">
            {/* Collapsible Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 border-b border-slate-800/80 cursor-pointer select-none hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4 text-cyan-400" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <LucideLayers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                        PBR Texture
                    </span>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                    {loadedCount}/5 Maps
                </span>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3">
                    {allObjects.length > 1 && (
                        <ThreeDCopyMaterialSection
                            object={object}
                            allObjects={allObjects}
                            onUpdateObject={onUpdateObject}
                        />
                    )}

                    {/* Quick .ZIP or Multi-Image PBR Bundle Auto-Loader */}
                    <ThreeDPbrQuickBundleImport
                        label="Load PBR .ZIP or Multi-Images"
                        subtitle="Auto-assigns _albedo, _height, _normal, _metallic, _roughness"
                        accentColor="cyan"
                        onBundleParsed={(bundle) => {
                            const updates: Partial<ThreeDObject> = {};
                            if (bundle.textureUrl) updates.textureUrl = bundle.textureUrl;
                            if (bundle.displacementMapUrl) {
                                updates.displacementMapUrl = bundle.displacementMapUrl;
                            }
                            if (bundle.normalMapUrl) updates.normalMapUrl = bundle.normalMapUrl;
                            if (bundle.metallicMapUrl) updates.metallicMapUrl = bundle.metallicMapUrl;
                            if (bundle.roughnessMapUrl) updates.roughnessMapUrl = bundle.roughnessMapUrl;
                            onUpdateObject(object.id, updates, true);
                        }}
                    />

                    {/* Dedicated Cavity & Solid B/W Height Studio Launcher */}
                    <button
                        type="button"
                        onClick={() => setIsCavityModalOpen(true)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                        title="Open external Cavity & Solid B/W Height Map Studio for Main PBR Height"
                    >
                        <LucideMountain className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cavity & Solid B/W Height Studio...</span>
                    </button>

                    <div className="space-y-2">
                        {pbrMaps.map((map) => {
                            const val = object[map.key] as string | undefined;
                            const fileInputRef = React.createRef<HTMLInputElement>();

                            const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const url = URL.createObjectURL(file);
                                onUpdateObject(object.id, { [map.key]: url }, true);
                            };

                            return (
                                <div
                                    key={map.key}
                                    className={`border ${map.colorClass} p-2.5 rounded-lg flex flex-col space-y-1.5`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold uppercase tracking-wide">
                                            {map.label}
                                        </span>
                                        {val && (
                                            <button
                                                type="button"
                                                onClick={() => onUpdateObject(object.id, { [map.key]: undefined }, true)}
                                                className="flex items-center space-x-1 text-[10px] font-bold text-red-400 hover:text-red-300 uppercase cursor-pointer"
                                            >
                                                <LucideTrash2 className="w-3 h-3" />
                                                <span>Clear</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between space-x-2">
                                        {val ? (
                                            <div
                                                className="flex-1 text-xs text-slate-200 font-mono truncate"
                                                title={val}
                                            >
                                                {val.startsWith('blob:') || val.startsWith('data:')
                                                    ? 'Custom Image Loaded'
                                                    : val.substring(val.lastIndexOf('/') + 1)}
                                            </div>
                                        ) : (
                                            <div className="flex-1 text-xs text-slate-500 italic">
                                                No map loaded
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-[11px] font-bold uppercase text-white px-2.5 py-1 rounded-md border border-slate-600 transition-colors cursor-pointer"
                                        >
                                            <LucideImage className="w-3.5 h-3.5 text-cyan-400" />
                                            <span>Load</span>
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <ThreeDPbrGeneratorTool
                        object={object}
                        onUpdateObject={onUpdateObject}
                    />
                </div>
            )}

            <CavityHeightGeneratorWindow
                isOpen={isCavityModalOpen}
                onClose={() => setIsCavityModalOpen(false)}
                object={object}
                initialTargetChannel="main"
                onUpdateObject={onUpdateObject}
            />
        </div>
    );
};
