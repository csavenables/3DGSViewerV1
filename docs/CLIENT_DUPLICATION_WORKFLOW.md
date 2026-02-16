# Client Duplication Workflow

This project is intended to be copied per client with minimal changes.

## Quick Steps (target: < 5 minutes)

1. Copy `public/scenes/demo` to `public/scenes/<clientSceneId>`.
2. Place client splat files into `public/scenes/<clientSceneId>/splats/`.
3. Edit `public/scenes/<clientSceneId>/scene.json`:
   - `id`
   - `title`
   - `assets[].src`
   - `assets[].transform`
   - `camera.home` and `camera.limits`
4. Add the new scene to `public/scenes/manifest.json`.
5. Run:
   - `npm run build`
6. Open:
   - `/?scene=<clientSceneId>` in local dev or deployed URL.

## Required Rules

- Keep assets under `public/scenes/<sceneId>/...`.
- Keep `assets` count at 5 or fewer.
- Use supported splat formats only: `.ply`, `.splat`, `.ksplat`, `.spz`.
- Keep all scene behavior in `scene.json` instead of code edits.

## Failure Checks

- If the scene fails to load, verify each `assets[].src` path exists.
- If camera starts too close/far, tune `camera.home.fov` and `camera.limits`.
- If orientation is wrong, adjust the primary asset `transform.rotation`.
