const invertedBrushCache = new Map<string, HTMLCanvasElement>();

/**
 * Inverts white with black (RGB channels: 255 - val) for a brush image,
 * preserving its alpha channel.
 */
export function getInvertedBrushImage(
    img: CanvasImageSource,
    width: number,
    height: number,
    srcKey?: string
): HTMLCanvasElement {
    const key = srcKey ? `${srcKey}_${width}x${height}` : null;
    if (key && invertedBrushCache.has(key)) {
        return invertedBrushCache.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
    }

    ctx.putImageData(imgData, 0, 0);

    if (key) {
        if (invertedBrushCache.size > 50) {
            const first = invertedBrushCache.keys().next().value;
            if (first) invertedBrushCache.delete(first);
        }
        invertedBrushCache.set(key, canvas);
    }

    return canvas;
}
