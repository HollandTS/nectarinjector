import { Tile, TmpFile, RGB, TmpParser } from './formats';

/**
 * Checks if a coordinate in the composite canvas (px, py) falls inside any active tile's base diamond area.
 */
export function isPixelOverlappingBaseTile(
  px: number,
  py: number,
  activeTiles: Tile[],
  minX: number,
  minY: number,
  mult: number
): boolean {
  for (let i = 0; i < activeTiles.length; i++) {
    const t = activeTiles[i];
    const elev = t.header.height * mult;
    const bx = t.header.x - minX;
    const by = (t.header.y - elev) - minY;
    const lx = px - bx;
    const ly = py - by;
    if (lx >= 0 && lx < t.cx && ly >= 0 && ly < t.cy) {
      if (TmpParser.isInsideWestwoodDiamond(lx, ly, t.cx, t.cy)) {
        const idx = ly * t.cx + lx;
        if (t.data && t.data[idx] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

export class TmpRenderer {
  static getPalette32(palette: RGB[]): Uint32Array {
    const p32 = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const c = palette[i] || { r: 0, g: 0, b: 0 };
      p32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
    }
    return p32;
  }

  static renderTileToCanvas(canvas: HTMLCanvasElement, tile: Tile, palette: RGB[], showZ: boolean = false) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const p32 = this.getPalette32(palette);
    canvas.width = tile.cx;
    canvas.height = tile.cy;
    const imgData = ctx.createImageData(tile.cx, tile.cy);
    const data32 = new Uint32Array(imgData.data.buffer);
    const pixels = showZ && tile.zData ? tile.zData : tile.data;

    for (let i = 0; i < pixels.length; i++) {
      const idx = pixels[i];
      if (idx === 0) {
        data32[i] = 0;
        continue;
      }

      if (showZ && tile.zData) {
        const lx = i % tile.cx;
        const ly = Math.floor(i / tile.cx);
        if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy) || idx === 255) {
          data32[i] = 0;
          continue;
        }
        const step = (tile.cy >= 60 || tile.cx >= 120) ? 4 : 8;
        const gray = Math.min(255, idx * step);
        data32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
      } else {
        data32[i] = p32[idx];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  static renderCompleteToCanvas(canvas: HTMLCanvasElement, tmpFile: TmpFile, palette: RGB[], showZ: boolean = false) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const mult = tmpFile.cy / 2;

    const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);
    if (activeTiles.length === 0) return;

    activeTiles.forEach(tile => {
      const h = tile.header;
      const elev = h.height * mult;

      minX = Math.min(minX, h.x);
      minY = Math.min(minY, h.y - elev);
      maxX = Math.max(maxX, h.x + tile.cx);
      maxY = Math.max(maxY, h.y - elev + tile.cy);

      if (h.has_extra_data) {
        minX = Math.min(minX, h.x_extra);
        minY = Math.min(minY, h.y_extra - elev);
        maxX = Math.max(maxX, h.x_extra + h.cx_extra);
        maxY = Math.max(maxY, h.y_extra - elev + h.cy_extra);
      }
    });

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0 || width > 10000 || height > 10000) return;

    canvas.width = width;
    canvas.height = height;
    const p32 = this.getPalette32(palette);

    // Render each tile
    activeTiles.forEach(tile => {
      const h = tile.header;
      const elev = h.height * mult;

      // Base Diamond
      const bx = h.x - minX;
      const by = (h.y - elev) - minY;
      const bImg = ctx.createImageData(tile.cx, tile.cy);
      const bD32 = new Uint32Array(bImg.data.buffer);
      const bPix = showZ && tile.zData ? tile.zData : tile.data;

      for (let i = 0; i < bPix.length; i++) {
        const idx = bPix[i];
        if (idx === 0) { bD32[i] = 0; continue; }
        if (showZ && tile.zData) {
          const lx = i % tile.cx;
          const ly = Math.floor(i / tile.cx);
          if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy) || idx === 255) {
            bD32[i] = 0;
            continue;
          }
          const gray = Math.min(255, idx * 8);
          bD32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
        } else {
          bD32[i] = p32[idx];
        }
      }

      const temp = document.createElement('canvas');
      temp.width = tile.cx; temp.height = tile.cy;
      temp.getContext('2d')!.putImageData(bImg, 0, 0);
      ctx.drawImage(temp, bx, by);

      // Extra Data
      if (h.has_extra_data && tile.extraImageData) {
        const ex = h.x_extra - minX;
        const ey = (h.y_extra - elev) - minY;
        const ew = h.cx_extra;
        const eh = h.cy_extra;

        const eImg = ctx.createImageData(ew, eh);
        const eD32 = new Uint32Array(eImg.data.buffer);
        const ePix = showZ && tile.extraZData ? tile.extraZData : tile.extraImageData;

        for (let ly = 0; ly < eh; ly++) {
          for (let lx = 0; lx < ew; lx++) {
            const i = ly * ew + lx;
            const idx = ePix[i];
            if (idx === 0) { eD32[i] = 0; continue; }

            if (showZ && tile.extraZData) {
              // 1. Extra image transparency: do not show if extra image itself has no pixel here
              if (tile.extraImageData && tile.extraImageData[i] === 0) {
                eD32[i] = 0;
                continue;
              }
              // 2. 255 indicates empty / background Z in Westwood data
              if (idx === 255) {
                eD32[i] = 0;
                continue;
              }
              // 3. Do not show extra Z-data where it overlaps any base tile diamond
              const px = ex + lx;
              const py = ey + ly;
              if (isPixelOverlappingBaseTile(px, py, activeTiles, minX, minY, mult)) {
                eD32[i] = 0;
                continue;
              }

              const step = (tile.cy >= 60 || tile.cx >= 120 || tmpFile.cy >= 60) ? 4 : 8;
              const gray = Math.min(255, idx * step);
              eD32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
            } else {
              eD32[i] = p32[idx];
            }
          }
        }
        temp.width = ew; temp.height = eh;
        temp.getContext('2d')!.putImageData(eImg, 0, 0);
        ctx.drawImage(temp, ex, ey);
      }
    });
  }

  static renderExtraToCanvas(canvas: HTMLCanvasElement, tile: Tile, palette: RGB[], showZ: boolean = false) {
    if (!tile.extraImageData) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const p32 = this.getPalette32(palette);
    const w = tile.header.cx_extra;
    const h = tile.header.cy_extra;
    if (w <= 0 || h <= 0) return;

    canvas.width = w;
    canvas.height = h;
    const imgData = ctx.createImageData(w, h);
    const data32 = new Uint32Array(imgData.data.buffer);
    const pixels = showZ && tile.extraZData ? tile.extraZData : tile.extraImageData;

    for (let i = 0; i < pixels.length; i++) {
      const idx = pixels[i];
      if (idx === 0) {
        data32[i] = 0;
        continue;
      }

      if (showZ && tile.extraZData) {
        if (tile.extraImageData && tile.extraImageData[i] === 0) {
          data32[i] = 0;
          continue;
        }
        if (idx === 255) {
          data32[i] = 0;
          continue;
        }
        const step = (tile.cy >= 60 || tile.cx >= 120) ? 4 : 8;
        const gray = Math.min(255, idx * step);
        data32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
      } else {
        data32[i] = p32[idx];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}
