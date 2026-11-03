import {
    encodeOpenTsTileDiamond,
    decodeOpenTsTileDiamond,
    isInsideOpenTsDiamond,
    getOpenTsDiamondSpans,
} from './openTsTileRenderer';

export { getOpenTsDiamondSpans };

/**
 * Packs 2D rectangular grid into OpenTS isometric diamond representation (`_iso_row_bases` / `_tilemask`).
 */
export function encodeTileDiamond(rect: Uint8Array, cx: number, cy: number): Uint8Array {
    return encodeOpenTsTileDiamond(rect, cx, cy);
}

/**
 * Hit test algorithm checking if local (lx, ly) pixel falls within the OpenTS `_tilemask` diamond
 * (23 active scanlines for 48x24, symmetric around row halfH - 1).
 */
export function isInsideWestwoodDiamond(lx: number, ly: number, cx: number, cy: number): boolean {
    return isInsideOpenTsDiamond(lx, ly, cx, cy);
}

/**
 * Unpacks OpenTS isometric diamond stream into a 2D rectangular buffer (`_tilemask`).
 */
export function decodeTileDiamond(packed: Uint8Array, cx: number, cy: number): Uint8Array {
    return decodeOpenTsTileDiamond(packed, cx, cy);
}

