export function floodFill(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    fillColor: { r: number; g: number; b: number; a: number }
) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (
        startR === fillColor.r &&
        startG === fillColor.g &&
        startB === fillColor.b &&
        startA === fillColor.a
    ) {
        return;
    }

    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const pos = (y * width + x) * 4;

        if (
            data[pos] === startR &&
            data[pos + 1] === startG &&
            data[pos + 2] === startB &&
            data[pos + 3] === startA
        ) {
            data[pos] = fillColor.r;
            data[pos + 1] = fillColor.g;
            data[pos + 2] = fillColor.b;
            data[pos + 3] = fillColor.a;

            if (x > 0) stack.push([x - 1, y]);
            if (x < width - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < height - 1) stack.push([x, y + 1]);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}
