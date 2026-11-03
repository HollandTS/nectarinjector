import React, { useRef, useState } from 'react';
import { ParsedPbrBundle, parsePbrFilesOrZip } from '../../../utils/newThreeDPlaneHelper';
import { LucideFolderOpen, LucideLoader2 } from 'lucide-react';

interface ThreeDPbrQuickBundleImportProps {
    label?: string;
    subtitle?: string;
    accentColor?: 'cyan' | 'amber' | 'teal';
    onBundleParsed: (bundle: ParsedPbrBundle) => void;
}

export const ThreeDPbrQuickBundleImport: React.FC<ThreeDPbrQuickBundleImportProps> = ({
    label = 'Load PBR .ZIP or Multi-Images',
    subtitle = 'Auto-assigns _albedo, _height, _normal, _metallic, _roughness',
    accentColor = 'cyan',
    onBundleParsed,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [lastAssignedInfo, setLastAssignedInfo] = useState<string | null>(null);

    const accentClasses =
        accentColor === 'amber'
            ? 'bg-amber-600/20 hover:bg-amber-600/35 border-amber-500/40 text-amber-200'
            : accentColor === 'teal'
            ? 'bg-teal-600/20 hover:bg-teal-600/35 border-teal-500/40 text-teal-200'
            : 'bg-cyan-600/20 hover:bg-cyan-600/35 border-cyan-500/40 text-cyan-200';

    const iconColor =
        accentColor === 'amber'
            ? 'text-amber-400'
            : accentColor === 'teal'
            ? 'text-teal-400'
            : 'text-cyan-400';

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsParsing(true);
        try {
            const bundle = await parsePbrFilesOrZip(files);
            const matchedRoles: string[] = [];
            if (bundle.textureUrl) matchedRoles.push('Albedo');
            if (bundle.displacementMapUrl) matchedRoles.push('Height');
            if (bundle.normalMapUrl) matchedRoles.push('Normal');
            if (bundle.metallicMapUrl) matchedRoles.push('Metal');
            if (bundle.roughnessMapUrl) matchedRoles.push('Rough');

            if (matchedRoles.length > 0) {
                onBundleParsed(bundle);
                setLastAssignedInfo(
                    `${bundle.baseName ? `${bundle.baseName}: ` : ''}${matchedRoles.join(', ')}`
                );
            } else {
                setLastAssignedInfo('No matching PBR images found');
            }
        } catch (err) {
            console.error('Failed to parse PBR bundle:', err);
            setLastAssignedInfo('Failed to load PBR files');
        } finally {
            setIsParsing(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-1">
            <button
                type="button"
                disabled={isParsing}
                onClick={() => inputRef.current?.click()}
                className={`w-full py-1.5 px-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${accentClasses}`}
                title={subtitle}
            >
                <div className="flex items-center space-x-2 min-w-0 text-left">
                    {isParsing ? (
                        <LucideLoader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${iconColor}`} />
                    ) : (
                        <LucideFolderOpen className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                    )}
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider truncate">
                            {isParsing ? 'Parsing PBR Files...' : label}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                            {lastAssignedInfo ? `Loaded: ${lastAssignedInfo}` : subtitle}
                        </div>
                    </div>
                </div>
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-black/40 border border-white/10 shrink-0">
                    ZIP / IMG
                </span>
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept=".zip,image/png,image/jpeg,image/webp"
                onChange={handleChange}
                className="hidden"
            />
        </div>
    );
};
