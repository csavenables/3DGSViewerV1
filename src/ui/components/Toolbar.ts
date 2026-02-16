import { SceneConfig } from '../../config/schema';
import { createButton } from './Button';

export interface ToolbarActions {
  onReset(): void;
  onToggleAutorotate(): boolean;
  onToggleFullscreen(enable: boolean): void;
  isFullscreen(): boolean;
}

export interface ToolbarController {
  setConfig(config: SceneConfig): void;
}

export function createToolbar(parent: HTMLElement, actions: ToolbarActions): ToolbarController {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  parent.appendChild(toolbar);

  const resetButton = createButton({
    id: 'btn-reset',
    label: 'Reset',
    onClick: () => actions.onReset(),
  });

  const autorotateButton = createButton({
    id: 'btn-autorotate',
    label: 'Auto Rotate',
    onClick: () => {
      const enabled = actions.onToggleAutorotate();
      autorotateButton.classList.toggle('active', enabled);
    },
  });

  const fullscreenButton = createButton({
    id: 'btn-fullscreen',
    label: 'Fullscreen',
    onClick: () => {
      const enable = !actions.isFullscreen();
      actions.onToggleFullscreen(enable);
      fullscreenButton.classList.toggle('active', enable);
      fullscreenButton.textContent = enable ? 'Exit Fullscreen' : 'Fullscreen';
    },
  });

  toolbar.appendChild(resetButton);
  toolbar.appendChild(autorotateButton);
  toolbar.appendChild(fullscreenButton);

  return {
    setConfig(config: SceneConfig): void {
      resetButton.classList.toggle('hidden', !config.ui.enableReset);
      autorotateButton.classList.toggle('hidden', !config.ui.enableAutorotate);
      fullscreenButton.classList.toggle('hidden', !config.ui.enableFullscreen);
      autorotateButton.classList.toggle('active', config.ui.autorotateDefaultOn);
    },
  };
}
