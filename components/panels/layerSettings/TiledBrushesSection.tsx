import React, { useRef, useState } from 'react';
import type { ProjectOverlay, TiledBrush } from '../../../types';
import { BrushPreset } from '../../../utils/brushPresets';
import { CollapsibleSection } from './CollapsibleSection';
import { BrushPresetPicker } from './BrushPresetPicker';
import { BrushItem } from './BrushItem';
import { LucidePlus, LucideFolderOpen } from 'lucide-react';

interface TiledBrushesSectionProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
}

export const TiledBrushesSection: React.FC<TiledBrushesSectionProps> = ({ ov, updateFilter }) => {
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const brushes: TiledBrush[] = ov.filters.brushes || [];

    const [expandedBrushIds, setExpandedBrushIds] = useState<Set<string>>(() => {
        if (brushes.length > 0) {
            return new Set([brushes[brushes.length - 1].id]);
        }
        return new Set();
    });
    const [newlyAddedBrushId, setNewlyAddedBrushId] = useState<string | null>(null);

    const toggleBrushExpanded = (brushId: string) => {
        setExpandedBrushIds(prev => {
            const next = new Set(prev);
            if (next.has(brushId)) {
                next.delete(brushId);
            } else {
                next.add(brushId);
            }
            return next;
        });
    };

    const addBrushFromPreset = (preset: BrushPreset) => {
        const newBrushId = `brush_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newBrush: TiledBrush = {
            id: newBrushId,
            name: preset.name,
            src: preset.path,
            mode: 'transparency',
            footprint: 1,
            mainScale: 100,
            spread: 100,
            canvasZoom: 100,
            rotation: 0,
            scale: 100,
            randomScale: 0,
            shuffleMode: 'standard',
            tiled: true,
            untransformed: false,
            tilingMode: 'tiled',
            hardness: 100,
            hue: 0,
            contrast: 100,
            brightness: 100,
            saturation: 100
        };
        const next = [...brushes, newBrush];
        updateFilter(ov.id, 'brushes', next);
        // Collapse open ones and open the newly made one, and scroll to it
        setExpandedBrushIds(new Set([newBrushId]));
        setNewlyAddedBrushId(newBrushId);
        setShowPresetPicker(false);
    };

    const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const newBrushId = `brush_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const newBrush: TiledBrush = {
                    id: newBrushId,
                    name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                    src: reader.result,
                    mode: 'transparency',
                    footprint: 1,
                    mainScale: 100,
                    spread: 100,
                    canvasZoom: 100,
                    rotation: 0,
                    scale: 100,
                    randomScale: 0,
                    shuffleMode: 'standard',
                    tiled: true,
                    untransformed: false,
                    tilingMode: 'tiled',
                    hardness: 100,
                    hue: 0,
                    contrast: 100,
                    brightness: 100,
                    saturation: 100
                };
                const next = [...brushes, newBrush];
                updateFilter(ov.id, 'brushes', next);
                // Collapse open ones and open the newly made one, and scroll to it
                setExpandedBrushIds(new Set([newBrushId]));
                setNewlyAddedBrushId(newBrushId);
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const updateBrush = (brushId: string, updates: Partial<TiledBrush>) => {
        const next = brushes.map(b => (b.id === brushId ? { ...b, ...updates } : b));
        updateFilter(ov.id, 'brushes', next);
    };

    const removeBrush = (brushId: string) => {
        const next = brushes.filter(b => b.id !== brushId);
        updateFilter(ov.id, 'brushes', next);
        setExpandedBrushIds(prev => {
            const copy = new Set(prev);
            copy.delete(brushId);
            return copy;
        });
    };

    return (
        <CollapsibleSection
            title="Brushes"
            titleColorClass="text-rose-400"
            defaultExpanded={brushes.length > 0}
            badge={
                brushes.length > 0 ? (
                    <span className="text-[10px] px-1.5 py-0.2 bg-rose-900/60 border border-rose-500/40 text-rose-300 rounded-full font-mono">
                        {brushes.length}
                    </span>
                ) : undefined
            }
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleCustomFileUpload} 
                accept="image/png,image/jpeg,image/webp" 
                className="hidden" 
            />

            {/* Action buttons: Pick Preset or Load PNG */}
            <div className="flex items-center space-x-2">
                <button
                    type="button"
                    onClick={() => setShowPresetPicker(!showPresetPicker)}
                    className="flex-1 flex items-center justify-center space-x-1 bg-cyan-700/60 hover:bg-cyan-600 py-1.5 rounded-lg border border-cyan-500/50 text-[10px] font-black uppercase text-white transition-all shadow-sm cursor-pointer"
                >
                    <LucidePlus className="w-3.5 h-3.5" />
                    <span>Add Preset Brush</span>
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg border border-slate-700 text-[10px] font-black uppercase text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                    <LucideFolderOpen className="w-3.5 h-3.5" />
                    <span>Load PNG</span>
                </button>
            </div>

            {/* Presets Grid Drawer */}
            {showPresetPicker && (
                <BrushPresetPicker
                    onSelectPreset={addBrushFromPreset}
                    onClose={() => setShowPresetPicker(false)}
                />
            )}

            {/* List of configured brushes */}
            {brushes.length === 0 ? (
                <div className="text-center py-2 text-[11px] text-slate-500 italic">
                    No brushes added yet. Add a preset or load a PNG to carve transparency, colorize, or stamp textures.
                </div>
            ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {brushes.map((brush) => (
                        <BrushItem
                            key={brush.id}
                            brush={brush}
                            isExpanded={expandedBrushIds.has(brush.id)}
                            onToggleExpand={() => toggleBrushExpanded(brush.id)}
                            autoScroll={newlyAddedBrushId === brush.id}
                            updateBrush={updateBrush}
                            removeBrush={removeBrush}
                        />
                    ))}
                </div>
            )}
        </CollapsibleSection>
    );
};
