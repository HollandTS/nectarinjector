
import React, { useState } from 'react';

interface DropOverlayProps {
    onDropAtZone: (files: FileList | File[], zone: 'tiles' | 'tiling' | 'smart') => void;
    onCancel: () => void;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ onDropAtZone, onCancel }) => {
    const [activeZone, setActiveZone] = useState<'tiles' | 'tiling' | 'smart' | null>(null);

    const handleZoneDrop = (e: React.DragEvent, zone: 'tiles' | 'tiling' | 'smart') => {
        e.preventDefault();
        e.stopPropagation();
        setActiveZone(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDropAtZone(e.dataTransfer.files, zone);
        }
    };

    const handleZoneEnter = (zone: 'tiles' | 'tiling' | 'smart') => {
        setActiveZone(zone);
    };

    return (
        <div 
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => handleZoneDrop(e, activeZone || 'tiles')}
            className="fixed inset-0 z-[10000] flex animate-in fade-in duration-300 pointer-events-auto"
        >
            {/* Left Zone: Import Tiles */}
            <div 
                onDragOver={(e) => { e.preventDefault(); handleZoneEnter('tiles'); }}
                onDragLeave={() => setActiveZone(null)}
                onDrop={(e) => handleZoneDrop(e, 'tiles')}
                className={`flex-1 h-full border-r-2 border-slate-700/50 flex flex-col items-center justify-center transition-all duration-300 ${activeZone === 'tiles' ? 'bg-cyan-500/20 backdrop-blur-md' : 'bg-black/60 backdrop-blur-sm'}`}
            >
                <div className={`p-8 rounded-full border-4 border-dashed transition-all duration-300 ${activeZone === 'tiles' ? 'border-cyan-400 bg-cyan-400/10 scale-110' : 'border-slate-600'}`}>
                    <svg className={`w-16 h-16 ${activeZone === 'tiles' ? 'text-cyan-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                </div>
                <h3 className={`mt-6 text-2xl font-black uppercase tracking-widest ${activeZone === 'tiles' ? 'text-cyan-300' : 'text-slate-400'}`}>Import Tiles</h3>
                <p className="text-slate-500 text-xs font-bold uppercase mt-2">Add to project asset list</p>
            </div>

            {/* Right Split Zone */}
            <div className="flex-1 flex flex-col">
                {/* Top Right: Tiling Layer */}
                <div 
                    onDragOver={(e) => { e.preventDefault(); handleZoneEnter('tiling'); }}
                    onDragLeave={() => setActiveZone(null)}
                    onDrop={(e) => handleZoneDrop(e, 'tiling')}
                    className={`flex-1 border-b-2 border-slate-700/50 flex flex-col items-center justify-center transition-all duration-300 ${activeZone === 'tiling' ? 'bg-emerald-500/20 backdrop-blur-md' : 'bg-black/70 backdrop-blur-sm'}`}
                >
                    <div className={`p-6 rounded-full border-4 border-dashed transition-all duration-300 ${activeZone === 'tiling' ? 'border-emerald-400 bg-emerald-400/10 scale-110' : 'border-slate-600'}`}>
                        <svg className={`w-12 h-12 ${activeZone === 'tiling' ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                    </div>
                    <h3 className={`mt-4 text-xl font-black uppercase tracking-widest ${activeZone === 'tiling' ? 'text-emerald-300' : 'text-slate-400'}`}>Tiling Layer</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Add as seamless tiled terrain</p>
                </div>

                {/* Bottom Right: Smart Overlay */}
                <div 
                    onDragOver={(e) => { e.preventDefault(); handleZoneEnter('smart'); }}
                    onDragLeave={() => setActiveZone(null)}
                    onDrop={(e) => handleZoneDrop(e, 'smart')}
                    className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 ${activeZone === 'smart' ? 'bg-purple-500/20 backdrop-blur-md' : 'bg-black/80 backdrop-blur-sm'}`}
                >
                    <div className={`p-6 rounded-full border-4 border-dashed transition-all duration-300 ${activeZone === 'smart' ? 'border-purple-400 bg-purple-400/10 scale-110' : 'border-slate-600'}`}>
                        <svg className={`w-12 h-12 ${activeZone === 'smart' ? 'text-purple-400' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </div>
                    <h3 className={`mt-4 text-xl font-black uppercase tracking-widest ${activeZone === 'smart' ? 'text-purple-300' : 'text-slate-400'}`}>Smart Overlay</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">Add as positionable decal</p>
                </div>
            </div>

            {/* Escape key instructions / Cancel */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="bg-slate-900/90 px-4 py-2 rounded-full border border-slate-700 shadow-2xl">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Release to drop • Move away to cancel</span>
                </div>
            </div>
        </div>
    );
};
