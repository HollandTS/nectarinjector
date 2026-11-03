import type { GridType } from '../types';

export const OPENTS_GRID_WIDTH = 96;
export const OPENTS_GRID_HEIGHT = 48;

export function isOpenTsDimensions(width: number, height: number): boolean {
    return (width === OPENTS_GRID_WIDTH && height === OPENTS_GRID_HEIGHT) || (width === 48 && height === 96);
}

export function detectGridTypeForTmp(
    cx: number,
    cy: number,
    filename?: string,
    currentGrid?: GridType
): GridType {
    if ((cx === 96 && cy === 48) || (cx === 48 && cy === 96)) {
        return 'opents_full';
    }
    const lower = (filename || '').toLowerCase();
    if (lower.includes('opents')) {
        return 'opents_full';
    }
    if (currentGrid === 'opents_full') {
        return 'opents_full';
    }
    if (cx === 60) {
        return 'ra2_full';
    }
    return 'ts_full';
}

export function detectGridTypeForWidth(
    width: number,
    currentGrid?: GridType
): GridType {
    if (currentGrid === 'opents_full') {
        return 'opents_full';
    }
    if (width % 96 === 0) {
        return 'opents_full';
    }
    if (width % 60 === 0) {
        return 'ra2_full';
    }
    return 'ts_full';
}
