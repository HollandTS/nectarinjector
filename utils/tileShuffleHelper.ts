import type { OverlayFilters } from '../types';

export interface ShuffleFlags {
    standard: boolean;
    mirrorH: boolean;
    mirrorV: boolean;
    rotate: boolean;
}

/**
 * Resolves the effective shuffle flags from OverlayFilters,
 * supporting both the individual boolean flags and legacy shuffleMode values.
 */
export function resolveShuffleFlags(f: OverlayFilters): ShuffleFlags {
    const hasExplicitFlags =
        f.shuffleStandard !== undefined ||
        f.shuffleMirrorH !== undefined ||
        f.shuffleMirrorV !== undefined ||
        f.shuffleRotate !== undefined;

    if (hasExplicitFlags) {
        return {
            standard: f.shuffleStandard ?? true,
            mirrorH: f.shuffleMirrorH ?? false,
            mirrorV: f.shuffleMirrorV ?? false,
            rotate: f.shuffleRotate ?? false,
        };
    }

    // Legacy fallback from f.shuffleMode
    switch (f.shuffleMode) {
        case 'none':
            return { standard: true, mirrorH: false, mirrorV: false, rotate: false };
        case 'mirror_h':
            return { standard: true, mirrorH: true, mirrorV: false, rotate: false };
        case 'mirror_v':
            return { standard: true, mirrorH: false, mirrorV: true, rotate: false };
        case 'mirror_both':
            return { standard: true, mirrorH: true, mirrorV: true, rotate: false };
        case 'default':
        default:
            return { standard: true, mirrorH: true, mirrorV: true, rotate: true };
    }
}

/**
 * Applies tile shuffle rotation and mirroring to a 2D canvas context
 * based on the active shuffle checkboxes (Standard, Mirror H, Mirror V, Rotate).
 */
export function applyTileShuffleTransform(
    ctx: CanvasRenderingContext2D,
    f: OverlayFilters,
    row: number,
    col: number
): void {
    const flags = resolveShuffleFlags(f);
    const seed = Math.abs((row * 1337 + col * 7331 + (f.scramblePositions || 0)) % 1000000);

    // 1. Rotation (90-degree increments)
    if (flags.rotate) {
        if (flags.standard) {
            // Mix of 0, 90, 180, 270
            const rotStep = Math.floor(seed % 4);
            if (rotStep !== 0) {
                ctx.rotate((rotStep * 90 * Math.PI) / 180);
            }
        } else {
            // Only rotated variants (90, 180, 270) when Standard is unchecked
            const rotStep = 1 + Math.floor(seed % 3);
            ctx.rotate((rotStep * 90 * Math.PI) / 180);
        }
    }

    // 2. Mirroring (Horizontal & Vertical)
    const isChaosLike = flags.rotate || (flags.mirrorH && flags.mirrorV);

    let scaleX = 1;
    let scaleY = 1;

    if (flags.mirrorH) {
        if (!flags.standard && !flags.mirrorV && !flags.rotate) {
            // Strictly Mirror H only (Standard unchecked)
            scaleX = -1;
        } else if (isChaosLike) {
            scaleX = (seed % 7) > 3 ? -1 : 1;
        } else {
            scaleX = col % 2 === 1 ? -1 : 1;
        }
    }

    if (flags.mirrorV) {
        if (!flags.standard && !flags.mirrorH && !flags.rotate) {
            // Strictly Mirror V only (Standard unchecked)
            scaleY = -1;
        } else if (isChaosLike) {
            scaleY = (seed % 11) > 5 ? -1 : 1;
        } else {
            scaleY = row % 2 === 1 ? -1 : 1;
        }
    }

    // If Standard is unchecked and both Mirror H & Mirror V are checked, ensure at least one transform is applied
    if (!flags.standard && flags.mirrorH && flags.mirrorV && scaleX === 1 && scaleY === 1 && !flags.rotate) {
        scaleX = (seed % 2) === 0 ? -1 : 1;
        scaleY = scaleX === 1 ? -1 : ((seed % 3) === 0 ? -1 : 1);
    }

    if (scaleX !== 1 || scaleY !== 1) {
        ctx.scale(scaleX, scaleY);
    }
}
