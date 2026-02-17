import * as THREE from 'three';
import { SceneConfig } from '../config/schema';
import { GaussianSplatRenderer } from '../renderers/GaussianSplatRenderer';
import { InputBindings } from './InputBindings';
import { CameraController } from './CameraController';
import { SceneManager, SplatToggleItem } from './SceneManager';
import { easeInOutCubic } from '../utils/easing';

export interface ViewerUi {
  setLoading(loading: boolean, message?: string): void;
  setError(title: string, details: string[]): void;
  clearError(): void;
  configureToolbar(config: SceneConfig): void;
  setSceneTitle(title: string): void;
  setSplatOptions(items: SplatToggleItem[], onToggle: (id: string, nextVisible: boolean) => void): void;
  setSplatBusy(id: string, busy: boolean): void;
  setSplatVisible(id: string, visible: boolean): void;
  getOverlayElement(): HTMLElement;
  getCanvasHostElement(): HTMLElement;
}

export class Viewer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
  private readonly webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly cameraController: CameraController;
  private readonly splatRenderer = new GaussianSplatRenderer();
  private readonly sceneManager: SceneManager;
  private readonly inputBindings: InputBindings;
  private readonly resizeObserver: ResizeObserver;

  private activeSceneId = '';
  private activeConfig: SceneConfig | null = null;
  private fittedHome: SceneConfig['camera']['home'] | null = null;
  private autoRotate = false;
  private disposed = false;
  private pendingResizeSync = false;
  private overlayAnimationToken = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly ui: ViewerUi,
  ) {
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webglRenderer.setSize(container.clientWidth, container.clientHeight);
    this.webglRenderer.setAnimationLoop(this.onFrame);
    this.webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.webglRenderer.domElement);

    this.cameraController = new CameraController(this.camera, this.webglRenderer.domElement);
    this.sceneManager = new SceneManager(this.splatRenderer, {
      onLoading: (message) => {
        this.ui.setLoading(true, message);
      },
      onReady: (config) => {
        this.ui.configureToolbar(config);
        this.ui.setSceneTitle(config.title);
      },
    });

    this.inputBindings = new InputBindings({
      onReset: () => this.resetView(),
      onToggleAutorotate: () => this.toggleAutorotate(),
    });

    this.scene.background = new THREE.Color('#0b0e14');
    const ambient = new THREE.AmbientLight('#ffffff', 0.8);
    this.scene.add(ambient);

    this.resizeObserver = new ResizeObserver(() => this.scheduleResizeSync());
    this.resizeObserver.observe(this.container);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('scroll', this.onResize);
  }

  async init(sceneId: string): Promise<void> {
    await this.splatRenderer.initialize({
      scene: this.scene,
      camera: this.camera,
      renderer: this.webglRenderer,
      rootElement: this.container,
    });
    this.inputBindings.bind();
    await this.loadScene(sceneId);
  }

  async loadScene(sceneId: string): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      this.ui.clearError();
      const config = await this.sceneManager.loadScene(sceneId);
      this.activeConfig = config;
      this.applySceneConfig(config);
      this.activeSceneId = sceneId;
      this.ui.setLoading(false);
      this.ui.setSplatOptions(this.sceneManager.getSplatItems(), (id, nextVisible) => {
        void this.toggleSplatVisibility(id, nextVisible);
      });
      await Promise.all([
        this.sceneManager.revealActiveScene(),
        this.playBottomUpScreenReveal(config.reveal.durationMs),
      ]);
    } catch (error) {
      this.ui.setLoading(false);
      const message = error instanceof Error ? error.message : 'Unknown error while loading scene.';
      const details: string[] =
        typeof error === 'object' &&
        error !== null &&
        'details' in error &&
        Array.isArray((error as { details?: unknown }).details)
          ? ((error as { details: string[] }).details ?? [])
          : [];
      this.ui.setError(message, details);
    }
  }

  resetView(): void {
    const config = this.sceneManager.config;
    if (!config) {
      return;
    }
    this.cameraController.setHomeImmediately(this.fittedHome ?? config.camera.home);
  }

  toggleAutorotate(): boolean {
    const config = this.sceneManager.config;
    if (!config || !config.ui.enableAutorotate) {
      return this.autoRotate;
    }
    this.autoRotate = !this.autoRotate;
    this.cameraController.setAutoRotate(this.autoRotate);
    return this.autoRotate;
  }

  setFullscreen(enabled: boolean): void {
    const target = this.container.parentElement ?? this.container;
    if (enabled) {
      void target.requestFullscreen?.();
      return;
    }
    void document.exitFullscreen();
  }

  isFullscreen(): boolean {
    return document.fullscreenElement !== null;
  }

  getActiveSceneId(): string {
    return this.activeSceneId;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.activeConfig = null;
    this.fittedHome = null;
    this.inputBindings.dispose();
    void this.sceneManager.dispose();
    this.cameraController.dispose();
    this.webglRenderer.dispose();
    this.webglRenderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('scroll', this.onResize);
  }

  private applySceneConfig(config: SceneConfig): void {
    this.cameraController.applyLimits(config.camera.limits, config.ui.enablePan);
    this.fitCameraToContent(config);
    this.autoRotate = config.ui.autorotateDefaultOn && config.ui.enableAutorotate;
    this.cameraController.setAutoRotate(this.autoRotate);
  }

  private async toggleSplatVisibility(id: string, nextVisible: boolean): Promise<void> {
    this.ui.setSplatBusy(id, true);
    try {
      const revealDuration = this.activeConfig?.reveal.durationMs ?? 1000;
      const finalVisible = await Promise.all([
        this.sceneManager.setSplatVisible(id, nextVisible),
        nextVisible
          ? this.playBottomUpScreenReveal(revealDuration)
          : this.playTopDownScreenFade(revealDuration),
      ]).then(([visible]) => visible);
      this.ui.setSplatVisible(id, finalVisible);
      if (this.activeConfig) {
        this.fitCameraToContent(this.activeConfig);
      }
    } catch {
      this.ui.setSplatVisible(id, !nextVisible);
    } finally {
      this.ui.setSplatBusy(id, false);
    }
  }

  private fitCameraToContent(config: SceneConfig): void {
    const fit = this.splatRenderer.getFitData();
    if (!fit) {
      this.cameraController.setHomeImmediately(config.camera.home);
      this.fittedHome = config.camera.home;
      return;
    }

    const expandedLimits = {
      ...config.camera.limits,
      maxDistance: Math.max(config.camera.limits.maxDistance, fit.radius * 8),
    };
    this.cameraController.applyLimits(expandedLimits, config.ui.enablePan);

    const direction = new THREE.Vector3(...config.camera.home.position).sub(
      new THREE.Vector3(...config.camera.home.target),
    );
    const usedDistance = this.cameraController.frameTarget(
      fit.center,
      fit.size,
      fit.radius,
      config.camera.home.fov,
      expandedLimits,
      direction,
    );

    // Keep enough zoom-out headroom after fitting.
    this.cameraController.applyLimits(
      {
        ...expandedLimits,
        maxDistance: Math.max(expandedLimits.maxDistance, usedDistance * 2.5),
      },
      config.ui.enablePan,
    );
    this.fittedHome = this.cameraController.getCurrentHome();
  }

  private onFrame = (): void => {
    const now = performance.now();
    this.cameraController.update(now);
    this.splatRenderer.update();
    this.splatRenderer.render();
  };

  private onResize = (): void => {
    this.scheduleResizeSync();
  };

  private scheduleResizeSync(): void {
    if (this.pendingResizeSync || this.disposed) {
      return;
    }
    this.pendingResizeSync = true;
    requestAnimationFrame(() => {
      this.pendingResizeSync = false;
      this.syncViewport();
    });
  }

  private syncViewport(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.webglRenderer.setSize(width, height);

    if (this.activeConfig) {
      this.fitCameraToContent(this.activeConfig);
    }
  }

  private async playBottomUpScreenReveal(durationMs: number): Promise<void> {
    await this.animateScreenRamp(durationMs, 'bottom-up');
  }

  private async playTopDownScreenFade(durationMs: number): Promise<void> {
    await this.animateScreenRamp(durationMs, 'top-down');
  }

  private async animateScreenRamp(
    durationMs: number,
    mode: 'bottom-up' | 'top-down',
  ): Promise<void> {
    const overlay = this.ui.getOverlayElement();
    this.overlayAnimationToken += 1;
    const token = this.overlayAnimationToken;
    const duration = Math.max(100, durationMs);
    const bandPercent = 16;
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '1';

    await new Promise<void>((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        if (token !== this.overlayAnimationToken || this.disposed) {
          overlay.style.opacity = '0';
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        const eased = easeInOutCubic(t);
        const edge = mode === 'bottom-up' ? (1 - eased) * 100 : eased * 100;
        const bandEdge = Math.min(100, edge + bandPercent);
        overlay.style.background = `linear-gradient(to bottom, rgba(2, 4, 10, 0.96) 0%, rgba(2, 4, 10, 0.96) ${edge.toFixed(
          2,
        )}%, rgba(2, 4, 10, 0) ${bandEdge.toFixed(2)}%, rgba(2, 4, 10, 0) 100%)`;

        if (t >= 1) {
          overlay.style.opacity = '0';
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
