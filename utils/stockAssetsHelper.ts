export interface StockAssetItem {
    id: string;
    name: string;
    fileName: string;
    url: string;
    folder: string;
}

function formatAssetName(rawName: string): string {
    const base = rawName.replace(/\.[^/.]+$/, '');
    let name = base.replace(/[_-]+/g, ' ').trim();
    name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2');
    return name
        .split(' ')
        .filter(Boolean)
        .map(word => {
            if (word.toUpperCase() === word && word.length > 2) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

// Broad static literal import.meta.glob across all folders so any case of IMAGES, images, BRUSHES, 3DOBJECTS is captured
const allImageModules: Record<string, string> = import.meta.glob<string>(
    [
        '../IMAGES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '/IMAGES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '../images/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '/images/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '../BRUSHES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '/BRUSHES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '../public/IMAGES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '/public/IMAGES/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
        '../*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP}',
        '/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP}'
    ],
    { eager: true, import: 'default' }
);

const all3DModules: Record<string, string> = import.meta.glob<string>(
    [
        '../3DOBJECTS/**/*.{glb,GLB,gltf,GLTF}',
        '/3DOBJECTS/**/*.{glb,GLB,gltf,GLTF}',
        '../3dobjects/**/*.{glb,GLB,gltf,GLTF}',
        '/3dobjects/**/*.{glb,GLB,gltf,GLTF}',
        '../*.{glb,GLB,gltf,GLTF}',
        '/*.{glb,GLB,gltf,GLTF}'
    ],
    { eager: true, query: '?url', import: 'default' }
);

function parseAllImages(): {
    all: StockAssetItem[];
    imagesFolder: StockAssetItem[];
    brushesFolder: StockAssetItem[];
} {
    const allMap = new Map<string, StockAssetItem>();
    const imagesMap = new Map<string, StockAssetItem>();
    const brushesMap = new Map<string, StockAssetItem>();

    for (const [pathKey, assetUrl] of Object.entries(allImageModules)) {
        const parts = pathKey.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1] || '';
        const id = fileName.replace(/\.[^/.]+$/, '');
        if (!fileName) continue;

        const upperPath = pathKey.toUpperCase();
        const isBrushes = upperPath.includes('/BRUSHES/');
        const isImages = upperPath.includes('/IMAGES/');
        const folder = isImages ? 'IMAGES' : isBrushes ? 'BRUSHES' : 'ROOT';

        const resolvedUrl =
            typeof assetUrl === 'string' && assetUrl.length > 0
                ? assetUrl
                : `/${folder === 'ROOT' ? '' : `${folder}/`}${fileName}`;

        const item: StockAssetItem = {
            id,
            name: formatAssetName(fileName),
            fileName,
            url: resolvedUrl,
            folder,
        };

        const dedupeKey = `${folder}:${fileName.toLowerCase()}`;
        if (!allMap.has(dedupeKey)) {
            allMap.set(dedupeKey, item);
        }
        if (isImages && !imagesMap.has(fileName.toLowerCase())) {
            imagesMap.set(fileName.toLowerCase(), item);
        } else if (isBrushes && !brushesMap.has(fileName.toLowerCase())) {
            brushesMap.set(fileName.toLowerCase(), item);
        } else if (!isBrushes && !imagesMap.has(fileName.toLowerCase())) {
            imagesMap.set(fileName.toLowerCase(), item);
        }
    }

    const sortByName = (a: StockAssetItem, b: StockAssetItem) => a.name.localeCompare(b.name);
    return {
        all: Array.from(allMap.values()).sort(sortByName),
        imagesFolder: Array.from(imagesMap.values()).sort(sortByName),
        brushesFolder: Array.from(brushesMap.values()).sort(sortByName),
    };
}

function parseAll3DModels(): StockAssetItem[] {
    const map = new Map<string, StockAssetItem>();

    for (const [pathKey, assetUrl] of Object.entries(all3DModules)) {
        const fileName = pathKey.split('/').pop() || '';
        const id = fileName.replace(/\.[^/.]+$/, '');
        if (!fileName || map.has(fileName.toLowerCase())) continue;

        map.set(fileName.toLowerCase(), {
            id,
            name: formatAssetName(fileName),
            fileName,
            url: typeof assetUrl === 'string' && assetUrl.length > 0 ? assetUrl : `/3DOBJECTS/${fileName}`,
            folder: '3DOBJECTS',
        });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const parsedImages = parseAllImages();

export const STOCK_ALL_IMAGES: StockAssetItem[] = parsedImages.all;
export const STOCK_IMAGES: StockAssetItem[] = parsedImages.imagesFolder;
export const STOCK_BRUSH_IMAGES: StockAssetItem[] = parsedImages.brushesFolder;
export const STOCK_3D_OBJECTS: StockAssetItem[] = parseAll3DModels();
