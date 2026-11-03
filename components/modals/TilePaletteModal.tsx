
import React, { useState, useEffect } from 'react';
import { X, Search, Palette as PaletteIcon, Check } from 'lucide-react';
import type { CanvasImage, RgbaColor } from '../../types';
import { extractPaletteFromImages, PaletteColor } from '../../utils/paletteUtils';

interface TilePaletteModalProps {
    selectedImages: CanvasImage[];
    onClose: () => void;
    onAddColors: (colors: RgbaColor[]) => void;
    existingColors: RgbaColor[];
    transparencyColor: RgbaColor | null;
    tolerance: number;
}

export const TilePaletteModal: React.FC<TilePaletteModalProps> = ({
    selectedImages,
    onClose,
    onAddColors,
    existingColors,
    transparencyColor,
    tolerance
}) => {
    const [palette, setPalette] = useState<PaletteColor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInModal, setSelectedInModal] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'hue' | 'brightness' | 'both'>('both');
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);

    const selectedImagesSerialized = selectedImages.map(img => img.id).join(',');
    const transparencyColorSerialized = transparencyColor ? `${transparencyColor.r},${transparencyColor.g},${transparencyColor.b},${transparencyColor.a}` : 'null';

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            let colors = await extractPaletteFromImages(selectedImages);
            
            setPalette(colors);
            setIsLoading(false);
        };
        load();
    }, [selectedImagesSerialized, transparencyColorSerialized, tolerance]);

    const toggleColor = (c: PaletteColor, forceValue?: boolean) => {
        const key = `${c.r},${c.g},${c.b}`;
        const next = new Set(selectedInModal);
        const isAlreadyInGroup = existingColors.some(ec => ec.r === c.r && ec.g === c.g && ec.b === c.b);
        if (isAlreadyInGroup) return;

        if (forceValue !== undefined) {
            if (forceValue) next.add(key);
            else next.delete(key);
        } else {
            if (next.has(key)) next.delete(key);
            else next.add(key);
        }
        setSelectedInModal(next);
    };

    const handleMouseDown = (c: PaletteColor) => {
        const key = `${c.r},${c.g},${c.b}`;
        const isSelected = selectedInModal.has(key);
        setIsDragging(true);
        setDragMode(isSelected ? 'deselect' : 'select');
        toggleColor(c, !isSelected);
    };

    const handleMouseEnter = (c: PaletteColor) => {
        if (isDragging && dragMode) {
            toggleColor(c, dragMode === 'select');
        }
    };

    useEffect(() => {
        const handleMouseUp = () => {
            setIsDragging(false);
            setDragMode(null);
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handleAdd = () => {
        const toAdd = palette.filter(c => selectedInModal.has(`${c.r},${c.g},${c.b}`));
        onAddColors(toAdd.map(({ r, g, b, a }) => ({ r, g, b, a })));
        onClose();
    };

    const filteredPalette = palette.filter(c => {
        if (!searchQuery) return true;
        const hex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
        return hex.includes(searchQuery.toLowerCase()) || 
               `${c.r},${c.g},${c.b}`.includes(searchQuery);
    });

    const sortedPalette = [...filteredPalette].sort((a, b) => {
        if (sortBy === 'hue') return a.h - b.h;
        if (sortBy === 'brightness') return a.l - b.l;
        if (Math.abs(a.h - b.h) > 10) return a.h - b.h;
        return a.l - b.l;
    });

    // Group by Hue ranges for better organization
    const hueGroups: { label: string, colors: PaletteColor[] }[] = [
        { label: 'Reds', colors: sortedPalette.filter(c => (c.h >= 0 && c.h < 20) || (c.h >= 340)) },
        { label: 'Oranges', colors: sortedPalette.filter(c => c.h >= 20 && c.h < 45) },
        { label: 'Yellows', colors: sortedPalette.filter(c => c.h >= 45 && c.h < 70) },
        { label: 'Greens', colors: sortedPalette.filter(c => c.h >= 70 && c.h < 160) },
        { label: 'Cyans', colors: sortedPalette.filter(c => c.h >= 160 && c.h < 200) },
        { label: 'Blues', colors: sortedPalette.filter(c => c.h >= 200 && c.h < 260) },
        { label: 'Purples', colors: sortedPalette.filter(c => c.h >= 260 && c.h < 300) },
        { label: 'Pinks', colors: sortedPalette.filter(c => c.h >= 300 && c.h < 340) },
    ].filter(g => g.colors.length > 0);

    // Grayscale group
    const grayscale = sortedPalette.filter(c => c.s < 10);
    if (grayscale.length > 0) {
        hueGroups.push({ label: 'Grayscale', colors: grayscale });
    }

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1a1f26] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center space-x-3">
                        <PaletteIcon className="w-5 h-5 text-emerald-400" />
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Tile Palette</h3>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                {selectedImages.length} Tiles Selected • {palette.length} Colors Found
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                <div className="p-4 bg-black/20 border-b border-white/5 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input 
                            type="text"
                            placeholder="Search by RGB or Hex..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-4">
                            <span className="text-[8px] font-black uppercase text-white/30">Sort By:</span>
                            <div className="flex space-x-3">
                                {(['hue', 'brightness', 'both'] as const).map(mode => (
                                    <label key={mode} className="flex items-center space-x-1 cursor-pointer group">
                                        <input 
                                            type="radio" 
                                            name="sort" 
                                            checked={sortBy === mode} 
                                            onChange={() => setSortBy(mode)}
                                            className="hidden"
                                        />
                                        <div className={`w-2 h-2 rounded-full border ${sortBy === mode ? 'bg-emerald-500 border-emerald-400' : 'border-white/20 group-hover:border-white/40'}`} />
                                        <span className={`text-[9px] font-bold uppercase ${sortBy === mode ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>{mode}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {(() => {
                            const selectableFiltered = filteredPalette.filter(
                                c => !existingColors.some(ec => ec.r === c.r && ec.g === c.g && ec.b === c.b)
                            );
                            const allSelected =
                                selectableFiltered.length > 0 &&
                                selectableFiltered.every(c => selectedInModal.has(`${c.r},${c.g},${c.b}`));

                            return (
                                <button
                                    type="button"
                                    disabled={selectableFiltered.length === 0}
                                    onClick={() => {
                                        const next = new Set(selectedInModal);
                                        if (allSelected) {
                                            selectableFiltered.forEach(c => next.delete(`${c.r},${c.g},${c.b}`));
                                        } else {
                                            selectableFiltered.forEach(c => next.add(`${c.r},${c.g},${c.b}`));
                                        }
                                        setSelectedInModal(next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center space-x-1.5 cursor-pointer ${
                                        allSelected
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
                                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                                >
                                    <Check className="w-3 h-3" />
                                    <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                                </button>
                            );
                        })()}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-8 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                            <span className="text-[10px] font-black uppercase text-white/30">Analyzing Tile Pixels...</span>
                        </div>
                    ) : hueGroups.length === 0 ? (
                        <div className="text-center py-20">
                            <span className="text-[10px] font-black uppercase text-white/20">No matching colors found</span>
                        </div>
                    ) : (
                        hueGroups.map(group => (
                            <div key={group.label} className="space-y-3">
                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">{group.label}</span>
                                <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
                                    {group.colors.map((c, i) => {
                                        const key = `${c.r},${c.g},${c.b}`;
                                        const isSelected = selectedInModal.has(key);
                                        const isAlreadyInGroup = existingColors.some(ec => ec.r === c.r && ec.g === c.g && ec.b === c.b);
                                        
                                        return (
                                            <button
                                                key={i}
                                                onMouseDown={() => handleMouseDown(c)}
                                                onMouseEnter={() => handleMouseEnter(c)}
                                                disabled={isAlreadyInGroup}
                                                className={`aspect-square rounded-lg border-2 transition-all relative group select-none ${
                                                    isSelected ? 'border-emerald-500 scale-110 z-10 shadow-lg shadow-emerald-500/20' : 
                                                    isAlreadyInGroup ? 'border-white/5 opacity-30 cursor-not-allowed' : 'border-white/10 hover:border-white/30 hover:scale-105'
                                                }`}
                                                style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
                                                title={`RGB(${c.r}, ${c.g}, ${c.b})`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white drop-shadow-md" />
                                                    </div>
                                                )}
                                                {isAlreadyInGroup && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-1 h-1 bg-white/50 rounded-full" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-white/40">
                        {selectedInModal.size} Colors Selected
                    </span>
                    <div className="flex space-x-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl text-[10px] font-black uppercase text-white/50 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAdd}
                            disabled={selectedInModal.size === 0}
                            className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                selectedInModal.size > 0 
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 active:scale-95' 
                                : 'bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                        >
                            Add to Group
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
