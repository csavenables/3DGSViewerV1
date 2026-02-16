import { loadSceneConfig } from '../config/loadSceneConfig';
import { SceneConfig } from '../config/schema';
import { SplatRenderer } from '../renderers/types';
import { Transitions } from './Transitions';

export interface SceneManagerEvents {
  onLoading(message: string): void;
  onReady(config: SceneConfig): void;
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
    const config = await loadSceneConfig(sceneId);

    this.transitions.setColor(config.transitions.fadeColour ?? '#000000');
    await this.transitions.fadeOut(config.transitions.sceneFadeMs);

    this.events.onLoading('Loading splat assets...');
    await this.renderer.clear();
    for (const asset of config.assets) {
      await this.renderer.loadSplat(asset);
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
