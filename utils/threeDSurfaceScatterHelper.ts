import * as THREE from 'three';
import type {
    ThreeDObject,
    ThreeDSurfaceScatterSettings,
} from '../types';
import { DEFAULT_SURFACE_SCATTER_SETTINGS } from './threeDSurfaceScatterPresets';
import {
    loadScatterAssetPrimitives,
    loadScatterItemTexture,
    createConfiguredScatterMaterial,
} from './threeDSurfaceScatterLoader';
import {
    createSeededRandom,
    smoothClumpNoise2D,
    collectEligibleSurfaceTriangles,
    samplePointOnSurface,
    isScatterChild,
    SpawnSample,
} from './threeDSurfaceScatterSampler';
import { applyBaseMeshHoldoutState } from './threeDSurfaceScatterHoldoutHelper';

export const SCATTER_GROUP_NAME = '__SurfaceScatterGroup__';

export function isSurfaceScatterChild(child: THREE.Object3D): boolean {
    return isScatterChild(child, SCATTER_GROUP_NAME);
}

function disposeScatterGroupChildren(group: THREE.Group): void {
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if ((child as THREE.InstancedMesh).isInstancedMesh) {
            const im = child as THREE.InstancedMesh;
            im.geometry?.dispose();
            if (Array.isArray(im.material)) {
                im.material.forEach((m) => m.dispose());
            } else {
                im.material?.dispose();
            }
        }
    }
}

/**
 * Updates the visibility and holdout depth-mask state of the base meshes on `model`.
 */
export function syncBaseMeshVisibilityAndHoldout(
    model: THREE.Group,
    obj: ThreeDObject,
    baseRenderOrder: number = 0
): void {
    const scatter: ThreeDSurfaceScatterSettings = {
        ...DEFAULT_SURFACE_SCATTER_SETTINGS,
        ...(obj.surfaceScatterSettings || {}),
    };
    const activeItems = (scatter.items || []).filter((item) => item.enabled && item.glbUrl);
    const shouldHideBase = Boolean(scatter.enabled && activeItems.length > 0 && scatter.hideBaseMesh);
    const shouldHoldout = Boolean(shouldHideBase && scatter.holdoutMask);

    model.traverse((child) => {
        if (isScatterChild(child, SCATTER_GROUP_NAME)) {
            return;
        }
        if ((child as THREE.Mesh).isMesh) {
            applyBaseMeshHoldoutState(
                child as THREE.Mesh,
                shouldHideBase,
                shouldHoldout,
                baseRenderOrder
            );
        }
    });
}

/**
 * Generates or updates the `THREE.InstancedMesh` array inside `model` so all scattered
 * 3D models (grass plugs, rocks, shrubs) sit on the top surface of `model` and move,
 * rotate, and cast shadows together with the main plane/object.
 */
export async function applySurfaceScatterToModel(
    model: THREE.Group,
    obj: ThreeDObject,
    baseRenderOrder: number = 0
): Promise<void> {
    const scatter: ThreeDSurfaceScatterSettings = {
        ...DEFAULT_SURFACE_SCATTER_SETTINGS,
        ...(obj.surfaceScatterSettings || {}),
    };

    const activeItems = (scatter.items || []).filter((item) => item.enabled && item.glbUrl);

    syncBaseMeshVisibilityAndHoldout(model, obj, baseRenderOrder);

    let scatterGroup = model.getObjectByName(SCATTER_GROUP_NAME) as THREE.Group | undefined;

    if (!scatter.enabled || activeItems.length === 0) {
        if (scatterGroup) {
            disposeScatterGroupChildren(scatterGroup);
            model.remove(scatterGroup);
        }
        return;
    }

    if (!scatterGroup) {
        scatterGroup = new THREE.Group();
        scatterGroup.name = SCATTER_GROUP_NAME;
        model.add(scatterGroup);
    }

    // Counter-scale scatterGroup against non-uniform `model.scale` so scattered grass/rocks
    // never get stretched horizontally when the plane is scaled to e.g. 6x6 tiles!
    const sx = Math.max(1e-4, Math.abs(model.scale.x));
    const sy = Math.max(1e-4, Math.abs(model.scale.y));
    const sz = Math.max(1e-4, Math.abs(model.scale.z));
    scatterGroup.scale.set(1 / sx, 1 / sy, 1 / sz);

    // Load all active GLB assets and optional custom textures in parallel
    const [loadedItemPrimitives, loadedItemTextures] = await Promise.all([
        Promise.all(activeItems.map((item) => loadScatterAssetPrimitives(item.glbUrl))),
        Promise.all(activeItems.map((item) => loadScatterItemTexture(item.textureUrl))),
    ]);

    const { triangles, totalArea, bounds } = collectEligibleSurfaceTriangles(
        model,
        scatter,
        SCATTER_GROUP_NAME
    );
    disposeScatterGroupChildren(scatterGroup);

    if (triangles.length === 0 || totalArea <= 1e-6) {
        return;
    }

    const rng = createSeededRandom(Math.round(scatter.seed ?? 42));
    const rawTargetCount = Math.round(
        Math.max(1, scatter.amount ?? 180) * (Math.max(1, scatter.density ?? 100) / 100)
    );
    const targetCount = Math.max(1, Math.min(4000, rawTargetCount));

    const totalWeight = activeItems.reduce((acc, it) => acc + Math.max(1, it.weight ?? 100), 0);
    const pickItemIndex = (): number => {
        if (activeItems.length === 1) return 0;
        let r = rng() * totalWeight;
        for (let i = 0; i < activeItems.length; i++) {
            r -= Math.max(1, activeItems[i].weight ?? 100);
            if (r <= 0) return i;
        }
        return activeItems.length - 1;
    };

    const sizeVec = new THREE.Vector3();
    bounds.getSize(sizeVec);
    const spanX = Math.max(0.01, sizeVec.x);
    const spanZ = Math.max(0.01, sizeVec.z);
    const avgSpan = 0.5 * (spanX + spanZ);

    const marginPct = Math.max(-50, Math.min(85, scatter.edgeMargin ?? 5)) / 100;
    const minAllowX = bounds.min.x + spanX * marginPct * 0.5;
    const maxAllowX = bounds.max.x - spanX * marginPct * 0.5;
    const minAllowZ = bounds.min.z + spanZ * marginPct * 0.5;
    const maxAllowZ = bounds.max.z - spanZ * marginPct * 0.5;

    const minSpacingPct = Math.max(0, Math.min(100, scatter.minSpacing ?? 15)) / 100;
    const idealCellDist = Math.sqrt((spanX * spanZ) / Math.max(1, targetCount));
    const minDist = minSpacingPct * idealCellDist * 0.85;
    const minDistSq = minDist * minDist;

    const clumpStrength = Math.max(0, Math.min(100, scatter.clumpStrength ?? 35)) / 100;
    const clumpFreq = Math.max(0.2, scatter.clumpScale ?? 4.0) / Math.max(0.5, avgSpan);

    const samples: SpawnSample[] = [];
    const maxAttempts = Math.min(18000, targetCount * 8);

    if (scatter.distributionMode === 'grid_jitter') {
        const aspect = spanX / Math.max(0.01, spanZ);
        const cols = Math.max(1, Math.round(Math.sqrt(targetCount * aspect)));
        const rows = Math.max(1, Math.ceil(targetCount / cols));
        const effWidth = Math.max(0.01, maxAllowX - minAllowX);
        const effDepth = Math.max(0.01, maxAllowZ - minAllowZ);
        const cellW = effWidth / cols;
        const cellD = effDepth / rows;

        const rayPositions = new Float32Array(triangles.length * 9);
        const rayNormals = new Float32Array(triangles.length * 9);
        for (let i = 0; i < triangles.length; i++) {
            const t = triangles[i];
            const base = i * 9;
            rayPositions[base] = t.vA.x;
            rayPositions[base + 1] = t.vA.y;
            rayPositions[base + 2] = t.vA.z;
            rayPositions[base + 3] = t.vB.x;
            rayPositions[base + 4] = t.vB.y;
            rayPositions[base + 5] = t.vB.z;
            rayPositions[base + 6] = t.vC.x;
            rayPositions[base + 7] = t.vC.y;
            rayPositions[base + 8] = t.vC.z;

            rayNormals[base] = t.nA.x;
            rayNormals[base + 1] = t.nA.y;
            rayNormals[base + 2] = t.nA.z;
            rayNormals[base + 3] = t.nB.x;
            rayNormals[base + 4] = t.nB.y;
            rayNormals[base + 5] = t.nB.z;
            rayNormals[base + 6] = t.nC.x;
            rayNormals[base + 7] = t.nC.y;
            rayNormals[base + 8] = t.nC.z;
        }

        const tempGeo = new THREE.BufferGeometry();
        tempGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
        tempGeo.setAttribute('normal', new THREE.BufferAttribute(rayNormals, 3));
        const tempMesh = new THREE.Mesh(
            tempGeo,
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
        );
        const raycaster = new THREE.Raycaster();
        const downDir = new THREE.Vector3(0, -1, 0);
        const rayOrigin = new THREE.Vector3();

        for (let r = 0; r < rows && samples.length < targetCount; r++) {
            for (let c = 0; c < cols && samples.length < targetCount; c++) {
                const jitterSpread = 1.15 - minSpacingPct * 0.65;
                const jx = 0.5 + (rng() - 0.5) * jitterSpread;
                const jz = 0.5 + (rng() - 0.5) * jitterSpread;
                const x = minAllowX + (c + jx) * cellW;
                const z = minAllowZ + (r + jz) * cellD;

                if (clumpStrength > 0.01) {
                    const nVal = smoothClumpNoise2D(
                        (x - bounds.min.x) * clumpFreq,
                        (z - bounds.min.z) * clumpFreq,
                        scatter.seed + 777
                    );
                    const threshold = clumpStrength * 0.68;
                    if (nVal < threshold && rng() < clumpStrength) {
                        continue;
                    }
                }

                rayOrigin.set(x, bounds.max.y + 50, z);
                raycaster.set(rayOrigin, downDir);
                const hits = raycaster.intersectObject(tempMesh, false);
                if (hits.length > 0) {
                    const hit = hits[0];
                    const n = hit.face ? hit.face.normal.clone().normalize() : new THREE.Vector3(0, 1, 0);
                    if (n.y < 0) n.negate();
                    samples.push({
                        pos: hit.point.clone(),
                        normal: n,
                        itemIndex: pickItemIndex(),
                    });
                }
            }
        }
        tempGeo.dispose();
        (tempMesh.material as THREE.Material).dispose();
    }

    for (let attempt = 0; attempt < maxAttempts && samples.length < targetCount; attempt++) {
        const candidate = samplePointOnSurface(triangles, totalArea, rng);
        const { pos, normal } = candidate;

        if (
            pos.x < minAllowX ||
            pos.x > maxAllowX ||
            pos.z < minAllowZ ||
            pos.z > maxAllowZ
        ) {
            continue;
        }

        const effectiveClump =
            scatter.distributionMode === 'clumped'
                ? Math.max(0.45, clumpStrength)
                : clumpStrength;
        if (effectiveClump > 0.01) {
            const nVal = smoothClumpNoise2D(
                (pos.x - bounds.min.x) * clumpFreq,
                (pos.z - bounds.min.z) * clumpFreq,
                scatter.seed + 777
            );
            const keepProb = Math.pow(Math.max(0, Math.min(1, nVal * 1.25)), effectiveClump * 2.4);
            if (rng() > keepProb) continue;
        }

        if (minDistSq > 1e-6 && samples.length > 0) {
            let tooClose = false;
            const checkStart = Math.max(0, samples.length - 180);
            for (let j = checkStart; j < samples.length; j++) {
                const dx = samples[j].pos.x - pos.x;
                const dz = samples[j].pos.z - pos.z;
                const dy = samples[j].pos.y - pos.y;
                if (dx * dx + dy * dy + dz * dz < minDistSq) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;
        }

        samples.push({
            pos,
            normal,
            itemIndex: pickItemIndex(),
        });
    }

    if (samples.length === 0) return;

    const samplesByItem: SpawnSample[][] = activeItems.map(() => []);
    for (const s of samples) {
        samplesByItem[s.itemIndex].push(s);
    }

    const upVec = new THREE.Vector3(0, 1, 0);
    const dummy = new THREE.Object3D();
    const alignQuat = new THREE.Quaternion();
    const normalTarget = new THREE.Vector3();
    const eulerRot = new THREE.Euler(0, 0, 0, 'YXZ');
    const localQuat = new THREE.Quaternion();
    const instanceColor = new THREE.Color();
    const tintTarget = new THREE.Color(scatter.tintColor || '#ffffff');
    const hsl = { h: 0, s: 0, l: 0 };

    const alignBlend = Math.max(0, Math.min(100, scatter.alignToNormal ?? 35)) / 100;
    const baseRotYRad = ((scatter.baseRotationY ?? 0) * Math.PI) / 180;
    const randRotYRad = ((scatter.randomRotationY ?? 360) * Math.PI) / 180;
    const randTiltRad = ((scatter.randomTiltXZ ?? 8) * Math.PI) / 180;

    const minScaleFactor = Math.max(0.05, (scatter.randomScaleMin ?? 75) / 100);
    const maxScaleFactor = Math.max(minScaleFactor, (scatter.randomScaleMax ?? 135) / 100);
    const globalBaseScale = Math.max(0.02, scatter.baseScale ?? 0.55);
    const sxMult = Math.max(0.05, scatter.scaleX ?? 1.0);
    const syMult = Math.max(0.05, scatter.scaleY ?? 1.0);
    const szMult = Math.max(0.05, scatter.scaleZ ?? 1.0);

    const colorVar = Math.max(0, Math.min(100, scatter.colorVariation ?? 18)) / 100;
    const brightVar = Math.max(0, Math.min(100, scatter.brightnessVariation ?? 15)) / 100;
    const tintStrength = Math.max(0, Math.min(100, scatter.tintStrength ?? 0)) / 100;

    for (let itemIdx = 0; itemIdx < activeItems.length; itemIdx++) {
        const item = activeItems[itemIdx];
        const itemSamples = samplesByItem[itemIdx];
        const primitives = loadedItemPrimitives[itemIdx];
        if (!itemSamples || itemSamples.length === 0 || !primitives || primitives.length === 0) {
            continue;
        }

        const count = itemSamples.length;
        const itemScaleMult = Math.max(0.05, item.scaleMultiplier ?? 1.0);
        const totalYOffset = (scatter.sinkOffset ?? -0.04) + (item.yOffset ?? 0);

        const matrices: THREE.Matrix4[] = new Array(count);
        const colors: THREE.Color[] = new Array(count);

        for (let i = 0; i < count; i++) {
            const s = itemSamples[i];

            const randScale = minScaleFactor + rng() * (maxScaleFactor - minScaleFactor);
            const normScale = primitives[0].normScale;
            const uScale = globalBaseScale * itemScaleMult * randScale * normScale;

            normalTarget.copy(upVec).lerp(s.normal, alignBlend).normalize();
            alignQuat.setFromUnitVectors(upVec, normalTarget);

            const ry = baseRotYRad + (rng() - 0.5) * randRotYRad;
            const rx = (rng() - 0.5) * 2 * randTiltRad;
            const rz = (rng() - 0.5) * 2 * randTiltRad;
            eulerRot.set(rx, ry, rz, 'YXZ');
            localQuat.setFromEuler(eulerRot);

            dummy.quaternion.copy(alignQuat).multiply(localQuat);

            dummy.position.copy(s.pos);
            dummy.position.y += totalYOffset;

            dummy.scale.set(uScale * sxMult, uScale * syMult, uScale * szMult);
            dummy.updateMatrix();
            matrices[i] = dummy.matrix.clone();

            instanceColor.setRGB(1, 1, 1);
            if (tintStrength > 0) {
                instanceColor.lerp(tintTarget, tintStrength);
            }
            instanceColor.getHSL(hsl);
            const hueJitter = (rng() - 0.5) * colorVar * 0.22;
            const lumJitter = (rng() - 0.5) * brightVar * 0.65;

            const nextH = (hsl.h + hueJitter + 1.0) % 1.0;
            const nextS = Math.max(0, Math.min(1, hsl.s + (rng() - 0.5) * colorVar * 0.25));
            const nextL = Math.max(0.08, Math.min(1.0, hsl.l + lumJitter));
            instanceColor.setHSL(nextH, nextS, nextL);

            colors[i] = instanceColor.clone();
        }

        const customItemTex = loadedItemTextures[itemIdx] || null;

        for (const prim of primitives) {
            const instGeo = prim.geometry.clone();
            const instMat = createConfiguredScatterMaterial(
                prim.material,
                Boolean(obj.paletteViewer),
                obj.opacity ?? 100,
                customItemTex,
                item
            );

            const instMesh = new THREE.InstancedMesh(instGeo, instMat, count);
            instMesh.userData.id = obj.id;
            instMesh.userData.isScatterInstance = true;
            instMesh.renderOrder = baseRenderOrder;
            instMesh.frustumCulled = false;
            instMesh.castShadow = obj.shadowSettings?.enabled !== false;
            instMesh.receiveShadow = false;

            for (let i = 0; i < count; i++) {
                instMesh.setMatrixAt(i, matrices[i]);
                instMesh.setColorAt(i, colors[i]);
            }
            instMesh.instanceMatrix.needsUpdate = true;
            if (instMesh.instanceColor) {
                instMesh.instanceColor.needsUpdate = true;
            }

            scatterGroup.add(instMesh);
        }
    }
}
