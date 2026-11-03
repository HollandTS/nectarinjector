import type { ShpFile, ShpFrame } from './shp';
import type { TargetEngine } from './tileResizer';

export function scaleFrameData(
  src: Uint8Array, 
  sw: number, 
  sh: number, 
  dw: number, 
  dh: number, 
  _isShadow?: boolean
): Uint8Array {
  const dst = new Uint8Array(dw * dh);
  // Pure nearest-neighbor sampling preserves 100% of palette indices (remap, shadows, art indices)
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    const rowSrc = sy * sw;
    const rowDst = y * dw;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      dst[rowDst + x] = src[rowSrc + sx];
    }
  }
  return dst;
}

export function scaleShpFile(shp: ShpFile, target: TargetEngine): ShpFile {
  const targetType = target;
  const currentType = shp.sourceType || 'TS';
  if (currentType === targetType) return shp;

  // For OpenTS_48x96, it is specifically a 200% resize (2x scale) from TS SHPs
  let scale: number;
  if (targetType === 'OpenTS_48x96') {
    scale = 2.0;
  } else {
    // Base tile widths: TS = 48, RA2 = 60, OpenTS = 120, OpenTS_48x96 = 96
    const currentBase = currentType === 'RA2' ? 60 : currentType === 'OpenTS' ? (shp.width >= 90 ? 120 : 96) : 48;
    const targetBase = targetType === 'RA2' ? 60 : targetType === 'OpenTS' ? 120 : 48;
    scale = targetBase / currentBase;
  }

  const scaledWidth = Math.max(1, Math.round(shp.width * scale));
  const scaledHeight = Math.max(1, Math.round(shp.height * scale));

  const scaledFrames: ShpFrame[] = shp.frames.map(frame => {
    const tempW = Math.max(1, Math.round(frame.w * scale));
    const tempH = Math.max(1, Math.round(frame.h * scale));
    const tempScaledX = Math.round(frame.x * scale);
    const tempScaledY = Math.round(frame.y * scale);

    // Scale frame pixels
    const tempScaledData = scaleFrameData(frame.data, frame.w, frame.h, tempW, tempH, frame.isShadow);

    // Scan for tight bounds
    let minX = tempW;
    let minY = tempH;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < tempH; y++) {
      for (let x = 0; x < tempW; x++) {
        if (tempScaledData[y * tempW + x] !== 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    let finalW = 0;
    let finalH = 0;
    let finalX = 0;
    let finalY = 0;
    let finalData: Uint8Array;

    if (maxX === -1) {
      // Entirely transparent frame
      finalW = 1;
      finalH = 1;
      finalX = tempScaledX;
      finalY = tempScaledY;
      finalData = new Uint8Array([0]);
    } else {
      finalW = maxX - minX + 1;
      finalH = maxY - minY + 1;
      finalX = tempScaledX + minX;
      finalY = tempScaledY + minY;

      finalData = new Uint8Array(finalW * finalH);
      for (let y = 0; y < finalH; y++) {
        const srcOff = (minY + y) * tempW;
        const dstOff = y * finalW;
        for (let x = 0; x < finalW; x++) {
          finalData[dstOff + x] = tempScaledData[srcOff + (minX + x)];
        }
      }
    }

    return {
      x: finalX,
      y: finalY,
      w: finalW,
      h: finalH,
      flags: 3, // Force compression flag
      fileOffset: 0,
      data: finalData,
      isShadow: frame.isShadow
    };
  });

  return {
    width: scaledWidth,
    height: scaledHeight,
    frames: scaledFrames,
    type: 'SHP',
    sourceType: targetType
  };
}
