
import React from 'react';
import type { GridType } from '../../types';
import { GRID_CONFIGS } from '../../constants';

interface IsometricGridProps {
    type: GridType;
    width: number;
    height: number;
}

export const IsometricGrid: React.FC<IsometricGridProps> = ({ type, width, height }) => {
    const config = GRID_CONFIGS[type];
    if (!config || type === 'none') return null;
    
    const w2 = config.width / 2;
    const h2 = config.height / 2;
    
    const paths = [];
    // We need enough lines to cover the entire canvas regardless of aspect ratio
    // The range determines how many grid units we draw in each direction from origin
    const range = 150; 
    
    // Lines of constant 'i' (The X-Axis equivalents in Iso)
    for (let i = -range; i <= range; i++) {
        const x1 = (i - (-range)) * w2 + w2;
        const y1 = (i + (-range)) * h2;
        const x2 = (i - range) * w2 + w2;
        const y2 = (i + range) * h2;
        paths.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    }

    // Lines of constant 'j' (The Y-Axis equivalents in Iso)
    for (let j = -range; j <= range; j++) {
        const x1 = ((-range) - j) * w2 + w2;
        const y1 = ((-range) + j) * h2;
        const x2 = (range - j) * w2 + w2;
        const y2 = (range + j) * h2;
        paths.push(`M ${x1} ${y1} L ${x2} ${y2}`);
    }

    return (
        <svg 
            width={width} 
            height={height} 
            className="absolute inset-0 pointer-events-none opacity-[0.15]"
            style={{ overflow: 'visible' }}
        >
            <path 
                d={paths.join(' ')} 
                stroke="rgba(255,255,255,0.4)" 
                strokeWidth="1" 
                vectorEffect="non-scaling-stroke"
                fill="none" 
            />
        </svg>
    );
};
