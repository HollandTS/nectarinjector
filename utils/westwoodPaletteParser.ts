export interface PaletteColor {
    r: number;
    g: number;
    b: number;
}

/**
 * Parses binary RAW palette (768 bytes of 256 RGB triplets, or 1024 bytes of 256 RGBX quads).
 * Automatically detects standard Westwood 6-bit (0..63) vs 8-bit (0..255) color components.
 */
export function parseRawPal(buffer: ArrayBuffer): PaletteColor[] {
    const bytes = new Uint8Array(buffer);
    const palette: PaletteColor[] = [];
    const stride = bytes.byteLength === 1024 ? 4 : 3;

    // Detect if this binary palette uses 8-bit values (> 63) or Westwood 6-bit VGA values (0..63)
    let is8Bit = false;
    const count = Math.min(256, Math.floor(bytes.length / stride));
    for (let i = 0; i < count; i++) {
        const base = i * stride;
        if (bytes[base] > 63 || bytes[base + 1] > 63 || bytes[base + 2] > 63) {
            is8Bit = true;
            break;
        }
    }

    for (let i = 0; i < 256; i++) {
        const base = i * stride;
        if (base + 2 < bytes.length) {
            if (is8Bit) {
                palette.push({
                    r: bytes[base],
                    g: bytes[base + 1],
                    b: bytes[base + 2],
                });
            } else {
                // Scale 6-bit VGA (0-63) to full 8-bit (0-255)
                const r6 = bytes[base] & 0x3f;
                const g6 = bytes[base + 1] & 0x3f;
                const b6 = bytes[base + 2] & 0x3f;
                palette.push({
                    r: (r6 << 2) | (r6 >> 4),
                    g: (g6 << 2) | (g6 >> 4),
                    b: (b6 << 2) | (b6 >> 4),
                });
            }
        } else {
            palette.push({ r: 0, g: 0, b: 0 });
        }
    }
    return palette;
}

/**
 * Parses ASCII JASC-PAL or plain 3-column RGB text palettes.
 */
export function parseJascPal(text: string): PaletteColor[] {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith(';'));

    let startLine = 0;
    let colorCount = 256;
    if (lines[0]?.toUpperCase().startsWith('JASC-PAL')) {
        colorCount = parseInt(lines[2], 10) || 256;
        startLine = 3;
    }

    const palette: PaletteColor[] = [];
    for (let i = startLine; i < lines.length && palette.length < colorCount; i++) {
        const parts = lines[i].split(/\s+/).map(Number);
        if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            palette.push({ r: parts[0], g: parts[1], b: parts[2] });
        }
    }

    // If all parsed text values are <= 63 (and at least some are > 0), scale 6-bit text to 8-bit
    const maxVal = palette.reduce((m, c) => Math.max(m, c.r, c.g, c.b), 0);
    if (maxVal > 0 && maxVal <= 63) {
        for (let i = 0; i < palette.length; i++) {
            const r6 = palette[i].r & 0x3f;
            const g6 = palette[i].g & 0x3f;
            const b6 = palette[i].b & 0x3f;
            palette[i] = {
                r: (r6 << 2) | (r6 >> 4),
                g: (g6 << 2) | (g6 >> 4),
                b: (b6 << 2) | (b6 >> 4),
            };
        }
    }

    while (palette.length < 256) {
        palette.push({ r: 0, g: 0, b: 0 });
    }
    return palette;
}

/**
 * Multi-format Palette parser (binary .pal vs JASC-PAL / text).
 */
export function parsePalFile(buffer: ArrayBuffer): PaletteColor[] {
    if (buffer.byteLength === 768 || buffer.byteLength === 1024) {
        return parseRawPal(buffer);
    }
    const textDecoder = new TextDecoder('utf-8');
    try {
        const text = textDecoder.decode(buffer);
        const trimmed = text.trim();
        if (trimmed.toUpperCase().startsWith('JASC-PAL') || /^(\d+\s+\d+\s+\d+\s*[\r\n]+){16,}/.test(trimmed)) {
            return parseJascPal(trimmed);
        }
    } catch {
        // Ignore parsing error and fallback to raw binary
    }
    return parseRawPal(buffer);
}

// Caching layer for default palette
let defaultPaletteCache: PaletteColor[] | null = null;

/**
 * Loads standard TS isotem.pal from remote GitHub repository with a gorgeous, computed local fallback.
 */
export async function loadDefaultPalette(): Promise<PaletteColor[]> {
    if (defaultPaletteCache) return defaultPaletteCache;

    try {
        const res = await fetch('https://raw.githubusercontent.com/HollandTS/retro_building_generator/main/TS/isotem.pal');
        if (res.ok) {
            const buf = await res.arrayBuffer();
            defaultPaletteCache = parseRawPal(buf);
            return defaultPaletteCache;
        }
    } catch (e) {
        console.warn('Could not fetch remote palette, utilizing local procedural palette.', e);
    }

    // Procedural terrain fallback palette (greens, earthy browns, grays, sands)
    const fallback: PaletteColor[] = [];
    for (let i = 0; i < 256; i++) {
        if (i === 0) {
            fallback.push({ r: 0, g: 0, b: 0 }); // index 0 transparent
        } else if (i < 64) {
            const intensity = Math.floor(40 + (i / 64) * 160);
            fallback.push({ r: Math.floor(intensity * 0.4), g: intensity, b: Math.floor(intensity * 0.3) });
        } else if (i < 128) {
            const intensity = Math.floor(50 + ((i - 64) / 64) * 150);
            fallback.push({ r: intensity, g: Math.floor(intensity * 0.7), b: Math.floor(intensity * 0.4) });
        } else if (i < 192) {
            const intensity = Math.floor(45 + ((i - 128) / 64) * 165);
            fallback.push({ r: intensity, g: intensity, b: intensity });
        } else {
            const intensity = Math.floor(60 + ((i - 192) / 64) * 180);
            fallback.push({ r: intensity, g: Math.floor(intensity * 0.95), b: Math.floor(intensity * 0.6) });
        }
    }
    defaultPaletteCache = fallback;
    return defaultPaletteCache;
}

/**
 * Validates whether an ArrayBuffer (and optional filename) contains a valid Westwood RAW, RGBX, or JASC PAL file structure.
 */
export function isValidWwPal(buffer: ArrayBuffer, fileName?: string): boolean {
    if (!buffer || buffer.byteLength === 0) return false;
    if (buffer.byteLength === 768 || buffer.byteLength === 1024) return true;
    const isPalExt = Boolean(fileName && /\.pal$/i.test(fileName.trim()));
    if (isPalExt && buffer.byteLength >= 768 && buffer.byteLength <= 16384) {
        return true;
    }
    try {
        const text = new TextDecoder('utf-8').decode(buffer).trim();
        if (text.toUpperCase().startsWith('JASC-PAL')) return true;
        if (isPalExt && /^(\d+\s+\d+\s+\d+)/.test(text)) return true;
        return false;
    } catch {
        return false;
    }
}
