import { loadSceneConfig } from '../config/loadSceneConfig';
import { RevealConfig, SceneConfig } from '../config/schema';
import { REVEAL_CONFIG_DEFAULTS, SplatHandle, SplatRenderer } from '../renderers/types';
import { SplatRevealController } from './SplatRevealController';
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
  private activeHandles: SplatHandle[] = [];
  private readonly revealController = new SplatRevealController();

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

    if (this.activeHandles.length > 0) {
      this.events.onLoading('Dissolving current scene...');
      const previousReveal = this.activeConfig?.reveal ?? REVEAL_CONFIG_DEFAULTS;
      await Promise.all(
        this.activeHandles.map((handle) =>
          this.revealController.revealOut(handle, handle.boundsY, previousReveal),
        ),
      );
    }

    this.events.onLoading('Loading splat assets...');
    try {
      await this.renderer.clear();
      const handles = await this.renderer.loadSplats(config.assets);
      this.activeHandles = handles;

      await this.prepareRevealStart(handles, config.reveal);
      await Promise.all(
        handles.map((handle) => this.revealController.revealIn(handle, handle.boundsY, config.reveal)),
      );
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
    this.activeHandles = [];
    await this.renderer.dispose();
  }

  private async prepareRevealStart(handles: SplatHandle[], reveal: RevealConfig): Promise<void> {
    for (const handle of handles) {
      const minY = handle.boundsY.minY + reveal.startPadding;
      handle.setRevealBounds(handle.boundsY);
      handle.setRevealParams({
        enabled: reveal.enabled,
        revealY: minY,
        band: reveal.band,
        affectAlpha: reveal.affectAlpha,
        affectSize: reveal.affectSize,
      });
    }
  }
}
