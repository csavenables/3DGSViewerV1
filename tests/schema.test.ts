import { describe, expect, it } from 'vitest';
import { validateSceneConfig } from '../src/config/schema';

describe('validateSceneConfig', () => {
  it('accepts a valid config', () => {
    const valid = {
      id: 'demo',
      title: 'Demo',
      assets: [
        {
          id: 'a',
          src: '/scenes/demo/splats/a.ply',
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visibleDefault: true,
        },
      ],
      camera: {
        home: { position: [0, 0, 2], target: [0, 0, 0], fov: 50 },
        limits: { minDistance: 0.4, maxDistance: 4, minPolarAngle: 0.1, maxPolarAngle: 2.9 },
        transitionMs: 500,
      },
      ui: {
        enableFullscreen: true,
        enableAutorotate: true,
        enableReset: true,
        enablePan: true,
        autorotateDefaultOn: false,
      },
      transitions: {
        sceneFadeMs: 300,
      },
    };

    const result = validateSceneConfig(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.reveal.enabled).toBe(true);
      expect(result.data.reveal.mode).toBe('yRamp');
      expect(result.data.reveal.durationMs).toBe(2800);
      expect(result.data.interiorView.enabled).toBe(false);
      expect(result.data.interiorView.radius).toBe(0.45);
    }
  });

  it('rejects configs with more than 5 assets', () => {
    const baseAsset = {
      id: 'a',
      src: '/x.ply',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      visibleDefault: true,
    };

    const invalid = {
      id: 'demo',
      title: 'Demo',
      assets: [baseAsset, baseAsset, baseAsset, baseAsset, baseAsset, baseAsset],
      camera: {
        home: { position: [0, 0, 2], target: [0, 0, 0], fov: 50 },
        limits: { minDistance: 0.4, maxDistance: 4, minPolarAngle: 0.1, maxPolarAngle: 2.9 },
        transitionMs: 500,
      },
      ui: {
        enableFullscreen: true,
        enableAutorotate: true,
        enableReset: true,
        enablePan: true,
        autorotateDefaultOn: false,
      },
      transitions: {
        sceneFadeMs: 300,
      },
    };

    const result = validateSceneConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('up to 5 splats');
    }
  });

  it('rejects invalid reveal parameters', () => {
    const invalid = {
      id: 'demo',
      title: 'Demo',
      assets: [
        {
          id: 'a',
          src: '/x.ply',
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visibleDefault: true,
        },
      ],
      camera: {
        home: { position: [0, 0, 2], target: [0, 0, 0], fov: 50 },
        limits: { minDistance: 0.4, maxDistance: 4, minPolarAngle: 0.1, maxPolarAngle: 2.9 },
        transitionMs: 500,
      },
      ui: {
        enableFullscreen: true,
        enableAutorotate: true,
        enableReset: true,
        enablePan: true,
        autorotateDefaultOn: false,
      },
      transitions: {
        sceneFadeMs: 300,
      },
      reveal: {
        enabled: true,
        mode: 'yRamp',
        durationMs: 0,
        band: -1,
      },
    };

    const result = validateSceneConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('reveal.durationMs');
      expect(result.errors.join(' ')).toContain('reveal.band');
    }
  });

  it('rejects invalid interior view hard limits and clamps soft limits', () => {
    const invalid = {
      id: 'demo',
      title: 'Demo',
      assets: [
        {
          id: 'a',
          src: '/x.ply',
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          visibleDefault: true,
        },
      ],
      camera: {
        home: { position: [0, 0, 2], target: [0, 0, 0], fov: 50 },
        limits: { minDistance: 0.4, maxDistance: 4, minPolarAngle: 0.1, maxPolarAngle: 2.9 },
        transitionMs: 500,
      },
      ui: {
        enableFullscreen: true,
        enableAutorotate: true,
        enableReset: true,
        enablePan: true,
        autorotateDefaultOn: false,
      },
      transitions: {
        sceneFadeMs: 300,
      },
      interiorView: {
        enabled: true,
        target: [0, 1, 0],
        radius: 0,
        softness: 0.9,
        fadeAlpha: -1,
        maxDistance: 0,
        affectSize: false,
      },
    };

    const result = validateSceneConfig(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('interiorView.radius');
      expect(result.errors.join(' ')).toContain('interiorView.maxDistance');
    }
  });
});
