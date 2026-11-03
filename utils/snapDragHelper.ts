export interface DraggablePos {
  id: string;
  left: number;
  top: number;
  el: HTMLCanvasElement;
}

/**
 * Capture current left/top styles for all elements scheduled to be dragged.
 */
export function getInitialDraggablePositions(ids: string[]): DraggablePos[] {
  const positions: DraggablePos[] = [];
  for (const id of ids) {
    const el = document.querySelector(`canvas[data-image-id="${id}"]`) as HTMLCanvasElement;
    if (el) {
      positions.push({
        id,
        left: parseFloat(el.style.left) || 0,
        top: parseFloat(el.style.top) || 0,
        el
      });
    }
  }
  return positions;
}

/**
 * Calculates current grid-snapper step movements and corresponding pixel snapped alignments.
 */
export function getSnappedOffsets(
  currentX: number,
  currentY: number,
  startX: number,
  startY: number,
  zoom: number,
  cellW: number,
  cellH: number
) {
  const dxTotal = (currentX - startX) / zoom;
  const dyTotal = (currentY - startY) / zoom;

  const w2 = cellW / 2;
  const h2 = cellH / 2;

  // Calculate the raw translation on index space
  const dgx = (dyTotal / h2 + dxTotal / w2) / 2;
  const dgy = (dyTotal / h2 - dxTotal / w2) / 2;

  // Snapped to perfect grid cell boundaries
  const dgxSnapped = Math.round(dgx);
  const dgySnapped = Math.round(dgy);

  // Return the visual physical pixel offset corresponding to that snapped grid coordinate
  const snappedDx = (dgxSnapped - dgySnapped) * w2;
  const snappedDy = (dgxSnapped + dgySnapped) * h2;

  return {
    dgx,
    dgy,
    dxTotal,
    dyTotal,
    dgxSnapped,
    dgySnapped,
    snappedDx,
    snappedDy
  };
}
