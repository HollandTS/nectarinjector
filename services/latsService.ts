import { CanvasImage, GridType, ActiveGridType } from '../types';
import { parseTmpFile, renderTmpToPng, getTmpMinOffsets, PaletteColor, loadDefaultPalette, isValidWwTmp } from '../utils/westwoodTmpParser';

export type LatOption =
    | 'clear'
    | "glat's - green"
    | 'clat - ruff'
    | 'blat - blue'
    | 'sandy - sand'
    | 'plat - pvclr';

export const LAT_OPTIONS: LatOption[] = [
    'clear',
    "glat's - green",
    'clat - ruff',
    'blat - blue',
    'sandy - sand',
    'plat - pvclr',
];

export const LAT_FILE_NAMES = [
    'glat01.tem', 'glat01a.tem', 'glat02.tem', 'glat02a.tem',
    'glat03.tem', 'glat03a.tem', 'glat04.tem', 'glat04a.tem',
    'glat05.tem', 'glat05a.tem', 'glat06.tem', 'glat06a.tem',
    'glat07.tem', 'glat07a.tem', 'glat08.tem', 'glat08a.tem',
    'glat09.tem', 'glat09a.tem', 'glat10.tem', 'glat10a.tem',
    'glat11.tem', 'glat11a.tem', 'glat12.tem', 'glat12a.tem',
    'glat13.tem', 'glat13a.tem', 'glat14.tem', 'glat14a.tem',
    'glat15.tem', 'glat15a.tem', 'glat16.tem', 'glat16a.tem',
    'green01.tem', 'green01a.tem', 'green01b.tem', 'green01c.tem',
    'green01d.tem', 'green01e.tem', 'green01f.tem', 'green01g.tem',
];

export function getLatFolderForGrid(gridType: GridType, lastActiveGrid?: ActiveGridType): 'TS' | 'RA2' | 'OPENTS' {
    const effectiveGrid = gridType === 'none' ? (lastActiveGrid || 'ts_full') : gridType;
    if (effectiveGrid.startsWith('ra2')) return 'RA2';
    if (effectiveGrid.startsWith('opents')) return 'OPENTS';
    return 'TS';
}

export function getRenamedFileName(originalName: string, option: LatOption): string {
    if (option === 'clear') {
        return originalName.replace(/green/gi, 'clear');
    }
    if (option === "glat's - green") {
        return originalName;
    }
    if (option === 'clat - ruff') {
        return originalName.replace(/glat/gi, 'clat').replace(/green/gi, 'ruff');
    }
    if (option === 'blat - blue') {
        return originalName.replace(/glat/gi, 'blat').replace(/green/gi, 'blue');
    }
    if (option === 'sandy - sand') {
        return originalName.replace(/glat/gi, 'sandy').replace(/green/gi, 'sand');
    }
    if (option === 'plat - pvclr') {
        return originalName.replace(/glat/gi, 'plat').replace(/green/gi, 'pvclr');
    }
    return originalName;
}

const GITHUB_LATS_BASE = 'https://raw.githubusercontent.com/HollandTS/Tile_Canvas_Pro/main/LATS';
const GITHUB_TS_TILES_BASE = 'https://raw.githubusercontent.com/HollandTS/Tile_Canvas_Pro/main/TS_tiles';

async function fetchLatFileBuffer(folder: 'TS' | 'RA2' | 'OPENTS', fileName: string): Promise<ArrayBuffer> {
    const candidateUrls = [
        `/LATS/${folder}/${fileName}?raw=1`,
        `/LATS/${folder}/${fileName}`,
        `${GITHUB_LATS_BASE}/${folder}/${fileName}`,
        folder === 'TS' ? `${GITHUB_TS_TILES_BASE}/${fileName}` : undefined,
    ].filter((u): u is string => Boolean(u));

    for (const url of candidateUrls) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const buf = await res.arrayBuffer();
            if (isValidWwTmp(buf)) {
                return buf;
            }
        } catch {
            // Try next candidate
        }
    }

    throw new Error(`Failed to load valid TMP binary for ${fileName} from LATS/${folder}`);
}

export async function loadLatsIntoImages(
    folder: 'TS' | 'RA2' | 'OPENTS',
    option: LatOption,
    palette: PaletteColor[] | null,
    getNextId: () => number,
    startX: number = 45,
    startY: number = 10
): Promise<CanvasImage[]> {
    const effectivePalette = palette && palette.length > 0 ? palette : await loadDefaultPalette();

    const loadedImages: CanvasImage[] = [];
    const cols = 8; // 8 columns

    const targetFileNames = option === 'clear'
        ? LAT_FILE_NAMES.filter(f => f.toLowerCase().startsWith('green'))
        : LAT_FILE_NAMES;

    // Load and process target files in parallel
    const filePromises = targetFileNames.map(async (fileName, index) => {
        const buffer = await fetchLatFileBuffer(folder, fileName);
        const parsedTmp = parseTmpFile(buffer);
        const rendered = renderTmpToPng(parsedTmp, effectivePalette);
        const offsets = getTmpMinOffsets(parsedTmp);
        const renamedName = getRenamedFileName(fileName, option);

        const col = index % cols;
        const row = Math.floor(index / cols);

        const img: CanvasImage = {
            id: `img-${getNextId()}`,
            src: rendered.src,
            originalSrc: rendered.src,
            name: renamedName,
            gridX: startX + col,
            gridY: startY + row,
            offsetX: 0,
            offsetY: 0,
            width: rendered.width,
            height: rendered.height,
            flipH: false,
            flipV: false,
            tmpBuffer: buffer,
            tmpMinX: offsets.minX,
            tmpMinY: offsets.minY,
            tmpCols: offsets.cols,
            tmpRows: offsets.rows,
            tmpCells: offsets.cells,
            isIsotile: true,
        };

        return { index, img };
    });

    const results = await Promise.all(filePromises);
    // Maintain original sorted order
    results.sort((a, b) => a.index - b.index);
    for (const r of results) {
        loadedImages.push(r.img);
    }

    return loadedImages;
}
