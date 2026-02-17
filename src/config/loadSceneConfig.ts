import { SceneConfig, validateSceneConfig } from './schema';

export class SceneConfigError extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
    this.name = 'SceneConfigError';
  }
}

export async function loadSceneConfig(sceneId: string): Promise<SceneConfig> {
  const url = `${import.meta.env.BASE_URL}scenes/${sceneId}/scene.json`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new SceneConfigError(`Failed to fetch "${url}". Check your network and static asset path.`);
  }

  if (!response.ok) {
    throw new SceneConfigError(
      `Scene config not found: "${url}" (${response.status} ${response.statusText}).`,
    );
  }

  let raw: unknown;
  try {
    raw = (await response.json()) as unknown;
  } catch {
    throw new SceneConfigError(`Scene config at "${url}" is not valid JSON.`);
  }

  const validation = validateSceneConfig(raw);
  if (!validation.ok) {
    throw new SceneConfigError(`Scene config validation failed for "${url}".`, validation.errors);
  }

  return normalizeAssetPaths(validation.data);
}

function normalizeAssetPaths(config: SceneConfig): SceneConfig {
  const normalizedAssets = config.assets.map((asset) => ({
    ...asset,
    src: resolveAssetPath(asset.src),
  }));

  return {
    ...config,
    assets: normalizedAssets,
  };
}

function resolveAssetPath(path: string): string {
  if (isExternalPath(path)) {
    return path;
  }

  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

function isExternalPath(path: string): boolean {
  return /^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:');
}
