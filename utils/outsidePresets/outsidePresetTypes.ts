import { TmpParser } from '../formats';

export type OutsidePresetCategory =
    | 'all'
    | 'oval'
    | 'organic'
    | 'foliage'
    | 'directional'
    | 'diamond';

export type OutsidePixelPresetId =
    // Oval & Rounded (8)
    | 'oval_spray_classic'
    | 'oval_soft_mist'
    | 'oval_pebble_halo'
    | 'oval_bayer_dither'
    | 'round_disc_cap'
    | 'oval_dense_core'
    | 'squircle_cushion'
    | 'oval_wide_cloud'
    // Organic & Blob (6)
    | 'blob_amoeba'
    | 'cloud_puffs'
    | 'splatter_burst'
    | 'mossy_cushions'
    | 'worn_cobble'
    | 'spore_clusters'
    // Tufts & Foliage (6)
    | 'oval_grass_crown'
    | 'wild_meadow_ring'
    | 'radial_needle_fringe'
    | 'bottom_vine_drips'
    | 'top_canopy_arch'
    | 'shrub_clusters'
    // Directional & Rim (6)
    | 'flank_bulge_oval'
    | 'top_bottom_arc'
    | 'left_right_wings'
    | 'windswept_right'
    | 'windswept_left'
    | 'detached_halo_ring'
    // Diamond Edge (8)
    | 'fine_spray'
    | 'coarse_pebbles'
    | 'bayer_dither'
    | 'jagged_eroded'
    | 'grass_tufts'
    | 'wide_dust'
    | 'clumped_patches'
    | 'heavy_rim';

export interface OutsidePixelPreset {
    id: OutsidePixelPresetId;
    category: Exclude<OutsidePresetCategory, 'all'>;
    name: string;
    subtitle: string;
    defaultSpreadPx: number;
}

export const BAYER_4X4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

export function hash2D(x: number, y: number, seed: number): number {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = hash2D(ix, iy, seed);
    const b = hash2D(ix + 1, iy, seed);
    const c = hash2D(ix, iy + 1, seed);
    const d = hash2D(ix + 1, iy + 1, seed);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export interface OutsidePixelMetrics {
    inDiamond: boolean;
    dx: number;
    dy: number;
    nx: number;
    ny: number;
    angle: number;
    diamondDistPx: number;
    diamondT: number;
    ovalT: number;
    flankWeight: number;
}

/**
 * Computes both Diamond-parallel distance (`diamondT`) and True Elliptical / Oval contour
 * progress (`ovalT`) so presets can form rounded oval silhouettes like the reference image.
 */
export function computeOutsidePixelMetrics(
    relX: number,
    relY: number,
    cx: number,
    cy: number,
    spreadPx: number
): OutsidePixelMetrics {
    const inDiamond =
        relX >= 0 &&
        relX < cx &&
        relY >= 0 &&
        relY < cy &&
        TmpParser.isInsideWestwoodDiamond(relX, relY, cx, cy);

    const centerX = (cx - 1) * 0.5;
    const centerY = (cy - 1) * 0.5;
    const hw = cx * 0.5;
    const hh = cy * 0.5;

    const dx = relX - centerX;
    const dy = relY - centerY;
    const nx = dx / hw;
    const ny = dy / hh;
    const angle = Math.atan2(ny, nx);

    const normDiamond = Math.abs(nx) + Math.abs(ny);
    const edgePerpScale = (hw * hh) / Math.hypot(hw, hh);
    const diamondDistPx = inDiamond ? 0 : Math.max(0.2, (normDiamond - 1.0) * edgePerpScale);
    const diamondT = diamondDistPx / Math.max(1, spreadPx);

    // Elliptical outer radii: bulges outward on the 4 flat diagonal flanks and stays tight at sharp tips
    const rx = hw + spreadPx * 0.42;
    const ry = hh + spreadPx * 0.72;
    const ovalNorm = Math.hypot(dx / rx, dy / ry);
    // At the diamond's 4 flat flanks, ovalNorm is ~0.58..0.68; at outer oval rim, ovalNorm is 1.0
    const innerOvalStart = 0.64;
    const ovalT = inDiamond ? 0 : Math.max(0.02, (ovalNorm - innerOvalStart) / (1.0 - innerOvalStart));

    // Flank weight: 1.0 at the 4 diagonal flat sides of the diamond, 0.0 at the 4 sharp tips
    const absNx = Math.abs(nx);
    const absNy = Math.abs(ny);
    const sumN = Math.max(0.001, absNx + absNy);
    const flankWeight = (4 * absNx * absNy) / (sumN * sumN);

    return {
        inDiamond,
        dx,
        dy,
        nx,
        ny,
        angle,
        diamondDistPx,
        diamondT,
        ovalT,
        flankWeight,
    };
}
