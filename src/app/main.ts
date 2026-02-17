import { createAppShell } from './bootstrap';
import { Viewer } from '../viewer/Viewer';

function getSceneIdFromQuery(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('scene') ?? 'demo';
}

export function startApp(): void {
  const appRoot = document.querySelector<HTMLElement>('#app');
  if (!appRoot) {
    throw new Error('Missing #app root element.');
  }

  let viewer: Viewer;
  const ui = createAppShell(appRoot, {
    onReset: () => viewer.resetView(),
    onToggleAutorotate: () => viewer.toggleAutorotate(),
    onToggleFullscreen: (enable) => viewer.setFullscreen(enable),
    isFullscreen: () => viewer.isFullscreen(),
  });

  viewer = new Viewer(ui.getCanvasHostElement(), ui);
  const initialSceneId = getSceneIdFromQuery();

  void (async () => {
    await viewer.init(initialSceneId);
  })();
}
