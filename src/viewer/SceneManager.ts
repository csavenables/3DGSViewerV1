import { loadSceneConfig } from '../config/loadSceneConfig';
import { RevealConfig, SceneConfig, SplatAssetConfig } from '../config/schema';
import { REVEAL_CONFIG_DEFAULTS, SplatHandle, SplatRenderer } from '../renderers/types';
import { SplatRevealController } from './SplatRevealController';

export interface SplatToggleItem {
  id: string;
  label: string;
  visible: boolean;
  loaded: boolean;
  failed: boolean;
}

export interface SceneManagerEvents {
  onLoading(message: string): void;
  onReady(config: SceneConfig): void;
  onItemsChanged(items: SplatToggleItem[]): void;
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
  private activeItems: SplatToggleItem[] = [];
  private activeAssets: SplatAssetConfig[] = [];
  private readonly handleById = new Map<string, SplatHandle>();
  private readonly loadingById = new Map<string, Promise<SplatHandle | null>>();
  private readonly revealController = new SplatRevealController();
  private opVersion = 0;

  constructor(
    private readonly renderer: SplatRenderer,
    private readonly events: SceneManagerEvents,
  ) {}

  get config(): SceneConfig | null {
    return this.activeConfig;
  }

  async loadScene(sceneId: string): Promise<SceneConfig> {
    this.opVersion += 1;
    const loadVersion = this.opVersion;
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
      if (loadVersion !== this.opVersion) {
        return this.activeConfig ?? config;
      }
      this.handleById.clear();
      this.loadingById.clear();
      this.activeAssets = config.assets;
      this.activeHandles = [];
      this.activeItems = config.assets.map((asset, index) => ({
        id: asset.id,
        label: asset.id.replaceAll('_', ' '),
        visible: index === 0,
        loaded: false,
        failed: false,
      }));
      this.events.onItemsChanged(this.getSplatItems());

      const firstAsset = config.assets[0];
      if (firstAsset) {
        const firstHandle = await this.ensureHandleLoaded(firstAsset.id, loadVersion);
        if (firstHandle) {
          this.renderer.setVisible(firstAsset.id, true);
          await this.prepareRevealStart([firstHandle], config.reveal);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error while loading splat assets.';
      throw new SceneLoadError('Unable to load scene assets.', [message]);
    }

    this.activeConfig = config;
    this.events.onReady(config);
    void this.preloadRemainingAssets(loadVersion);
    return config;
  }

  async revealActiveScene(): Promise<void> {
    if (!this.activeConfig) {
      return;
    }
    await Promise.all(
      this.activeHandles.map(async (handle) => {
        const item = this.activeItems.find((entry) => entry.id === handle.id);
        if (!item?.visible) {
          this.renderer.setVisible(handle.id, false);
          return;
        }
        this.renderer.setVisible(handle.id, true);
        await this.revealController.revealIn(handle, handle.boundsY, this.activeConfig!.reveal);
      }),
    );
  }

  getSplatItems(): SplatToggleItem[] {
    return this.activeItems.map((item) => ({ ...item }));
  }

  async setSplatVisible(id: string, visible: boolean): Promise<boolean> {
    if (!this.activeConfig) {
      return false;
    }
    const handle = this.handleById.get(id) ?? (await this.ensureHandleLoaded(id, this.opVersion));
    const item = this.activeItems.find((entry) => entry.id === id);
    if (!handle || !item) {
      return false;
    }
    if (item.visible === visible) {
      return visible;
    }

    this.opVersion += 1;
    const localVersion = this.opVersion;

    if (visible) {
      item.visible = true;
      this.renderer.setVisible(id, true);
      await this.prepareRevealStart([handle], this.activeConfig.reveal);
      await this.revealController.revealIn(handle, handle.boundsY, this.activeConfig.reveal);
      return true;
    }

    await this.revealController.revealOut(handle, handle.boundsY, this.activeConfig.reveal);
    if (localVersion !== this.opVersion) {
      return item.visible;
    }
    this.renderer.setVisible(id, false);
    item.visible = false;
    return false;
  }

  async dispose(): Promise<void> {
    this.activeHandles = [];
    this.activeItems = [];
    this.activeAssets = [];
    this.handleById.clear();
    this.loadingById.clear();
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

  private async preloadRemainingAssets(version: number): Promise<void> {
    for (let i = 1; i < this.activeAssets.length; i += 1) {
      if (version !== this.opVersion) {
        return;
      }
      const asset = this.activeAssets[i];
      await this.ensureHandleLoaded(asset.id, version);
    }
  }

  private async ensureHandleLoaded(id: string, version: number): Promise<SplatHandle | null> {
    const existing = this.handleById.get(id);
    if (existing) {
      return existing;
    }

    const inFlight = this.loadingById.get(id);
    if (inFlight) {
      return inFlight;
    }

    const asset = this.activeAssets.find((entry) => entry.id === id);
    if (!asset) {
      return null;
    }

    const loadPromise = (async (): Promise<SplatHandle | null> => {
      try {
        const handle = await this.renderer.loadSplat(asset);
        if (version !== this.opVersion) {
          return null;
        }
        this.handleById.set(id, handle);
        this.activeHandles.push(handle);
        this.renderer.setVisible(id, false);
        await this.prepareRevealStart([handle], this.activeConfig?.reveal ?? REVEAL_CONFIG_DEFAULTS);
        const item = this.activeItems.find((entry) => entry.id === id);
        if (item) {
          item.loaded = true;
          item.failed = false;
          this.events.onItemsChanged(this.getSplatItems());
        }
        return handle;
      } catch {
        const item = this.activeItems.find((entry) => entry.id === id);
        if (item) {
          item.loaded = false;
          item.failed = true;
          this.events.onItemsChanged(this.getSplatItems());
        }
        return null;
      } finally {
        this.loadingById.delete(id);
      }
    })();

    this.loadingById.set(id, loadPromise);
    return loadPromise;
  }
}
