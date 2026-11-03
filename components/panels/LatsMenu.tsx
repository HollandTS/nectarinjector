import React, { useState, useRef, useEffect } from 'react';
import { LatOption, LAT_OPTIONS } from '../../services/latsService';

interface LatsMenuProps {
    onSelectOption: (option: LatOption) => void;
    isLoading?: boolean;
}

export const LatsMenu: React.FC<LatsMenuProps> = ({ onSelectOption, isLoading = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleItemClick = (opt: LatOption) => {
        setIsOpen(false);
        onSelectOption(opt);
    };

    return (
        <div className="relative inline-block" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                title="LATS"
                className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
                    isOpen 
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/60 shadow-lg shadow-amber-950/30' 
                        : 'bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border-slate-700/60'
                } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Isometric LAT transition diamond icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3L3 12l9 9 9-9-9-9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 9l12 6" />
                    <circle cx="9.5" cy="8" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="14.5" cy="16" r="1.5" fill="currentColor" stroke="none" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-44 bg-[#161b22]/98 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-1.5 z-[600] flex flex-col space-y-1">
                    <div className="px-2 py-1 text-[9px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-800 flex items-center justify-between">
                        <span>LATS</span>
                        <span className="text-[8px] text-amber-400/70 font-mono">ISOTILES</span>
                    </div>

                    {LAT_OPTIONS.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => handleItemClick(opt)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-800/80"
                        >
                            <span>{opt}</span>
                            <span className="text-[9px] text-slate-500 font-mono">.tem</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
