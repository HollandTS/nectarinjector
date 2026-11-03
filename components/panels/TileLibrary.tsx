
import React, { useState, useMemo } from 'react';
import DraggableContainer from '../DraggableContainer';

interface TileLibraryProps {
    onClose: () => void;
    onSelect: (filename: string) => void;
}

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/HollandTS/Tile_Canvas_Pro/main/TS_tiles/";

/**
 * Rebuilt master list generator.
 * Uses strict 2-digit padding and standard prefix groups.
 */
const generateMasterList = () => {
    const list: string[] = [];
    const addGroup = (prefix: string, count: number) => {
        for (let i = 1; i <= count; i++) {
            list.push(`${prefix}${String(i).padStart(2, '0')}.source.png`);
            list.push(`${prefix}${String(i).padStart(2, '0')}.png`);
        }
    };

    // Terrain sets - expanded ranges to catch most variations
    addGroup('glat', 40);
    addGroup('green', 40);
    addGroup('cliff', 60);
    addGroup('slope', 40);
    addGroup('shore', 50);
    addGroup('water', 30);
    addGroup('dirt', 30);
    addGroup('sand', 30);
    addGroup('snow', 30);
    addGroup('pave', 30);
    addGroup('brdg', 20);
    addGroup('bridge', 20);
    addGroup('rail', 20);
    
    // Static objects and landmarks
    const objects = [
        'atree01.png', 'atree02.png', 'atree03.png',
        'btree01.png', 'btree02.png', 'btree03.png',
        'ctree01.png', 'ctree02.png', 'ctree03.png',
        'shrub01.png', 'shrub02.png', 'shrub03.png',
        'rock01.png', 'rock02.png', 'rock03.png', 'rock04.png',
        'tiberium.png', 'tibe01.png', 'tibe02.png',
        'hosp.png', 'nuke.png', 'fcre.png', 'oxon.png', 'bunk.png',
        'dome.png', 'pill.png', 'gawea.png', 'gawall.png', 'gapowr.png', 'sub.png',
        'shrine01.png', 'shrine02.png', 'statue01.png', 'statue02.png'
    ];
    
    // Add variations of building names if they exist as png
    return Array.from(new Set([...list, ...objects]));
};

const MASTER_LIST = generateMasterList();

export const TileLibrary: React.FC<TileLibraryProps> = ({ onClose, onSelect }) => {
    const [search, setSearch] = useState('');
    const [customFilename, setCustomFilename] = useState('');

    const filteredTiles = useMemo(() => {
        const query = search.toLowerCase();
        if (!query) return MASTER_LIST.slice(0, 300); // Limit initial view for performance
        return MASTER_LIST.filter(name => name.toLowerCase().includes(query));
    }, [search]);

    const handleDragStart = (e: React.DragEvent, filename: string) => {
        e.dataTransfer.setData('tile-filename', filename);
    };

    const handleFetchDirect = () => {
        if (!customFilename) return;
        const name = customFilename.toLowerCase().endsWith('.png') ? customFilename : `${customFilename}.png`;
        onSelect(name);
    };

    return (
        <DraggableContainer initialPos={{ x: 300, y: 80 }} className="w-[700px] bg-[#0d1117]/98 border border-slate-700/60 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] z-[2500]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center drag-handle cursor-move">
                <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-cyan-400 tracking-[0.4em] select-none">Global Tile Repository</span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Unified Asset Archive</span>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 p-2.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Controls Bar */}
            <div className="p-5 bg-black/40 border-b border-slate-800/50 flex flex-col space-y-4">
                <div className="relative">
                    <input 
                        type="text" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search for any tile (e.g. glat01, cliff05, shrine)..." 
                        className="w-full bg-[#161b22] border border-slate-700 rounded-2xl px-12 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium placeholder:text-slate-600"
                    />
                    <svg className="w-5 h-5 text-slate-600 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
                
                <div className="flex items-center space-x-3 px-1">
                    <div className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-800/50">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
                        <span>Direct Fetch</span>
                    </div>
                    <input 
                        type="text" 
                        value={customFilename} 
                        onChange={e => setCustomFilename(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleFetchDirect()}
                        placeholder="Enter exact filename (e.g. mmmv01.png)" 
                        className="flex-grow bg-[#0d1117] border border-slate-800 rounded-xl px-4 py-2 text-[11px] text-purple-400 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                    />
                    <button 
                        onClick={handleFetchDirect} 
                        className="bg-purple-600/10 hover:bg-purple-600 text-purple-500 hover:text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all border border-purple-500/20 active:scale-95 shadow-lg"
                    >
                        Spawn
                    </button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-grow overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent min-h-[450px]">
                <div className="grid grid-cols-5 gap-5">
                    {filteredTiles.map(filename => (
                        <div 
                            key={filename}
                            onClick={() => onSelect(filename)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, filename)}
                            className="aspect-square bg-[#161b22]/30 border border-slate-800/50 rounded-3xl flex flex-col items-center justify-between p-4 group hover:border-cyan-500/40 hover:bg-cyan-500/5 cursor-pointer transition-all active:scale-95 shadow-lg hover:shadow-cyan-900/10"
                        >
                            <div className="flex-grow flex items-center justify-center w-full min-h-0">
                                <img 
                                    src={`${GITHUB_RAW_BASE}${filename}`} 
                                    alt={filename} 
                                    crossOrigin="anonymous"
                                    className="max-w-full max-h-full object-contain transition-all duration-500 group-hover:scale-125 group-hover:drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" 
                                    style={{imageRendering: 'pixelated'}}
                                    loading="lazy"
                                    onError={(e) => {
                                        // Automatically hide missing files from the list
                                        const target = e.target as HTMLImageElement;
                                        const card = target.closest('.group') as HTMLElement;
                                        if (card) {
                                            card.style.display = 'none';
                                        }
                                    }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-700 group-hover:text-cyan-400 font-mono truncate w-full text-center mt-3 font-bold tracking-tight uppercase transition-colors">{filename.replace('.png', '').replace('.source', '')}</span>
                        </div>
                    ))}
                </div>

                {filteredTiles.length === 0 && (
                    <div className="py-32 flex flex-col items-center justify-center space-y-5">
                        <div className="w-20 h-20 bg-slate-800/30 rounded-full flex items-center justify-center border border-slate-700/30">
                            <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600">Archive entry not found</p>
                    </div>
                )}
            </div>
            
            {/* Footer */}
            <div className="p-5 border-t border-slate-800 bg-black/30 rounded-b-3xl">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-4">
                        <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">
                            Total Scanned: <span className="text-slate-400">{MASTER_LIST.length}</span>
                        </p>
                        <div className="w-[1px] h-3 bg-slate-800"></div>
                        <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest">
                            Search Result: <span className="text-cyan-500">{filteredTiles.length}</span>
                        </p>
                    </div>
                    <div className="flex items-center space-x-2 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[8px] text-emerald-500/80 uppercase font-black tracking-tighter">Verified GitHub Source</span>
                    </div>
                </div>
            </div>
        </DraggableContainer>
    );
};
