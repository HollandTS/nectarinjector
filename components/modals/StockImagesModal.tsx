import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import DraggableContainer from '../DraggableContainer';
import { STOCK_IMAGES, STOCK_BRUSH_IMAGES, StockAssetItem } from '../../utils/stockAssetsHelper';
import { LucideImage, LucideSearch, LucideX, LucideLoader2, LucideFolderOpen } from 'lucide-react';

interface StockImagesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectImage: (dataUrl: string, name: string) => void;
}

export const StockImagesModal: React.FC<StockImagesModalProps> = ({
    isOpen,
    onClose,
    onSelectImage,
}) => {
    const [search, setSearch] = useState('');
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'images' | 'brushes'>('all');
    const [customStockItems, setCustomStockItems] = useState<StockAssetItem[]>([]);
    const [modalSize, setModalSize] = useState({
        width: Math.min(860, Math.max(480, window.innerWidth - 80)),
        height: Math.min(680, Math.max(420, window.innerHeight - 80)),
    });
    const folderInputRef = useRef<HTMLInputElement>(null);

    const imagesCount = STOCK_IMAGES.length + customStockItems.length;
    const brushesCount = STOCK_BRUSH_IMAGES.length;

    const combinedItems = useMemo(() => {
        const map = new Map<string, StockAssetItem>();
        const addList = (list: StockAssetItem[]) => {
            for (const item of list) {
                const key = `${item.folder}:${item.fileName.toLowerCase()}`;
                if (!map.has(key)) {
                    map.set(key, item);
                }
            }
        };

        if (activeTab === 'images') {
            addList(STOCK_IMAGES);
            addList(customStockItems);
        } else if (activeTab === 'brushes') {
            addList(STOCK_BRUSH_IMAGES);
        } else {
            addList(STOCK_IMAGES);
            addList(customStockItems);
            addList(STOCK_BRUSH_IMAGES);
        }

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTab, customStockItems]);

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return combinedItems;
        return combinedItems.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                item.fileName.toLowerCase().includes(q)
        );
    }, [search, combinedItems]);

    if (!isOpen) return null;

    const handleAddLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newItems: StockAssetItem[] = [];
        Array.from(files).forEach((file: File) => {
            if (
                !file.type.startsWith('image/') &&
                !/\.(png|jpg|jpeg|bmp|webp|gif|svg)$/i.test(file.name)
            ) {
                return;
            }
            const url = URL.createObjectURL(file);
            const id = file.name.replace(/\.[^/.]+$/, '');
            newItems.push({
                id,
                name: id.replace(/[_-]+/g, ' '),
                fileName: file.name,
                url,
                folder: 'IMAGES',
            });
        });

        if (newItems.length > 0) {
            setCustomStockItems((prev) => [...prev, ...newItems]);
        }
        e.target.value = '';
    };

    const handlePickItem = async (item: StockAssetItem) => {
        setLoadingId(item.id);
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const dataUrl = await new Promise<string>((resolve, reject) => {
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width || 256;
                        canvas.height = img.naturalHeight || img.height || 256;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } else {
                            resolve(item.url);
                        }
                    } catch {
                        resolve(item.url);
                    }
                };
                img.onerror = (err) => reject(err);
                img.src = item.url;
            });
            onSelectImage(dataUrl, item.name);
            onClose();
        } catch (err) {
            console.error('Failed to load stock image:', err);
            onSelectImage(item.url, item.name);
            onClose();
        } finally {
            setLoadingId(null);
        }
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
            minWidth={520}
            minHeight={400}
            className="bg-[#0d1117]/98 border border-slate-700/80 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col z-[3000] text-slate-200 overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center drag-handle cursor-move select-none shrink-0 bg-slate-900/70">
                <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                        <LucideImage className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase text-cyan-400 tracking-widest truncate">
                            Stock Images Library
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                            Click any thumbnail to create a Tiled Layer ({combinedItems.length} shown)
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                        ref={folderInputRef}
                        type="file"
                        multiple
                        accept="image/*,.bmp,.png,.jpg,.jpeg,.webp"
                        onChange={handleAddLocalFiles}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        className="flex items-center space-x-1.5 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-cyan-300 transition-all cursor-pointer"
                        title="Load images from your computer into Stock view"
                    >
                        <LucideFolderOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>+ Add Images</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 p-2 rounded-xl cursor-pointer"
                        title="Close Stock Images"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="px-5 py-3 bg-black/40 border-b border-slate-800/60 flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-[200px]">
                    <LucideSearch className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search stock images & textures..."
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
                {imagesCount > 0 && brushesCount > 0 && (
                    <div className="flex items-center bg-[#161b22] p-1 rounded-xl border border-slate-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                activeTab === 'all'
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            All ({imagesCount + brushesCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('images')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                activeTab === 'images'
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            IMAGES ({imagesCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('brushes')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                activeTab === 'brushes'
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            BRUSHES ({brushesCount})
                        </button>
                    </div>
                )}
            </div>

            {/* Thumbnails Grid */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-700 min-h-0">
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3.5">
                        {filteredItems.map((item) => {
                            const isLoading = loadingId === item.id;
                            return (
                                <button
                                    key={`${item.folder}-${item.fileName}-${item.url}`}
                                    type="button"
                                    onClick={() => handlePickItem(item)}
                                    disabled={isLoading}
                                    className="group bg-[#161b22]/90 border border-slate-800 hover:border-cyan-500/70 hover:bg-cyan-500/10 rounded-xl p-2 flex flex-col items-center transition-all cursor-pointer active:scale-95 shadow-md overflow-hidden"
                                    title={item.fileName}
                                >
                                    <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center relative border border-slate-800/80 shrink-0">
                                        <img
                                            src={item.url}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 block"
                                        />
                                        {isLoading && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                <LucideLoader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full mt-2 text-center">
                                        <p className="text-[10px] font-black text-slate-200 group-hover:text-cyan-300 truncate uppercase tracking-tight">
                                            {item.name}
                                        </p>
                                        <p className="text-[8px] font-mono text-slate-500 truncate">
                                            {item.fileName}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
                        <LucideImage className="w-10 h-10 text-slate-700" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            No matching stock images found
                        </p>
                        <p className="text-[10px] text-slate-500 max-w-sm">
                            Click <span className="text-cyan-400 font-bold">+ Add Images</span> above or place image files inside the <span className="text-cyan-400 font-mono">/IMAGES</span> folder.
                        </p>
                    </div>
                )}
            </div>
        </DraggableContainer>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};
