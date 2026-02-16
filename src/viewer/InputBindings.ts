interface InputBindingActions {
  onReset(): void;
  onToggleAutorotate(): void;
}

export class InputBindings {
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(private readonly actions: InputBindingActions) {
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        this.actions.onReset();
      }
      if (event.key.toLowerCase() === 'a') {
        this.actions.onToggleAutorotate();
      }
    };
  }

  bind(): void {
    window.addEventListener('keydown', this.keyHandler);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keyHandler);
  }
}
