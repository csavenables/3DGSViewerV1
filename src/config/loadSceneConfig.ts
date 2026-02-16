import { SceneConfig, validateSceneConfig } from './schema';

export class SceneConfigError extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
    this.name = 'SceneConfigError';
  }
}

export async function loadSceneConfig(sceneId: string): Promise<SceneConfig> {
  const url = `/scenes/${sceneId}/scene.json`;

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

  return validation.data;
}
