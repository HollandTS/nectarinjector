import { TmpParser } from './formats';
import {
    OUTSIDE_PRESET_CATEGORIES,
    OutsidePresetCategory,
    OutsidePresetCategoryInfo,
    OutsidePixelPreset,
    OutsidePixelPresetId,
    hash2D,
} from './extraOutsidePixelMath';
import { evaluateOutsidePixelMask } from './extraOutsidePixelEvaluator';

export {
    OUTSIDE_PRESET_CATEGORIES,
    evaluateOutsidePixelMask,
};
export type {
    OutsidePresetCategory,
    OutsidePresetCategoryInfo,
    OutsidePixelPreset,
    OutsidePixelPresetId,
};

export const OUTSIDE_PIXEL_PRESETS: OutsidePixelPreset[] = [
    // --- Category 1: Oval & Round (10) ---
    {
        id: 'oval_spray_classic',
        category: 'oval_round',
        name: '1. Classic Oval Spray',
        subtitle: 'Rounds off the 4 flat edges with spray mist',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_wide_cushion',
        category: 'oval_round',
        name: '2. Plump Oval Cushion',
        subtitle: 'Bulges across diagonal flats into a soft oval',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_dense_core',
        category: 'oval_round',
        name: '3. Solid Oval Pad + Rim',
        subtitle: 'Filled oval cushion with speckled outer edge',
        defaultSpreadPx: 8,
    },
    {
        id: 'round_circle_cap',
        category: 'oval_round',
        name: '4. Round Circular Cap',
        subtitle: 'Extra top & bottom fullness for a round shape',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_feathered_mist',
        category: 'oval_round',
        name: '5. Feathered Oval Cloud',
        subtitle: 'Soft airy oval transition with wide mist',
        defaultSpreadPx: 9,
    },
    {
        id: 'oval_pebble_halo',
        category: 'oval_round',
        name: '6. Oval Pebble & Gravel',
        subtitle: 'Rounded oval silhouette with 2px pebble specks',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_ring_scatter',
        category: 'oval_round',
        name: '7. Oval + Satellite Ring',
        subtitle: 'Rounded base with outer droplet ring',
        defaultSpreadPx: 9,
    },
    {
        id: 'oval_vertical_egg',
        category: 'oval_round',
        name: '8. North-South Egg Oval',
        subtitle: 'Rounded oval fuller on top and bottom poles',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_horizontal_pad',
        category: 'oval_round',
        name: '9. East-West Wide Oval',
        subtitle: 'Wide oval pad stretched toward left & right',
        defaultSpreadPx: 8,
    },
    {
        id: 'oval_soft_dither',
        category: 'oval_round',
        name: '10. Ordered Oval Dither',
        subtitle: 'Crisp Bayer stipple shaped into a smooth oval',
        defaultSpreadPx: 8,
    },

    // --- Category 2: Organic & Clouds (6) ---
    {
        id: 'organic_amoeba_cloud',
        category: 'organic_blobs',
        name: '11. Wavy Amoeba Cloud',
        subtitle: 'Multi-lobe organic rounded contour',
        defaultSpreadPx: 9,
    },
    {
        id: 'organic_moss_patches',
        category: 'organic_blobs',
        name: '12. Mossy Oval Patches',
        subtitle: 'Organic patchy clusters on a rounded bed',
        defaultSpreadPx: 8,
    },
    {
        id: 'organic_ puddle_splat',
        category: 'organic_blobs',
        name: '13. Mud / Puddle Splat',
        subtitle: 'Rounded liquid lobes with stray outer drops',
        defaultSpreadPx: 8,
    },
    {
        id: 'organic_bushy_fringe',
        category: 'organic_blobs',
        name: '14. Scalloped Bush Fringe',
        subtitle: 'Puffy rounded foliage scallops around tile',
        defaultSpreadPx: 8,
    },
    {
        id: 'organic_starburst_rays',
        category: 'organic_blobs',
        name: '15. Radial Tuft Streaks',
        subtitle: 'Outward grass/dirt rays inside an oval halo',
        defaultSpreadPx: 9,
    },
    {
        id: 'organic_island_archipelago',
        category: 'organic_blobs',
        name: '16. Mini Island Crumbs',
        subtitle: 'Oval cushion with detached micro-patches',
        defaultSpreadPx: 9,
    },

    // --- Category 3: Diamond Rim (6) ---
    {
        id: 'fine_spray',
        category: 'diamond_edge',
        name: '17. Diamond Spray Mist',
        subtitle: 'Parallel spray-can mist along diamond lines',
        defaultSpreadPx: 7,
    },
    {
        id: 'coarse_pebbles',
        category: 'diamond_edge',
        name: '18. Diamond Pebble Specks',
        subtitle: '1px & 2px gravel clusters along border',
        defaultSpreadPx: 7,
    },
    {
        id: 'jagged_eroded',
        category: 'diamond_edge',
        name: '19. Jagged Eroded Rim',
        subtitle: 'Rough broken border with stray outer specks',
        defaultSpreadPx: 6,
    },
    {
        id: 'grass_tufts',
        category: 'diamond_edge',
        name: '20. Short Blade Streaks',
        subtitle: 'Vertical 1×2 & 1×3 pixel tufts around edge',
        defaultSpreadPx: 7,
    },
    {
        id: 'wide_dust',
        category: 'diamond_edge',
        name: '21. Wide Dust Scatter',
        subtitle: 'Airy, wide-reaching fine pixel spread',
        defaultSpreadPx: 10,
    },
    {
        id: 'heavy_rim',
        category: 'diamond_edge',
        name: '22. Dense Diamond Halo',
        subtitle: 'Thick inner collar with scattered outer drops',
        defaultSpreadPx: 8,
    },

    // --- Category 4: Directional & Corner (6) ---
    {
        id: 'dir_side_cheeks_oval',
        category: 'directional',
        name: '23. 4-Flat Side Cheeks',
        subtitle: 'Fills only the 4 diagonal flats into an oval',
        defaultSpreadPx: 8,
    },
    {
        id: 'dir_top_canopy_oval',
        category: 'directional',
        name: '24. North / Top Oval Crown',
        subtitle: 'Rounded spray concentrated on upper half',
        defaultSpreadPx: 8,
    },
    {
        id: 'dir_bottom_skirt_oval',
        category: 'directional',
        name: '25. South / Bottom Skirt',
        subtitle: 'Rounded spray concentrated on lower half',
        defaultSpreadPx: 8,
    },
    {
        id: 'dir_left_wind_drift',
        category: 'directional',
        name: '26. West / Left Wind Drift',
        subtitle: 'Oval spray blown toward the left side',
        defaultSpreadPx: 8,
    },
    {
        id: 'dir_right_wind_drift',
        category: 'directional',
        name: '27. East / Right Wind Drift',
        subtitle: 'Oval spray blown toward the right side',
        defaultSpreadPx: 8,
    },
    {
        id: 'dir_four_corner_ears',
        category: 'directional',
        name: '28. 4-Corner Tip Caps',
        subtitle: 'Extra spray on N/S/E/W diamond tips',
        defaultSpreadPx: 8,
    },

    // --- Category 5: Dither & Stipple (4) ---
    {
        id: 'bayer_dither',
        category: 'dither_stipple',
        name: '29. Bayer Dither Rim',
        subtitle: 'Pixel-art stipple dither fade along border',
        defaultSpreadPx: 6,
    },
    {
        id: 'clumped_patches',
        category: 'dither_stipple',
        name: '30. Micro Clump Islands',
        subtitle: 'Small grouped patches & speckles outside',
        defaultSpreadPx: 8,
    },
    {
        id: 'stipple_checker_oval',
        category: 'dither_stipple',
        name: '31. Checkerboard Oval Fade',
        subtitle: '1px checker stipple inside an oval contour',
        defaultSpreadPx: 8,
    },
    {
        id: 'stipple_noise_rings',
        category: 'dither_stipple',
        name: '32. Concentric Oval Ripples',
        subtitle: 'Rippled stipple rings fading into spray',
        defaultSpreadPx: 8,
    },
];

const previewCache = new Map<string, string>();

/**
 * Renders a small pixel-art preview thumbnail (data URL) showing the base diamond
 * and the outside spray-painted pixel spread mask on a classic dark-blue TMP background.
 */
export function getOutsidePresetPreviewUrl(preset: OutsidePixelPreset): string {
    if (previewCache.has(preset.id)) return previewCache.get(preset.id)!;

    const cx = 48;
    const cy = 24;
    const pad = 11;
    const w = cx + pad * 2;
    const h = cy + pad * 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
        const relY = y - pad;
        for (let x = 0; x < w; x++) {
            const relX = x - pad;
            const off = (y * w + x) * 4;

            // Classic Westwood TMP viewer dark navy background (like the user's screenshot)
            data[off] = 4;
            data[off + 1] = 12;
            data[off + 2] = 68;
            data[off + 3] = 255;

            const inDiamond =
                relX >= 0 &&
                relX < cx &&
                relY >= 0 &&
                relY < cy &&
                TmpParser.isInsideWestwoodDiamond(relX, relY, cx, cy);

            if (inDiamond || evaluateOutsidePixelMask(preset.id, relX, relY, cx, cy, preset.defaultSpreadPx, 1337)) {
                const grain = hash2D(relX, relY, 555);
                const baseR = inDiamond ? 128 : 142;
                const baseG = inDiamond ? 112 : 124;
                const baseB = inDiamond ? 86 : 94;
                const delta = Math.round((grain - 0.5) * 38);
                data[off] = Math.max(0, Math.min(255, baseR + delta));
                data[off + 1] = Math.max(0, Math.min(255, baseG + delta));
                data[off + 2] = Math.max(0, Math.min(255, baseB + delta));
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    const url = canvas.toDataURL('image/png');
    previewCache.set(preset.id, url);
    return url;
}
