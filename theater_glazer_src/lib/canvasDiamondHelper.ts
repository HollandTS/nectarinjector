import { PlacedElement } from '../types';
import { TmpFile, Tile } from './formats';

/**
 * Renders precision diamond-shaped selection outlines and handles for placed elements.
 */
export function drawElementSelectionOutline(
  ctx: CanvasRenderingContext2D,
  item: PlacedElement,
  screenLeft: number,
  screenTop: number,
  cachedWidth: number,
  cachedHeight: number
) {
  ctx.save();

  if (item.fileType === 'TMP' && item.content) {
    const tmp = item.content as TmpFile;
    const mult = tmp.cy / 2;

    let minX = Infinity;
    let minY = Infinity;

    const activeTiles = tmp.tiles.filter((t): t is Tile => t !== null);
    if (activeTiles.length > 0) {
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
    } else {
      minX = 0;
      minY = 0;
    }

    ctx.strokeStyle = '#10b981'; // Emerald green outline
    ctx.lineWidth = 1.5;

    tmp.tiles.forEach(tile => {
      if (!tile) return;
      const h = tile.header;
      const elev = h.height * mult;

      const tx = screenLeft + (h.x - minX);
      const ty = screenTop + (h.y - elev - minY);
      const tcx = tile.cx;
      const tcy = tile.cy;

      // Draw diamond polygon around tile
      ctx.beginPath();
      ctx.moveTo(tx + tcx / 2, ty);
      ctx.lineTo(tx + tcx, ty + tcy / 2);
      ctx.lineTo(tx + tcx / 2, ty + tcy);
      ctx.lineTo(tx, ty + tcy / 2);
      ctx.closePath();

      // Subtle emerald tint fill
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fill();
      ctx.stroke();

      // Handle dots at 4 diamond vertices
      ctx.fillStyle = '#10b981';
      const hs = 4; // handle size
      const vertices = [
        { x: tx + tcx / 2, y: ty },         // Top
        { x: tx + tcx, y: ty + tcy / 2 },     // Right
        { x: tx + tcx / 2, y: ty + tcy },     // Bottom
        { x: tx, y: ty + tcy / 2 }          // Left
      ];

      vertices.forEach(v => {
        ctx.fillRect(v.x - hs / 2, v.y - hs / 2, hs, hs);
      });

      // Extra image layer outline if attached
      if (h.has_extra_data && tile.extraImageData) {
        const ex = screenLeft + (h.x_extra - minX);
        const ey = screenTop + (h.y_extra - elev - minY);
        const ew = h.cx_extra;
        const eh = h.cy_extra;

        ctx.strokeStyle = '#f59e0b'; // Amber outline for extra image
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(ex, ey, ew, eh);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
        ctx.fillRect(ex, ey, ew, eh);

        ctx.fillStyle = '#f59e0b';
        [
          { x: ex, y: ey },
          { x: ex + ew, y: ey },
          { x: ex, y: ey + eh },
          { x: ex + ew, y: ey + eh }
        ].forEach(pt => {
          ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        });
        ctx.setLineDash([]);
      }
    });

  } else {
    // SHP File (rectangular sprite)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(screenLeft - 1, screenTop - 1, cachedWidth + 2, cachedHeight + 2);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(screenLeft, screenTop, cachedWidth, cachedHeight);

    ctx.fillStyle = '#10b981';
    const hs = 4;
    [
      { x: screenLeft, y: screenTop },
      { x: screenLeft + cachedWidth, y: screenTop },
      { x: screenLeft, y: screenTop + cachedHeight },
      { x: screenLeft + cachedWidth, y: screenTop + cachedHeight }
    ].forEach(pt => {
      ctx.fillRect(pt.x - hs / 2, pt.y - hs / 2, hs, hs);
    });
  }

  ctx.restore();
}
