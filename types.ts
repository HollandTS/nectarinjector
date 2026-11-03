
export interface CanvasImage {
  id: string;
  src: string;
  originalSrc: string;
  name: string;
  gridX: number; // Logical Grid X
  gridY: number; // Logical Grid Y
  offsetX: number; // Pixel Nudge X
  offsetY: number; // Pixel Nudge Y
  width: number;
  height: number;
  flipH?: boolean;
  flipV?: boolean;
  visualBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tmpBuffer?: ArrayBuffer; // Store original Westwood tmp buffer for palette swapping
  tmpMinX?: number; // Logical pixel offset of top-left relative to local origin tile
  tmpMinY?: number; // Logical pixel offset of top-left relative to local origin tile
  tmpCols?: number; // True TMP block column count (cblocks_x)
  tmpRows?: number; // True TMP block row count (cblocks_y)
  tmpCells?: { col: number; row: number; height: number; rampType: number }[]; // Active sub-tile cell footprints
  heightLevel?: number; // Fake height level (in half-cell height steps, e.g. 12px TS / 15px RA2) for aligning with slopes/ramps
  isIsotile?: boolean;
  renderMode?: 'pixel' | 'smooth' | 'crisp';
  stackOrder?: number;
  sceneGroupId?: string;
  sceneGroupName?: string;
  sceneGroupMoveTogether?: boolean;
}

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type GridType = 'none' | 'ts_full' | 'ra2_full' | 'opents_full';
export type ActiveGridType = 'ts_full' | 'ra2_full' | 'opents_full';

export interface GridConfig {
  width: number;
  height: number;
}

export interface ThreeDTextureSettings {
  sharpness: number;
  scale: number;
  contrast: number;
  brightness: number;
  hue: number;
  saturation: number;
  metallic: number;
  roughness: number;
  magFilter: 'nearest' | 'linear';
  minFilter: 'nearest' | 'linear';
  anisotropy: number;
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  normalScale?: number;
}

export interface ThreeDShadowSettings {
  enabled: boolean;
  targetLayerId?: string;
  opacity: number;
  blur: number;
  color?: string;
  offsetY: number;
  offsetX: number;
  offsetZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
}

export interface ColorHeightRule {
  id: string;
  label?: string;
  targetColor: { r: number; g: number; b: number };
  tolerance: number;    // 1 to 100, default 28 (color similarity radius)
  softness: number;     // 0 to 50, default 15 (smooth feathering at color edge)
  heightOffset: number; // -100 to 100, default +65 (+ = raise color UP, - = carve color DOWN)
  bladeNoise: number;   // 0 to 100, default 35 (grass/foliage blade spikes inside matched color)
  enabled: boolean;
}

export interface ThreeDDisplacementSettings {
  enabled: boolean;
  scale: number;        // -20 to 20, default 2.5 (Y height multiplier)
  bias: number;         // -10 to 10, default 0 (vertical offset)
  invert: boolean;      // invert light/dark height
  contrast: number;     // 0 to 300, default 100
  brightness: number;   // -100 to 100, default 0
  blur: number;         // 0 to 16, default 1 (smoothing radius)
  blackPoint: number;   // 0 to 100, default 0 (clamp floor)
  whitePoint: number;   // 0 to 100, default 100 (clamp ceiling)
  terracing: number;    // 0 to 32, default 0 (0 = smooth, >0 = stepped levels)
  subdivisions: number; // 16 to 256, default 96 (mesh grid resolution for planes)
  // Selective Color-Targeted Height Sculpting (e.g., Raise Green Grass / Carve Dark Gaps)
  colorHeightRules?: ColorHeightRule[];
  colorBaseMix?: number; // 0 to 100, default 100 (0 = Pure Color Rules only, 100 = Greyscale + Color Rules)
  // Random Terrain Deformation
  terrainEnabled: boolean;
  terrainAmplitude: number;  // 0 to 15, default 2.0
  terrainFrequency: number;  // 0.2 to 12, default 2.5
  terrainRoughness: number;  // 0 to 1, default 0.5 (fractal octaves persistence)
  terrainSeed: number;       // random seed integer
  terrainRidgeMode: boolean; // false = smooth hills, true = sharp ridges/craters
  edgeFalloff: number;       // 0 to 100, default 0 (keep plane borders flat at 0)
  // Seamless 1x1 Tile-Lock & Normal Wrap for Diamond Game Tiles
  tileLockEnabled?: boolean; // lock height, subdivisions, and terrain noise to 1x1 tile grid
  tileNormalWrap?: boolean;  // wrap vertex normals and PBR Sobel across tile borders
  tileSeamBlend?: number;    // 0 to 100, default 35 (blend height at 1x1 tile boundaries)
  tileCountX?: number;       // number of horizontal tiles spanned by the plane
  tileCountZ?: number;       // number of vertical tiles spanned by the plane
  // Connected Mesh / Spatial Seam Welding (prevents GLB faces from separating along hard edges)
  weldVertices?: boolean;    // default true (locks shared vertices at seams so faces never crack apart)
  weldTolerance?: number;    // 0 to 100%, default 35 (spatial snap tolerance for closing small modeling gaps)
}

export interface ThreeDCliffShapingSettings {
  enabled: boolean;
  // Angle / Slope Detection (Flat Top vs Steep Cliff Wall)
  slopeThreshold: number;       // 5 to 85 degrees, default 42 (angles steeper than this become cliff wall)
  slopeFeather: number;         // 0 to 50 degrees, default 14 (smooth transition width)
  invertSlopeMask?: boolean;    // optional invert
  // Top Ground / Plateau Rim Transition (Blends cliff wall into the top flat ground)
  topGroundTransition: number;  // 0 to 80%, default 0 (how far down from the top plateau the top ground blends into the cliff wall)
  topGroundFeather: number;     // 1 to 60%, default 18 (softness of the top ground transition zone)
  topGroundDrop: number;        // -50 to 50%, default 0 (shifts the start of the top ground rim up or down)
  topGroundNoise: number;       // 0 to 100%, default 35 (organic rocky/dirt edge breakup along the top lip)
  topGroundBevel: number;       // 0 to 100%, default 25 (smooths mesh normals & rounds the sharp 90° top lip corner)
  // Secondary Texture & PBR Maps for Vertical Cliff Faces
  dualTextureEnabled: boolean;
  wallTextureUrl?: string;      // Diffuse / Albedo map for steep cliff walls
  wallOverlayId?: string;       // Optional active 2D Layer / Linked Group ID for cliff walls
  wallNormalMapUrl?: string;    // Normal map for steep cliff walls
  wallRoughnessMapUrl?: string; // Roughness map for steep cliff walls
  wallDepthMapUrl?: string;     // Depth / Height map for steep cliff walls
  wallCoverageBoost?: number;   // 0 to 100%, default 35 (guarantees strong cliff wall texture visibility on steep faces)
  wallTriplanar: boolean;       // Box/Triplanar UV projection on vertical faces so textures never stretch
  wallScale: number;            // 0.1 to 10, default 1.0 (UV repeat multiplier)
  wallRepeatX: number;          // 0.1 to 10, default 1.0
  wallRepeatY: number;          // 0.1 to 10, default 1.0
  wallOffsetX: number;          // -2 to 2, default 0
  wallOffsetY: number;          // -2 to 2, default 0
  wallBrightness: number;       // 0 to 200, default 100
  wallContrast: number;         // 0 to 200, default 100
  wallSaturation: number;       // 0 to 200, default 100
  wallHue: number;              // -180 to 180, default 0
  wallRoughness: number;        // 0 to 1, default 0.85
  wallNormalScale: number;      // 0 to 3, default 1.2
  // Height-Based Cliff Wall Emerge & Dissolve (Controls how much Cliff Rock/PBR emerges from Main Texture without mesh deformation)
  wallMixAmount?: number;       // 0 to 100%, default 100 (overall opacity/coverage of cliff wall material)
  wallHeightDissolve?: number;  // 0 to 100%, default 75 (uses Wall Height/Luminance so high rocks emerge first through dirt)
  wallHeightThreshold?: number; // 0 to 100%, default 65 (how much rock comes out: 0% = main dirt, 50% = rock peaks, 100% = full cliff rock)
  wallHeightSharpness?: number; // 0 to 100%, default 65 (0% = soft dissolve, 100% = crisp rock-to-dirt edge)
  wallHeightInvert?: boolean;   // invert height mask (e.g. if dark pixels should emerge first)
  wallBumpStrength?: number;    // 0 to 3, default 1.3 (extra shader bump derived from Wall Height/Depth map)
  // Angle-Aware Mesh Subdivision & PBR Depth Displacement
  subdivideLevel: number;       // 0 = Original GLB, 1 = 4x tris, 2 = 16x tris, 3 = 64x tris
  wallDepthScale: number;       // -10 to 10, default 0.0 (extrudes steep cliff wall along normal using wallDepthMap / wall texture)
  wallDepthContrast: number;    // 0 to 300, default 120
  wallDepthBlur: number;        // 0 to 12, default 1
  wallDepthInvert: boolean;     // invert light/dark on wall depth
  flatTopDepthScale: number;    // -10 to 10, default 0.0 (vertical Y height multiplier on flat plateau tops)
  // Cliff Wall Normal-Push & Procedural Rock Strata / Crag Sculpting
  wallNormalPush: number;       // -8 to 8, default 0 (uniform outward/inward push on steep faces)
  strataEnabled: boolean;       // horizontal sedimentary rock layers / ledges
  strataAmplitude: number;      // -6 to 6, default 1.2
  strataFrequency: number;      // 0.5 to 20, default 5.0
  strataSharpness: number;      // 0 to 100, default 55 (stepped terrace ledges vs sine waves)
  strataTilt: number;           // -45 to 45 degrees, default 0 (tilted geological bedding planes)
  cragEnabled: boolean;         // vertical rock crevices, fissures & jagged columns
  cragAmplitude: number;        // -6 to 6, default 1.0
  cragFrequency: number;        // 0.5 to 16, default 3.5
  cragSharpness: number;        // 0 to 100, default 60 (sharp ridge fractures vs smooth undulations)
  overhangAmount: number;       // -6 to 6, default 0 (pushes upper cliff lip outward)
  talusSkirtAmount: number;     // -6 to 6, default 0 (flares bottom cliff base outward)
  pinBottomEdge: number;        // 0 to 100, default 25 (pins very bottom/border vertices so tile connections stay clean)
  cliffSeed: number;            // deterministic random seed for rock crags/strata
  // Connected Mesh / Spatial Seam Welding
  weldVertices?: boolean;       // default true (keeps cliff faces & top rim connected without tearing)
  weldTolerance?: number;       // 0 to 100%, default 35 (spatial snap tolerance)
}

export interface ThreeDSlopeShapingSettings {
  enabled: boolean;
  // Angle / Ramp Band Detection (targets inclined ramp faces between minAngle and maxAngle)
  minAngle: number;              // 2 to 75 degrees, default 8 (ignore completely flat ground below this angle)
  maxAngle: number;              // 10 to 88 degrees, default 55 (ignore vertical cliffs above this angle)
  feather: number;               // 1 to 40 degrees, default 12 (smooth transition width into flat ground & cliffs)
  invertMask?: boolean;          // optional invert
  // Top & Bottom Ramp Transition (Crest & Toe Blending)
  crestTransition: number;       // 0 to 70%, default 18 (blends upper ramp crest smoothly into flat top plateau)
  toeTransition: number;         // 0 to 70%, default 18 (blends lower ramp toe smoothly into bottom flat ground)
  transitionFeather: number;     // 1 to 50%, default 20 (softness of crest & toe transitions)
  transitionNoise: number;       // 0 to 100%, default 30 (organic dirt/erosion breakup at ramp borders)
  crestBevel: number;            // 0 to 100%, default 25 (rounds the upper & lower ramp transition corners)
  // Secondary Slope Material (Ramp Texture & PBR Maps)
  dualTextureEnabled: boolean;
  slopeTextureUrl?: string;      // Diffuse / Albedo map for ramp slopes
  slopeOverlayId?: string;       // Optional active 2D Layer / Linked Group ID for ramp slopes
  slopeNormalMapUrl?: string;    // Normal map for ramp slopes
  slopeRoughnessMapUrl?: string; // Roughness map for ramp slopes
  slopeDepthMapUrl?: string;     // Depth / Height map for ramp slopes
  slopeTriplanar: boolean;       // Planar / Triplanar projection so diagonal slopes never stretch
  slopeScale: number;            // 0.1 to 10, default 1.0
  slopeRepeatX: number;          // 0.1 to 10, default 1.0
  slopeRepeatY: number;          // 0.1 to 10, default 1.0
  slopeOffsetX: number;          // -2 to 2, default 0
  slopeOffsetY: number;          // -2 to 2, default 0
  slopeBrightness: number;       // 0 to 200, default 100
  slopeContrast: number;         // 0 to 200, default 100
  slopeSaturation: number;       // 0 to 200, default 100
  slopeHue: number;              // -180 to 180, default 0
  slopeRoughness: number;        // 0 to 1, default 0.85
  slopeNormalScale: number;      // 0 to 3, default 1.15
  // Height-Based Emerge & Dissolve (Controls how much Slope Rock/PBR emerges from Main Dirt Texture without mesh deformation)
  slopeMixAmount?: number;       // 0 to 100%, default 100 (overall opacity/coverage of slope material on slopes)
  slopeHeightDissolve?: number;  // 0 to 100%, default 75 (uses Slope Height/Luminance so high rocks emerge first through dirt)
  slopeHeightThreshold?: number; // 0 to 100%, default 55 (how much rock comes out: 0% = no rock, 50% = peaks, 100% = full rock)
  slopeHeightSharpness?: number; // 0 to 100%, default 65 (0% = soft dissolve, 100% = crisp rock-to-dirt edge)
  slopeHeightInvert?: boolean;   // invert height mask (e.g. if dark pixels should emerge first)
  slopeBumpStrength?: number;    // 0 to 3, default 1.2 (extra shader bump derived from Slope Height/Depth map)
  // Main Texture Displacement on Slopes Only
  mainSlopeDisplacementEnabled?: boolean; // displaces the main object texture/heightmap strictly on the slope angle band
  mainSlopeDepthScale?: number;           // -10 to 10, default 1.5
  mainSlopeDepthBias?: number;            // -5 to 5, default 0
  mainSlopeDepthContrast?: number;        // 0 to 300, default 120
  mainSlopeDepthBlur?: number;            // 0 to 12, default 1
  mainSlopeDepthInvert?: boolean;         // default false
  mainSlopeDisplacementMode?: 'normal' | 'vertical'; // 'normal' (along slope surface normal) or 'vertical' (Y-axis elevation)
  mainSlopeTriplanar?: boolean;           // sample main texture in planar/triplanar space vs mesh UV
  // Slope Mesh Subdivision, Profile Curvature & PBR Depth
  subdivideLevel: number;        // 0 = Original GLB, 1 = 4x tris, 2 = 16x tris, 3 = 64x tris
  slopeNormalPush: number;       // -6 to 6, default 0 (uniform outward/inward push on inclined ramp faces)
  slopeCurvature: number;        // -6 to 6, default 0 (negative = concave scoop/saga ramp, positive = convex rounded hill)
  slopeDepthScale: number;       // -8 to 8, default 1.2 (displaces ramp surface using slope depth/texture)
  slopeDepthContrast: number;    // 0 to 300, default 115
  slopeDepthBlur: number;        // 0 to 12, default 1
  slopeDepthInvert: boolean;
  // Slope Dips, Gullies & Erosion Ruts (Mesh Depressions)
  dipsEnabled: boolean;          // carves natural terrain dips, hollows & worn ramp ruts
  dipAmplitude: number;          // 0 to 8, default 1.6 (depth of carved dips & hollows)
  dipFrequency: number;          // 0.5 to 16, default 3.2 (scale/spacing of dips across the slope)
  dipSharpness: number;          // 0 to 100, default 45 (smooth bowl hollows vs steeper gully ruts)
  gullyRunoff: number;           // 0 to 100, default 40 (stretches dips downhill along the ramp direction like erosion ruts)
  pinEdges: number;              // 0 to 100, default 30 (locks outer tile/ramp connection edges so adjacent slope tiles stitch cleanly)
  //Connected Mesh / Spatial Seam Welding
  weldVertices?: boolean;        // default true (keeps ramp faces connected without cracking apart)
  weldTolerance?: number;        // 0 to 100%, default 35 (spatial snap tolerance)
  // Darker Spots, Hollow Shading & Moisture Patches (Shader Color & Roughness)
  darkSpotsEnabled: boolean;     // adds organic darker dirt/moisture spots & darkens carved dips
  dipDarkening: number;          // 0 to 100%, default 45 (automatically darkens recessed dips, gullies & concave hollows)
  spotIntensity: number;         // 0 to 100%, default 35 (strength of procedural darker soil/rock patches on slopes)
  spotScale: number;             // 0.5 to 20, default 4.5 (size/frequency of darker patches)
  spotContrast: number;          // 0 to 100%, default 50 (soft mottling vs distinct dark patches)
  spotCoverage: number;          // 0 to 100%, default 48 (how much of the slope gets dark spots)
  spotTint: string;              // hex color for dark spots/dips, default '#1f1914' (rich dark earth/shadow)
  spotWetness: number;           // -100 to 100%, default 20 (adjusts roughness in dark spots/dips: positive = damp/glossy, negative = dry/matte)
  slopeSeed: number;             // deterministic seed for dips & dark spots
}

export interface ThreeDSubdivisionSettings {
  level: number;                 // 0 to 4, default 0
  mode: 'flat' | 'smooth';       // default 'flat'
  smoothStrength: number;        // 0 to 100%, default 65
  creaseAngle: number;           // 15 to 180 degrees, default 60
  bakeVersion?: number;          // incremented when baking current subdivision into base mesh
  bakedBaseTriangles?: number;   // optional telemetry of baked base triangles
  bakedBaseVertices?: number;    // optional telemetry of baked base vertices
}

export interface ThreeDTransitionPairSettings {
  enabled: boolean;
  thickness: number;             // 1 to 100%, default 28 (width of boundary transition zone)
  softness: number;              // 0 to 100%, default 45 (edge feathering of transition band)
  mixBias: number;               // -100 to 100%, default 0 (shift balance toward Texture A or B)
  brightness: number;            // 0 to 250%, default 92 (border brightness multiplier)
  contrast: number;              // 0 to 250%, default 110 (border contrast)
  tintColor: string;             // hex color for border blend/stroke, default '#3b3026'
  tintMix: number;               // 0 to 100%, default 25 (how strongly tintColor mixes into boundary)
  strokeStrength: number;        // 0 to 100%, default 35 (distinct border stroke line intensity)
  strokeCount: number;           // 1 to 8, default 1 (number of parallel contour stroke lines)
  strokeSharpness: number;       // 0 to 100%, default 55 (crispness of stroke lines)
  noiseBreakup: number;          // 0 to 100%, default 35 (organic breakup along the transition seam)
  noiseScale: number;            // 0.5 to 25, default 6.0 (frequency of organic seam breakup)
}

export interface ThreeDMaterialTransitionSettings {
  mainCliff: ThreeDTransitionPairSettings;
  mainSlope: ThreeDTransitionPairSettings;
  cliffSlope: ThreeDTransitionPairSettings;
}

export interface ThreeDSurfaceScatterItem {
  id: string;
  name: string;
  glbUrl: string;
  enabled: boolean;
  weight: number;          // 1 to 100, default 100
  scaleMultiplier: number; // 0.1 to 5, default 1.0
  yOffset: number;         // -5 to 5, default 0
  textureUrl?: string;     // Custom texture override for this scattered item
  hueShift?: number;       // -180 to 180, default 0
  brightness?: number;     // 0 to 200, default 100
  contrast?: number;       // 0 to 200, default 100
  saturation?: number;     // 0 to 200, default 100
}

export interface ThreeDSurfaceScatterSettings {
  enabled: boolean;
  items: ThreeDSurfaceScatterItem[];
  // Placement Mode & Amount
  distributionMode: 'random' | 'grid_jitter' | 'clumped'; // default 'grid_jitter'
  amount: number;              // 1 to 2500, default 180
  density: number;             // 0 to 200%, default 100
  seed: number;                // default 42
  // Clumping / Patchiness
  clumpStrength: number;       // 0 to 100%, default 35
  clumpScale: number;          // 0.5 to 20, default 4.0
  minSpacing: number;          // 0 to 100%, default 15
  edgeMargin: number;          // -50 to 80%, default 5
  // Top Surface Filtering
  minSlopeAngle: number;       // 0 to 90 deg, default 0
  maxSlopeAngle: number;       // 0 to 90 deg, default 40
  minHeightPct: number;        // 0 to 100%, default 0
  maxHeightPct: number;        // 0 to 100%, default 100
  // Scale Controls
  baseScale: number;           // 0.05 to 5.0, default 0.55
  randomScaleMin: number;      // 10 to 200%, default 75
  randomScaleMax: number;      // 10 to 300%, default 135
  scaleX: number;              // 0.1 to 3.0, default 1.0
  scaleY: number;              // 0.1 to 3.0, default 1.0
  scaleZ: number;              // 0.1 to 3.0, default 1.0
  // Rotation & Alignment
  randomRotationY: number;     // 0 to 360 deg, default 360
  randomTiltXZ: number;        // 0 to 60 deg, default 8
  baseRotationY: number;       // -180 to 180 deg, default 0
  alignToNormal: number;       // 0 to 100%, default 35
  sinkOffset: number;          // -2.0 to 2.0, default -0.04
  // Color & Visual Variation
  colorVariation: number;      // 0 to 100%, default 18
  brightnessVariation: number; // 0 to 100%, default 15
  tintColor: string;           // default '#ffffff'
  tintStrength: number;        // 0 to 100%, default 0
  hideBaseMesh?: boolean;      // default false
  holdoutMask?: boolean;       // default false: when hideBaseMesh is checked, hidden base mesh still masks (occludes) scattered objects
}

export interface ThreeDObject {
  id: string;
  glbUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  textureUrl?: string; // Diffuse / Albedo map
  normalMapUrl?: string; // Normal map
  metallicMapUrl?: string; // Metallic map
  roughnessMapUrl?: string; // Roughness map
  displacementMapUrl?: string; // Generated or loaded grayscale height/displacement map
  displacementSettings?: ThreeDDisplacementSettings;
  subdivisionSettings?: ThreeDSubdivisionSettings;
  pbrGeneratorSettings?: Record<string, any>;
  cavityHeightGeneratorSettings?: Record<string, any>;
  cliffCavityHeightSettings?: Record<string, any>;
  slopeCavityHeightSettings?: Record<string, any>;
  cliffShapingSettings?: ThreeDCliffShapingSettings;
  slopeShapingSettings?: ThreeDSlopeShapingSettings;
  transitionSettings?: ThreeDMaterialTransitionSettings;
  surfaceScatterSettings?: ThreeDSurfaceScatterSettings;
  textureOverlayId?: string;
  textureSettings?: ThreeDTextureSettings;
  shadowSettings?: ThreeDShadowSettings;
  uvMapping?: 'default' | 'smart';
  paletteViewer?: boolean;
  opacity?: number; // 0 to 100, default 100
  stackOrder?: number;
  sceneGroupId?: string;
  sceneGroupName?: string;
  sceneGroupMoveTogether?: boolean;
  name: string;
}

export type ToolMode = 'SELECT' | 'EYEDROPPER' | 'ERASER' | 'PAINT' | '3D' | 'TRANSITION_STAMP' | 'HAND_BRUSH';

export type BrushResizeSampling =
  | 'nearest'
  | 'bilinear'
  | 'bicubic'
  | 'lanczos'
  | 'pixel_art';

export interface BrushHistoryTileSnapshot {
  tileId: string;
  tileName: string;
  beforeSrc: string;
  afterSrc: string;
}

export interface BrushHistoryEntry {
  id: string;
  timestamp: number;
  brushName: string;
  brushThumbSrc: string;
  mode: 'transparency' | 'coloring' | 'normal';
  tileSnapshots: BrushHistoryTileSnapshot[];
}

export interface LoadedShpBrushItem {
  id: string;
  fileName: string;
  buffer: ArrayBuffer;
  frameIndex: number;
  totalFrames: number;
  normalFrameCount: number;
  hasShadowHalf: boolean;
  brushSrc: string;
  shadowSrc: string | null;
  customPalette: Array<{ r: number; g: number; b: number }> | null;
  customPaletteName: string | null;
}

export interface HandBrushSettings {
  brushSrc: string;
  brushName: string;
  mode: 'transparency' | 'coloring' | 'normal';
  footprint: number;    // size/footprint over tiles (1 to 20, default 1)
  mainScale: number;    // brush stamp scale (10 to 500, default 100)
  canvasZoom: number;   // internal crop/zoom (50 to 800, default 100)
  rotation: number;     // 0 to 360, default 0
  strength: number;     // hardness/strength (0 to 200, default 100)
  mirrorH: boolean;     // horizontal mirror
  mirrorV: boolean;     // vertical mirror
  shuffleMode: TiledBrushShuffleMode;
  randomizeRotation: boolean; // randomize rotation on each press
  invert: boolean;      // invert white with black for brush
  tilingMode: 'tiled' | 'untransformed'; // transform to isometric diamond vs untransformed flat
  resizeSampling?: BrushResizeSampling; // resize/downscale sampling algorithm
  // Coloring mode sliders
  hue: number;          // -180 to 180, default 0
  contrast: number;     // 0 to 200, default 100
  brightness: number;   // 0 to 200, default 100
  saturation: number;   // 0 to 200, default 100
  // Normal mode coloring sliders (collapsible)
  normalHue?: number;          // -180 to 180, default 0
  normalSaturation?: number;   // 0 to 200, default 100
  normalBrightness?: number;   // 0 to 200, default 100
  normalTransparency?: number; // 0 to 100, default 0
  // Auto-bake underneath
  autoBakeUnderneath: boolean;
  // Selection & Viewport Polish Options
  onlySelectedTiles?: boolean; // default false: brush works on all tiles unless checked
  showSelectionBox?: boolean;  // default false: hides cyan tile selection outlines while brushing
  // SHP Sprite Brush & Shadow Options
  isShpBrush?: boolean;
  shpBuffer?: ArrayBuffer | null;
  shpFileName?: string;
  shpFrameIndex?: number;      // 0-based index of the active normal frame
  shpTotalFrames?: number;     // total frames in the SHP archive
  shpNormalFrameCount?: number;// number of normal frames (usually total / 2 when shadow half is present)
  shpHasShadowHalf?: boolean;  // whether the second half of frames are shadow frames
  shpShadowSrc?: string | null;// rendered shadow mask data URL
  shpShadowEnabled?: boolean;  // default true: apply shadow frame darkening onto tile
  shpShadowDarkness?: number;  // 0 to 100, default 55 (% darkening where shadow hits tile)
  shpShadowSoftness?: number;  // 0 to 10, default 0 (optional feathering of shadow edge)
  shpShadowOffsetX?: number;   // -64 to 64, default 0
  shpShadowOffsetY?: number;   // -64 to 64, default 0
  shpShadowBlendPalIndex1?: number; // 0 to 100, default 25 (tint with palette index #1 color)
  shpCustomPalette?: Array<{ r: number; g: number; b: number }> | null;
  shpCustomPaletteName?: string | null;
  // Remembered SHP Library & Multi-Select Rotation / Random-Pick
  loadedShpItems?: LoadedShpBrushItem[];
  activeShpId?: string | null;
  selectedShpIds?: string[];    // IDs of SHPs checked for multi-SHP rotation / random-pick
  shpRandomPick?: boolean;      // when enabled, rotates/picks from selectedShpIds on each brush press
}

export interface MaskGroup {
  id: string;
  colors: RgbaColor[];
  tolerance: number;
  threeDElevation?: number; // 0 to 100: height-based border overhang when injecting a 3D object
  isExcludedFromAutoDivide?: boolean;
  isExcludedFromDepth?: boolean;
}

export type OverlayLayer = 'front' | 'back';

export type OverlayType = 'smart' | 'tiled';

export type TileType = 'flat' | 'slope_se' | 'slope_sw';

export type ShuffleMode = 'default' | 'none' | 'mirror_h' | 'mirror_v' | 'mirror_both';

export type JitterType = 'none' | 'noise' | 'pixel' | 'stamp' | 'offset' | 'edge';

export type JitterShape = 'circle' | 'square' | 'custom' | 'draw';

export type JitterWaveShape = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface ContourSettings {
  thickness: number;
  feather: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  targetColor: RgbaColor | null;
  tolerance: number;
  invert: boolean;
  maskGroups: MaskGroup[];
  activeMaskGroupId: string | null;
}

export interface MaskEntry {
  color: RgbaColor;
  tolerance: number;
}

export interface ColorSwap {
  id: string;
  targetColor: RgbaColor | null;
  replaceColor: RgbaColor | null;
  tolerance: number;
}

export interface AdditionalTexture {
  id?: string;
  src: string;
  weight: number;
  canvasZoom: number;
  filters: Partial<OverlayFilters>;
}

export type TiledBrushMode = 'transparency' | 'normal' | 'coloring';
export type TiledBrushShuffleMode = 'chaos' | 'standard' | 'mirror_h' | 'mirror_v' | 'mirror_both';
export type TiledBrushTilingMode = 'tiled' | 'untiled' | 'untransformed';

export interface TiledBrush {
  id: string;
  name: string;
  src: string;
  mode: TiledBrushMode;
  footprint?: number;   // over how many tiles to scale (e.g. 1 to 20, default 1)
  mainScale?: number;   // brush stamp scale percentage (e.g. 10 to 500, default 100)
  repeatSpread?: number; // legacy property
  spread: number;       // appearance percentage on tiles (0 to 100, default 100)
  canvasZoom?: number;  // internal zoom percentage (e.g. 50 to 800, default 100)
  rotation?: number;    // rotation angle in degrees (0 to 360, default 0)
  scale?: number;       // legacy/fallback property
  randomScale: number;  // random scaling range percentage (0 to 100)
  shuffleMode: TiledBrushShuffleMode;
  tiled?: boolean;      // true: tiled across grid, false: untiled (single stamp across entire area)
  untransformed?: boolean; // true: untransformed 2D stamp, false: isometric transformed
  tilingMode?: TiledBrushTilingMode; // 'tiled' | 'untiled' | 'untransformed' (default 'tiled')
  resizeSampling?: BrushResizeSampling; // resize/downscale sampling method
  invert?: boolean;     // inverts white with black for brush image
  hardness: number;     // penetration hardness (0 to 100, default 100)
  // Coloring mode sliders
  hue?: number;         // -180 to 180, default 0
  contrast?: number;    // 0 to 200, default 100
  brightness?: number;  // 0 to 200, default 100
  saturation?: number;  // 0 to 200, default 100
}

export interface SmartColorSwapSettings {
  targetColor: RgbaColor | null;
  replaceColor: RgbaColor | null;
  tolerance: number;
  hue: number;
  saturation: number;
  brightness: number;
  sharpening: number;
  smoothing: number;
}

export interface SmartColorSwapItem extends SmartColorSwapSettings {
  id: string;
  name?: string;
  enabled: boolean;
}

export interface TileColorSwapItem {
  id: string;
  name?: string;
  enabled: boolean;
  strength: number; // 0 to 100
  selectedTileIds: string[];
  colors: RgbaColor[];
}

export interface DepthFilterSettings {
  enabled: boolean;
  depthOverlayId: string | null;
  brightness: number;
  contrast: number;
  hueShift: number;
  saturationShift: number;
  valueShift: number;
  blendStrength: number;
  // Color specific adjustments
  greyAdjustment: number;
  greenAdjustment: number;
  brownAdjustment: number;
  posterize: number;
  blackLevel: number;
  whiteLevel: number;
  depthTolerance: number;
  invert: boolean;
  luminanceInfluence: number; // 0 to 100
  smartSmoothing: number; // 0 to 100
  slopeCompensation: number; // 0 to 100, for brightness differences in slopes
  colorSmoothness: number; // 0 to 100, for smoother color adjustments
  edgeEnhancement: number; // 0 to 100, for enhancing edges in depth
}

export interface OverlayFilters {
  blur: number;
  sharpen: number;
  masterSharpSmooth: number;
  smartSmoothStrength: number;
  smartSmoothRadius: number;
  smartSmoothTolerance: number;
  sharpenRadius: number;
  sharpenThreshold: number;
  balanceColors?: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  targetColor: RgbaColor | null;
  replaceColor: RgbaColor | null;
  colorTolerance: number;
  colorSwaps: ColorSwap[];
  // Advanced Jitter
  pixelNoise: number; // Strength
  jitterType: JitterType;
  jitterSize: number;
  jitterWidth: number;
  jitterZoom: number;
  jitterCount: number;
  jitterOpacity: number;
  jitterShape: JitterShape;
  jitterRotation: number;
  jitterWaveShape: JitterWaveShape;
  customStampSrc: string | null;
  // Edge Jitter
  edgeJitterAmount?: number;
  edgeJitterThickness?: number;
  edgeJitterMode?: 'pixel' | 'noise' | 'rough' | 'offset';
  edgeJitterTarget?: 'outer' | 'all';
  edgeJitterSize?: number;
  edgeJitterOnly?: boolean;
  edgeJitterRotation?: number;
  edgeJitterWaveShape?: JitterWaveShape;
  edgeJitterFrequency?: number;
  edgeJitterSmoothing?: number;
  edgeJitterColorRangeOnly?: boolean;
  edgeJitterColors?: RgbaColor[];
  edgeJitterColorTolerance?: number;
  // Transforms
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  // Masking & Injection
  maskToColor: boolean;
  maskGroups: MaskGroup[];
  maskOverlayIds: (string | null)[];
  activeMaskGroupId: string | null;
  maskEntries: MaskEntry[]; // Kept for legacy compatibility if needed
  maskGroupTolerance: number; // Global tolerance
  // Tiling
  staticScale: number; // Tile Footprint (Grid Spacing)
  mainScale: number;   // Individual Zoom (Texture Content Size)
  canvasZoom: number;  // Border Cut Zoom (Internal Crop)
  shuffleMode: ShuffleMode;
  shuffleStandard?: boolean;
  shuffleMirrorH?: boolean;
  shuffleMirrorV?: boolean;
  shuffleRotate?: boolean;
  renderMode: 'pixel' | 'smooth' | 'crisp';
  tileType: TileType;
  // Contour Injection
  showContourSettings: boolean;
  contourThickness: number;
  contourFeather: number;
  contourInvert: boolean;
  contourNoise: number;
  transitionOverlayId: string | null;
  transitionGroupAId: string | null;
  transitionGroupBId: string | null;
  // Random Zoom
  zoomRandomness: number;
  scramblePositions: number;
  // Additional Textures
  additionalTextures: AdditionalTexture[];
  // Tiled Brushes
  brushes?: TiledBrush[];
  // Smart Color Swap
  smartColorSwapEnabled: boolean;
  smartColorSwapSettings: SmartColorSwapSettings;
  smartColorSwaps?: SmartColorSwapItem[];
  tileColorSwaps?: TileColorSwapItem[];
  // Depth Injection
  depthSettings: DepthFilterSettings;
  globalMode: boolean;
  injectionStrength: number;
  paletteViewer?: boolean;
}

export interface OriginalColorSettings {
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  targetColor: RgbaColor | null;
  tolerance: number;
}

export interface ProjectOverlay {
  id: string;
  name: string;
  type: OverlayType;
  src: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  repeatX: number; // for tiled
  repeatY: number; // for tiled
  opacity: number;
  isVisible: boolean;
  paletteViewer?: boolean;
  placement: OverlayLayer;
  filters: OverlayFilters;
  isFourInOne?: boolean;
  isResizing?: boolean;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  originalTiledBackup?: {
    type: 'tiled';
    src: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    repeatX: number;
    repeatY: number;
    filters: OverlayFilters;
  };
  linkGroupId?: string;
  linkGroupName?: string;
  stackOrder?: number;
  sceneGroupId?: string;
  sceneGroupName?: string;
  sceneGroupMoveTogether?: boolean;
}

export interface TransitionStamp {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  skewX: number;
  skewY: number;
  falloffEnabled: boolean;
  falloffWidth: number; // 0 to 100
  autoSnap: boolean;
}
