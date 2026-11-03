import { JitterWaveShape } from '../../types';

export function calculateWaveOffset(
    t: number,
    shape: JitterWaveShape = 'sine'
): number {
    const norm = ((t % 1) + 1) % 1; // 0 to 1
    switch (shape) {
        case 'square':
            return norm < 0.5 ? 1 : -1;
        case 'triangle':
            return norm < 0.5 ? (norm * 4 - 1) : (3 - norm * 4);
        case 'sawtooth':
            return norm * 2 - 1;
        case 'sine':
        default:
            return Math.sin(t * Math.PI * 2);
    }
}
