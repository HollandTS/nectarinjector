import type { Tile, TileHeader, TmpFile } from './formats';
import { generateSmartTileZData } from './smartZData';
import { optimizeCustomEdges } from './edgeStepOptimizer';
import { repairTileHoles, repairExtraHoles } from './holeRepair';
import { getSharpSample } from './sharpSampler';
import { interpolateExtraZData } from './extraZInterpolator';
import { computeTargetTileMask } from './tileEdgeMask';
import { computeDiamondMask } from './diamondMask';
import { fillTileFromMask, fillTileZFromMask } from './tileMaskFiller';
import { protectRampSeams } from './rampSeamProtector';
import { fillTmpHoles } from './tmpHoleFiller';
import { resolveExactSlopeSpecs, resampleUnifiedSlopeTile } from './rampUnifiedResampler';

export { getSharpSample } from './sharpSampler';

export type TargetEngine = 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96';

export interface ConvertOptions {
  isRamp?: boolean;
  imageFilter?: 'quadratic' | 'linear' | 'box' | 'nearest';
  zFilter?: 'quadratic' | 'linear' | 'box' | 'nearest';
  smartZData?: boolean;
}

export const getDiamondBounds = (y: number, w: number, h: number, expansion: number = 0) => {
  const halfW = w / 2;
  const halfH = h / 2;
  const ty = Math.floor(y);
  let ry: number;
  if (ty < halfH) {
    ry = ty;
  } else {
    ry = h - 2 - ty;
  }
  if (ry < 0) {
    return { w: 0, x: 0 };
  }
  const rowW = (ry + 1) * 4 + expansion * 2;
  const xStart = halfW - (ry + 1) * 2 - expansion;
  return { 
    w: Math.max(0, Math.min(w, rowW)), 
    x: Math.max(0, Math.min(w, xStart)) 
  };
};


export function convertTmpEngine(
  tmpFile: TmpFile, 
  target: TargetEngine, 
  options?: ConvertOptions
): TmpFile {
  let targetCx = 48;
  let targetCy = 24;

  if (target === 'TS') {
    targetCx = 48;
    targetCy = 24;
  } else if (target === 'RA2') {
    targetCx = 60;
    targetCy = 30;
  } else if (target === 'OpenTS') {
    targetCx = 120;
    targetCy = 60;
  } else if (target === 'OpenTS_48x96') {
    targetCx = 96;
    targetCy = 48;
  }

  const isRamp = options?.isRamp || false;
  const imageFilter = options?.imageFilter || 'quadratic';
  const zFilter = options?.zFilter || 'quadratic';

  // Strict check: if type matches AND dimensions match, skip conversion
  const isAlreadyTarget = target === 'OpenTS_48x96'
    ? (tmpFile.cx === 96 && tmpFile.cy === 48)
    : (tmpFile.type === target && tmpFile.cx === targetCx && tmpFile.cy === targetCy);
  if (isAlreadyTarget) {
    return tmpFile;
  }

  if (tmpFile.cx <= 0 || tmpFile.cy <= 0) {
    console.warn('Invalid source dimensions', tmpFile.cx, tmpFile.cy);
    return tmpFile;
  }

  const scale = targetCx / tmpFile.cx;
  const invScale = tmpFile.cx / targetCx;

  if (!isFinite(scale) || !isFinite(invScale)) {
    console.warn('Invalid scale calculation');
    return tmpFile;
  }

  const newTiles = tmpFile.tiles.map((tile, tileIdx) => {
    if (!tile || tile.cx <= 0 || tile.cy <= 0) return null;

    const sw = tile.cx;
    const sh = tile.cy;
    const dw = targetCx;
    const dh = targetCy;

    const isTileRamp = isRamp || (tile.header.ramp_type > 0);
    if (isTileRamp) {
      const exactSpecs = resolveExactSlopeSpecs(tile, tileIdx, tmpFile.tiles, sw, sh, dw, dh);
      if (exactSpecs) {
        return resampleUnifiedSlopeTile(
          tile,
          exactSpecs.srcSpec,
          exactSpecs.dstSpec,
          sw,
          sh,
          dw,
          dh,
          scale,
          imageFilter,
          zFilter,
          options?.smartZData
        );
      }
    }

    // 0. Compute advanced edge mask (preserves 2:1 diamond bounds and custom slope/ramp pixel rhythms)
    const tileMask = computeTargetTileMask(tile.data, sw, sh, dw, dh, isTileRamp, tile.header.ramp_type);

    // 1. Create target data buffer and fill strictly within mask with 100% solid pixels
    const newData = new Uint8Array(dw * dh);
    fillTileFromMask(newData, tile.data, tileMask, sw, sh, dw, dh, imageFilter);

    // 2. Generate or fill Z-Data
    let finalZData: Uint8Array | null = null;
    if (options?.smartZData && (tile.zData || tile.header.has_z_data)) {
      finalZData = generateSmartTileZData(dw, dh, tile.zData, sw, sh, newData, isTileRamp);
    } else if (tile.zData) {
      finalZData = new Uint8Array(dw * dh);
      const zMask = computeDiamondMask(dw, dh);
      fillTileZFromMask(finalZData, tile.zData, zMask, sw, sh, dw, dh, zFilter);
    }

    // 3. Multi-pass hole repair to fix pinholes & seam gaps strictly within mask
    repairTileHoles(newData, finalZData, dw, dh, tileMask);

    // 3. Handle Extra Data (Cliffs) - Rectangular mapping with quality sampler
    let newExtraImageData: Uint8Array | null = null;
    let newExtraZData: Uint8Array | null = null;
    let newCxExtra = 0;
    let newCyExtra = 0;
    let newXExtra = 0;
    let newYExtra = 0;

    if (tile.header.has_extra_data && tile.extraImageData) {
      newCxExtra = Math.round(tile.header.cx_extra * scale);
      newCyExtra = Math.round(tile.header.cy_extra * scale);
      // Ensure even dimensions for engine compatibility
      if (newCxExtra % 2 !== 0) newCxExtra++;
      if (newCyExtra % 2 !== 0) newCyExtra++;
      newXExtra = Math.round(tile.header.x_extra * scale);
      newYExtra = Math.round(tile.header.y_extra * scale);
      
      if (newCxExtra > 0 && newCyExtra > 0) {
        newExtraImageData = new Uint8Array(newCxExtra * newCyExtra);
        
        const eInvScaleX = tile.header.cx_extra / newCxExtra;
        const eInvScaleY = tile.header.cy_extra / newCyExtra;

        // Extra data is rectangular - use full-width bounds
        const eSrcBounds: { w: number; x: number }[] = [];
        for (let y = 0; y < tile.header.cy_extra; y++) {
          eSrcBounds.push({ w: tile.header.cx_extra, x: 0 });
        }

        for (let ey = 0; ey < newCyExtra; ey++) {
          for (let ex = 0; ex < newCxExtra; ex++) {
            const dIdx = ey * newCxExtra + ex;
            const val = getSharpSample(tile.extraImageData!, tile.header.cx_extra, tile.header.cy_extra, ex, ey, eInvScaleX, eInvScaleY, eSrcBounds, false, imageFilter);
            newExtraImageData[dIdx] = val;
          }
        }

        // Generate smooth continuous Z-Data for extra image (no 3-4px flat banding)
        if (tile.extraZData || (options?.smartZData && tile.header.has_z_data)) {
          newExtraZData = interpolateExtraZData(
            newCxExtra,
            newCyExtra,
            tile.extraZData,
            tile.header.cx_extra,
            tile.header.cy_extra,
            sh,
            dh,
            newExtraImageData,
            newXExtra,
            dw
          );
        }

        repairExtraHoles(newExtraImageData, newExtraZData, newCxExtra, newCyExtra, dh - 1);

        if (isTileRamp) {
          protectRampSeams(
            newData,
            newExtraImageData,
            dw,
            dh,
            newCxExtra,
            newCyExtra,
            newXExtra,
            newYExtra,
            tile.header.ramp_type || 1,
            tileMask
          );
        }
      }
    }

    // 4. Update Header
    const newHeader: TileHeader = {
      ...tile.header,
      x: Math.round(tile.header.x * scale),
      y: Math.round(tile.header.y * scale),
      x_extra: newXExtra,
      y_extra: newYExtra,
      cx_extra: newCxExtra,
      cy_extra: newCyExtra,
      height: tile.header.height,
      has_z_data: options?.smartZData ? (finalZData !== null) : tile.header.has_z_data
    };

    return {
      ...tile,
      cx: dw,
      cy: dh,
      header: newHeader,
      data: newData,
      zData: finalZData,
      extraImageData: newExtraImageData,
      extraZData: newExtraZData
    };
  });

  const result: TmpFile = {
    ...tmpFile,
    cx: targetCx,
    cy: targetCy,
    tiles: newTiles,
    type: target === 'OpenTS_48x96' ? 'OpenTS' : target
  };

  // Fill seam pinholes and missing Z-depth after resize process
  fillTmpHoles(result);

  return result;
}
