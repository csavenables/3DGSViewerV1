# Mobile QA Checklist

Run this checklist before calling a milestone complete.

## Devices/Browsers

- iOS Safari (recent iPhone)
- Android Chrome (recent Android)

## Functional Checks

- Scene loads without white/blank screen.
- Loading indicator appears while assets are loading.
- Default camera starts centered on model.
- Orbit gesture feels stable and centered.
- Pinch zoom works and respects zoom limits.
- Pan works only when enabled in config.
- Reset button returns to a good home view.
- Auto-rotate toggle works.
- Fullscreen button works (or is hidden when disabled).
- Scene switch dropdown works and uses fade out/in.

## Visual Checks

- Model is fully visible on first load in portrait and landscape.
- UI controls are reachable and readable on small screens.
- No overlap between toolbar and browser UI/chrome.
- No obvious stretching/skew from aspect changes.

## Failure Checks

- Missing scene file shows a user-facing error.
- Invalid scene JSON shows a user-facing error.
- Unsupported asset format shows a user-facing error.
- More than 5 assets in config shows a user-facing error.
