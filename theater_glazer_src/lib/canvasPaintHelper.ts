import { TmpFile, Tile, TmpParser } from './formats';
import { ShpFile } from './shp';

export interface PaintLocation {
  fileType: 'TMP' | 'SHP';
  tileIndex?: number; // Slot index inside TMP tiles list
  cellType?: 'base' | 'extra';
  pixelIndex: number;
}

export function findPixelInElement(
  fileType: 'TMP' | 'SHP',
  content: TmpFile | ShpFile,
  rx: number,
  ry: number,
  ignoreDiamond: boolean = false
): PaintLocation | null {
  if (fileType === 'TMP') {
    const tmp = content as TmpFile;
    const activeTiles = tmp.tiles.filter((t): t is Tile => t !== null);
    if (activeTiles.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    const mult = tmp.cy / 2;

    activeTiles.forEach(tile => {
      const h = tile.header;
      const elev = h.height * mult;
      minX = Math.min(minX, h.x);
      minY = Math.min(minY, h.y - elev);
      if (h.has_extra_data) {
        minX = Math.min(minX, h.x_extra);
        minY = Math.min(minY, h.y_extra - elev);
      }
    });

    // Check extra layer first because it draws on top of base
    for (const tile of tmp.tiles) {
      if (!tile) continue;
      const h = tile.header;
      const elev = h.height * mult;

      // Checking extra layer intersection
      if (h.has_extra_data && tile.extraImageData) {
        const ex = h.x_extra - minX;
        const ey = (h.y_extra - elev) - minY;
        const ew = h.cx_extra;
        const eh = h.cy_extra;

        if (rx >= ex && rx < ex + ew && ry >= ey && ry < ey + eh) {
          const lx = Math.floor(rx - ex);
          const ly = Math.floor(ry - ey);
          const pixelIndex = ly * ew + lx;
          if (pixelIndex >= 0 && pixelIndex < tile.extraImageData.length) {
            return {
              fileType: 'TMP',
              tileIndex: tile.slot,
              cellType: 'extra',
              pixelIndex
            };
          }
        }
      }

      // Checking base layer intersection
      const bx = h.x - minX;
      const by = (h.y - elev) - minY;
      if (rx >= bx && rx < bx + tile.cx && ry >= by && ry < by + tile.cy) {
        const lx = Math.floor(rx - bx);
        const ly = Math.floor(ry - by);

        if (ignoreDiamond || TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
          const pixelIndex = ly * tile.cx + lx;
          if (pixelIndex >= 0 && pixelIndex < tile.data.length) {
            return {
              fileType: 'TMP',
              tileIndex: tile.slot,
              cellType: 'base',
              pixelIndex
            };
          }
        }
      }
    }
  } else {
    // SHP File
    const shp = content as ShpFile;
    if (shp.frames && shp.frames.length > 0) {
      const frame = shp.frames[0];
      const lx = Math.floor(rx);
      const ly = Math.floor(ry);
      if (lx >= 0 && lx < frame.w && ly >= 0 && ly < frame.h) {
        const pixelIndex = ly * frame.w + lx;
        if (pixelIndex >= 0 && pixelIndex < frame.data.length) {
          return {
            fileType: 'SHP',
            pixelIndex
          };
        }
      }
    }
  }

  return null;
}

/**
 * Perform brush operations on specified array with specified brush width
 */
export function paintBrushOnData(
  data: Uint8Array,
  width: number,
  height: number,
  pixelIndex: number,
  brushSize: number,
  colorValue: number,
  lockColorZero: boolean = false,
  isDiamondMask: boolean = false,
  cx?: number,
  cy?: number
) {
  const targetX = pixelIndex % width;
  const targetY = Math.floor(pixelIndex / width);
  const radius = Math.floor(brushSize / 2);

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // Circle brush boundary check
      if (dx * dx + dy * dy > radius * radius + 0.5) continue;

      const px = targetX + dx;
      const py = targetY + dy;

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        if (idx >= 0 && idx < data.length) {
          // Lock Transparent #0 Check
          if (lockColorZero) {
            if (data[idx] === 0 || colorValue === 0) {
              continue;
            }
          }

          // Westwood diamond shape constraint check for base tile edits
          if (isDiamondMask && cx && cy) {
            if (!TmpParser.isInsideWestwoodDiamond(px, py, cx, cy)) {
              continue;
            }
          }

          data[idx] = colorValue;
        }
      }
    }
  }
}
