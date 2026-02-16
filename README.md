# 3DGSViewerV1

3DGSViewerV1 is a lightweight, config-driven web viewer template for product splat experiences. It is designed for static deployment (GitHub Pages or Cloudflare Pages), with a clear scene folder structure so projects can be duplicated quickly per client.

## Features

- TypeScript strict mode with a modular viewer architecture.
- Scene config loading and runtime schema validation with friendly error states.
- Configurable camera home view, orbit/pan/zoom limits, and smooth reset transitions.
- Multi-splat scene loading (`.ply`) with per-asset transforms and visibility defaults.
- Fade-out/fade-in scene transitions and basic loading UX.
- Scene switching via `public/scenes/manifest.json` (no code changes required to add scenes).
- Minimal responsive toolbar for reset, fullscreen, and auto-rotate.

## Getting Started

```bash
npm install
npm run dev
```

Build for static hosting:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Controls

- Mouse / touch: orbit, pan, zoom.
- `Reset` button or `R`: return to home camera view.
- `Auto Rotate` button or `A`: toggle autorotate.
- `Fullscreen`: enter/exit fullscreen mode.

## Scene Workflow

1. Duplicate `public/scenes/demo` to `public/scenes/<clientSceneId>`.
2. Replace `.ply` files under `public/scenes/<clientSceneId>/splats`.
3. Update `public/scenes/<clientSceneId>/scene.json`.
4. Add the new scene to `public/scenes/manifest.json`.
5. Load with query param, e.g. `?scene=clientSceneId`.
