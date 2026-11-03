
import React, { useRef, useState } from 'react';
import DraggableContainer from '../DraggableContainer';

interface LayerLabProps {
    isAiGenOpen: boolean;
    setIsAiGenOpen: (v: boolean) => void;
    texPrompt: string;
    setTexPrompt: (v: string) => void;
    isFourInOne: boolean;
    setIsFourInOne: (v: boolean) => void;
    onGenerate: () => void;
    onLoadTexture: (src: string) => void;
    onLoadOverlay: (src: string) => void;
}

export const LayerLab: React.FC<LayerLabProps> = ({
    isAiGenOpen, setIsAiGenOpen, texPrompt, setTexPrompt, isFourInOne, setIsFourInOne, onGenerate, onLoadTexture, onLoadOverlay
}) => {
    const texInputRef = useRef<HTMLInputElement>(null);
    const overlayInputRef = useRef<HTMLInputElement>(null);
    const [isTexDrag, setIsTexDrag] = useState(false);
    const [isOverlayDrag, setIsOverlayDrag] = useState(false);

    const handleTexFile = (f: File) => {
        const r = new FileReader();
        r.onload = (e) => onLoadTexture(e.target?.result as string);
        r.readAsDataURL(f);
    };

    const handleOverlayFile = (f: File) => {
        const r = new FileReader();
        r.onload = (e) => onLoadOverlay(e.target?.result as string);
        r.readAsDataURL(f);
    };

    return (
        <DraggableContainer initialPos={{ x: window.innerWidth / 2 + 120, y: 20 }} className={`bg-[#1a1f26]/95 border border-slate-700/80 p-3 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col space-y-4 backdrop-blur-xl max-h-[85vh] overflow-y-auto z-[500] w-[180px]`}>
            <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 drag-handle cursor-move">
                <span className="text-[9px] font-black uppercase text-cyan-400 select-none">Layer Lab</span>
            </div>
            
            <div className="space-y-2">
                <button onClick={() => setIsAiGenOpen(!isAiGenOpen)} className="w-full text-[8px] font-black text-left uppercase text-cyan-400/80 hover:text-cyan-400 transition-colors flex items-center justify-between">
                    AI generate texture {isAiGenOpen ? '▼' : 'expand>>'}
                </button>
                {isAiGenOpen && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 p-2 bg-black/20 rounded-xl border border-slate-700/50">
                        <textarea value={texPrompt} onChange={(e) => setTexPrompt(e.target.value)} placeholder="AI prompt..." className="w-full bg-black/40 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none" rows={2} />
                        <div className="flex items-center space-x-2">
                            <button onClick={onGenerate} className="flex-grow bg-cyan-600 hover:bg-cyan-500 py-1.5 rounded-lg text-white font-bold text-[8px] uppercase tracking-wider transition-all">Generate</button>
                            <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={isFourInOne} onChange={e => setIsFourInOne(e.target.checked)} className="w-3 h-3 accent-cyan-500 rounded border-slate-700" />
                                <span className="text-[7px] font-black uppercase text-slate-500">2x2</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col space-y-3 items-center">
                <div className="w-full space-y-1">
                    <div className="w-full shrink-0 h-16">
                        <input type="file" ref={texInputRef} onChange={e => e.currentTarget.files?.[0] && handleTexFile(e.currentTarget.files[0])} className="hidden" accept="image/*" />
                        <div 
                            onDragOver={e => { e.preventDefault(); setIsTexDrag(true); }} 
                            onDragLeave={() => setIsTexDrag(false)} 
                            onDrop={e => { e.preventDefault(); setIsTexDrag(false); e.dataTransfer.files?.[0] && handleTexFile(e.dataTransfer.files[0]); }} 
                            onClick={() => texInputRef.current?.click()} 
                            className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isTexDrag ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 hover:border-slate-500 bg-black/20'}`}
                        >
                            <svg className="text-slate-500 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth="2.5"/></svg>
                            <span className="text-[6px] font-black text-slate-500 uppercase">Tiling</span>
                        </div>
                    </div>
                </div>
                <div className="w-full space-y-1">
                    <div className="w-full shrink-0 h-16">
                        <input type="file" ref={overlayInputRef} onChange={e => e.currentTarget.files?.[0] && handleOverlayFile(e.currentTarget.files[0])} className="hidden" accept="image/*" />
                        <div 
                            onDragOver={e => { e.preventDefault(); setIsOverlayDrag(true); }} 
                            onDragLeave={() => setIsOverlayDrag(false)} 
                            onDrop={e => { e.preventDefault(); setIsOverlayDrag(false); e.dataTransfer.files?.[0] && handleOverlayFile(e.dataTransfer.files[0]); }} 
                            onClick={() => overlayInputRef.current?.click()} 
                            className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${isOverlayDrag ? 'border-purple-400 bg-purple-400/10' : 'border-slate-700 hover:border-slate-500 bg-black/20'}`}
                        >
                            <svg className="text-slate-500 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2.5"/></svg>
                            <span className="text-[6px] font-black text-slate-500 uppercase">Overlay</span>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableContainer>
    );
};
