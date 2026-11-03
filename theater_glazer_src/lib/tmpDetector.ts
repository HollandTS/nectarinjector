export type EngineType = 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96';

export function detectFileType(buffer: ArrayBuffer, fileName?: string): 'TMP' | 'SHP' | 'UNKNOWN' {
  if (buffer.byteLength < 16) return 'UNKNOWN';
  const dv = new DataView(buffer);

  // Check if it fits the SHP footprint
  const shpHeaderType = dv.getUint16(0, true);
  const shpWidth = dv.getUint16(2, true);
  const shpHeight = dv.getUint16(4, true);
  const shpNumFrames = dv.getUint16(6, true);

  if (shpHeaderType === 0 && shpNumFrames > 0 && shpWidth > 0 && shpWidth < 4096 && shpHeight > 0 && shpHeight < 4096) {
    const neededHeaderSize = 8 + shpNumFrames * 24;
    if (buffer.byteLength >= neededHeaderSize) {
      let allOffsetsValid = true;
      for (let i = 0; i < Math.min(shpNumFrames, 10); i++) {
        const off = dv.getUint32(8 + i * 24 + 20, true);
        if (off !== 0 && (off < neededHeaderSize || off >= buffer.byteLength)) {
          allOffsetsValid = false;
          break;
        }
      }
      if (allOffsetsValid) {
        return 'SHP';
      }
    }
  }

  // Try to detect TMP via 32-bit headers (TS, RA2, OpenTS 120x60, OpenTS 96x48)
  const cx32le = dv.getInt32(8, true);
  const cy32le = dv.getInt32(12, true);
  const cx16le = dv.getUint16(2, true);
  const cy16le = dv.getUint16(4, true);

  // 32-bit dimension checks
  if (
    (cx32le === 48 && cy32le === 24) ||
    (cx32le === 60 && cy32le === 30) ||
    (cx32le === 120 && cy32le === 60) ||
    (cx32le === 96 && cy32le === 48) ||
    (cx32le === 48 && cy32le === 96)
  ) {
    return 'TMP';
  }

  // 16-bit dimension checks (legacy or TD/RA1/OpenTS variants)
  if (
    (cx16le === 48 && cy16le === 24) ||
    (cx16le === 60 && cy16le === 30) ||
    (cx16le === 120 && cy16le === 60) ||
    (cx16le === 96 && cy16le === 48) ||
    (cx16le === 48 && cy16le === 96)
  ) {
    return 'TMP';
  }

  // Check 2:1 isometric aspect ratio for custom OpenTS tiles
  if (
    cx32le > 0 &&
    cy32le > 0 &&
    cx32le <= 2048 &&
    cy32le <= 2048 &&
    (cx32le === cy32le * 2 || cy32le === cx32le * 2)
  ) {
    return 'TMP';
  }

  // Fallback check against known Westwood terrain file extensions
  if (fileName) {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    const tmpExtensions = ['.tem', '.sno', '.des', '.til', '.tmp', '.urb', '.ubn', '.lun', '.int', '.sno2'];
    if (tmpExtensions.includes(ext)) {
      return 'TMP';
    }
    if (ext === '.shp') {
      return 'SHP';
    }
  }

  return 'UNKNOWN';
}

export function detectEngineFromDimensions(cx: number, cy: number, declaredType?: string): EngineType {
  if (cx === 120 || cy === 60) {
    return 'OpenTS';
  }
  if (cx === 96 || cy === 48) {
    return 'OpenTS_48x96';
  }
  if (cx === 60 || cy === 30) {
    return 'RA2';
  }
  if (cx === 48 || cy === 24) {
    return 'TS';
  }
  if (declaredType === 'OpenTS') {
    return 'OpenTS';
  }
  if (declaredType === 'RA2') {
    return 'RA2';
  }
  return 'TS';
}

export function getEngineDimensions(engine: EngineType): { cellW: number; cellH: number } {
  switch (engine) {
    case 'OpenTS':
      return { cellW: 120, cellH: 60 };
    case 'OpenTS_48x96':
      return { cellW: 96, cellH: 48 };
    case 'RA2':
      return { cellW: 60, cellH: 30 };
    case 'TS':
    default:
      return { cellW: 48, cellH: 24 };
  }
}
