import { TmpParser, TmpFile, Tile } from './formats';

/**
 * Finds the nearest non-zero pixel in a Uint8Array representing a rectangular image of size cx x cy.
 * Returns the non-zero pixel value, or 0 if all pixels in the array are 0.
 */
function getNearestNonZeroPixel(data: Uint8Array, index: number, cx: number, cy: number): number {
  if (data[index] !== 0) return data[index];
  
  const targetY = Math.floor(index / cx);
  const targetX = index % cx;
  
  // Search in expanding concentric rings
  const maxRadius = Math.max(cx, cy);
  for (let r = 1; r < maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const y = targetY + dy;
      if (y < 0 || y >= cy) continue;
      
      const rowOffset = y * cx;
      // When dy is -r or r, we check all dx from -r to r
      if (Math.abs(dy) === r) {
        for (let dx = -r; dx <= r; dx++) {
          const x = targetX + dx;
          if (x >= 0 && x < cx) {
            const val = data[rowOffset + x];
            if (val !== 0) return val;
          }
        }
      } else {
        // Otherwise, we check just dx = -r and dx = r
        const x1 = targetX - r;
        if (x1 >= 0 && x1 < cx) {
          const val = data[rowOffset + x1];
          if (val !== 0) return val;
        }
        const x2 = targetX + r;
        if (x2 >= 0 && x2 < cx) {
          const val = data[rowOffset + x2];
          if (val !== 0) return val;
        }
      }
    }
  }
  return 0; // fallback if everything is 0
}

/**
 * Resizes a Z-data buffer to fit new extra-data dimensions if they differ slightly due to scaling.
 */
function scaleZBuffer(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  if (sw === dw && sh === dh) return new Uint8Array(src);
  const dst = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor((y * sh) / dh);
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor((x * sw) / dw);
      dst[y * dw + x] = src[sy * sw + sx];
    }
  }
  return dst;
}

/**
 * Merges a resized converted tile (RA2 -> TS or TS -> RA2) with the stock template tile.
 * This preserves the exact resized main image and extra image data of the converted tile,
 * but matches/swaps the stock Z-data and related physical collision/ramp properties.
 */
export function mergeResizedWithStock(resizedTmp: TmpFile, stockTmp: TmpFile): TmpFile {
  const newTiles = resizedTmp.tiles.map((resizedTile, i) => {
    if (!resizedTile) return null;

    const stockTile = stockTmp.tiles && stockTmp.tiles[i] ? stockTmp.tiles[i] : null;
    if (!stockTile) {
      // If no matching stock tile, return the resized tile exactly as it is (no stock merge, completely safe!)
      return resizedTile;
    }

    // Match the exact transparent pixel layout of the stock template to keep edges pixel perfect.
    const newData = new Uint8Array(resizedTile.data);
    for (let dIdx = 0; dIdx < newData.length; dIdx++) {
      if (stockTile.data[dIdx] === 0) {
        newData[dIdx] = 0; // Force exact transparency match
      } else if (newData[dIdx] === 0 && stockTile.data[dIdx] !== 0) {
        // Fallback: fill hole with the nearest non-zero pixel
        newData[dIdx] = getNearestNonZeroPixel(newData, dIdx, resizedTile.cx, resizedTile.cy);
      }
    }

    const newExtraImageData = resizedTile.extraImageData ? new Uint8Array(resizedTile.extraImageData) : null;
    if (newExtraImageData && stockTile.extraImageData) {
      for (let dIdx = 0; dIdx < newExtraImageData.length; dIdx++) {
        if (stockTile.extraImageData[dIdx] === 0) {
          newExtraImageData[dIdx] = 0; // Force exact transparency match for extra data
        } else if (newExtraImageData[dIdx] === 0 && stockTile.extraImageData[dIdx] !== 0) {
          // Fallback: fill hole with nearest non-zero pixel
          newExtraImageData[dIdx] = getNearestNonZeroPixel(newExtraImageData, dIdx, resizedTile.header.cx_extra, resizedTile.header.cy_extra);
        }
      }
    }

    // Carry Z-Data directly from the stock template
    const newZData = stockTile.zData ? new Uint8Array(stockTile.zData) : null;
    let newExtraZData: Uint8Array | null = null;
    
    if (stockTile.extraZData && stockTile.header.cx_extra > 0 && stockTile.header.cy_extra > 0) {
      if (resizedTile.header.cx_extra > 0 && resizedTile.header.cy_extra > 0) {
        newExtraZData = scaleZBuffer(
          stockTile.extraZData,
          stockTile.header.cx_extra,
          stockTile.header.cy_extra,
          resizedTile.header.cx_extra,
          resizedTile.header.cy_extra
        );
      } else {
        newExtraZData = new Uint8Array(stockTile.extraZData);
      }
    }

    // Compose a merged header: keep geometry & extra bounds from the resized image,
    // but carry z-mapping state plus core game collision properties (height/ramp) from stock.
    const newHeader = {
      ...resizedTile.header,
      has_z_data: stockTile.header.has_z_data,
      z_ofs: stockTile.header.z_ofs,
      extra_z_ofs: stockTile.header.extra_z_ofs,
      height: stockTile.header.height,
      ramp_type: stockTile.header.ramp_type,
    };

    return {
      ...resizedTile,
      header: newHeader,
      data: newData,
      zData: newZData,
      extraImageData: newExtraImageData,
      extraZData: newExtraZData,
    };
  });

  return {
    ...resizedTmp,
    tiles: newTiles,
  };
}

/**
 * Attempts to load and parse a stock TEM file by its base name from `/src/public/stock/`.
 */
export async function tryLoadStockFile(baseName: string): Promise<TmpFile | null> {
  const normalizedName = baseName.toLowerCase();
  try {
    const listFallback = [
      `/stock/${normalizedName}.tem`,
      `stock/${normalizedName}.tem`,
      `/src/public/stock/${normalizedName}.tem`,
      `/public/stock/${normalizedName}.tem`
    ];
    for (const url of listFallback) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return TmpParser.parseTmp(buffer);
        }
      } catch {
        // ignore
      }
    }
    return null;
  } catch (err) {
    console.warn(`[Stock Mode] Failed to load stock tile file: ${normalizedName}`, err);
    return null;
  }
}

/**
 * Attempts to load and parse a stock RA2 TEM file by its base name from `/src/public/stock-ra2/`.
 */
export async function tryLoadStockRa2File(baseName: string): Promise<TmpFile | null> {
  const normalizedName = baseName.toLowerCase();
  try {
    const listFallback = [
      `/stock-ra2/${normalizedName}.tem`,
      `stock-ra2/${normalizedName}.tem`,
      `/src/public/stock-ra2/${normalizedName}.tem`,
      `/public/stock-ra2/${normalizedName}.tem`
    ];
    for (const url of listFallback) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return TmpParser.parseTmp(buffer);
        }
      } catch {
        // ignore
      }
    }
    return null;
  } catch (err) {
    console.warn(`[Stock Mode RA2] Failed to load stock RA2 terrain tile file: ${normalizedName}`, err);
    return null;
  }
}

