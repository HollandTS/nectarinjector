import React, { useState, useEffect, useRef } from 'react';
import { LucideFolderPlus } from 'lucide-react';

interface CreateSceneGroupModalProps {
    isOpen: boolean;
    itemCount: number;
    defaultName?: string;
    onConfirm: (name: string, moveTogether: boolean) => void;
    onCancel: () => void;
}

export const CreateSceneGroupModal: React.FC<CreateSceneGroupModalProps> = ({
    isOpen,
    itemCount,
    defaultName = 'Scene Group',
    onConfirm,
    onCancel,
}) => {
    const [name, setName] = useState(defaultName);
    const [moveTogether, setMoveTogether] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
            setMoveTogether(true);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(name.trim() || 'Scene Group', moveTogether);
    };

    return (
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1f26] border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <LucideFolderPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400">
                            Create Group ({itemCount})
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">
                            Group layers, 3D objects & tiles while keeping their positions
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                        Group Name
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter group name..."
                        className="w-full bg-[#0d1117] border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none transition-colors"
                    />
                </div>

                <label className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={moveTogether}
                        onChange={(e) => setMoveTogether(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 accent-emerald-500 cursor-pointer"
                    />
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                            Move Together
                        </div>
                        <div className="text-[9px] text-slate-400">
                            Simultaneously drag all layers, 3D objects & tiles in this group
                        </div>
                    </div>
                </label>

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
                        className="px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 uppercase shadow-lg shadow-emerald-500/30 transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                        <LucideFolderPlus className="w-3.5 h-3.5" />
                        <span>Create Group</span>
                    </button>
                </div>
            </form>
        </div>
    );
};
