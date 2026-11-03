import { Tile } from './formats';

export function cloneTile(tile: Tile | null): Tile | null {
  if (!tile) return null;
  return {
    ...tile,
    header: {
      ...tile.header,
      radar_colors: [...tile.header.radar_colors]
    },
    data: new Uint8Array(tile.data),
    zData: tile.zData ? new Uint8Array(tile.zData) : null,
    extraImageData: tile.extraImageData ? new Uint8Array(tile.extraImageData) : null,
    extraZData: tile.extraZData ? new Uint8Array(tile.extraZData) : null,
    damagedData: tile.damagedData ? new Uint8Array(tile.damagedData) : null,
  };
}

export function cloneTilesArray(tiles: (Tile | null)[]): (Tile | null)[] {
  return tiles.map(cloneTile);
}
