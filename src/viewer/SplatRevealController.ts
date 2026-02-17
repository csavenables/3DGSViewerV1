import { RevealConfig } from '../config/schema';
import { SplatHandle, SplatRevealBounds } from '../renderers/types';
import { easeInOutCubic } from '../utils/easing';

function applyEase(t: number, ease: RevealConfig['ease']): number {
  if (ease === 'linear') {
    return t;
  }
  return easeInOutCubic(t);
}

export class SplatRevealController {
  async revealIn(
    handle: SplatHandle,
    boundsY: SplatRevealBounds,
    config: RevealConfig,
  ): Promise<void> {
    if (!config.enabled) {
      handle.setRevealParams({
        enabled: false,
        revealY: boundsY.maxY,
        band: config.band,
        affectAlpha: config.affectAlpha,
        affectSize: config.affectSize,
      });
      return;
    }

    const minY = boundsY.minY + config.startPadding;
    const maxY = boundsY.maxY + config.endPadding;
    await this.animate(handle, minY, maxY, config);
  }

  async revealOut(
    handle: SplatHandle,
    boundsY: SplatRevealBounds,
    config: RevealConfig,
  ): Promise<void> {
    if (!config.enabled) {
      return;
    }

    const minY = boundsY.minY + config.startPadding;
    const maxY = boundsY.maxY + config.endPadding;
    await this.animate(handle, maxY, minY, config);
  }

  private async animate(
    handle: SplatHandle,
    fromY: number,
    toY: number,
    config: RevealConfig,
  ): Promise<void> {
    const start = performance.now();
    const duration = Math.max(100, config.durationMs);

    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = applyEase(t, config.ease);
        const revealY = fromY + (toY - fromY) * eased;
        handle.setRevealParams({
          enabled: true,
          revealY,
          band: config.band,
          affectAlpha: config.affectAlpha,
          affectSize: config.affectSize,
        });

        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
