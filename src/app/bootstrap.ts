import { SceneConfig } from '../config/schema';
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

  if (
    !viewerHost ||
    !overlay ||
    !errorPanel ||
    !errorTitle ||
    !errorDetails ||
    !sceneTitle ||
    !footer ||
    !splatControls
  ) {
    throw new Error('App shell failed to initialize.');
  }

  const loader: LoaderController = createLoader(viewerHost);
  const toolbar = createToolbar(footer, actions);
  let splatBusyAll = false;

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
    setSceneTitle(title: string): void {
      sceneTitle.textContent = title;
    },
    setSplatOptions(
      items: SplatToggleItem[],
      onSelect: (id: string) => void,
    ): void {
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
        button.disabled = splatBusyAll || !item.loaded || item.failed;
        button.onclick = () => {
          if (button.disabled) {
            return;
          }
          onSelect(item.id);
        };
        splatControls.appendChild(button);
      }
    },
    setSplatBusy(id: string, busy: boolean): void {
      const button = splatControls.querySelector<HTMLButtonElement>(`button[data-splat-id="${id}"]`);
      if (!button) {
        return;
      }
      button.disabled = busy;
      button.classList.toggle('busy', busy);
    },
    setSplatBusyAll(busy: boolean): void {
      splatBusyAll = busy;
      const buttons = splatControls.querySelectorAll<HTMLButtonElement>('button[data-splat-id]');
      for (const button of buttons) {
        const loaded = button.dataset.loaded === 'true';
        const failed = button.classList.contains('failed');
        button.disabled = busy || !loaded || failed;
        button.classList.toggle('busy', busy);
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
