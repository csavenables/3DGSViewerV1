import { SceneConfig } from '../config/schema';
import { createLoader, LoaderController } from '../ui/components/Loader';
import { createToolbar, ToolbarController } from '../ui/components/Toolbar';
import { ViewerUi } from '../viewer/Viewer';

export interface AppShell extends ViewerUi {
  toolbar: ToolbarController;
}

export function createAppShell(container: HTMLElement, actions: Parameters<typeof createToolbar>[1]): AppShell {
  container.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <h1 class="app-title">3DGSViewerV1</h1>
        <div class="header-scene-controls">
          <p class="scene-title">Scene</p>
          <select class="scene-select hidden" aria-label="Select scene"></select>
        </div>
      </header>
      <main class="viewer-root">
        <section class="viewer-host" id="viewer-host"></section>
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
  const sceneSelect = container.querySelector<HTMLSelectElement>('.scene-select');

  if (
    !viewerHost ||
    !overlay ||
    !errorPanel ||
    !errorTitle ||
    !errorDetails ||
    !sceneTitle ||
    !footer ||
    !sceneSelect
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
    setSceneTitle(title: string): void {
      sceneTitle.textContent = title;
    },
    setSceneOptions(
      scenes: Array<{ id: string; title: string }>,
      activeSceneId: string,
      onSceneChange: (sceneId: string) => void,
    ): void {
      sceneSelect.innerHTML = '';
      if (scenes.length <= 1) {
        sceneSelect.classList.add('hidden');
        return;
      }

      for (const scene of scenes) {
        const option = document.createElement('option');
        option.value = scene.id;
        option.textContent = scene.title;
        option.selected = scene.id === activeSceneId;
        sceneSelect.appendChild(option);
      }

      sceneSelect.onchange = () => {
        const sceneId = sceneSelect.value;
        if (sceneId) {
          onSceneChange(sceneId);
        }
      };
      sceneSelect.classList.remove('hidden');
    },
    getOverlayElement(): HTMLElement {
      return overlay;
    },
    getCanvasHostElement(): HTMLElement {
      return viewerHost;
    },
  };
}
