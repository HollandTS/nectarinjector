import { TmpFile, TmpParser } from './formats';

/**
 * Fills seam pinholes and missing Z-depth data between tiles and extra images after resizing.
 */
export function fillTmpHoles(tmpFile: TmpFile): void {
  const mult = tmpFile.cy / 2;
  const activeTiles = tmpFile.tiles.filter(t => t !== null);
  if (activeTiles.length === 0) return;

  // 1. Pad extra images by 2 pixels on seams if extra images exist so they can cover
  // the sub-pixel diagonal step differences between resized diamonds and rectangular boxes.
  activeTiles.forEach(tile => {
    if (!tile.header.has_extra_data || !tile.extraImageData) return;
    const h = tile.header;
    const pad = 2;
    const oldW = h.cx_extra;
    const oldH = h.cy_extra;
    const newW = oldW + pad * 2;
    const newH = oldH + pad * 2;
    const newImg = new Uint8Array(newW * newH);
    const newZ = tile.extraZData ? new Uint8Array(newW * newH) : null;

    for (let y = 0; y < oldH; y++) {
      const oldRow = y * oldW;
      const newRow = (y + pad) * newW + pad;
      for (let x = 0; x < oldW; x++) {
        newImg[newRow + x] = tile.extraImageData[oldRow + x];
        if (newZ && tile.extraZData) {
          newZ[newRow + x] = tile.extraZData[oldRow + x];
        }
      }
    }

    h.x_extra -= pad;
    h.y_extra -= pad;
    h.cx_extra = newW;
    h.cy_extra = newH;
    tile.extraImageData = newImg;
    tile.extraZData = newZ;
  });

  // Calculate composite bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  activeTiles.forEach(t => {
    const elev = t.header.height * mult;
    minX = Math.min(minX, t.header.x);
    maxX = Math.max(maxX, t.header.x + t.cx);
    minY = Math.min(minY, t.header.y - elev);
    maxY = Math.max(maxY, (t.header.y - elev) + t.cy);
    if (t.header.has_extra_data) {
      minX = Math.min(minX, t.header.x_extra);
      maxX = Math.max(maxX, t.header.x_extra + t.header.cx_extra);
      minY = Math.min(minY, t.header.y_extra - elev);
      maxY = Math.max(maxY, (t.header.y_extra - elev) + t.header.cy_extra);
    }
  });

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0 || width > 10000 || height > 10000) return;

  const colorCanvas = new Uint8Array(width * height);
  const zCanvas = new Uint8Array(width * height);

  // Render Base tiles
  activeTiles.forEach(tile => {
    const h = tile.header;
    const elev = h.height * mult;
    const bx = h.x - minX;
    const by = (h.y - elev) - minY;
    for (let ly = 0; ly < tile.cy; ly++) {
      for (let lx = 0; lx < tile.cx; lx++) {
        if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) continue;
        const lIdx = ly * tile.cx + lx;
        const compIdx = (by + ly) * width + (bx + lx);
        const c = tile.data[lIdx];
        const z = tile.zData ? tile.zData[lIdx] : 0;
        if (c !== 0) colorCanvas[compIdx] = c;
        if (z !== 0 && z !== 255) zCanvas[compIdx] = z;
      }
    }
    // Render Extra images
    if (h.has_extra_data && tile.extraImageData) {
      const ex = h.x_extra - minX;
      const ey = (h.y_extra - elev) - minY;
      for (let ly = 0; ly < h.cy_extra; ly++) {
        for (let lx = 0; lx < h.cx_extra; lx++) {
          const lIdx = ly * h.cx_extra + lx;
          const compIdx = (ey + ly) * width + (ex + lx);
          const c = tile.extraImageData[lIdx];
          const z = tile.extraZData ? tile.extraZData[lIdx] : 0;
          if (c !== 0) colorCanvas[compIdx] = c;
          if (z !== 0 && z !== 255) zCanvas[compIdx] = z;
        }
      }
    }
  });

  // Iterative pass to fill holes
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const compIdx = y * width + x;
        const c = colorCanvas[compIdx];
        const z = zCanvas[compIdx];

        if (c === 0 || z === 0) {
          const neighbors: { c: number; z: number }[] = [];
          for (const [dx, dy] of dirs) {
            const nIdx = (y + dy) * width + (x + dx);
            const nc = colorCanvas[nIdx];
            const nz = zCanvas[nIdx];
            if (nc !== 0) neighbors.push({ c: nc, z: nz });
          }

          const hasLR = (colorCanvas[y * width + (x - 1)] !== 0 && colorCanvas[y * width + (x + 1)] !== 0);
          const hasUD = (colorCanvas[(y - 1) * width + x] !== 0 && colorCanvas[(y + 1) * width + x] !== 0);

          if (hasLR || hasUD || neighbors.length >= 3) {
            const validZ = neighbors.filter(n => n.z > 0 && n.z < 255);
            const fillC = neighbors[0]?.c || 0;
            const fillZ = validZ.length > 0
              ? Math.round(validZ.reduce((a, b) => a + b.z, 0) / validZ.length)
              : (tmpFile.cy - 1);

            if (fillC !== 0) {
              colorCanvas[compIdx] = fillC;
              zCanvas[compIdx] = fillZ;

              // Assign to extra image first, then base diamond
              let assigned = false;
              for (let tIdx = activeTiles.length - 1; tIdx >= 0; tIdx--) {
                const tile = activeTiles[tIdx];
                const h = tile.header;
                const elev = h.height * mult;
                if (h.has_extra_data && tile.extraImageData) {
                  const ex = h.x_extra - minX;
                  const ey = (h.y_extra - elev) - minY;
                  const elx = x - ex;
                  const ely = y - ey;
                  if (elx >= 0 && elx < h.cx_extra && ely >= 0 && ely < h.cy_extra) {
                    const lIdx = ely * h.cx_extra + elx;
                    if (tile.extraImageData[lIdx] === 0) tile.extraImageData[lIdx] = fillC;
                    if (tile.extraZData && tile.extraZData[lIdx] === 0) tile.extraZData[lIdx] = fillZ;
                    assigned = true;
                    break;
                  }
                }
              }

              if (!assigned) {
                for (let tIdx = 0; tIdx < activeTiles.length; tIdx++) {
                  const tile = activeTiles[tIdx];
                  const h = tile.header;
                  const elev = h.height * mult;
                  const bx = h.x - minX;
                  const by = (h.y - elev) - minY;
                  const lx = x - bx;
                  const ly = y - by;
                  if (lx >= 0 && lx < tile.cx && ly >= 0 && ly < tile.cy) {
                    if (TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
                      const lIdx = ly * tile.cx + lx;
                      if (tile.data[lIdx] === 0) tile.data[lIdx] = fillC;
                      if (tile.zData && tile.zData[lIdx] === 0) tile.zData[lIdx] = fillZ;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
