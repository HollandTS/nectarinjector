import {
    OutsidePixelPresetId,
    hash2D,
    valueNoise2D,
    BAYER_4X4,
    getOutsideShapeMetrics,
} from './extraOutsidePixelMath';

/**
 * Evaluates whether an outside pixel `(relX, relY)` relative to a sub-tile's `(0, 0)` origin
 * should be active for the given `presetId` and `spreadPx`.
 */
export function evaluateOutsidePixelMask(
    presetId: OutsidePixelPresetId,
    relX: number,
    relY: number,
    cx: number,
    cy: number,
    spreadPx: number,
    seed: number = 1337
): boolean {
    const m = getOutsideShapeMetrics(relX, relY, cx, cy, spreadPx);
    if (m.insideDiamond) return false;

    const tDiamond = m.diamondDistPx / Math.max(1, spreadPx);
    const tOval = m.ovalDistPx / Math.max(1, spreadPx);
    const r1 = hash2D(relX, relY, seed);
    const r2 = hash2D(relX + 19, relY - 13, seed + 7);

    switch (presetId) {
        // ============================================================================
        // CATEGORY 1: OVAL & ROUND (Rounds off the 4 flat diamond lines into an oval!)
        // ============================================================================
        case 'oval_spray_classic': {
            // Matches the reference screenshot: fills the 4 diagonal flats into a rounded oval
            // with dense inner body and spray-painted outer droplets
            if (tOval > 1.15) return false;
            const n = valueNoise2D(relX * 0.32, relY * 0.32, seed + 11);
            const effT = tOval / (0.76 + n * 0.38);
            if (effT >= 1.0) return false;
            if (effT < 0.35) return r1 < 0.92;
            const prob = Math.pow(1 - (effT - 0.35) / 0.65, 1.45) * 0.82;
            return r1 < prob;
        }

        case 'oval_wide_cushion': {
            // Extra-plump oval belly over the 4 flat diamond edges, tapered at tips
            const flatBulge = Math.sin(2 * m.angle) ** 2; // 1.0 on diagonal flat centers, 0.0 on tips
            const reachScale = 0.62 + flatBulge * 0.65;
            const t = tOval / reachScale;
            if (t >= 1.0) return false;
            const n = valueNoise2D(relX * 0.3, relY * 0.3, seed + 17);
            if (t < 0.42 + n * 0.15) return r1 < 0.94;
            return r1 < Math.pow(1 - t, 1.5) * 0.78;
        }

        case 'oval_dense_core': {
            // Solid rounded oval pad that only breaks into spray at the outer 30% rim
            if (tOval > 1.05) return false;
            const n = valueNoise2D(relX * 0.36, relY * 0.36, seed + 23);
            const effT = tOval + (n - 0.5) * 0.22;
            if (effT < 0.58) return true;
            if (effT >= 1.0) return false;
            const rimT = (effT - 0.58) / 0.42;
            return r1 < Math.pow(1 - rimT, 1.4) * 0.85;
        }

        case 'round_circle_cap': {
            // Screen-space circular/round cap (expands top & bottom extra to make a true rounder shape)
            const centerX = (cx - 1) * 0.5;
            const centerY = (cy - 1) * 0.5;
            const radX = cx * 0.5 + spreadPx * 0.95;
            const radY = cy * 0.5 + spreadPx * 1.35;
            const dCircle = Math.hypot((relX - centerX) / radX, (relY - centerY) / radY);
            if (dCircle > 1.05) return false;
            const n = valueNoise2D(relX * 0.3, relY * 0.3, seed + 31);
            const eff = dCircle + (n - 0.5) * 0.16;
            if (eff < 0.78) return r1 < 0.93;
            if (eff >= 1.0) return false;
            return r1 < Math.pow((1.0 - eff) / 0.22, 1.35) * 0.8;
        }

        case 'oval_feathered_mist': {
            // Soft, airy oval spray mist with gradual gradient all the way from edge to oval perimeter
            if (tOval > 1.2) return false;
            const n = valueNoise2D(relX * 0.28, relY * 0.28, seed + 41);
            const effT = tOval / (0.7 + n * 0.48);
            if (effT >= 1.0) return false;
            return r1 < Math.pow(1 - effT, 1.65) * 0.76;
        }

        case 'oval_pebble_halo': {
            // Rounded oval silhouette composed of 2x1 / 2x2 pebble clusters + fine spray
            if (tOval > 1.1) return false;
            const cellHash = hash2D(Math.floor(relX / 2), Math.floor(relY / 2), seed + 47);
            const falloff = Math.pow(Math.max(0, 1 - tOval), 1.25);
            if (tOval < 0.3) return r1 < 0.9;
            if (cellHash < falloff * 0.55) return r1 < 0.84;
            return r1 < falloff * 0.28;
        }

        case 'oval_ring_scatter': {
            // Oval base fill plus a secondary broken outer satellite droplet ring
            if (tOval > 1.25) return false;
            if (tOval < 0.45) return r1 < 0.88;
            const ringWave = Math.exp(-Math.pow((tOval - 0.78) / 0.18, 2));
            const n = valueNoise2D(relX * 0.35, relY * 0.35, seed + 53);
            return r1 < (ringWave * 0.65 + (1 - tOval) * 0.25) * (0.6 + n * 0.5);
        }

        case 'oval_vertical_egg': {
            // Rounded egg-oval emphasized on top & bottom poles
            const poleBoost = 0.65 + Math.sin(m.angle) ** 2 * 0.6;
            const t = tOval / poleBoost;
            if (t >= 1.0) return false;
            const n = valueNoise2D(relX * 0.32, relY * 0.32, seed + 61);
            return r1 < Math.pow(1 - t * (0.85 + (n - 0.5) * 0.3), 1.4) * 0.86;
        }

        case 'oval_horizontal_pad': {
            // Wide horizontal oval pad emphasized on left & right wings
            const wingBoost = 0.65 + Math.cos(m.angle) ** 2 * 0.6;
            const t = tOval / wingBoost;
            if (t >= 1.0) return false;
            const n = valueNoise2D(relX * 0.32, relY * 0.32, seed + 67);
            return r1 < Math.pow(1 - t * (0.85 + (n - 0.5) * 0.3), 1.4) * 0.86;
        }

        case 'oval_soft_dither': {
            // Ordered Bayer 4x4 dither shaped into a smooth rounded oval contour
            if (tOval > 1.08) return false;
            const wave = (valueNoise2D(relX * 0.25, relY * 0.25, seed + 71) - 0.5) * 0.2;
            const density = Math.max(0, Math.min(1, Math.pow(1 - (tOval + wave), 1.25) * 0.92));
            const bx = ((relX % 4) + 4) % 4;
            const by = ((relY % 4) + 4) % 4;
            return density > BAYER_4X4[by][bx];
        }

        // ============================================================================
        // CATEGORY 2: ORGANIC & CLOUDS (Wavy, natural non-diamond shapes)
        // ============================================================================
        case 'organic_amoeba_cloud': {
            // Wavy multi-lobe organic cloud around the tile
            const lobe =
                0.78 +
                0.22 * Math.sin(m.angle * 3 + seed * 0.1) +
                0.15 * Math.cos(m.angle * 5 - seed * 0.2);
            const n = valueNoise2D(relX * 0.26, relY * 0.26, seed + 79);
            const t = tOval / (lobe * (0.75 + n * 0.4));
            if (t >= 1.0) return false;
            if (t < 0.48) return r1 < 0.92;
            return r1 < Math.pow(1 - t, 1.55) * 0.82;
        }

        case 'organic_moss_patches': {
            // Organic mossy patches & satellite clusters on an oval bed
            if (tOval > 1.2) return false;
            const patch = valueNoise2D(relX * 0.32, relY * 0.38, seed + 83);
            const detail = valueNoise2D(relX * 0.65, relY * 0.65, seed + 89);
            const combined = patch * 0.65 + detail * 0.35;
            const thresh = 0.28 + tOval * 0.48;
            if (combined > thresh) return r1 < 0.88;
            return r1 < Math.pow(Math.max(0, 1 - tOval), 2.2) * 0.25;
        }

        case 'organic_ puddle_splat': {
            // Liquid/mud splat with rounded lobes and outer droplets
            const splatWave =
                0.72 +
                0.25 * Math.cos(m.angle * 4 + 1.1) +
                0.18 * Math.sin(m.angle * 7 - 0.7);
            const t = tOval / splatWave;
            if (t < 0.62) return r1 < 0.96;
            if (t < 1.1) {
                const dropHash = hash2D(Math.floor(relX / 2), Math.floor(relY / 2), seed + 97);
                return dropHash > 0.72 && r1 < 0.75;
            }
            return false;
        }

        case 'organic_bushy_fringe': {
            // Scalloped bushy puffs rounding out the tile perimeter
            const puffs = 0.75 + 0.3 * Math.abs(Math.sin(m.angle * 6 + seed * 0.05));
            const n = valueNoise2D(relX * 0.42, relY * 0.42, seed + 103);
            const t = tOval / (puffs * (0.7 + n * 0.4));
            if (t >= 1.0) return false;
            return r1 < Math.pow(1 - t, 1.3) * 0.86;
        }

        case 'organic_starburst_rays': {
            // Radial fingers/streaks radiating outward in an oval envelope
            if (tOval > 1.18) return false;
            const angleBucket = Math.floor(((m.angle + Math.PI) / (2 * Math.PI)) * 28);
            const rayLen = 0.45 + hash2D(angleBucket, 0, seed + 109) * 0.65;
            const t = tOval / rayLen;
            if (t >= 1.0) return false;
            return r1 < Math.pow(1 - t, 1.35) * 0.84;
        }

        case 'organic_island_archipelago': {
            // Rounded base with detached mini islands floating outside
            if (tOval > 1.25) return false;
            if (tOval < 0.35) return r1 < 0.9;
            const isl = valueNoise2D(relX * 0.42, relY * 0.48, seed + 113);
            if (isl > 0.62 && tOval < 1.05) return r1 < 0.86;
            return r1 < Math.pow(Math.max(0, 1 - tOval), 2.0) * 0.22;
        }

        // ============================================================================
        // CATEGORY 3: DIAMOND RIM (Classic parallel to diamond lines)
        // ============================================================================
        case 'fine_spray': {
            if (tDiamond > 1.0) return false;
            const angleNoise = valueNoise2D(relX * 0.35, relY * 0.35, seed + 11);
            const effT = tDiamond / (0.7 + angleNoise * 0.45);
            if (effT >= 1.0) return false;
            return r1 < Math.pow(1 - effT, 1.55) * 0.78;
        }

        case 'coarse_pebbles': {
            if (tDiamond > 1.0) return false;
            const cellHash = hash2D(Math.floor(relX / 2), Math.floor(relY / 1.5), seed + 23);
            const falloff = Math.pow(1 - tDiamond, 1.4);
            if (cellHash < falloff * 0.48) return r2 < 0.78;
            return r2 < falloff * 0.22;
        }

        case 'jagged_eroded': {
            if (tDiamond > 1.0) return false;
            const lowFreq = valueNoise2D(relX * 0.32, relY * 0.32, seed + 53);
            const midFreq = valueNoise2D(relX * 0.7, relY * 0.7, seed + 59);
            const reach = (lowFreq * 0.65 + midFreq * 0.35) * 0.95;
            if (tDiamond < reach * 0.72) return r1 < 0.88;
            return r1 < Math.pow(1 - tDiamond, 2.2) * 0.28;
        }

        case 'grass_tufts': {
            if (tDiamond > 1.0) return false;
            const colHash = hash2D(relX, Math.floor(relY / 3), seed + 71);
            const streakNoise = valueNoise2D(relX * 0.6, relY * 0.22, seed + 73);
            const prob = Math.pow(1 - tDiamond, 1.35) * 0.72;
            return colHash * 0.6 + (1 - streakNoise) * 0.4 < prob;
        }

        case 'wide_dust': {
            if (tDiamond > 1.0) return false;
            const n = valueNoise2D(relX * 0.28, relY * 0.28, seed + 89);
            const effT = tDiamond / (0.65 + n * 0.5);
            if (effT >= 1.0) return false;
            return r1 < Math.pow(1 - effT, 1.8) * 0.58;
        }

        case 'heavy_rim': {
            if (tDiamond > 1.0) return false;
            if (tDiamond < 0.28) return r1 < 0.86;
            const remT = (tDiamond - 0.28) / 0.72;
            const n = valueNoise2D(relX * 0.4, relY * 0.4, seed + 113);
            return r1 < Math.pow(1 - remT, 1.5) * (0.45 + n * 0.4);
        }

        // ============================================================================
        // CATEGORY 4: DIRECTIONAL & CORNER
        // ============================================================================
        case 'dir_top_canopy_oval': {
            // Rounded oval spray concentrated on the upper/north half of the tile
            const topWeight = Math.max(0.15, Math.min(1.2, 0.65 - m.dyNorm * 0.65));
            const t = tOval / topWeight;
            if (t >= 1.0) return false;
            const n = valueNoise2D(relX * 0.34, relY * 0.34, seed + 127);
            return r1 < Math.pow(1 - t * (0.85 + (n - 0.5) * 0.3), 1.45) * 0.85;
        }

        case 'dir_bottom_skirt_oval': {
            // Rounded oval spray concentrated on the lower/south half of the tile
            const botWeight = Math.max(0.15, Math.min(1.2, 0.65 + m.dyNorm * 0.65));
            const t = tOval / botWeight;
            if (t >= 1.0) return false;
            const n = valueNoise2D(relX * 0.34, relY * 0.34, seed + 131);
            return r1 < Math.pow(1 - t * (0.85 + (n - 0.5) * 0.3), 1.45) * 0.85;
        }

        case 'dir_left_wind_drift': {
            // Wind-blown spray drifting to the left/west
            const leftWeight = Math.max(0.15, Math.min(1.25, 0.65 - m.dxNorm * 0.65));
            const t = tOval / leftWeight;
            if (t >= 1.0) return false;
            return r1 < Math.pow(1 - t, 1.5) * 0.84;
        }

        case 'dir_right_wind_drift': {
            // Wind-blown spray drifting to the right/east
            const rightWeight = Math.max(0.15, Math.min(1.25, 0.65 + m.dxNorm * 0.65));
            const t = tOval / rightWeight;
            if (t >= 1.0) return false;
            return r1 < Math.pow(1 - t, 1.5) * 0.84;
        }

        case 'dir_four_corner_ears': {
            // Emphasizes the 4 cardinal tips (N/S/E/W corners) with rounded caps
            const cornerWeight = 0.35 + Math.cos(2 * m.angle) ** 2 * 0.75;
            const t = tDiamond / cornerWeight;
            if (t >= 1.0) return false;
            return r1 < Math.pow(1 - t, 1.4) * 0.85;
        }

        case 'dir_side_cheeks_oval': {
            // Strictly fills ONLY the 4 diagonal flat sides to turn the diamond into an oval, zero tip overhang
            const flatSideWeight = Math.sin(2 * m.angle) ** 2; // 0 at tips, 1 at flat midpoints
            if (flatSideWeight < 0.08) return false;
            const t = tOval / (flatSideWeight * 1.15);
            if (t >= 1.0) return false;
            if (t < 0.45) return r1 < 0.92;
            return r1 < Math.pow(1 - t, 1.45) * 0.82;
        }

        // ============================================================================
        // CATEGORY 5: DITHER & STIPPLE
        // ============================================================================
        case 'bayer_dither': {
            if (tDiamond > 1.0) return false;
            const wave = (valueNoise2D(relX * 0.25, relY * 0.25, seed + 37) - 0.5) * 0.25;
            const density = Math.max(0, Math.min(1, Math.pow(1 - (tDiamond + wave), 1.35) * 0.85));
            const bx = ((relX % 4) + 4) % 4;
            const by = ((relY % 4) + 4) % 4;
            return density > BAYER_4X4[by][bx];
        }

        case 'clumped_patches': {
            if (tDiamond > 1.0) return false;
            const patchNoise = valueNoise2D(relX * 0.38, relY * 0.45, seed + 101);
            const falloff = Math.pow(1 - tDiamond, 1.15);
            if (patchNoise * falloff > 0.36) return r1 < 0.82;
            return r1 < Math.pow(1 - tDiamond, 2.4) * 0.18;
        }

        case 'stipple_checker_oval': {
            // Classic 1px checkerboard stipple inside an oval border with spray outer edge
            if (tOval > 1.08) return false;
            const isChecker = ((relX + relY) & 1) === 0;
            if (tOval < 0.42) return isChecker || r1 < 0.55;
            if (tOval < 0.78) return isChecker && r1 < 0.85;
            return r1 < Math.pow(Math.max(0, (1.08 - tOval) / 0.3), 1.5) * 0.55;
        }

        case 'stipple_noise_rings': {
            // Concentric stippled oval ripples fading outward
            if (tOval > 1.12) return false;
            const ripple = 0.5 + 0.5 * Math.cos(tOval * Math.PI * 3.5);
            const falloff = Math.pow(Math.max(0, 1 - tOval / 1.12), 1.25);
            return r1 < falloff * (0.35 + ripple * 0.55);
        }
    }
}
