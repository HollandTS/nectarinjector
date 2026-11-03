import { findPixelInElement, PaintLocation } from '../src/lib/canvasPaintHelper';
import { TmpParser } from '../src/lib/formats';

/**
 * Blueprint & Code Reference: Interactive Pixel Hover Cursor (Brush Preview Options)
 * Paints a dynamic hover guide directly on top of overlapping pixels.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HoverCursorConfig {
  ctx: CanvasRenderingContext2D;
  mouseX: number;
  mouseY: number;
  brushSize: number;
  toolMode: 'draw' | 'eraser' | 'picker' | 'clone';
  selectedColorIndex: number;
  palette: RGB[];
  screenLeft: number; // calculated overlapping elements' bounding screen region coordinates
  screenTop: number;
  cachedWidth: number;
  cachedHeight: number;
  activeTileContent: any; // original tile dataset (TMP or SHP)
}

export function drawInteractiveHoverCursor({
  ctx,
  mouseX,
  mouseY,
  brushSize,
  toolMode,
  selectedColorIndex,
  palette,
  screenLeft,
  screenTop,
  cachedWidth,
  cachedHeight,
  activeTileContent,
}: HoverCursorConfig) {
  ctx.save();

  const radius = Math.floor(brushSize / 2);

  // Iterate the circular kernel around mouse pointer coordinates
  for (let bdy = -radius; bdy <= radius; bdy++) {
    for (let bdx = -radius; bdx <= radius; bdx++) {
      // Circle boundaries check
      if (bdx * bdx + bdy * bdy > radius * radius + 0.5) continue;

      const currentCavX = Math.floor(mouseX) + bdx;
      const currentCavY = Math.floor(mouseY) + bdy;

      // Translate canvas space coordinates into target relative offsets
      const targetRx = currentCavX - screenLeft;
      const targetRy = currentCavY - screenTop;

      if (targetRx >= 0 && targetRx < cachedWidth && targetRy >= 0 && targetRy < cachedHeight) {
        // Run collision check with elements
        const bHit = findPixelInElement('TMP', activeTileContent, targetRx, targetRy);
        if (bHit) {
          let isInside = true;

          // Check limits: Westwood diamonds restrict tile placements/edits to internal tiles
          if (bHit.fileType === 'TMP' && bHit.cellType === 'base') {
            const tile = activeTileContent.tiles[bHit.tileIndex!];
            if (tile) {
              const lx = bHit.pixelIndex % tile.cx;
              const ly = Math.floor(bHit.pixelIndex / tile.cx);
              
              // Standard diamond boundary check
              if (!TmpParser.isInsideWestwoodDiamond(lx, ly, tile.cx, tile.cy)) {
                isInside = false;
              }
            }
          }

          if (isInside) {
            let previewColor: RGB | null = palette[selectedColorIndex];
            let hasColor = toolMode !== 'eraser';

            if (toolMode === 'picker') {
              // Highlight the pixel hovered for reading with cyan tint
              ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
              ctx.fillRect(currentCavX, currentCavY, 1, 1);
            } else if (toolMode === 'eraser') {
              // Translucent warning red zone
              ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
              ctx.fillRect(currentCavX, currentCavY, 1, 1);
            } else if (hasColor && previewColor) {
              // Real color overlay
              ctx.fillStyle = `rgba(${previewColor.r}, ${previewColor.g}, ${previewColor.b}, 0.85)`;
              ctx.fillRect(currentCavX, currentCavY, 1, 1);
            }

            // Draw clean micro outline around active element pixels
            ctx.strokeStyle = toolMode === 'eraser' ? '#ef4444' : '#10b981';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(currentCavX - 0.1, currentCavY - 0.1, 1.2, 1.2);
          }
        }
      }
    }
  }

  ctx.restore();
}
