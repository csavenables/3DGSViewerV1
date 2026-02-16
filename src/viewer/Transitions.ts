export class Transitions {
  constructor(private readonly overlay: HTMLElement) {}

  setColor(color: string): void {
    this.overlay.style.background = color;
  }

  async fadeOut(durationMs: number): Promise<void> {
    await this.animate(0, 1, durationMs);
  }

  async fadeIn(durationMs: number): Promise<void> {
    await this.animate(1, 0, durationMs);
  }

  private async animate(from: number, to: number, durationMs: number): Promise<void> {
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.opacity = String(from);
    this.overlay.style.transition = `opacity ${durationMs}ms ease`;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        this.overlay.style.opacity = String(to);
        window.setTimeout(resolve, durationMs);
      });
    });
  }
}
