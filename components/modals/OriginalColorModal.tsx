import React, { useState, useEffect } from 'react';
import { FilterSlider } from '../ui/FilterSlider';
import { RgbaColor, OriginalColorSettings } from '../../types';
import { Ban, Check, Trash2, Pipette, Move } from 'lucide-react';
import DraggableContainer from '../DraggableContainer';

interface OriginalColorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (settings: OriginalColorSettings) => void;
    onUndo: () => void;
    canUndo: boolean;
    isEyedropperActive: boolean;
    setIsEyedropperActive: (v: boolean) => void;
    pickedColor: RgbaColor | null;
}

export const OriginalColorModal: React.FC<OriginalColorModalProps> = ({
    isOpen, onClose, onApply, onUndo, canUndo, isEyedropperActive, setIsEyedropperActive, pickedColor
}) => {
    const [settings, setSettings] = useState<OriginalColorSettings>({
        hue: 0,
        saturation: 100,
        brightness: 100,
        contrast: 100,
        sharpness: 0,
        targetColor: null,
        tolerance: 20
    });

    useEffect(() => {
        if (isOpen && pickedColor && isEyedropperActive) {
            setSettings(prev => ({ ...prev, targetColor: pickedColor }));
            setIsEyedropperActive(false);
        }
    }, [isOpen, pickedColor, isEyedropperActive, setIsEyedropperActive]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center transition-all duration-300 ${isEyedropperActive ? 'bg-black/20 pointer-events-none' : 'bg-black/80 backdrop-blur-sm'}`}>
            <DraggableContainer 
                initialPos={{ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 250 }}
                className="pointer-events-auto"
            >
                <div className="bg-[#1a1f26] border border-slate-700 rounded-2xl shadow-2xl w-[400px] p-6 space-y-6 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center drag-handle cursor-move">
                        <div className="flex items-center space-x-2">
                            <Move className="w-3 h-3 text-slate-500" />
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Original Tile Colors</h3>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                            <Ban className="w-5 h-5" />
                        </button>
                    </div>

                <div className="space-y-4">
                    <FilterSlider label="Hue" min={-180} max={180} value={settings.hue} defaultValue={0} onChange={v => setSettings({ ...settings, hue: v })} />
                    <FilterSlider label="Saturation" min={0} max={200} value={settings.saturation} defaultValue={100} onChange={v => setSettings({ ...settings, saturation: v })} />
                    <FilterSlider label="Brightness" min={0} max={200} value={settings.brightness} defaultValue={100} onChange={v => setSettings({ ...settings, brightness: v })} />
                    <FilterSlider label="Contrast" min={0} max={200} value={settings.contrast} defaultValue={100} onChange={v => setSettings({ ...settings, contrast: v })} />
                    <FilterSlider label="Sharpness" min={0} max={100} value={settings.sharpness} defaultValue={0} onChange={v => setSettings({ ...settings, sharpness: v })} />
                    
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Selective Adjustment</span>
                            <button 
                                onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                                className={`p-2 rounded-lg border transition-all ${isEyedropperActive ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                                title="Pick color from tiles"
                            >
                                <Pipette className="w-4 h-4" />
                            </button>
                        </div>

                        {settings.targetColor && (
                            <div className="flex items-center space-x-3">
                                <div 
                                    className="w-8 h-8 rounded-lg border border-white/20 shadow-inner"
                                    style={{ backgroundColor: `rgba(${settings.targetColor.r}, ${settings.targetColor.g}, ${settings.targetColor.b}, 1)` }}
                                />
                                <div className="flex-grow">
                                    <FilterSlider label="Tolerance" min={0} max={100} value={settings.tolerance} defaultValue={20} onChange={v => setSettings({ ...settings, tolerance: v })} />
                                </div>
                                <button 
                                    onClick={() => setSettings({ ...settings, targetColor: null })}
                                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-white/5">
                    <button 
                        onClick={() => onApply(settings)}
                        className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/20"
                    >
                        <Check className="w-4 h-4" />
                        <span>Apply Adjustment</span>
                    </button>
                    <button 
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={`px-4 border text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 ${canUndo ? 'border-red-500/30 bg-red-900/20 text-red-400 hover:bg-red-900/40' : 'border-white/10 bg-white/5 text-white/30 cursor-not-allowed'}`}
                        title="Undo Color Adjustment"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </DraggableContainer>
    </div>
);
};
