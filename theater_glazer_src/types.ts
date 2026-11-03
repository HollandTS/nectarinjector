import { TmpFile } from './lib/formats';
import { ShpFile } from './lib/shp';

export interface LoadedFile {
  name: string;
  content: TmpFile | ShpFile;
  fileType: 'TMP' | 'SHP';
}

export interface PlacedElement {
  id: string;
  fileName: string;
  fileType: 'TMP' | 'SHP';
  content: TmpFile | ShpFile | null;
  gx: number;
  gy: number;
  width: number;
  height: number;
}
