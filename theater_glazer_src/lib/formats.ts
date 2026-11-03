import { convertTmpEngine, TargetEngine, ConvertOptions } from './tileResizer';
import { TmpRenderer } from './tmpRenderer';

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
  type: "TS" | "RA2" | "OpenTS";
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
    const halfW = Math.floor(cx / 2);
    const halfH = Math.floor(cy / 2);
    let ry;
    if (ly < halfH) ry = ly;
    else ry = cy - 1 - ly - 1;
    if (ry < 0) return false;

    const xOffset = halfW - (ry + 1) * 2;
    const cxRow = (ry + 1) * 4;
    return (lx >= xOffset && lx < (xOffset + cxRow));
  }

  static decodeTileDiamond(diamondData: Uint8Array, cx: number, cy: number): Uint8Array {
    const rect = new Uint8Array(cx * cy);
    if (diamondData.length < (cx * cy) / 2) return rect; // Invalid size
    
    let readIdx = 0;
    let x = cx / 2;
    let cx_row = 0;
    const halfH = cy / 2;

    for (let y = 0; y < halfH; y++) {
      cx_row += 4;
      x -= 2;
      for (let i = 0; i < cx_row; i++) {
        if (readIdx < diamondData.length) {
          const pxIdx = y * cx + (x + i);
          if (pxIdx >= 0 && pxIdx < rect.length) {
            rect[pxIdx] = diamondData[readIdx++];
          }
        }
      }
    }
    for (let y = halfH; y < cy; y++) {
      cx_row -= 4;
      x += 2;
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

    if ((cx32le === 48 && cy32le === 24) || (cx32le === 60 && cy32le === 30) || (cx32le === 120 && cy32le === 60) || (cx32le === 96 && cy32le === 48)) {
        cblocks_x = cblocks_x_val;
        cblocks_y = cblocks_y_val;
        cx = cx32le;
        cy = cy32le;
    } else if (cx32le === 48 && cy32le === 96) {
        cblocks_x = cblocks_x_val;
        cblocks_y = cblocks_y_val;
        cx = 96;
        cy = 48;
    } else if ((cx16le === 48 && cy16le === 24) || (cx16le === 60 && cy16le === 30) || (cx16le === 120 && cy16le === 60) || (cx16le === 96 && cy16le === 48)) {
        // Red Alert 1 / Tiberian Dawn variant detect
        cblocks_x = dv.getUint16(6, true);
        cblocks_y = 1;
        cx = cx16le;
        cy = cy16le;
        is16Bit = true;
        console.log("[TMP Parser] Detected 16-bit header format (RA1/TD style)");
    } else if (cx32le > 0 && cy32le > 0 && cx32le <= 2048 && cy32le <= 2048 && (cx32le === cy32le * 2 || cy32le === cx32le * 2)) {
        cblocks_x = cblocks_x_val;
        cblocks_y = cblocks_y_val;
        cx = Math.max(cx32le, cy32le);
        cy = Math.min(cx32le, cy32le);
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
      type: cx === 48 ? "TS" : (cx === 120 || cx === 96) ? "OpenTS" : "RA2"
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
    let x = cx / 2;
    let cx_row = 0;
    const halfH = cy / 2;

    for (let y = 0; y < halfH; y++) {
      cx_row += 4;
      x -= 2;
      for (let i = 0; i < cx_row; i++) {
        diamond[writeIdx++] = rectData[y * cx + (x + i)];
      }
    }
    for (let y = halfH; y < cy; y++) {
      cx_row -= 4;
      x += 2;
      for (let i = 0; i < cx_row; i++) {
        diamond[writeIdx++] = rectData[y * cx + (x + i)];
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

  static convertEngine(
    tmpFile: TmpFile, 
    target: TargetEngine, 
    options?: ConvertOptions
  ): TmpFile {
    return convertTmpEngine(tmpFile, target, options);
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
      
      dv.setUint8(startOfTile + 36, h.flags);
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
    TmpRenderer.renderTileToCanvas(canvas, tile, palette, showZ);
  }

  static renderCompleteToCanvas(canvas: HTMLCanvasElement, tmpFile: TmpFile, palette: RGB[], showZ: boolean = false) {
    TmpRenderer.renderCompleteToCanvas(canvas, tmpFile, palette, showZ);
  }

  static renderExtraToCanvas(canvas: HTMLCanvasElement, tile: Tile, palette: RGB[], showZ: boolean = false) {
    TmpRenderer.renderExtraToCanvas(canvas, tile, palette, showZ);
  }
}
