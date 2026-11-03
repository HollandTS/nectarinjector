import { RGB, TmpFile, Tile } from './formats';
import { ShpFile, ShpFrame } from './shp';

/**
 * Creates a Look-Up Table (LUT) to map 256-color palette indices from a source palette to a target palette.
 */
export function createPaletteLut(sourcePalette: RGB[], targetPalette: RGB[], isShp: boolean): Uint8Array {
    const lut = new Uint8Array(256);
    
    // Index 0 always maps to Index 0 (transparency)
    lut[0] = 0;
    
    if (isShp) {
        // Index 1 maps to Index 1 (shadows are preserved in SHP Format 80)
        lut[1] = 1;
        
        // Match other colors (2 to 255) to target palette (scanning target indices 2 to 255)
        for (let i = 2; i < 256; i++) {
            const srcColor = sourcePalette[i] || { r: 0, g: 0, b: 0 };
            let minDistance = Infinity;
            let closestIndex = 2;
            
            for (let j = 2; j < 256; j++) {
                const targetColor = targetPalette[j] || { r: 0, g: 0, b: 0 };
                const rDiff = srcColor.r - targetColor.r;
                const gDiff = srcColor.g - targetColor.g;
                const bDiff = srcColor.b - targetColor.b;
                const distSq = rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
                
                if (distSq < minDistance) {
                    minDistance = distSq;
                    closestIndex = j;
                }
            }
            lut[i] = closestIndex;
        }
    } else {
        // Match index 1 to 255 to target palette (scanning target indices 1 to 255)
        for (let i = 1; i < 256; i++) {
            const srcColor = sourcePalette[i] || { r: 0, g: 0, b: 0 };
            let minDistance = Infinity;
            let closestIndex = 1;
            
            for (let j = 1; j < 256; j++) {
                const targetColor = targetPalette[j] || { r: 0, g: 0, b: 0 };
                const rDiff = srcColor.r - targetColor.r;
                const gDiff = srcColor.g - targetColor.g;
                const bDiff = srcColor.b - targetColor.b;
                const distSq = rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
                
                if (distSq < minDistance) {
                    minDistance = distSq;
                    closestIndex = j;
                }
            }
            lut[i] = closestIndex;
        }
    }
    
    return lut;
}

/**
 * Remaps indices in a TmpFile based on a Look-Up Table (LUT).
 */
export function remapTmpColors(tmpFile: TmpFile, lut: Uint8Array): TmpFile {
    const newTiles = tmpFile.tiles.map(tile => {
        if (!tile) return null;
        
        // Remap primary tile data
        const newData = new Uint8Array(tile.data.length);
        for (let i = 0; i < tile.data.length; i++) {
            newData[i] = lut[tile.data[i]];
        }
        
        // Remap extra image data if present
        let newExtraImageData: Uint8Array | null = null;
        if (tile.extraImageData) {
            newExtraImageData = new Uint8Array(tile.extraImageData.length);
            for (let i = 0; i < tile.extraImageData.length; i++) {
                newExtraImageData[i] = lut[tile.extraImageData[i]];
            }
        }
        
        // Remap damaged data if present
        let newDamagedData: Uint8Array | null = null;
        if (tile.damagedData) {
            newDamagedData = new Uint8Array(tile.damagedData.length);
            for (let i = 0; i < tile.damagedData.length; i++) {
                newDamagedData[i] = lut[tile.damagedData[i]];
            }
        }
        
        return {
            ...tile,
            data: newData,
            extraImageData: newExtraImageData,
            damagedData: newDamagedData
        };
    });
    
    return {
        ...tmpFile,
        tiles: newTiles
    };
}

/**
 * Remaps indices in a ShpFile based on a Look-Up Table (LUT).
 */
export function remapShpColors(shpFile: ShpFile, lut: Uint8Array): ShpFile {
    const newFrames = shpFile.frames.map(frame => {
        const newData = new Uint8Array(frame.data.length);
        for (let i = 0; i < frame.data.length; i++) {
            newData[i] = lut[frame.data[i]];
        }
        return {
            ...frame,
            data: newData
        };
    });
    
    return {
        ...shpFile,
        frames: newFrames
    };
}
