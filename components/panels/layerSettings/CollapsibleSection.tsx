import React, { useState } from 'react';
import { LucideChevronDown, LucideChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    titleColorClass?: string;
    badge?: React.ReactNode;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    titleColorClass = 'text-cyan-400',
    badge,
    defaultExpanded = true,
    children
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="flex flex-col bg-black/40 p-2.5 rounded-xl border border-slate-700/80 shadow-sm transition-all">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full py-1 group cursor-pointer select-none"
            >
                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-black uppercase tracking-wider ${titleColorClass}`}>
                        {title}
                    </span>
                    {badge}
                </div>
                <div className="text-slate-400 group-hover:text-white transition-colors">
                    {isExpanded ? (
                        <LucideChevronDown className="w-4 h-4" />
                    ) : (
                        <LucideChevronRight className="w-4 h-4" />
                    )}
                </div>
            </button>
            {isExpanded && (
                <div className="pt-2 space-y-2.5 animate-in fade-in duration-150">
                    {children}
                </div>
            )}
        </div>
    );
};
