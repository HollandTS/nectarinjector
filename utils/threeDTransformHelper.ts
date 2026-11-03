import * as THREE from 'three';
import type { ThreeDObject } from '../types';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';

/**
 * Computes the next scale vector for a 3D object during a free ('xyz') or axis-locked
 * scale transform so that:
 * 1. Non-uniform aspect ratios (e.g. a 3x2 plane where scale = { x: 3, y: 1, z: 2 })
 *    are preserved proportionally instead of overwriting y and z with scale.x.
 * 2. Procedural 3D planes (whose vertical height displacement lives on the local Y axis)
 *    keep their vertical Y scale at 1.0 during free 'xyz' scaling unless the user
 *    explicitly locks an axis that includes 'y' (e.g. 'y', 'xy', 'yz').
 */
export function computeNextThreeDObjectScale(
    currentScale: { x: number; y: number; z: number },
    axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz',
    scaleMultiplier: number,
    isProcPlane: boolean
): { x: number; y: number; z: number } {
    const next = { ...currentScale };

    if (axis === 'xyz') {
        next.x = Math.max(0.01, currentScale.x * scaleMultiplier);
        next.z = Math.max(0.01, currentScale.z * scaleMultiplier);
        if (!isProcPlane) {
            next.y = Math.max(0.01, currentScale.y * scaleMultiplier);
        }
        return next;
    }

    const axesToUpdate: ('x' | 'y' | 'z')[] = [];
    if (axis.length === 1) {
        axesToUpdate.push(axis as 'x' | 'y' | 'z');
    } else {
        if (axis.includes('x')) axesToUpdate.push('x');
        if (axis.includes('y')) axesToUpdate.push('y');
        if (axis.includes('z')) axesToUpdate.push('z');
    }

    for (const a of axesToUpdate) {
        next[a] = Math.max(0.01, currentScale[a] * scaleMultiplier);
    }

    return next;
}

/**
 * Applies a mouse-move delta to a 3D model's transform (translate, rotate, or scale) in place.
 */
export function applyMouseDeltaToThreeDModel(
    model: THREE.Group,
    obj: ThreeDObject | undefined,
    mode: 'translate' | 'rotate' | 'scale',
    axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz',
    moveVec: THREE.Vector3 | null,
    rotRads: number,
    scaleMultiplier: number
): void {
    const axesToUpdate: ('x' | 'y' | 'z')[] = [];
    if (axis.length === 1) {
        axesToUpdate.push(axis as 'x' | 'y' | 'z');
    } else {
        if (axis.includes('x')) axesToUpdate.push('x');
        if (axis.includes('y')) axesToUpdate.push('y');
        if (axis.includes('z')) axesToUpdate.push('z');
    }

    if (mode === 'translate' && moveVec) {
        for (const a of axesToUpdate) {
            model.position[a] += moveVec[a];
        }
    } else if (mode === 'rotate') {
        for (const a of axesToUpdate) {
            model.rotation[a] += rotRads;
        }
    } else if (mode === 'scale') {
        const isProcPlane = obj ? isProceduralPlaneUrl(obj.glbUrl) : false;
        const nextScale = computeNextThreeDObjectScale(
            { x: model.scale.x, y: model.scale.y, z: model.scale.z },
            axis,
            scaleMultiplier,
            isProcPlane
        );
        model.scale.set(nextScale.x, nextScale.y, nextScale.z);
    }
}
