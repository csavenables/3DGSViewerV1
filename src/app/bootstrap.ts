import { InteriorViewConfig, SceneConfig } from '../config/schema';
import { createLoader, LoaderController } from '../ui/components/Loader';
import { createToolbar, ToolbarController } from '../ui/components/Toolbar';
import { SplatToggleItem } from '../viewer/SceneManager';
import { ViewerUi } from '../viewer/Viewer';

export interface AppShell extends ViewerUi {
  toolbar: ToolbarController;
}

export function createAppShell(container: HTMLElement, actions: Parameters<typeof createToolbar>[1]): AppShell {
  container.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <h1 class="app-title">3DGSViewerV1</h1>
        <p class="scene-title">Scene</p>
      </header>
      <main class="viewer-root">
        <section class="viewer-host" id="viewer-host"></section>
        <aside class="splat-panel" aria-label="Splat visibility controls">
          <h2 class="splat-panel-title">Splats</h2>
          <div class="splat-controls"></div>
          <div class="interior-debug">
            <h3 class="interior-title">Interior Debug</h3>
            <label class="interior-row">Radius <input data-key="radius" type="range" min="0.2" max="20" step="0.05" /></label>
            <label class="interior-row">Softness <input data-key="softness" type="range" min="0.05" max="0.6" step="0.01" /></label>
            <label class="interior-row">Fade Alpha <input data-key="fadeAlpha" type="range" min="0" max="1" step="0.01" /></label>
            <label class="interior-row">Max Dist <input data-key="maxDistance" type="range" min="1" max="100" step="1" /></label>
            <label class="interior-row">Target X <input data-key="targetX" type="range" min="-10" max="10" step="0.05" /></label>
            <label class="interior-row">Target Y <input data-key="targetY" type="range" min="-10" max="10" step="0.05" /></label>
            <label class="interior-row">Target Z <input data-key="targetZ" type="range" min="-10" max="10" step="0.05" /></label>
            <label class="interior-row interior-check">
              <input data-key="enabled" type="checkbox" />
              Enabled
            </label>
          </div>
        </aside>
        <div class="transition-overlay"></div>
      </main>
      <div class="error-panel hidden" role="alert">
        <h2 class="error-title"></h2>
        <ul class="error-details"></ul>
      </div>
      <footer class="app-footer">
        <p>R: Reset | A: Toggle Auto-Rotate</p>
      </footer>
    </div>
  `;

  const viewerHost = container.querySelector<HTMLElement>('#viewer-host');
  const overlay = container.querySelector<HTMLElement>('.transition-overlay');
  const errorPanel = container.querySelector<HTMLElement>('.error-panel');
  const errorTitle = container.querySelector<HTMLElement>('.error-title');
  const errorDetails = container.querySelector<HTMLElement>('.error-details');
  const sceneTitle = container.querySelector<HTMLElement>('.scene-title');
  const footer = container.querySelector<HTMLElement>('.app-footer');
  const splatControls = container.querySelector<HTMLElement>('.splat-controls');
  const interiorDebug = container.querySelector<HTMLElement>('.interior-debug');

  if (
    !viewerHost ||
    !overlay ||
    !errorPanel ||
    !errorTitle ||
    !errorDetails ||
    !sceneTitle ||
    !footer ||
    !splatControls ||
    !interiorDebug
  ) {
    throw new Error('App shell failed to initialize.');
  }

  const loader: LoaderController = createLoader(viewerHost);
  const toolbar = createToolbar(footer, actions);

  return {
    toolbar,
    setLoading(loading: boolean, message?: string): void {
      if (loading) {
        loader.show(message);
      } else {
        loader.hide();
      }
    },
    setError(title: string, details: string[]): void {
      errorTitle.textContent = title;
      errorDetails.innerHTML = '';
      for (const detail of details) {
        const li = document.createElement('li');
        li.textContent = detail;
        errorDetails.appendChild(li);
      }
      errorPanel.classList.remove('hidden');
    },
    clearError(): void {
      errorPanel.classList.add('hidden');
      errorTitle.textContent = '';
      errorDetails.innerHTML = '';
    },
    configureToolbar(config: SceneConfig): void {
      toolbar.setConfig(config);
    },
    configureInteriorDebug(
      config: InteriorViewConfig,
      onChange: (patch: Partial<InteriorViewConfig>) => void,
    ): void {
      const getInput = (key: string): HTMLInputElement | null =>
        interiorDebug.querySelector<HTMLInputElement>(`input[data-key="${key}"]`);
      const radius = getInput('radius');
      const softness = getInput('softness');
      const fadeAlpha = getInput('fadeAlpha');
      const maxDistance = getInput('maxDistance');
      const targetX = getInput('targetX');
      const targetY = getInput('targetY');
      const targetZ = getInput('targetZ');
      const enabled = getInput('enabled');
      if (!radius || !softness || !fadeAlpha || !maxDistance || !targetX || !targetY || !targetZ || !enabled) {
        return;
      }
      radius.value = String(config.radius);
      softness.value = String(config.softness);
      fadeAlpha.value = String(config.fadeAlpha);
      maxDistance.value = String(config.maxDistance);
      targetX.value = String(config.target[0]);
      targetY.value = String(config.target[1]);
      targetZ.value = String(config.target[2]);
      enabled.checked = config.enabled;

      const emitTarget = (): void => {
        onChange({
          target: [Number(targetX.value), Number(targetY.value), Number(targetZ.value)],
        });
      };
      radius.oninput = () => onChange({ radius: Number(radius.value) });
      softness.oninput = () => onChange({ softness: Number(softness.value) });
      fadeAlpha.oninput = () => onChange({ fadeAlpha: Number(fadeAlpha.value) });
      maxDistance.oninput = () => onChange({ maxDistance: Number(maxDistance.value) });
      targetX.oninput = emitTarget;
      targetY.oninput = emitTarget;
      targetZ.oninput = emitTarget;
      enabled.onchange = () => onChange({ enabled: enabled.checked });
    },
    setSceneTitle(title: string): void {
      sceneTitle.textContent = title;
    },
    setSplatOptions(
      items: SplatToggleItem[],
      onSelect: (id: string) => void,
    ): void {
      const staircaseActive = items.some((item) => item.id === 'staircase' && item.active);
      interiorDebug.classList.toggle('hidden', !staircaseActive);
      splatControls.innerHTML = '';
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'splat-toggle';
        button.dataset.splatId = item.id;
        button.dataset.active = item.active ? 'true' : 'false';
        button.dataset.loaded = item.loaded ? 'true' : 'false';
        button.textContent = item.label;
        button.classList.toggle('active', item.active);
        button.classList.toggle('failed', item.failed);
        button.disabled = !item.loaded || item.failed;
        button.onclick = () => {
          if (button.disabled) {
            return;
          }
          for (const other of splatControls.querySelectorAll<HTMLButtonElement>('button.splat-toggle')) {
            other.classList.remove('active');
          }
          button.classList.add('active');
          onSelect(item.id);
        };
        splatControls.appendChild(button);
      }
    },
    getOverlayElement(): HTMLElement {
      return overlay;
    },
    getCanvasHostElement(): HTMLElement {
      return viewerHost;
    },
  };
}
