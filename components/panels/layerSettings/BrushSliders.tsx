import React from 'react';
import type { TiledBrush } from '../../../types';
import { FilterSlider } from '../../ui/FilterSlider';
import { LucidePalette } from 'lucide-react';

interface BrushSlidersProps {
    brush: TiledBrush;
    updateBrush: (brushId: string, updates: Partial<TiledBrush>) => void;
}

export const BrushSliders: React.FC<BrushSlidersProps> = ({ brush, updateBrush }) => {
    const currentFootprint = brush.footprint ?? (brush.mainScale !== undefined && brush.mainScale <= 20 ? brush.mainScale : undefined) ?? brush.repeatSpread ?? 1;
    const currentMainScale = brush.footprint !== undefined ? (brush.mainScale ?? 100) : ((brush.mainScale && brush.mainScale > 20) ? brush.mainScale : 100);
    const currentSpread = brush.spread ?? 100;
    const currentCanvasZoom = brush.canvasZoom ?? brush.scale ?? 100;
    const currentRotation = brush.rotation ?? 0;

    return (
        <>
            {/* Core Sliders */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <FilterSlider
                    label="Footprint"
                    min={1}
                    max={20}
                    value={currentFootprint}
                    defaultValue={1}
                    onChange={v => updateBrush(brush.id, { footprint: v, repeatSpread: v })}
                />
                <FilterSlider
                    label="Main Scale"
                    min={10}
                    max={500}
                    value={currentMainScale}
                    defaultValue={100}
                    onChange={v => updateBrush(brush.id, { mainScale: v })}
                />
                <FilterSlider
                    label="Spread"
                    min={0}
                    max={100}
                    value={currentSpread}
                    defaultValue={100}
                    onChange={v => updateBrush(brush.id, { spread: v })}
                />
                <FilterSlider
                    label="Canvas Zoom"
                    min={50}
                    max={800}
                    value={currentCanvasZoom}
                    defaultValue={100}
                    onChange={v => updateBrush(brush.id, { canvasZoom: v, scale: v })}
                />
                <FilterSlider
                    label="Rotation"
                    min={0}
                    max={360}
                    value={currentRotation}
                    defaultValue={0}
                    onChange={v => updateBrush(brush.id, { rotation: v })}
                />
                <FilterSlider
                    label="Random Scale"
                    min={0}
                    max={100}
                    value={brush.randomScale}
                    defaultValue={0}
                    onChange={v => updateBrush(brush.id, { randomScale: v })}
                />
                <FilterSlider
                    label="Hardness"
                    min={0}
                    max={300}
                    value={brush.hardness}
                    defaultValue={100}
                    onChange={v => updateBrush(brush.id, { hardness: v })}
                />
            </div>

            {/* Coloring Sliders (only if mode === 'coloring') */}
            {brush.mode === 'coloring' && (
                <div className="space-y-1.5 pt-2 mt-1 border-t border-cyan-800/50 bg-cyan-950/20 p-1.5 rounded-lg">
                    <div className="flex items-center space-x-1 text-[10px] font-bold text-cyan-300 uppercase tracking-wide mb-1">
                        <LucidePalette className="w-3 h-3 text-cyan-400" />
                        <span>Coloring Controls</span>
                    </div>
                    <FilterSlider
                        label="Hue"
                        min={-180}
                        max={180}
                        value={brush.hue ?? 0}
                        defaultValue={0}
                        onChange={v => updateBrush(brush.id, { hue: v })}
                    />
                    <FilterSlider
                        label="Contrast"
                        min={0}
                        max={200}
                        value={brush.contrast ?? 100}
                        defaultValue={100}
                        onChange={v => updateBrush(brush.id, { contrast: v })}
                    />
                    <FilterSlider
                        label="Brightness"
                        min={0}
                        max={200}
                        value={brush.brightness ?? 100}
                        defaultValue={100}
                        onChange={v => updateBrush(brush.id, { brightness: v })}
                    />
                    <FilterSlider
                        label="Saturation"
                        min={0}
                        max={200}
                        value={brush.saturation ?? 100}
                        defaultValue={100}
                        onChange={v => updateBrush(brush.id, { saturation: v })}
                    />
                </div>
            )}
        </>
    );
};
