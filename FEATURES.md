# Features Contract

This file is the source of truth for current Gymmer behavior. Update this file in the same commit when intentionally changing user-facing behavior.

## Core user flows

- Configure workout on Settings view.
- Start workout from Settings.
- Run timer through phases: prep, work, rest.
- Pause/resume timer from timer controls or tapping timer circle.
- Hold reset button for ~1.2s to end active session and return to settings.
- Complete all sets and see `Done!` state with `Again` action.
- Open workout history view, review entries, clear history, and go back.

## Config features

- Workout preset buttons: `chest`, `arms`, `abs`, `back`, `legs`, `delts`.
- Sets buttons: `1`, `2`, `3`, `4`, `5`.
- Work presets: `30s`, `45s` plus custom input (`ss` or `m:ss`).
- Rest presets: `1m`, `1:30`, `2m`, `2:30`, `3m` plus custom input (`ss` or `m:ss`).
- Time bounds: minimum 1s, maximum 600s when applying presets.

## Timer behavior invariants

- Timer starts with a prep phase of 3 seconds.
- Phase progression: `prep -> work -> rest -> work ...` until sets complete.
- A work phase completion fills one set dot.
- Sets decrement after finishing a rest phase and transitioning back to work.
- Last set completion stores a full completion entry and shows done UI.
- Timer display ring uses `--progress` and updates through active phases.
- End-of-phase animation appears for work/rest transitions unless skipped during timestamp sync.

## Persistence invariants

- Completions are stored in localStorage key `gymmer_completions`.
- Active session is stored in localStorage key `gymmer_session_v1`.
- Session restore supports phases `prep`, `work`, `rest`.
- Up to 50 completion records are kept.

## PWA and lifecycle invariants

- Service worker file `sw.js` is registered from `app.js`.
- Cache asset list includes app shell files: `index.html`, `styles.css`, `app.js`, `manifest.json`, `icon.svg`.
- Visibility/page-show events resync timer from timestamps when app returns to foreground.
- Wake Lock is requested when running (if available) and released on pause/stop/reset.

## Manual Regression Checklist

Run this checklist for any change that touches related code:

1. Open Settings; all views/buttons render and respond.
2. Tap Start workout; prep countdown starts from `3`, then enters Work.
3. Pause and resume from both `Start/Pause` button and timer circle tap.
4. Hold reset ~1.2s during an active session; verify return to Settings.
5. Complete one full set cycle and verify set-dot progression.
6. Complete full workout and verify `Done!`, `Again`, and done-state buttons.
7. Open Workout history; verify new entry appears and clear history works.
8. Reload page during an active session; verify session restores correctly.
9. Reload after completion/reset; verify no stale running session remains.
10. Confirm service worker still registers and app shell still loads offline after one successful load.
