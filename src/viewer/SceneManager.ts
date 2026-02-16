import { loadSceneConfig } from '../config/loadSceneConfig';
import { SceneConfig } from '../config/schema';
import { SplatRenderer } from '../renderers/types';
import { Transitions } from './Transitions';

export interface SceneManagerEvents {
  onLoading(message: string): void;
  onReady(config: SceneConfig): void;
}

export class SceneLoadError extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
    this.name = 'SceneLoadError';
  }
}

export class SceneManager {
  private activeConfig: SceneConfig | null = null;

  constructor(
    private readonly renderer: SplatRenderer,
    private readonly transitions: Transitions,
    private readonly events: SceneManagerEvents,
  ) {}

  get config(): SceneConfig | null {
    return this.activeConfig;
  }

  async loadScene(sceneId: string): Promise<SceneConfig> {
    this.events.onLoading('Loading scene configuration...');
    let config: SceneConfig;
    try {
      config = await loadSceneConfig(sceneId);
    } catch (error) {
      if (error instanceof Error) {
        throw new SceneLoadError(error.message);
      }
      throw new SceneLoadError('Unknown error while loading scene configuration.');
    }

    this.transitions.setColor(config.transitions.fadeColour ?? '#000000');
    await this.transitions.fadeOut(config.transitions.sceneFadeMs);

    this.events.onLoading('Loading splat assets...');
    try {
      await this.renderer.clear();
      await this.renderer.loadSplats(config.assets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while loading splat assets.';
      throw new SceneLoadError('Unable to load scene assets.', [message]);
    }

    this.activeConfig = config;
    this.events.onReady(config);
    await this.transitions.fadeIn(config.transitions.sceneFadeMs);
    return config;
  }

  async dispose(): Promise<void> {
    await this.renderer.dispose();
  }
}
