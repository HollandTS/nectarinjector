/**
 * Blueprint & Implementation Guide: Isometric Snapping & Coordinates System
 * Use this module as a reference to align staggered tiles onto an isometric grid
 * with dynamic anchor-point snapping and elevation handling.
 */

export interface PlacedElement {
  id: string;
  fileName: string;
  fileType: 'TMP' | 'SHP';
  gx: number; // Isometric Grid coordinates
  gy: number;
  content: any;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface IsometricConfig {
  cellW: number;      // e.g., 48px or 64px width of isometric diamond boundary
  cellH: number;      // e.g., 24px or 32px height of isometric diamond boundary
  mapCenterX: number; // Viewport focal centers
  mapCenterY: number;
}

/**
 * 1. Convert Isometric Grid Coordinates to Screen Coordinates
 */
export function gridToScreen(
  gx: number,
  gy: number,
  config: IsometricConfig
): Point2D {
  const { cellW, cellH, mapCenterX, mapCenterY } = config;
  
  // Delta coordinates calculated based on stagger step
  const dx = (gx - gy) * (cellW / 2);
  const dy = (gx + gy) * (cellH / 2);

  return {
    x: mapCenterX + dx,
    y: mapCenterY + dy,
  };
}

/**
 * 2. Calculate All Snapping Anchor Points on Placed Elements
 * This extracts base corners and elevated offset points for extra images.
 */
export function calculateAnchorPoints(
  placedElements: PlacedElement[],
  getCachedCanvas: (fileName: string) => { width: number; height: number },
  config: IsometricConfig
): Point2D[] {
  const { cellW, cellH, mapCenterX, mapCenterY } = config;
  const points: Point2D[] = [];

  placedElements.forEach(item => {
    if (!item.content) return;
    const cached = getCachedCanvas(item.fileName);
    
    // Isometric grid alignment offsets
    const dx = (item.gx - item.gy) * (cellW / 2);
    const dy = (item.gx + item.gy) * (cellH / 2);

    let minX = 0;
    let minY = 0;

    if (item.fileType === 'TMP') {
      const tmp = item.content;
      let fileMinX = Infinity;
      let fileMinY = Infinity;
      const activeTiles = tmp.tiles.filter((t: any) => t !== null);
      if (activeTiles.length === 0) return;
      
      const mult = tmp.cy / 2; // elevation multiplier

      activeTiles.forEach((tile: any) => {
        const h = tile.header;
        const elev = h.height * mult; // Vertical elevation offset
        
        fileMinX = Math.min(fileMinX, h.x);
        fileMinY = Math.min(fileMinY, h.y - elev);

        if (h.has_extra_data) {
          fileMinX = Math.min(fileMinX, h.x_extra);
          fileMinY = Math.min(fileMinY, h.y_extra - elev);
        }
      });

      minX = fileMinX;
      minY = fileMinY;

      const screenLeft = mapCenterX + dx + minX;
      const screenTop = mapCenterY + dy + minY;

      tmp.tiles.forEach((tile: any) => {
        if (!tile) return;
        const h = tile.header;
        const elev = h.height * mult;

        // Base tile offsets
        const bx = h.x - minX;
        const by = h.y - elev - minY;
        const tx = screenLeft + bx;
        const ty = screenTop + by;
        const tcx = tile.cx;
        const tcy = tile.cy;

        // Generate 8 base anchor coordinates
        points.push({ x: tx, y: ty });
        points.push({ x: tx + tcx, y: ty });
        points.push({ x: tx, y: ty + tcy });
        points.push({ x: tx + tcx, y: ty + tcy });
        points.push({ x: tx + tcx / 2, y: ty });
        points.push({ x: tx + tcx / 2, y: ty + tcy });
        points.push({ x: tx, y: ty + tcy / 2 });
        points.push({ x: tx + tcx, y: ty + tcy / 2 });

        // Elevation extra image offsets
        if (h.has_extra_data && tile.extraImageData) {
          const ex = h.x_extra - minX;
          const ey = h.y_extra - elev - minY;
          const etx = screenLeft + ex;
          const ety = screenTop + ey;
          const ecx = h.cx_extra;
          const ecy = h.cy_extra;

          // Generate 8 extra image anchor coordinates
          points.push({ x: etx, y: ety });
          points.push({ x: etx + ecx, y: ety });
          points.push({ x: etx, y: ety + ecy });
          points.push({ x: etx + ecx, y: ety + ecy });
          points.push({ x: etx + ecx / 2, y: ety });
          points.push({ x: etx + ecx / 2, y: ety + ecy });
          points.push({ x: etx, y: ety + ecy / 2 });
          points.push({ x: etx + ecx, y: ety + ecy / 2 });
        }
      });
    } else {
      // Bounding box anchor points for flat sprites
      minX = -cached.width / 2;
      minY = -cached.height / 2;

      const screenLeft = mapCenterX + dx + minX;
      const screenTop = mapCenterY + dy + minY;

      points.push({ x: screenLeft, y: screenTop });
      points.push({ x: screenLeft + cached.width, y: screenTop });
      points.push({ x: screenLeft, y: screenTop + cached.height });
      points.push({ x: screenLeft + cached.width, y: screenTop + cached.height });
      points.push({ x: screenLeft + cached.width / 2, y: screenTop });
      points.push({ x: screenLeft + cached.width / 2, y: screenTop + cached.height });
      points.push({ x: screenLeft, y: screenTop + cached.height / 2 });
      points.push({ x: screenLeft + cached.width, y: screenTop + cached.height / 2 });
    }
  });

  return points;
}

/**
 * 3. Search and Snap to Closest Anchor Coordinate
 */
export function findClosestAnchor(
  mouseX: number,
  mouseY: number,
  anchors: Point2D[],
  snapThreshold: number = 15
): Point2D | null {
  let closest: Point2D | null = null;
  let minDistance = snapThreshold;

  for (const pt of anchors) {
    const dx = pt.x - mouseX;
    const dy = pt.y - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closest = pt;
    }
  }

  return closest;
}
