# Core Isometric Tile Editor Features: Blueprint and Prompts

This guide outlines exactly how the isometric canvas layout, pixel drawing brushes, snapping math, and the layered custom stamp brush capture flow are built. Use these descriptions, instructions, and correct formulas to instruct any AI assistant to build these features without bugs.

\---

## 1\. Isometric Snapping \& Grid Layout System

### The Challenge

Isometric tiles (Westwood style) reside on a staggered grid. Standard grid conversions fail because elevation heights, base tile dimensions, and secondary elevation assets shift visual positions.

### Architectural Solution

1. **World Coordinates (`gx`, `gy`) to Screen Coordinates**:

   * The offset from the map center is calculated as:
$$\\Delta X = (gx - gy) \\times \\frac{\\text{cellW}}{2}$$
$$\\Delta Y = (gx + gy) \\times \\frac{\\text{cellH}}{2}$$
   * These coordinates identify the pivot floor index of the tile.
2. **Elevation Offset Adjustment**:

   * For tiles containing elevation height values, the tile and its corresponding extra layer assets must be translated upwards using:
$$\\text{elevationY} = \\text{tileHeight} \\times \\text{elevationMultiplier}$$
where $\\text{elevationMultiplier} = \\frac{\\text{cellH}}{2}$.
   * The screen base becomes:
$$\\text{screenLeft} = \\text{mapCenterX} + \\Delta X + \\text{fileMinX}$$
$$\\text{screenTop} = \\text{mapCenterY} + \\Delta Y + \\text{fileMinY} - \\text{elevationY}$$
3. **Dynamic Anchor Points Calculation**:

   * Calculate an exact list of 8 primary snapping points (corners and midpoints) per tile, including elevated extra images:

     * Corners: `(tx, ty)`, `(tx + cx, ty)`, `(tx, ty + cy)`, `(tx + cx, ty + cy)`
     * Midpoints: `(tx + cx/2, ty)`, `(tx + cx/2, ty + cy)`, `(tx, ty + cy/2)`, `(tx + cx, ty + cy/2)`
   * Apply Euclidean distance tests against the floating mouse cursor coordinate to pick the closest anchor dynamically within a threshold (e.g., 15px).

\---

## 2\. Interactive Pixel Hover Cursor (Brush Preview)

### The Challenge

Standard desktop cursors are imprecise for pixel-exact tile editing. Cursors should adapt dynamically to overlay the exact pixel shape they will strike, colored with active values, accounting for diamond masks.

### Solution Pattern

1. **Dynamic Hover Selection**:

   * Locate the top-most tile under the cursor. Determine relative pixel coordinates `(rx, ry)` within that sprite sheet or coordinate system.
2. **Brush Mask Loop**:

   * Iterate through coordinates in a circular brush kernel of selected diameter `brushSize` centered on the target pixel:

```typescript
     const radius = Math.floor(brushSize / 2);
     for (let dy = -radius; dy <= radius; dy++) {
       for (let dx = -radius; dx <= radius; dx++) {
         if (dx \* dx + dy \* dy > radius \* radius + 0.5) continue; // circle shape constraint
         
         const currentCavX = Math.floor(mouseX) + bdx;
         const currentCavY = Math.floor(mouseY) + bdy;
         // Perform overlap and diamond tests...
       }
     }
     ```

3. **Responsive Visual Overlay**:

   * **Draw tool**: Draw 1x1 rects over each overlapping coordinate using the active palette index colors with translucent opacity (e.g., `0.85`).
   * **Eraser tool**: Draw 1x1 red squares (`rgba(239, 68, 68, 0.25)`) indicating pixel deletion boundary.
   * **Clone Stamp tool**: Sample the corresponding offset coordinates from the locked canvas source, extract their indexes, and paint them as the preview directly in place.

\---

## 3\. High-Precision Custom Brush (Stamp Tool) Capture

### The Challenge

When capturing custom brushes using box or lasso selectors, layered assets can overlap. If the front-most asset contains transparent/void zones (color index `0` standard palette), standard scanners return the front tile's transparent pixel and stop, causing gaps and transparent blocks in the captured stamp, ignoring valid colored pixels of tiles directly underneath!

### The Perfect Fix: Depth-First Solid Pixel Harvesting

Instead of returning a hit on any overlapping tile's bounding coordinates and exiting, the capture engine must scan through layered tiles in reverse depth order (front-to-back) and continue harvesting deeper until a **solid pixel** (color index $> 0$) is retrieved:

```typescript
// Harvesting formula avoiding transparency leakage:
let val = null;

for (const item of reverseLayeredElements) {
  const isInside = cx >= screenLeft \&\& cx <= screenLeft + width;
  if (!isInside) continue;

  const rx = cx - screenLeft;
  const ry = cy - screenTop;
  const hit = findPixelInElement(item.fileType, item.content, rx, ry, true);

  if (hit) {
    let currentVal = 0;
    if (hit.fileType === 'TMP') {
      const tile = item.content.tiles\[hit.tileIndex];
      const data = hit.cellType === 'base' ? tile.data : tile.extraImageData;
      if (data) currentVal = data\[hit.pixelIndex];
    } else {
      currentVal = item.content.frames\[0].data\[hit.pixelIndex];
    }

    // Capture ONLY solid pixels. If transparent, let the loop proceed to tiles underneath!
    if (currentVal > 0) {
      val = currentVal;
      break; 
    }
  }
}
```

This guarantees an exact "What You See Is What You Get" capturing experience on complex canvases!


Core Westwood Math Insight to Solve a Saving Bug

In standard rectangular layouts, offsets point to absolute file locations. In Westwood isotile formats, tile headers are embedded together with diamond arrays.

All internal offset properties inside individual tile blocks (extra\_ofs, z\_ofs, and extra\_z\_ofs) MUST be written as relative offsets from the start of that specific tile block, not the file start pointer:

If your target engine does not calculate these relative to startOfTile, coordinate buffers align incorrectly, leading to flat tiles with invisible or displaced cliffs. im feeding you the codes in the file LoaderAndSaverExample.tsx which should help the app correctly format and serialize files without bugs.

