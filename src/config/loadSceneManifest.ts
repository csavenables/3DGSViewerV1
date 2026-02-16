export interface SceneManifestEntry {
  id: string;
  title: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function loadSceneManifest(): Promise<SceneManifestEntry[]> {
  let response: Response;
  try {
    response = await fetch('/scenes/manifest.json');
  } catch {
    return [];
  }
  if (!response.ok) {
    return [];
  }

  const raw = (await response.json()) as unknown;
  if (!isObject(raw) || !Array.isArray(raw.scenes)) {
    return [];
  }

  const scenes: SceneManifestEntry[] = [];
  for (const scene of raw.scenes) {
    if (!isObject(scene)) {
      continue;
    }
    if (typeof scene.id !== 'string' || typeof scene.title !== 'string') {
      continue;
    }
    scenes.push({ id: scene.id, title: scene.title });
  }
  return scenes;
}
