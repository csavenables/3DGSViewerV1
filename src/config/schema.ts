export type Vec3 = [number, number, number];

export interface SplatTransform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface SplatAssetConfig {
  id: string;
  src: string;
  transform: SplatTransform;
  visibleDefault: boolean;
}

export interface CameraHomeConfig {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export interface CameraLimitsConfig {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export interface UiConfig {
  enableFullscreen: boolean;
  enableAutorotate: boolean;
  enableReset: boolean;
  enablePan: boolean;
  autorotateDefaultOn: boolean;
}

export interface TransitionConfig {
  sceneFadeMs: number;
  fadeColour?: string;
}

export type RevealMode = 'yRamp';
export type RevealEase = 'easeInOut' | 'linear';

export interface RevealConfig {
  enabled: boolean;
  mode: RevealMode;
  durationMs: number;
  band: number;
  ease: RevealEase;
  affectAlpha: boolean;
  affectSize: boolean;
  startPadding: number;
  endPadding: number;
}

export interface SceneConfig {
  id: string;
  title: string;
  assets: SplatAssetConfig[];
  camera: {
    home: CameraHomeConfig;
    limits: CameraLimitsConfig;
    transitionMs: number;
  };
  ui: UiConfig;
  transitions: TransitionConfig;
  reveal: RevealConfig;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(isNumber);
}

function readString(obj: Record<string, unknown>, key: string, errors: string[]): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`"${key}" must be a non-empty string.`);
    return '';
  }
  return value;
}

function readBoolean(obj: Record<string, unknown>, key: string, errors: string[]): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') {
    errors.push(`"${key}" must be a boolean.`);
    return false;
  }
  return value;
}

function readNumber(obj: Record<string, unknown>, key: string, errors: string[]): number {
  const value = obj[key];
  if (!isNumber(value)) {
    errors.push(`"${key}" must be a number.`);
    return 0;
  }
  return value;
}

function readVec3(obj: Record<string, unknown>, key: string, errors: string[]): Vec3 {
  const value = obj[key];
  if (!isVec3(value)) {
    errors.push(`"${key}" must be a numeric 3-tuple.`);
    return [0, 0, 0];
  }
  return value;
}

export function validateSceneConfig(raw: unknown): { ok: true; data: SceneConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(raw)) {
    return { ok: false, errors: ['Scene config must be a JSON object.'] };
  }

  const id = readString(raw, 'id', errors);
  const title = readString(raw, 'title', errors);

  const assetsValue = raw.assets;
  const assets: SplatAssetConfig[] = [];
  if (!Array.isArray(assetsValue)) {
    errors.push('"assets" must be an array.');
  } else {
    if (assetsValue.length > 5) {
      errors.push('MVP limit exceeded: "assets" supports up to 5 splats.');
    }
    for (let index = 0; index < assetsValue.length; index += 1) {
      const item = assetsValue[index];
      if (!isObject(item)) {
        errors.push(`assets[${index}] must be an object.`);
        continue;
      }

      const transformValue = item.transform;
      if (!isObject(transformValue)) {
        errors.push(`assets[${index}].transform must be an object.`);
        continue;
      }

      assets.push({
        id: readString(item, 'id', errors),
        src: readString(item, 'src', errors),
        transform: {
          position: readVec3(transformValue, 'position', errors),
          rotation: readVec3(transformValue, 'rotation', errors),
          scale: readVec3(transformValue, 'scale', errors),
        },
        visibleDefault: readBoolean(item, 'visibleDefault', errors),
      });
    }
  }

  const cameraValue = raw.camera;
  if (!isObject(cameraValue)) {
    errors.push('"camera" must be an object.');
  }

  const cameraObject = isObject(cameraValue) ? cameraValue : {};
  const cameraHomeValue = isObject(cameraObject.home) ? cameraObject.home : null;
  const cameraLimitsValue = isObject(cameraObject.limits) ? cameraObject.limits : null;
  if (!isObject(cameraHomeValue)) {
    errors.push('"camera.home" must be an object.');
  }
  if (!isObject(cameraLimitsValue)) {
    errors.push('"camera.limits" must be an object.');
  }

  const uiValue = raw.ui;
  if (!isObject(uiValue)) {
    errors.push('"ui" must be an object.');
  }
  const uiObject = isObject(uiValue) ? uiValue : {};

  const transitionsValue = raw.transitions;
  if (!isObject(transitionsValue)) {
    errors.push('"transitions" must be an object.');
  }
  const revealValue = raw.reveal;
  if (revealValue !== undefined && !isObject(revealValue)) {
    errors.push('"reveal" must be an object when provided.');
  }
  const transitionsObject = isObject(transitionsValue) ? transitionsValue : {};
  const revealObject = isObject(revealValue) ? revealValue : {};
  const cameraHomeObject = isObject(cameraHomeValue) ? cameraHomeValue : {};
  const cameraLimitsObject = isObject(cameraLimitsValue) ? cameraLimitsValue : {};

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const config: SceneConfig = {
    id,
    title,
    assets,
    camera: {
      home: {
        position: readVec3(cameraHomeObject, 'position', errors),
        target: readVec3(cameraHomeObject, 'target', errors),
        fov: readNumber(cameraHomeObject, 'fov', errors),
      },
      limits: {
        minDistance: readNumber(cameraLimitsObject, 'minDistance', errors),
        maxDistance: readNumber(cameraLimitsObject, 'maxDistance', errors),
        minPolarAngle: readNumber(cameraLimitsObject, 'minPolarAngle', errors),
        maxPolarAngle: readNumber(cameraLimitsObject, 'maxPolarAngle', errors),
      },
      transitionMs: readNumber(cameraObject, 'transitionMs', errors),
    },
    ui: {
      enableFullscreen: readBoolean(uiObject, 'enableFullscreen', errors),
      enableAutorotate: readBoolean(uiObject, 'enableAutorotate', errors),
      enableReset: readBoolean(uiObject, 'enableReset', errors),
      enablePan: readBoolean(uiObject, 'enablePan', errors),
      autorotateDefaultOn: readBoolean(uiObject, 'autorotateDefaultOn', errors),
    },
    transitions: {
      sceneFadeMs: readNumber(transitionsObject, 'sceneFadeMs', errors),
      fadeColour:
        typeof transitionsObject.fadeColour === 'string' ? transitionsObject.fadeColour : undefined,
    },
    reveal: {
      enabled: typeof revealObject.enabled === 'boolean' ? revealObject.enabled : true,
      mode: revealObject.mode === 'yRamp' ? 'yRamp' : 'yRamp',
      durationMs: isNumber(revealObject.durationMs) ? revealObject.durationMs : 2800,
      band: isNumber(revealObject.band) ? revealObject.band : 0.12,
      ease:
        revealObject.ease === 'linear' || revealObject.ease === 'easeInOut'
          ? revealObject.ease
          : 'easeInOut',
      affectAlpha: typeof revealObject.affectAlpha === 'boolean' ? revealObject.affectAlpha : true,
      affectSize: typeof revealObject.affectSize === 'boolean' ? revealObject.affectSize : true,
      startPadding: isNumber(revealObject.startPadding) ? revealObject.startPadding : 0,
      endPadding: isNumber(revealObject.endPadding) ? revealObject.endPadding : 0,
    },
  };

  if (config.camera.limits.maxDistance < config.camera.limits.minDistance) {
    errors.push('"camera.limits.maxDistance" must be >= "camera.limits.minDistance".');
  }

  if (config.camera.limits.maxPolarAngle < config.camera.limits.minPolarAngle) {
    errors.push('"camera.limits.maxPolarAngle" must be >= "camera.limits.minPolarAngle".');
  }

  if (config.reveal.durationMs <= 0) {
    errors.push('"reveal.durationMs" must be > 0.');
  }
  if (config.reveal.band <= 0) {
    errors.push('"reveal.band" must be > 0.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: config };
}
