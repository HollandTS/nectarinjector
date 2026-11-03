/**
 * Blueprint & Code Reference: Staggered Isometric Tile Loader & Saver (Serializer)
 * 
 * THE COMMON SAVING BUG SOLVED:
 * In Westwood .tmp files, offset references in individual tile headers (such as 
 * `extra_ofs`, `z_ofs`, and `extra_z_ofs`) MUST be encoded as RELATIVE offsets 
 * from the start of that specific tile's block (e.g., `writePointer - startOfTile`),
 * NOT absolute offsets from the beginning of the file. Saving with absolute offsets 
 * will corrupt coordinate allocations, causing loaded cliffs/elevation data to render 
 * incorrectly or crash.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface TileHeader {
  x: number;
  y: number;
  extra_ofs: number;      // Offset relative to the start of this tile's block
  z_ofs: number;          // Offset relative to the start of this tile's block
  extra_z_ofs: number;    // Offset relative to the start of this tile's block
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
  data: Uint8Array;            // Decoded standard full bounding rectangular data (cellX * cellY)
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
  type: "TS" | "RA2";
}

export class IsometricFormats {

  /**
   * 1. Decode Compressed Westwood Diamond Data to Flat Rectangular Array
   */
  static decodeTileDiamond(diamondData: Uint8Array, cx: number, cy: number): Uint8Array {
    const rect = new Uint8Array(cx * cy);
    if (diamondData.length < (cx * cy) / 2) return rect;
    
    let readIdx = 0;
    let x = cx / 2;
    let cx_row = 0;
    const halfH = cy / 2;

    // Top half expansion
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
    // Bottom half constriction
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

  /**
   * 2. Encode Flat Rectangular data back into Compressed Westwood Diamond format
   */
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

  /**
   * 3. Parsers & Decodes a complete Westwood .tmp file buffer cleanly
   * Ensures safety limits and auto-detects 16-bit vs 32-bit engine structures.
   */
  static parseTmp(buffer: ArrayBuffer): TmpFile {
    if (buffer.byteLength < 16) {
      throw new Error("Invalid .tmp file: too small to parse.");
    }

    const dv = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    let cblocks_x = dv.getInt32(0, true);
    let cblocks_y = dv.getInt32(4, true);
    let cx = dv.getInt32(8, true);
    let cy = dv.getInt32(12, true);
    let is16Bit = false;

    // Detect 16-bit historic header structures (TD/RA1 Legacy format)
    const cx16le = dv.getUint16(2, true);
    const cy16le = dv.getUint16(4, true);
    if ((cx16le === 48 && cy16le === 24) || (cx16le === 60 && cy16le === 30)) {
      cblocks_x = dv.getUint16(6, true);
      cblocks_y = 1;
      cx = cx16le;
      cy = cy16le;
      is16Bit = true;
    }

    let numTiles = cblocks_x * cblocks_y;
    const headerSize = is16Bit ? 8 : 16;
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
        if (offset + 52 > buffer.byteLength) {
          tiles.push(null);
          continue;
        }

        const flags = dv.getUint8(offset + 36);
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
          flags: flags,
          height: dv.getInt8(offset + 40),
          land_type: dv.getUint8(offset + 41),
          ramp_type: dv.getUint8(offset + 42),
          radar_colors: [
            dv.getUint8(offset + 43), dv.getUint8(offset + 44), dv.getUint8(offset + 45),
            dv.getUint8(offset + 46), dv.getUint8(offset + 47), dv.getUint8(offset + 48)
          ],
          has_extra_data: (flags & 0x01) !== 0,
          has_z_data: (flags & 0x02) !== 0,
          has_damaged_data: (flags & 0x04) !== 0,
          is_fully_transparent: (flags & 0x08) !== 0,
        };
        dataOffset = offset + 52;
      }

      const decodedData = this.decodeTileDiamond(
        u8.slice(dataOffset, dataOffset + diamondSize),
        cx,
        cy
      );

      let zData: Uint8Array | null = null;
      let extraImageData: Uint8Array | null = null;
      let extraZData: Uint8Array | null = null;
      let damagedData: Uint8Array | null = null;

      let currentPtr = dataOffset + diamondSize;

      if (!is16Bit) {
        if (header.has_z_data) {
          // Fallback to sequential placement if relative offset offset pointer value is 0
          const zStart = header.z_ofs > 0 ? offset + header.z_ofs : currentPtr;
          zData = this.decodeTileDiamond(u8.slice(zStart, zStart + diamondSize), cx, cy);
          if (header.z_ofs === 0) currentPtr += diamondSize;
        }

        if (header.has_damaged_data) {
          damagedData = this.decodeTileDiamond(u8.slice(currentPtr, currentPtr + diamondSize), cx, cy);
          currentPtr += diamondSize;
        }

        if (header.has_extra_data) {
          const extraSize = header.cx_extra * header.cy_extra;
          if (extraSize > 1) {
            const extraStart = header.extra_ofs > 0 ? offset + header.extra_ofs : currentPtr;
            extraImageData = u8.slice(extraStart, extraStart + extraSize);
            if (header.extra_ofs === 0) currentPtr += extraSize;

            if (header.has_z_data) {
              const extraZStart = header.extra_z_ofs > 0 ? offset + header.extra_z_ofs : currentPtr;
              extraZData = u8.slice(extraZStart, extraZStart + extraSize);
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
      type: cx === 48 ? "TS" : "RA2"
    };
  }

  /**
   * 4. Serializes / Writes TmpFile structures back to standardized solid binary Buffers.
   * COMPATIBILITY SAFE: Relational Sub-Offsets are recalculated mathematically.
   */
  static writeTmp(tmpFile: TmpFile): ArrayBuffer {
    const numTiles = tmpFile.tiles.length;
    let totalSize = 16 + numTiles * 4; // Flat starting header (16) + pointer registers table offsets
    
    const activeTiles = tmpFile.tiles.map((t, i) => ({ t, i })).filter(x => x.t !== null);
    
    // Step A: Calculate exact total file size in bytes to prevent Buffer resizing penalties
    activeTiles.forEach(({ t }) => {
      const tile = t!;
      totalSize += 52; // 52-byte tile properties metadata block header
      totalSize += (tile.cx * tile.cy) / 2; // Diamond pixel block data
      
      if (tile.header.has_z_data && tile.zData) {
        totalSize += (tile.cx * tile.cy) / 2;
      }
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
    
    // Write primary 16-byte global header boundaries
    dv.setInt32(0, tmpFile.cblocks_x, true);
    dv.setInt32(4, tmpFile.cblocks_y, true);
    dv.setInt32(8, tmpFile.cx, true);
    dv.setInt32(12, tmpFile.cy, true);
    
    const offsets = new Int32Array(numTiles);
    let currentPtr = 16 + numTiles * 4; // Start right after the tile offset index tables
    
    // Step B: Write active tile blocks sequentially
    activeTiles.forEach(({ t, i }) => {
      const tile = t!;
      offsets[i] = currentPtr; // Save absolute start coordinates pointer for writing to the index table
      
      const startOfTile = currentPtr;
      const diamondSize = (tile.cx * tile.cy) / 2;
      
      let zOfs = 0;
      let extraOfs = 0;
      let extraZOfs = 0;
      
      // Reserve 52 bytes at the start of the tile block for the TileHeader
      let writePointer = startOfTile + 52;
      
      // 1. Encode and write base tile pixels
      const encoded = this.encodeTileDiamond(tile.data, tile.cx, tile.cy);
      u8.set(encoded, writePointer);
      writePointer += diamondSize;
      
      // 2. Encode and write Z elevation registers (calculated relative offsets)
      if (tile.header.has_z_data && tile.zData) {
        zOfs = writePointer - startOfTile; // <--- MATH FIX: Relative offset from tile start!
        const encodedZ = this.encodeTileDiamond(tile.zData, tile.cx, tile.cy);
        u8.set(encodedZ, writePointer);
        writePointer += diamondSize;
      }
      
      // 3. Write Extra layers / Cliff assets
      if (tile.header.has_extra_data && tile.extraImageData) {
        extraOfs = writePointer - startOfTile; // <--- MATH FIX: Relative offset from tile start!
        u8.set(tile.extraImageData, writePointer);
        writePointer += tile.header.cx_extra * tile.header.cy_extra;
        
        // 4. Write Extra Z registers
        if (tile.header.has_z_data && tile.extraZData) {
          extraZOfs = writePointer - startOfTile; // <--- MATH FIX: Relative offset from tile start!
          u8.set(tile.extraZData, writePointer);
          writePointer += tile.header.cx_extra * tile.header.cy_extra;
        }
      }
      
      // 5. Populate and write tile's 52-byte header with compiled sub-offsets
      const h = tile.header;
      dv.setInt32(startOfTile, h.x, true);
      dv.setInt32(startOfTile + 4, h.y, true);
      dv.setInt32(startOfTile + 8, extraOfs, true);        // Written with reconstructed relative offset values
      dv.setInt32(startOfTile + 12, zOfs, true);          // Written with reconstructed relative offset values
      dv.setInt32(startOfTile + 16, extraZOfs, true);      // Written with reconstructed relative offset values
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
      
      currentPtr = writePointer; // Increment general buffer pointer
    });
    
    // Step C: Write the computed absolute offsets table into header indices
    for (let i = 0; i < numTiles; i++) {
        dv.setInt32(16 + i * 4, offsets[i], true);
    }
    
    return buffer;
  }
}
