import { RgbaColor } from '../../types';
import { colorDistance } from '../colorUtils';

/**
 * Checks whether a given RGB pixel matches any color in the specified target colors array
 * within the given tolerance.
 */
export function isColorInRange(
    r: number,
    g: number,
    b: number,
    targetColors?: RgbaColor[],
    tolerance: number = 20
): boolean {
    if (!targetColors || targetColors.length === 0) {
        return true;
    }
    const currentRgb: RgbaColor = { r, g, b, a: 1 };
    for (let i = 0; i < targetColors.length; i++) {
        if (colorDistance(currentRgb, targetColors[i]) <= tolerance) {
            return true;
        }
    }
    return false;
}
