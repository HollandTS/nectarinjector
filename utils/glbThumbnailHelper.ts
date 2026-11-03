import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const thumbnailCache = new Map<string, string>();
const pendingRenders = new Map<string, Promise<string>>();

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getSharedRenderer(): THREE.WebGLRenderer {
    if (!sharedRenderer) {
        sharedRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        sharedRenderer.setSize(220, 220);
        sharedRenderer.setPixelRatio(1);
        sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    return sharedRenderer;
}

/**
 * Renders a 3D GLB model from a URL into a 2D data URL thumbnail image.
 * Results are cached in memory by URL for instant subsequent opens.
 */
export function renderGlbThumbnail(glbUrl: string): Promise<string> {
    if (thumbnailCache.has(glbUrl)) {
        return Promise.resolve(thumbnailCache.get(glbUrl)!);
    }
    if (pendingRenders.has(glbUrl)) {
        return pendingRenders.get(glbUrl)!;
    }

    const promise = new Promise<string>((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            glbUrl,
            (gltf) => {
                try {
                    const renderer = getSharedRenderer();
                    const scene = new THREE.Scene();

                    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
                    scene.add(ambientLight);

                    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
                    dirLight1.position.set(5, 10, 7);
                    scene.add(dirLight1);

                    const dirLight2 = new THREE.DirectionalLight(0x67e8f9, 0.7);
                    dirLight2.position.set(-6, -4, -5);
                    scene.add(dirLight2);

                    const model = gltf.scene;
                    scene.add(model);

                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());

                    model.position.sub(center);

                    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
                    const scale = 2.2 / maxDim;
                    model.scale.setScalar(scale);

                    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
                    camera.position.set(2.4, 2.0, 2.6);
                    camera.lookAt(0, 0, 0);

                    renderer.setClearColor(0x000000, 0);
                    renderer.render(scene, camera);

                    const dataUrl = renderer.domElement.toDataURL('image/png');
                    thumbnailCache.set(glbUrl, dataUrl);
                    pendingRenders.delete(glbUrl);
                    resolve(dataUrl);
                } catch (err) {
                    pendingRenders.delete(glbUrl);
                    reject(err);
                }
            },
            undefined,
            (err) => {
                pendingRenders.delete(glbUrl);
                reject(err);
            }
        );
    });

    pendingRenders.set(glbUrl, promise);
    return promise;
}
