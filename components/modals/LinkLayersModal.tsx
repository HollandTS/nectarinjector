import React, { useState, useEffect, useRef } from 'react';
import { LucideLink2 } from 'lucide-react';

interface LinkLayersModalProps {
    isOpen: boolean;
    layerCount: number;
    defaultName?: string;
    onConfirm: (name: string) => void;
    onCancel: () => void;
}

export const LinkLayersModal: React.FC<LinkLayersModalProps> = ({
    isOpen,
    layerCount,
    defaultName = 'Linked Layer',
    onConfirm,
    onCancel,
}) => {
    const [name, setName] = useState(defaultName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(name.trim() || 'Linked Layer');
    };

    return (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1f26] border border-sky-400/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-950/60 border border-sky-400/40 flex items-center justify-center text-sky-400">
                        <LucideLink2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-sky-400">
                            Link Layers ({layerCount})
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">
                            Connect layers so they move as one & can be picked together
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                        Linked Layer Name
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter linked layer name..."
                        className="w-full bg-[#0d1117] border border-sky-500/40 focus:border-sky-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none transition-colors"
                    />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 uppercase transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg text-xs font-black bg-sky-500 hover:bg-sky-400 text-slate-950 uppercase shadow-lg shadow-sky-500/30 transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                        <LucideLink2 className="w-3.5 h-3.5" />
                        <span>Link Layers</span>
                    </button>
                </div>
            </form>
        </div>
    );
};
