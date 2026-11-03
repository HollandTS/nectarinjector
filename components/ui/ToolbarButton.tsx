
import React from 'react';

interface ToolbarButtonProps {
    children: React.ReactNode;
    onClick: () => void;
    title?: string;
    className?: string;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ 
    children, onClick, title, className = '' 
}) => (
    <button 
        onClick={onClick} 
        title={title} 
        className={`p-2 hover:bg-slate-700/60 hover:text-white rounded-md transition-all active:scale-95 flex items-center text-slate-400 border border-transparent hover:border-slate-600 ${className}`}
    >
        {children}
    </button>
);
