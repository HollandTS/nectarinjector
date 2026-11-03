import * as THREE from 'three';

/**
 * Projects each 3D model's world-space bounding box into 2D canvas coordinates (0..width, 0..height)
 * and returns the IDs of all models whose projected screen box intersects the marquee rectangle.
 */
export function findModelsInSelectionBox(
    modelsMap: Map<string, THREE.Group>,
    camera: THREE.Camera,
    canvasWidth: number,
    canvasHeight: number,
    box: { x1: number; y1: number; x2: number; y2: number }
): string[] {
    const minX = Math.min(box.x1, box.x2);
    const maxX = Math.max(box.x1, box.x2);
    const minY = Math.min(box.y1, box.y2);
    const maxY = Math.max(box.y1, box.y2);

    camera.updateMatrixWorld(true);
    const matchedIds: string[] = [];
    const worldBox = new THREE.Box3();
    const corner = new THREE.Vector3();

    modelsMap.forEach((model, id) => {
        if (!model.visible) return;
        model.updateMatrixWorld(true);
        worldBox.setFromObject(model);
        if (worldBox.isEmpty()) return;

        let projMinX = Infinity;
        let projMaxX = -Infinity;
        let projMinY = Infinity;
        let projMaxY = -Infinity;

        const xs = [worldBox.min.x, worldBox.max.x];
        const ys = [worldBox.min.y, worldBox.max.y];
        const zs = [worldBox.min.z, worldBox.max.z];

        for (let ix = 0; ix < 2; ix++) {
            for (let iy = 0; iy < 2; iy++) {
                for (let iz = 0; iz < 2; iz++) {
                    corner.set(xs[ix], ys[iy], zs[iz]).project(camera);
                    const sx = ((corner.x + 1) * 0.5) * canvasWidth;
                    const sy = ((-corner.y + 1) * 0.5) * canvasHeight;
                    if (sx < projMinX) projMinX = sx;
                    if (sx > projMaxX) projMaxX = sx;
                    if (sy < projMinY) projMinY = sy;
                    if (sy > projMaxY) projMaxY = sy;
                }
            }
        }

        // Check 2D AABB overlap between projected model bounds and marquee box
        const overlaps =
            projMinX <= maxX &&
            projMaxX >= minX &&
            projMinY <= maxY &&
            projMaxY >= minY;

        if (overlaps) {
            matchedIds.push(id);
        }
    });

    return matchedIds;
}
