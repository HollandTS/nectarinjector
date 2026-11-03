export type ZToolMode = 'inspect' | 'brush' | 'column' | 'fill-standard' | 'clamp';

export type ZDisplayMode = 'heatmap' | 'grayscale' | 'overlay';

export type ZViewScope = 'single' | 'complete';

export type ZTargetLayer = 'base' | 'extra';

export interface ZValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  count?: number;
}

export interface ZValidationReport {
  minZ: number;
  maxZ: number;
  expectedMaxZ: number;
  totalPixels: number;
  transparentPixelsWithZ: number;
  discontinuousColumns: number;
  issues: ZValidationIssue[];
}
