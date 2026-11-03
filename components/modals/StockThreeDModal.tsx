import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DraggableContainer from '../DraggableContainer';
import { STOCK_3D_OBJECTS, StockAssetItem } from '../../utils/stockAssetsHelper';
import { renderGlbThumbnail } from '../../utils/glbThumbnailHelper';
import { LucideBox, LucideSearch, LucideX, LucideLoader2 } from 'lucide-react';

interface StockThreeDModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectGlb: (glbUrl: string, name: string) => void;
}

export const StockThreeDModal: React.FC<StockThreeDModalProps> = ({
    isOpen,
    onClose,
    onSelectGlb,
}) => {
    const [search, setSearch] = useState('');
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
    const [modalSize, setModalSize] = useState({
        width: Math.min(720, Math.max(460, window.innerWidth - 80)),
        height: Math.min(560, Math.max(380, window.innerHeight - 80)),
    });

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        STOCK_3D_OBJECTS.forEach((item) => {
            if (thumbnails[item.url]) return;
            renderGlbThumbnail(item.url)
                .then((dataUrl) => {
                    if (!cancelled) {
                        setThumbnails((prev) => ({ ...prev, [item.url]: dataUrl }));
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setFailedIds((prev) => ({ ...prev, [item.url]: true }));
                    }
                });
        });

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return STOCK_3D_OBJECTS;
        return STOCK_3D_OBJECTS.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                item.fileName.toLowerCase().includes(q)
        );
    }, [search]);

    if (!isOpen) return null;

    const handlePick = (item: StockAssetItem) => {
        onSelectGlb(item.url, item.fileName);
        onClose();
    };

    const modal = (
        <DraggableContainer
            initialPos={{
                x: Math.max(20, Math.round((window.innerWidth - modalSize.width) / 2)),
                y: Math.max(20, Math.round((window.innerHeight - modalSize.height) / 2)),
            }}
            size={modalSize}
            onResize={(sz) => setModalSize(sz)}
            resizable={true}
            minWidth={460}
            minHeight={360}
            className="bg-[#0d1117]/98 border border-slate-700/80 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col z-[3000] text-slate-200 overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center drag-handle cursor-move select-none shrink-0 bg-slate-900/70">
                <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                        <LucideBox className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase text-cyan-400 tracking-widest truncate">
                            Stock 3D Objects (.GLB)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                            Click any 3D model to load it into the 3D Studio ({STOCK_3D_OBJECTS.length} available)
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 p-2 rounded-xl cursor-pointer shrink-0"
                    title="Close Stock 3D Objects"
                >
                    <LucideX className="w-4 h-4" />
                </button>
            </div>

            {/* Search Bar */}
            <div className="px-5 py-3 bg-black/40 border-b border-slate-800/60 shrink-0">
                <div className="relative">
                    <LucideSearch className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search 3D models in 3DOBJECTS folder..."
                        className="w-full bg-[#161b22] border border-slate-700/80 rounded-xl pl-10 pr-9 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60 transition-all"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                            <LucideX className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* 3D Thumbnails Grid */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {filteredItems.map((item) => {
                            const thumb = thumbnails[item.url];
                            const hasFailed = failedIds[item.url];
                            return (
                                <button
                                    key={item.fileName}
                                    type="button"
                                    onClick={() => handlePick(item)}
                                    className="group bg-[#161b22]/90 border border-slate-800 hover:border-cyan-500/70 hover:bg-cyan-500/10 rounded-xl p-3 flex flex-col items-center transition-all cursor-pointer active:scale-95 shadow-md overflow-hidden"
                                    title={item.fileName}
                                >
                                    <div className="w-full h-32 rounded-lg overflow-hidden bg-gradient-to-b from-slate-900 to-black/80 flex items-center justify-center relative border border-slate-800/80 shrink-0">
                                        {thumb ? (
                                            <img
                                                src={thumb}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_4px_12px_rgba(34,211,238,0.25)] block"
                                            />
                                        ) : hasFailed ? (
                                            <LucideBox className="w-10 h-10 text-cyan-500/60 group-hover:scale-110 transition-transform" />
                                        ) : (
                                            <div className="flex flex-col items-center space-y-1.5">
                                                <LucideLoader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                                <span className="text-[8px] uppercase font-bold text-slate-500">
                                                    Preview...
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full mt-2.5 text-center">
                                        <p className="text-[11px] font-black text-slate-200 group-hover:text-cyan-300 truncate uppercase tracking-tight">
                                            {item.name}
                                        </p>
                                        <p className="text-[9px] font-mono text-slate-500 truncate">
                                            {item.fileName}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-56 flex flex-col items-center justify-center text-center space-y-2">
                        <LucideBox className="w-10 h-10 text-slate-700" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            {STOCK_3D_OBJECTS.length === 0
                                ? 'No 3D models found in /3DOBJECTS folder'
                                : 'No matching 3D models'}
                        </p>
                        <p className="text-[10px] text-slate-500 max-w-sm">
                            Add <span className="text-cyan-400 font-mono">.glb</span> files to the <span className="text-cyan-400 font-mono">/3DOBJECTS</span> folder in the project root.
                        </p>
                    </div>
                )}
            </div>
        </DraggableContainer>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};
