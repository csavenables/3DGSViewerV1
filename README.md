# 3DGSViewerV1

3DGSViewerV1 is a lightweight, config-driven web viewer template for product splat experiences. It is designed for static deployment (GitHub Pages or Cloudflare Pages), with a clear scene folder structure so projects can be duplicated quickly per client.

## Features

- TypeScript strict mode with a modular viewer architecture.
- Scene config loading and runtime schema validation with friendly error states.
- Configurable camera home view, orbit/pan/zoom limits, and smooth reset transitions.
- Multi-splat scene loading with supported formats: `.ply`, `.splat`, `.ksplat`, `.spz`.
- Fade-out/fade-in scene transitions and basic loading UX.
- Scene switching via `public/scenes/manifest.json` (no code changes required to add scenes).
- Minimal responsive toolbar for reset, fullscreen, and auto-rotate.
- Friendly failures for invalid/unsupported scene assets.

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

## Deployment

- GitHub Pages and Cloudflare Pages are both supported.
- See `docs/DEPLOYMENT.md`.

## Checklists & Ops

- Client duplication guide: `docs/CLIENT_DUPLICATION_WORKFLOW.md`
- Mobile QA checklist: `docs/MOBILE_QA_CHECKLIST.md`
