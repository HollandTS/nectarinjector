export interface BrushPreset {
  id: string;
  name: string;
  path: string;
}

function formatBrushName(rawName: string): string {
  let name = rawName.replace(/[_-]+/g, ' ').trim();
  name = name.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  return name
    .split(' ')
    .map(word => {
      if (word.toUpperCase() === word && word.length > 2) {
        // e.g. GRUNGE -> Grunge
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const brushModules: Record<string, string> = import.meta.glob<string>(
  [
    '../BRUSHES/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}',
    '/BRUSHES/*.{png,PNG,jpg,JPG,jpeg,JPEG,bmp,BMP,webp,WEBP,gif,GIF,svg,SVG}'
  ],
  { eager: true, import: 'default' }
);

function generatePresets(): BrushPreset[] {
  const map = new Map<string, BrushPreset>();

  for (const [pathKey, assetUrl] of Object.entries(brushModules)) {
    const filename = pathKey.split('/').pop() || '';
    const id = filename.replace(/\.[^/.]+$/, '');
    if (!id || map.has(id)) continue;

    map.set(id, {
      id,
      name: formatBrushName(id),
      path: typeof assetUrl === 'string' ? assetUrl : `/BRUSHES/${filename}`
    });
  }

  // Sort alphabetically by name
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const PRESET_BRUSHES: BrushPreset[] = generatePresets();
