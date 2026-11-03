import { TmpParser } from './formats';

export type OutsidePresetCategory =
    | 'oval_round'
    | 'organic_blobs'
    | 'diamond_edge'
    | 'directional'
    | 'dither_stipple';

export interface OutsidePresetCategoryInfo {
    id: OutsidePresetCategory | 'all';
    label: string;
}

export const OUTSIDE_PRESET_CATEGORIES: OutsidePresetCategoryInfo[] = [
    { id: 'all', label: 'All (32)' },
    { id: 'oval_round', label: 'Oval & Round' },
    { id: 'organic_blobs', label: 'Organic & Clouds' },
    { id: 'diamond_edge', label: 'Diamond Rim' },
    { id: 'directional', label: 'Directional & Corner' },
    { id: 'dither_stipple', label: 'Dither & Stipple' },
];

export type OutsidePixelPresetId =
    // Oval & Round (10)
    | 'oval_spray_classic'
    | 'oval_wide_cushion'
    | 'oval_dense_core'
    | 'round_circle_cap'
    | 'oval_feathered_mist'
    | 'oval_pebble_halo'
    | 'oval_ring_scatter'
    | 'oval_vertical_egg'
    | 'oval_horizontal_pad'
    | 'oval_soft_dither'
    // Organic & Clouds (6)
    | 'organic_amoeba_cloud'
    | 'organic_moss_patches'
    | 'organic_ puddle_splat'
    | 'organic_bushy_fringe'
    | 'organic_starburst_rays'
    | 'organic_island_archipelago'
    // Diamond Rim (6)
    | 'fine_spray'
    | 'coarse_pebbles'
    | 'jagged_eroded'
    | 'grass_tufts'
    | 'wide_dust'
    | 'heavy_rim'
    // Directional & Corner (6)
    | 'dir_top_canopy_oval'
    | 'dir_bottom_skirt_oval'
    | 'dir_left_wind_drift'
    | 'dir_right_wind_drift'
    | 'dir_four_corner_ears'
    | 'dir_side_cheeks_oval'
    // Dither & Stipple (4)
    | 'bayer_dither'
    | 'clumped_patches'
    | 'stipple_checker_oval'
    | 'stipple_noise_rings';

export interface OutsidePixelPreset {
    id: OutsidePixelPresetId;
    category: OutsidePresetCategory;
    name: string;
    subtitle: string;
    defaultSpreadPx: number;
}

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

export const BAYER_4X4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

/**
 * Computes metrics for an outside pixel relative to the 1x1 Westwood diamond:
 * - `diamondDistPx`: perpendicular pixel distance from the straight diamond edge (0 if inside)
 * - `ovalNorm`: isometric 2:1 elliptical radius normalized so 1.0 = inscribed/circumscribed oval
 * - `ovalFillT`: 0.0 at diamond edge -> 1.0 at the outer rounded oval envelope!
 *   Because the diamond is concave relative to an ellipse along its 4 flat edges, `ovalFillT`
 *   naturally fills the 4 diagonal flats thicker in the middle so the overall tile + extra
 *   silhouette becomes a smooth rounded oval (just like the reference screenshot).
 */
export interface OutsideShapeMetrics {
    insideDiamond: boolean;
    diamondDistPx: number;
    ovalDistPx: number;
    dxNorm: number;
    dyNorm: number;
    angle: number;
}

export function getOutsideShapeMetrics(
    relX: number,
    relY: number,
    cx: number,
    cy: number,
    spreadPx: number
): OutsideShapeMetrics {
    const insideDiamond =
        relX >= 0 &&
        relX < cx &&
        relY >= 0 &&
        relY < cy &&
        TmpParser.isInsideWestwoodDiamond(relX, relY, cx, cy);

    const centerX = (cx - 1) * 0.5;
    const centerY = (cy - 1) * 0.5;
    const hw = cx * 0.5;
    const hh = cy * 0.5;

    const dxNorm = (relX - centerX) / hw;
    const dyNorm = (relY - centerY) / hh;
    const angle = Math.atan2(dyNorm, dxNorm);

    if (insideDiamond) {
        return {
            insideDiamond: true,
            diamondDistPx: 0,
            ovalDistPx: 0,
            dxNorm,
            dyNorm,
            angle,
        };
    }

    // L1 diamond distance
    const l1Norm = Math.abs(dxNorm) + Math.abs(dyNorm);
    const edgePerpScale = (hw * hh) / Math.hypot(hw, hh);
    const diamondDistPx = Math.max(0.25, (l1Norm - 1.0) * edgePerpScale);

    // L2 elliptical (oval) distance:
    // At the 4 diamond tips, L2 = 1.0. At the 4 flat edge midpoints, L2 = 0.7071 (1/sqrt(2)).
    // So an outer oval of semi-axes (hw + spreadPx*1.35, hh + spreadPx*0.95) bulges out smoothly
    // over the 4 flat edges and rounds off the whole tile into an oval cushion!
    const ovalRx = hw + spreadPx * 1.35;
    const ovalRy = hh + spreadPx * 0.95;
    const ellipNorm = Math.hypot((relX - centerX) / ovalRx, (relY - centerY) / ovalRy);

    // On the diamond boundary in direction `angle`, the diamond's radius is 1 / (|cos| + |sin|)
    const cosA = Math.abs(Math.cos(angle));
    const sinA = Math.abs(Math.sin(angle));
    const diamondBoundX = (hw * Math.cos(angle)) / (cosA + sinA);
    const diamondBoundY = (hh * Math.sin(angle)) / (cosA + sinA);
    const diamondEllipNorm = Math.hypot(diamondBoundX / ovalRx, diamondBoundY / ovalRy);

    // Normalized 0..1 progress from the diamond edge out to the rounded oval perimeter
    const tOval = Math.max(
        0.02,
        (ellipNorm - diamondEllipNorm) / Math.max(0.05, 1.0 - diamondEllipNorm)
    );
    const ovalDistPx = tOval * spreadPx;

    return {
        insideDiamond: false,
        diamondDistPx,
        ovalDistPx,
        dxNorm,
        dyNorm,
        angle,
    };
}
