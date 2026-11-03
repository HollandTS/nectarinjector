export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface TileHeader {
  x: number;
  y: number;
  extra_ofs: number;
  z_ofs: number;
  extra_z_ofs: number;
  x_extra: number;
  y_extra: number;
  cx_extra: number;
  cy_extra: number;
  flags: number;
  height: number;
  land_type: number;
  ramp_type: number;
  radar_colors: number[];
  has_extra_data: boolean;
  has_z_data: boolean;
  has_damaged_data: boolean;
  is_fully_transparent: boolean;
}

export interface Tile {
  slot: number;
  header: TileHeader;
  data: Uint8Array;      // Decoded diamond data
  zData: Uint8Array | null;
  extraImageData: Uint8Array | null;
  extraZData: Uint8Array | null;
  damagedData: Uint8Array | null;
  cx: number;
  cy: number;
}

export interface TmpFile {
  cblocks_x: number;
  cblocks_y: number;
  cx: number;
  cy: number;
  tiles: (Tile | null)[];
  type: "TS" | "RA2" | "OPENTS";
}

export class TmpParser {
  static parsePalette(buffer: ArrayBuffer): RGB[] {
    const palette: RGB[] = Array.from({ length: 256 }, () => ({ r: 0, g: 0, b: 0 }));
    const txt = new TextDecoder().decode(buffer);

    if (txt.startsWith("JASC-PAL")) {
      const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      let pIdx = 0;
      for (let i = 3; i < lines.length && pIdx < 256; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 3) {
          const r = parseInt(parts[0]);
          const g = parseInt(parts[1]);
          const b = parseInt(parts[2]);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            palette[pIdx] = { r, g, b };
            pIdx++;
          }
        }
      }
    } else if (buffer.byteLength === 768) {
      const view = new Uint8Array(buffer);
      for (let i = 0; i < 256; i++) {
        palette[i] = {
          r: view[i * 3] * 4,
          g: view[i * 3 + 1] * 4,
          b: view[i * 3 + 2] * 4,
        };
      }
    } else {
      throw new Error("Unknown palette format. Expected JASC-PAL or 768-byte binary.");
    }
    return palette;
  }

  static isInsideWestwoodDiamond(lx: number, ly: number, cx: number, cy: number): boolean {
    if (lx < 0 || lx >= cx || ly < 0 || ly >= cy - 1) return false;
    const halfW = Math.floor(cx / 2);
    const halfH = Math.floor(cy / 2);
    const stepHalf = Math.max(1, Math.round(cx / cy));
    const stepFull = stepHalf * 2;
    const ry = ly < halfH ? ly : (cy - 2) - ly;
    if (ry < 0) return false;

    const xOffset = halfW - (ry + 1) * stepHalf;
    const cxRow = (ry + 1) * stepFull;
    return (lx >= xOffset && lx < (xOffset + cxRow));
  }

  static decodeTileDiamond(diamondData: Uint8Array, cx: number, cy: number): Uint8Array {
    const rect = new Uint8Array(cx * cy);
    if (diamondData.length < (cx * cy) / 2) return rect; // Invalid size
    
    const halfW = Math.floor(cx / 2);
    const halfH = Math.floor(cy / 2);
    const stepHalf = Math.max(1, Math.round(cx / cy));
    const stepFull = stepHalf * 2;

    let readIdx = 0;

    // Top half expansion (rows 0 .. halfH - 1, including the single full-width equator row at halfH - 1)
    for (let y = 0; y < halfH; y++) {
      const cx_row = (y + 1) * stepFull;
      const x = halfW - (y + 1) * stepHalf;
      for (let i = 0; i < cx_row; i++) {
        if (readIdx < diamondData.length) {
          const pxIdx = y * cx + (x + i);
          if (pxIdx >= 0 && pxIdx < rect.length) {
            rect[pxIdx] = diamondData[readIdx++];
          }
        }
      }
    }
    // Bottom half constriction (rows halfH .. cy - 2; row cy - 1 is 0 pixels per OpenTS _tilemask / ISO_DRAW_HEIGHT = ISO_HEIGHT - 1)
    for (let y = halfH; y < cy - 1; y++) {
      const mirrorY = (cy - 2) - y;
      const cx_row = (mirrorY + 1) * stepFull;
      const x = halfW - (mirrorY + 1) * stepHalf;
      for (let i = 0; i < cx_row; i++) {
        if (readIdx < diamondData.length) {
          const pxIdx = y * cx + (x + i);
          if (pxIdx >= 0 && pxIdx < rect.length) {
            rect[pxIdx] = diamondData[readIdx++];
          }
        }
      }
    }
    return rect;
  }

  static parseTmp(buffer: ArrayBuffer): TmpFile {
    if (buffer.byteLength < 16) {
      throw new Error("File too small to be a TMP file.");
    }
    const dv = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    let cblocks_x = 0;
    let cblocks_y = 0;
    let cx = 0;
    let cy = 0;
    let is16Bit = false;

    const cblocks_x_val = dv.getInt32(0, true);
    const cblocks_y_val = dv.getInt32(4, true);
    const cx32le = dv.getInt32(8, true);
    const cy32le = dv.getInt32(12, true);

    const cx16le = dv.getUint16(2, true);
    const cy16le = dv.getUint16(4, true);

    if ((cx32le === 48 && cy32le === 24) || (cx32le === 60 && cy32le === 30) || (cx32le === 48 && cy32le === 96) || (cx32le === 96 && cy32le === 48)) {
        cblocks_x = cblocks_x_val;
        cblocks_y = cblocks_y_val;
        cx = cx32le;
        cy = cy32le;
    } else if ((cx16le === 48 && cy16le === 24) || (cx16le === 60 && cy16le === 30)) {
        // Red Alert 1 / Tiberian Dawn variant detect
        cblocks_x = dv.getUint16(6, true);
        cblocks_y = 1;
        cx = cx16le;
        cy = cy16le;
        is16Bit = true;
        console.log("[TMP Parser] Detected 16-bit header format (RA1/TD style)");
    } else {
        cblocks_x = cblocks_x_val;
        cblocks_y = cblocks_y_val;
        cx = cx32le;
        cy = cy32le;
        console.warn("[TMP Parser] Unknown header signature. Attempting generic 32-bit parse.");
    }

    console.log(`[TMP Parser] Header: ${cblocks_x}x${cblocks_y}, Tile size: ${cx}x${cy}`);

    // Sanity checks to prevent browser freeze
    const MAX_ALLOWED_TILES = 10000;
    
    // If indices are zero or negative, or too large, they are definitely wrong
    if (cblocks_x <= 0 || cblocks_x > 2000) cblocks_x = 1;
    if (cblocks_y <= 0 || cblocks_y > 2000) cblocks_y = 1;

    // Recalculate numTiles after cleaning
    let numTiles = cblocks_x * cblocks_y;

    // Safety: don't even try to read indices if we'd exceed reasonable bounds
    if (numTiles > MAX_ALLOWED_TILES) {
        console.warn(`[TMP Parser] Capping tile count from ${numTiles} to ${MAX_ALLOWED_TILES} for stability.`);
        numTiles = MAX_ALLOWED_TILES;
    }

    if (cx <= 0 || cy <= 0 || cx > 1024 || cy > 1024) {
      throw new Error(`Invalid tile dimensions: ${cx}x${cy}.`);
    }

    // Check if the file is at least large enough to contain the tile index table (16 is header)
    const headerSize = is16Bit ? 8 : 16; 
    if (buffer.byteLength < headerSize + numTiles * 4) {
      const estimatedCount = Math.floor((buffer.byteLength - headerSize) / 4);
      if (estimatedCount < numTiles) {
        console.warn(`[TMP Parser] File size mismatch. Adjusting tile count to ${estimatedCount}.`);
        numTiles = Math.max(0, estimatedCount);
      }
    }

    const tiles: (Tile | null)[] = [];

    for (let i = 0; i < numTiles; i++) {
      const indexOffset = headerSize + i * 4;
      if (indexOffset + 4 > buffer.byteLength) break;

      const offset = dv.getInt32(indexOffset, true);
      if (offset === 0 || offset >= buffer.byteLength) {
        tiles.push(null);
        continue;
      }

      const diamondSize = (cx * cy) / 2;
      
      let header: TileHeader;
      let dataOffset: number;

      if (is16Bit) {
          // TD/RA1 TMPs are often just raw diamond blocks without headers
          header = {
              x: 0, y: 0, extra_ofs: 0, z_ofs: 0, extra_z_ofs: 0,
              x_extra: 0, y_extra: 0, cx_extra: 0, cy_extra: 0,
              flags: 0, height: 0, land_type: 0, ramp_type: 0,
              radar_colors: [128, 128, 128, 128, 128, 128],
              has_extra_data: false, has_z_data: false,
              has_damaged_data: false, is_fully_transparent: false
          };
          dataOffset = offset;
      } else {
          // TS/RA2 52-byte header
          if (offset + 52 > buffer.byteLength) {
              tiles.push(null);
              continue;
          }
          header = {
            x: dv.getInt32(offset, true),
            y: dv.getInt32(offset + 4, true),
            extra_ofs: dv.getInt32(offset + 8, true),
            z_ofs: dv.getInt32(offset + 12, true),
            extra_z_ofs: dv.getInt32(offset + 16, true),
            x_extra: dv.getInt32(offset + 20, true),
            y_extra: dv.getInt32(offset + 24, true),
            cx_extra: dv.getInt32(offset + 28, true),
            cy_extra: dv.getInt32(offset + 32, true),
            flags: dv.getUint8(offset + 36),
            height: dv.getInt8(offset + 40),
            land_type: dv.getUint8(offset + 41),
            ramp_type: dv.getUint8(offset + 42),
            radar_colors: [
              dv.getUint8(offset + 43), dv.getUint8(offset + 44), dv.getUint8(offset + 45),
              dv.getUint8(offset + 46), dv.getUint8(offset + 47), dv.getUint8(offset + 48)
            ],
            has_extra_data: (dv.getUint8(offset + 36) & 0x01) !== 0,
            has_z_data: (dv.getUint8(offset + 36) & 0x02) !== 0,
            has_damaged_data: (dv.getUint8(offset + 36) & 0x04) !== 0,
            is_fully_transparent: (dv.getUint8(offset + 36) & 0x08) !== 0,
          };
          dataOffset = offset + 52;
      }

      if (dataOffset + diamondSize > buffer.byteLength) {
          tiles.push(null);
          continue;
      }

      const rawData = u8.slice(dataOffset, dataOffset + diamondSize);
      const decodedData = this.decodeTileDiamond(rawData, cx, cy);

      let zData: Uint8Array | null = null;
      let extraImageData: Uint8Array | null = null;
      let extraZData: Uint8Array | null = null;
      let damagedData: Uint8Array | null = null;

      let currentPtr = dataOffset + diamondSize;

      if (!is16Bit) {
          if (header.has_z_data) {
              const zStart = header.z_ofs > 0 ? offset + header.z_ofs : currentPtr;
              if (zStart + diamondSize <= buffer.byteLength) {
                  zData = this.decodeTileDiamond(u8.slice(zStart, zStart + diamondSize), cx, cy);
                  if (header.z_ofs === 0) currentPtr += diamondSize;
              }
          }

          if (header.has_damaged_data) {
              if (currentPtr + diamondSize <= buffer.byteLength) {
                  damagedData = this.decodeTileDiamond(u8.slice(currentPtr, currentPtr + diamondSize), cx, cy);
                  currentPtr += diamondSize;
              }
          }

          if (header.has_extra_data) {
              const extraSize = header.cx_extra * header.cy_extra;
              if (extraSize > 1) {
                  const extraStart = header.extra_ofs > 0 ? offset + header.extra_ofs : currentPtr;
                  if (extraStart + extraSize <= buffer.byteLength) {
                      extraImageData = u8.slice(extraStart, extraStart + extraSize);
                      if (header.extra_ofs === 0) currentPtr += extraSize;

                      if (header.has_z_data) {
                          const extraZStart = header.extra_z_ofs > 0 ? offset + header.extra_z_ofs : currentPtr;
                          if (extraZStart + extraSize <= buffer.byteLength) {
                              extraZData = u8.slice(extraZStart, extraZStart + extraSize);
                          }
                      }
                  }
              }
          }
      }

      tiles.push({
        slot: i,
        header,
        data: decodedData,
        zData,
        extraImageData,
        extraZData,
        damagedData,
        cx,
        cy
      });
    }

    return {
      cblocks_x,
      cblocks_y,
      cx,
      cy,
      tiles,
      type: ((cx === 96 && cy === 48) || (cx === 48 && cy === 96)) ? "OPENTS" : (cx === 48 ? "TS" : "RA2")
    };
  }

  static getPalette32(palette: RGB[]): Uint32Array {
    const p32 = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      const c = palette[i] || { r: 0, g: 0, b: 0 };
      // ABGR format for little-endian Uint32Array buffer
      p32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
    }
    return p32;
  }

  static encodeTileDiamond(rectData: Uint8Array, cx: number, cy: number): Uint8Array {
    const diamondSize = (cx * cy) / 2;
    const diamond = new Uint8Array(diamondSize);
    let writeIdx = 0;
    const halfW = Math.floor(cx / 2);
    const halfH = Math.floor(cy / 2);
    const stepHalf = Math.max(1, Math.round(cx / cy));
    const stepFull = stepHalf * 2;

    for (let y = 0; y < halfH; y++) {
      const cx_row = (y + 1) * stepFull;
      const x = halfW - (y + 1) * stepHalf;
      for (let i = 0; i < cx_row; i++) {
        if (writeIdx < diamondSize) {
          diamond[writeIdx++] = rectData[y * cx + (x + i)];
        }
      }
    }
    for (let y = halfH; y < cy - 1; y++) {
      const mirrorY = (cy - 2) - y;
      const cx_row = (mirrorY + 1) * stepFull;
      const x = halfW - (mirrorY + 1) * stepHalf;
      for (let i = 0; i < cx_row; i++) {
        if (writeIdx < diamondSize) {
          diamond[writeIdx++] = rectData[y * cx + (x + i)];
        }
      }
    }
    return diamond;
  }

  static scaleBuffer(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
    const dst = new Uint8Array(dw * dh);
    for (let y = 0; y < dh; y++) {
      const sy = Math.floor(y * sh / dh);
      const rowSrc = sy * sw;
      const rowDst = y * dw;
      for (let x = 0; x < dw; x++) {
        const sx = Math.floor(x * sw / dw);
        dst[rowDst + x] = src[rowSrc + sx];
      }
    }
    return dst;
  }

  static convertEngine(tmpFile: TmpFile, target: "TS" | "RA2", options?: { isRamp?: boolean }): TmpFile {
    const isToTS = target === "TS";
    const targetCx = isToTS ? 48 : 60;
    const targetCy = isToTS ? 24 : 30;
    const isRamp = options?.isRamp || false;

    // Strict check: if type matches AND dimensions match, only then skip
    if (tmpFile.type === target && tmpFile.cx === targetCx && tmpFile.cy === targetCy) {
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

    const newTiles = tmpFile.tiles.map(tile => {
      if (!tile || tile.cx <= 0 || tile.cy <= 0) return null;

      const sw = tile.cx;
      const sh = tile.cy;
      const dw = targetCx;
      const dh = targetCy;

      const getDiamondBounds = (y: number, w: number, h: number, expansion: number = 0) => {
          const halfH = h / 2;
          const ty = Math.floor(y);
          let rx;
          if (ty < halfH) {
              rx = ty;
          } else {
              rx = (h - 1) - ty;
          }
          let rowW = (rx + 1) * 4;
          rowW += expansion * 2;
          const xStart = (w - rowW) / 2;
          return { 
              w: Math.max(0, Math.min(w, rowW)), 
              x: Math.max(0, Math.min(w, xStart)) 
          };
      };

      const getSharpSample = (src: Uint8Array, sw: number, sh: number, tx: number, ty: number, invX: number, invY: number, srcBounds: {w: number, x: number}[], forceLenient: boolean = false): number => {
          const centerX = (tx + 0.5) * invX;
          const centerY = (ty + 0.5) * invY;
          
          // Radius: MUST be at least invX to guarantee coverage during downscaling.
          const radiusX = Math.max(1.1, invX * 0.9);
          const radiusY = Math.max(1.1, invY * 0.9);
          
          const sxStart = Math.floor(centerX - radiusX);
          const sxEnd = Math.ceil(centerX + radiusX);
          const syStart = Math.floor(centerY - radiusY);
          const syEnd = Math.ceil(centerY + radiusY);

          const weights = new Map<number, number>();
          let bestVal = 0;
          let maxW = -1;

          for (let sy = syStart; sy <= syEnd; sy++) {
              if (sy < 0 || sy >= sh) continue;
              const sb = srcBounds[sy];
              const dy = Math.abs(sy + 0.5 - centerY) / radiusY;
              if (dy >= 1.0) continue;
              
              // Quadratic kernel for better smoothing while preserving edges
              const wy = 1.0 - dy * dy;
              const rowOff = sy * sw;
              
              for (let sx = sxStart; sx <= sxEnd; sx++) {
                  if (sx < 0 || sx >= sw) continue;
                  
                  // Leniency check: ramps ignore diamond bounds to prevent seams
                  if (!forceLenient && (sx < sb.x || sx >= sb.x + sb.w)) continue;

                  const val = src[rowOff + sx];
                  if (val === 0) continue;
                  
                  const dx = Math.abs(sx + 0.5 - centerX) / radiusX;
                  if (dx >= 1.0) continue;
                  
                  const w = (1.0 - dx * dx) * wy;
                  const currentW = (weights.get(val) || 0) + w;
                  weights.set(val, currentW);
                  if (currentW > maxW) {
                      maxW = currentW;
                      bestVal = val;
                  }
              }
          }

          // HOLE FILLING: If we found nothing but are inside the expected area, 
          // perform an exhaustive search for the nearest neighbor.
          if (bestVal === 0) {
              const cx = Math.floor(centerX);
              const cy = Math.floor(centerY);
              let minDistSq = Infinity;
              
              // Search up to 2 pixels away to find a non-zero pixel
              for (let dy = -2; dy <= 2; dy++) {
                  for (let dx = -2; dx <= 2; dx++) {
                      const ny = cy + dy;
                      const nx = cx + dx;
                      if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                          const v = src[ny * sw + nx];
                          if (v !== 0) {
                              const dsq = dx * dx + dy * dy;
                              if (dsq < minDistSq) {
                                  minDistSq = dsq;
                                  bestVal = v;
                              }
                          }
                      }
                  }
              }
          }

          return bestVal;
      };

      // 0. Pre-calculate source bounds for edge guarding
      const srcBounds: {w: number, x: number}[] = [];
      // Expansion prevents artifacts at the edges of the RA2 tiles
      const srcExpansion = isRamp ? 8 : 2; 
      for (let y = 0; y < sh; y++) srcBounds.push(getDiamondBounds(y, sw, sh, srcExpansion));

      // 1. Create target data buffer (rectangle)
      const newData = new Uint8Array(dw * dh);
      const newZData = tile.zData ? new Uint8Array(dw * dh) : null;
      
      const invScaleX = sw / dw;
      const invScaleY = sh / dh;

      // 2. Map row by row
      for (let ty = 0; ty < dh; ty++) {
          // Destination diamond masking: be generous with ramps to hide seams
          const tb = getDiamondBounds(ty, dw, dh, isRamp ? 8 : 1);

          for (let tx = 0; tx < dw; tx++) {
              const dIdx = ty * dw + tx;
              
              // Strict diamond masking
              if (tx < tb.x || tx >= tb.x + tb.w) {
                  newData[dIdx] = 0;
                  if (newZData) newZData[dIdx] = 0;
                  continue;
              }

              const val = getSharpSample(tile.data, sw, sh, tx, ty, invScaleX, invScaleY, srcBounds, isRamp);
              
              newData[dIdx] = val;
              if (newZData && tile.zData) {
                  newZData[dIdx] = getSharpSample(tile.zData, sw, sh, tx, ty, invScaleX, invScaleY, srcBounds, isRamp);
              }
          }
      }

      // 3. Handle Extra Data (Cliffs) - Rectangular mapping with quality sampler
      let newExtraImageData = null;
      let newExtraZData = null;
      let newCxExtra = 0;
      let newCyExtra = 0;
      let newXExtra = 0;
      let newYExtra = 0;

      if (tile.header.has_extra_data && tile.extraImageData) {
        newCxExtra = Math.round(tile.header.cx_extra * scale);
        newCyExtra = Math.round(tile.header.cy_extra * scale);
        // Ensure even dimensions for compatibility
        if (newCxExtra % 2 !== 0) newCxExtra++;
        if (newCyExtra % 2 !== 0) newCyExtra++;
        
        if (newCxExtra > 0 && newCyExtra > 0) {
            newExtraImageData = new Uint8Array(newCxExtra * newCyExtra);
            if (tile.extraZData) newExtraZData = new Uint8Array(newCxExtra * newCyExtra);
            
            const eInvScaleX = tile.header.cx_extra / newCxExtra;
            const eInvScaleY = tile.header.cy_extra / newCyExtra;

            // Extra data is usually rectangular - use full-width bounds
            const eSrcBounds: {w: number, x: number}[] = [];
            for (let y = 0; y < tile.header.cy_extra; y++) {
                eSrcBounds.push({ w: tile.header.cx_extra, x: 0 });
            }

            for (let ey = 0; ey < newCyExtra; ey++) {
                for (let ex = 0; ex < newCxExtra; ex++) {
                    const dIdx = ey * newCxExtra + ex;
                    const val = getSharpSample(tile.extraImageData!, tile.header.cx_extra, tile.header.cy_extra, ex, ey, eInvScaleX, eInvScaleY, eSrcBounds);
                    newExtraImageData[dIdx] = val;
                    if (newExtraZData && tile.extraZData) {
                        newExtraZData[dIdx] = getSharpSample(tile.extraZData, tile.header.cx_extra, tile.header.cy_extra, ex, ey, eInvScaleX, eInvScaleY, eSrcBounds);
                    }
                }
            }
        }

        newXExtra = Math.round(tile.header.x_extra * scale);
        newYExtra = Math.round(tile.header.y_extra * scale);
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
        height: tile.header.height // Height steps are engine-agnostic logic-wise
      };

      return {
        ...tile,
        cx: dw,
        cy: dh,
        header: newHeader,
        data: newData,
        zData: newZData,
        extraImageData: newExtraImageData,
        extraZData: newExtraZData
      };
    });

    return {
      ...tmpFile,
      cx: targetCx,
      cy: targetCy,
      tiles: newTiles,
      type: target
    };
  }

  static writeTmp(tmpFile: TmpFile): ArrayBuffer {
    const numTiles = tmpFile.tiles.length;
    // Header (16) + Index Table (numTiles * 4)
    let totalSize = 16 + numTiles * 4;
    
    const activeTiles = tmpFile.tiles.map((t, i) => ({ t, i })).filter(x => x.t !== null);
    
    activeTiles.forEach(({ t }) => {
      const tile = t!;
      totalSize += 52; // Tile Header
      totalSize += (tile.cx * tile.cy) / 2; // Diamond
      if (tile.header.has_z_data && tile.zData) totalSize += (tile.cx * tile.cy) / 2;
      if (tile.header.has_extra_data && tile.extraImageData) {
        totalSize += tile.header.cx_extra * tile.header.cy_extra;
        if (tile.header.has_z_data && tile.extraZData) {
            totalSize += tile.header.cx_extra * tile.header.cy_extra;
        }
      }
    });

    const buffer = new ArrayBuffer(totalSize);
    const dv = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    
    dv.setInt32(0, tmpFile.cblocks_x, true);
    dv.setInt32(4, tmpFile.cblocks_y, true);
    dv.setInt32(8, tmpFile.cx, true);
    dv.setInt32(12, tmpFile.cy, true);
    
    const offsets = new Int32Array(numTiles);
    let currentPtr = 16 + numTiles * 4;
    
    activeTiles.forEach(({ t, i }) => {
      const tile = t!;
      offsets[i] = currentPtr;
      const startOfTile = currentPtr;
      const diamondSize = (tile.cx * tile.cy) / 2;
      
      let zOfs = 0;
      let extraOfs = 0;
      let extraZOfs = 0;
      
      let writePointer = startOfTile + 52;
      
      const encoded = this.encodeTileDiamond(tile.data, tile.cx, tile.cy);
      u8.set(encoded, writePointer);
      writePointer += diamondSize;
      
      if (tile.header.has_z_data && tile.zData) {
          zOfs = writePointer - startOfTile;
          const encodedZ = this.encodeTileDiamond(tile.zData, tile.cx, tile.cy);
          u8.set(encodedZ, writePointer);
          writePointer += diamondSize;
      }
      
      if (tile.header.has_extra_data && tile.extraImageData) {
          extraOfs = writePointer - startOfTile;
          u8.set(tile.extraImageData, writePointer);
          writePointer += tile.header.cx_extra * tile.header.cy_extra;
          
          if (tile.header.has_z_data && tile.extraZData) {
              extraZOfs = writePointer - startOfTile;
              u8.set(tile.extraZData, writePointer);
              writePointer += tile.header.cx_extra * tile.header.cy_extra;
          }
      }
      
      const h = tile.header;
      dv.setInt32(startOfTile, h.x, true);
      dv.setInt32(startOfTile + 4, h.y, true);
      dv.setInt32(startOfTile + 8, extraOfs, true);
      dv.setInt32(startOfTile + 12, zOfs, true);
      dv.setInt32(startOfTile + 16, extraZOfs, true);
      dv.setInt32(startOfTile + 20, h.x_extra, true);
      dv.setInt32(startOfTile + 24, h.y_extra, true);
      dv.setInt32(startOfTile + 28, h.cx_extra, true);
      dv.setInt32(startOfTile + 32, h.cy_extra, true);
      
      let computedFlags = h.flags;
      if (extraOfs > 0) computedFlags |= 0x01;
      else computedFlags &= ~0x01;
      if (zOfs > 0) computedFlags |= 0x02;
      else computedFlags &= ~0x02;
      dv.setUint8(startOfTile + 36, computedFlags);
      dv.setInt8(startOfTile + 40, h.height);
      dv.setUint8(startOfTile + 41, h.land_type);
      dv.setUint8(startOfTile + 42, h.ramp_type);
      
      for (let j = 0; j < 6; j++) {
        dv.setUint8(startOfTile + 43 + j, h.radar_colors[j] || 0);
      }
      
      currentPtr = writePointer;
    });
    
    for (let i = 0; i < numTiles; i++) {
        dv.setInt32(16 + i * 4, offsets[i], true);
    }
    
    return buffer;
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

    for (let py = 0; py < tile.cy; py++) {
      for (let px = 0; px < tile.cx; px++) {
        const i = py * tile.cx + px;
        if (!this.isInsideWestwoodDiamond(px, py, tile.cx, tile.cy)) {
          data32[i] = 0;
          continue;
        }
        const idx = pixels[i];
        if (showZ && tile.zData) {
          const gray = Math.min(255, idx * 8);
          data32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
        } else {
          // Per OpenTS isotype.cpp Draw_Tile: base diamond spans are unconditional (even index 0 is drawn with palette[0])
          data32[i] = p32[idx];
        }
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

        if (h.has_extra_data && tile.extraImageData && h.cx_extra > 0 && h.cy_extra > 0) {
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

    const outImg = ctx.createImageData(width, height);
    const out32 = new Uint32Array(outImg.data.buffer);
    // OpenTS 16-bit depth buffer initialized to 0xFFFF (far) as in IsoDrawData.FillDepth = 0xFFFF
    const depthBuf = new Int32Array(width * height);
    depthBuf.fill(0x7fffffff);

    // Render each tile sorted back-to-front by isometric depth (matching OpenTS tactical map cell order)
    const sortedTiles = [...activeTiles].sort((a, b) => {
        const depthA = a.header.y - (a.header.height * mult);
        const depthB = b.header.y - (b.header.height * mult);
        if (depthA !== depthB) return depthA - depthB;
        return a.header.x - b.header.x;
    });

    sortedTiles.forEach(tile => {
        const h = tile.header;
        const elev = h.height * mult;
        const bx = h.x - minX;
        const by = (h.y - elev) - minY;

        // OpenTS BaseDepth formula from isotype.cpp line 1789:
        // BaseDepth = Bounds.Y + ScrollOffset - y - set->Height + height * set->Height / -2
        // Note: y here is the drawn screen Y `(h.y - elev)`, so lower on screen (larger y) has smaller BaseDepth (closer to camera, wins `depthBuf >= pixelDepth`).
        const baseDepth = 32768 - by - tile.cy - Math.floor((h.height * tile.cy) / 2);
        const useZ = Boolean(h.has_z_data && tile.zData);

        const bPix = showZ && tile.zData ? tile.zData : tile.data;

        // 1. Base Diamond Pass (OpenTS _tilemask scanlines 0 .. cy - 2)
        for (let py = 0; py < tile.cy - 1; py++) {
            const dy = by + py;
            if (dy < 0 || dy >= height) continue;
            for (let px = 0; px < tile.cx; px++) {
                if (!this.isInsideWestwoodDiamond(px, py, tile.cx, tile.cy)) continue;
                const dx = bx + px;
                if (dx < 0 || dx >= width) continue;

                const srcIdx = py * tile.cx + px;
                const dstIdx = dy * width + dx;
                const palIdx = bPix[srcIdx];

                // In OpenTS Draw_Tile, base diamond pixels are solid spans within _tilemask,
                // except when a tile slot is explicitly flagged transparent and uses palette index 0.
                if (palIdx === 0 && h.is_fully_transparent) continue;

                if (useZ && tile.zData) {
                    const pixelDepth = baseDepth + tile.zData[srcIdx];
                    if (depthBuf[dstIdx] >= pixelDepth) {
                        depthBuf[dstIdx] = pixelDepth;
                        if (showZ) {
                            const gray = Math.min(255, palIdx * 8);
                            out32[dstIdx] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
                        } else {
                            out32[dstIdx] = p32[palIdx];
                        }
                    }
                } else {
                    if (showZ && tile.zData) {
                        const gray = Math.min(255, palIdx * 8);
                        out32[dstIdx] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
                    } else {
                        out32[dstIdx] = p32[palIdx];
                    }
                }
            }
        }

        // 2. Extra Data Pass (isotype.cpp line 2301: ex = ExtraX - X + x, ey = ExtraY - Y + y)
        // Since x = h.x - minX and y = h.y - elev - minY:
        // ex = h.x_extra - minX, ey = h.y_extra - elev - minY.
        // In OpenTS line 2361 / 2436: `if (*IsoDrawData.SrcPixel)` -> palette index 0 is transparent!
        if (h.has_extra_data && tile.extraImageData && h.cx_extra > 0 && h.cy_extra > 0) {
            const ex = h.x_extra - minX;
            const ey = (h.y_extra - elev) - minY;
            const ew = h.cx_extra;
            const eh = h.cy_extra;
            const ePix = showZ && tile.extraZData ? tile.extraZData : tile.extraImageData;
            const useExtraZ = Boolean(h.has_z_data && tile.extraZData);

            for (let py = 0; py < eh; py++) {
                const dy = ey + py;
                if (dy < 0 || dy >= height) continue;
                for (let px = 0; px < ew; px++) {
                    const dx = ex + px;
                    if (dx < 0 || dx >= width) continue;

                    const srcIdx = py * ew + px;
                    const rawColorIdx = tile.extraImageData[srcIdx];
                    if (rawColorIdx === 0) continue; // Extra image index 0 is always transparent in OpenTS

                    const dstIdx = dy * width + dx;
                    const palIdx = ePix[srcIdx];

                    if (useExtraZ && tile.extraZData) {
                        const pixelDepth = baseDepth + tile.extraZData[srcIdx];
                        if (depthBuf[dstIdx] >= pixelDepth) {
                            depthBuf[dstIdx] = pixelDepth;
                            if (showZ) {
                                const gray = Math.min(255, palIdx * 8);
                                out32[dstIdx] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
                            } else {
                                out32[dstIdx] = p32[palIdx];
                            }
                        }
                    } else {
                        if (showZ && tile.extraZData) {
                            const gray = Math.min(255, palIdx * 8);
                            out32[dstIdx] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
                        } else {
                            out32[dstIdx] = p32[palIdx];
                        }
                    }
                }
            }
        }
    });

    ctx.putImageData(outImg, 0, 0);
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
        const gray = Math.min(255, idx * 8);
        data32[i] = (255 << 24) | (gray << 16) | (gray << 8) | gray;
      } else {
        data32[i] = p32[idx];
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}
