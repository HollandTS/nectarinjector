import { findPixelInElement } from '../src/lib/canvasPaintHelper';

/**
 * Blueprint & Code Reference: Solid Custom Brush (Stamp Tool) Pixel Extractor
 * 
 * FIXES TRANSPARENCY LEAK OVERLAPS:
 * Instead of simply returning a hit on any overlapping sheet index and exiting,
 * this scans through placed elements backwards (front-to-back depth order).
 * If the pixel evaluated on the front element is transparent (standard index 0 / alpha),
 * it bypasses it and evaluates the layer directly behind it, avoiding white/transparent boxes in stamp.
 */

interface Point2D {
  x: number;
  y: number;
}

interface PlacedElement {
  id: string;
  fileType: 'TMP' | 'SHP';
  fileName: string;
  content: any;
  gx: number;
  gy: number;
}

interface CameraConfig {
  mapCenterX: number;
  mapCenterY: number;
  cellW: number;
  cellH: number;
}

/**
 * Captures pixel colors within a specified box/lasso selection area on the Canvas.
 */
export function extractCustomBrushPixels(
  selectionMinX: number,
  selectionMaxX: number,
  selectionMinY: number,
  selectionMaxY: number,
  placedElements: PlacedElement[],
  selectedIds: Set<string>,
  getCachedCanvas: (fileName: string) => { width: number; height: number },
  camera: CameraConfig
): { width: number; height: number; pixels: (number | null)[] } {
  const { mapCenterX, mapCenterY, cellW, cellH } = camera;

  // Selected region coordinates boundary sizes
  const rx1 = Math.floor(selectionMinX);
  const rx2 = Math.ceil(selectionMaxX);
  const ry1 = Math.floor(selectionMinY);
  const ry2 = Math.ceil(selectionMaxY);

  const W = rx2 - rx1;
  const H = ry2 - ry1;

  const capturedPixels: (number | null)[] = new Array(W * H).fill(null);

  // 1. Sort elements by reverse rendering order (front to back)
  const sortedLayers = [...placedElements].sort((a, b) => {
    // Standard isometric depth ordering Formula: gx + gy
    const offsetA = a.gx + a.gy;
    const offsetB = b.gx + b.gy;
    if (offsetA !== offsetB) return offsetB - offsetA;
    return b.gx - a.gx;
  });

  // 2. Loop through every pixel in the defined selection coordinate bounds
  for (let bdy = 0; bdy < H; bdy++) {
    for (let bdx = 0; bdx < W; bdx++) {
      const cx = rx1 + bdx;
      const cy = ry1 + bdy;

      let pixelValue: number | null = null;

      // Depth-First Harvesting Strategy (Excluding Transparent Background Pixels):
      for (const item of sortedLayers) {
        if (!item.content) continue;
        const cached = getCachedCanvas(item.fileName);

        // Grid positions
        const dx = (item.gx - item.gy) * (cellW / 2);
        const dy = (item.gx + item.gy) * (cellH / 2);

        // File offset calculation bounds...
        let minX = 0;
        let minY = 0;

        if (item.fileType === 'TMP') {
          const tmp = item.content;
          let fileMinX = Infinity;
          let fileMinY = Infinity;
          const activeTiles = tmp.tiles.filter((t: any) => t !== null);
          if (activeTiles.length > 0) {
            const mult = tmp.cy / 2;
            activeTiles.forEach((tile: any) => {
              const h = tile.header;
              const elev = h.height * mult;
              fileMinX = Math.min(fileMinX, h.x);
              fileMinY = Math.min(fileMinY, h.y - elev);
              if (h.has_extra_data) {
                fileMinX = Math.min(fileMinX, h.x_extra);
                fileMinY = Math.min(fileMinY, h.y_extra - elev);
              }
            });
            minX = fileMinX;
            minY = fileMinY;
          }
        } else {
          minX = -cached.width / 2;
          minY = -cached.height / 2;
        }

        const screenLeft = mapCenterX + dx + minX;
        const screenTop = mapCenterY + dy + minY;

        // Is the current selection index within coordinates boundaries?
        if (
          cx >= screenLeft &&
          cx <= screenLeft + cached.width &&
          cy >= screenTop &&
          cy <= screenTop + cached.height
        ) {
          const rx = cx - screenLeft;
          const ry = cy - screenTop;

          // Search collision hit (ignoring diamond boundary rules during group stamp captures)
          const hit = findPixelInElement(item.fileType, item.content, rx, ry, true);
          if (hit) {
            let extractedVal = 0;

            if (hit.fileType === 'TMP' && hit.tileIndex !== undefined) {
              const sTmp = item.content;
              const sTile = sTmp.tiles[hit.tileIndex];
              if (sTile) {
                const sData = hit.cellType === 'base' ? sTile.data : sTile.extraImageData;
                if (sData) extractedVal = sData[hit.pixelIndex];
              }
            } else {
              const sShp = item.content;
              if (sShp.frames && sShp.frames[0]) {
                extractedVal = sShp.frames[0].data[hit.pixelIndex];
              }
            }

            // COLOR CHECK: Index 0 is standard Westwood transparent/void space
            if (extractedVal > 0) {
              pixelValue = extractedVal;
              break; // FOUND solid pixel: Halt deep search on coordinates and lock this value
            }
            // If extractedVal === 0, keep scanning elements underneath!
          }
        }
      }

      // Store found pixel value (supports translucent or alpha transparent pixels safely)
      capturedPixels[bdy * W + bdx] = pixelValue;
    }
  }

  return {
    width: W,
    height: H,
    pixels: capturedPixels,
  };
}
