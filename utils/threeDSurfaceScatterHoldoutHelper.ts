import * as THREE from 'three';

/**
 * Configures a base mesh's visibility and depth/color write properties to support:
 * 1. Normal visible rendering (!hideBase)
 * 2. Complete hiding (hideBase && !holdoutMask)
 * 3. Holdout Mask mode (hideBase && holdoutMask): the base mesh writes to the depth buffer
 *    with `colorWrite = false` before scattered instances render, so any part of a scattered
 *    object behind or underneath the base mesh is cleanly masked out (occluded) while the
 *    base mesh itself remains 100% invisible/transparent.
 */
export function applyBaseMeshHoldoutState(
    mesh: THREE.Mesh,
    hideBase: boolean,
    holdoutMask: boolean,
    baseRenderOrder: number
): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    if (!hideBase) {
        mesh.visible = true;
        mesh.renderOrder = baseRenderOrder;
        materials.forEach((mat) => {
            if (!mat) return;
            if (mat.userData.wasHoldoutMask) {
                mat.colorWrite = true;
                mat.depthWrite = mat.userData.preHoldoutDepthWrite ?? true;
                mat.depthTest = mat.userData.preHoldoutDepthTest ?? true;
                mat.userData.wasHoldoutMask = false;
                mat.needsUpdate = true;
            }
        });
        return;
    }

    if (holdoutMask) {
        // Keep mesh visible in WebGL pipeline so it writes depth, but disable color buffer output
        mesh.visible = true;
        mesh.renderOrder = baseRenderOrder - 1;
        materials.forEach((mat) => {
            if (!mat) return;
            if (!mat.userData.wasHoldoutMask) {
                mat.userData.preHoldoutDepthWrite = mat.depthWrite;
                mat.userData.preHoldoutDepthTest = mat.depthTest;
                mat.userData.wasHoldoutMask = true;
            }
            mat.colorWrite = false;
            mat.depthWrite = true;
            mat.depthTest = true;
            mat.needsUpdate = true;
        });
    } else {
        mesh.visible = false;
        mesh.renderOrder = baseRenderOrder;
        materials.forEach((mat) => {
            if (!mat) return;
            if (mat.userData.wasHoldoutMask) {
                mat.colorWrite = true;
                mat.depthWrite = mat.userData.preHoldoutDepthWrite ?? true;
                mat.depthTest = mat.userData.preHoldoutDepthTest ?? true;
                mat.userData.wasHoldoutMask = false;
                mat.needsUpdate = true;
            }
        });
    }
}
