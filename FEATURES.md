# Features Contract

This file is the source of truth for current Gymmer behavior. Update this file in the same commit when intentionally changing user-facing behavior.

## Core user flows

- Configure workout on Settings view.
- Start workout from Settings.
- Run timer through phases: prep, work, rest.
- Pause/resume timer from timer controls or tapping timer circle.
- The phase badge and muscle-group indicator are shown together as a single integrated header row above the timer.
- The timer screen shows richer current-workout context in that header: current muscle group, current set number, total sets, and work/rest interval lengths.
- Hold to reset lives on the same controls row as pause/resume in a balanced two-button layout; holding it for ~1.2s ends the active session and returns to settings (small finger drift on touch screens should not cancel the hold).
- Complete all sets and see `Done!` state with `Again` action.
- Open workout history view, review entries, clear history, and go back.

## Config features

- Settings shows an Account panel with current sync identity and optional Google sign-in.
- Google sign-in links the current anonymous Firebase account when possible so existing synced history remains under the same user; if the Google account already exists, history is merged into that account.
- Workout preset buttons: `chest`, `biceps`, `triceps`, `abs`, `back`, `legs`, `delts`, `custom`, displayed as a compact 4×2 grid.
- The `custom` workout preset button clears the selected preset while keeping the current set/work/rest values.
- Sets buttons: `1`, `2`, `3`, `4`, `5`.
- Work presets: `30s`, `45s` plus custom input (`ss` or `m:ss`).
- Rest presets: `1m`, `1:30`, `2m`, `2:30`, `3m` plus custom input (`ss` or `m:ss`).
- Time bounds: minimum 1s, maximum 600s when applying presets.

## Timer behavior invariants

- Timer starts with a prep phase of 3 seconds.
- Phase progression: `prep -> work -> rest -> work ...` until sets complete.
- A new exercise always starts with all set dots unfilled.
- A work phase completion fills one set dot.
- Sets decrement after finishing a rest phase and transitioning back to work.
- Last set completion stores a full completion entry and shows done UI.
- Timer display ring uses `--progress` and updates through active phases.
- End-of-phase animation appears for work/rest transitions unless skipped during timestamp sync.

## Persistence invariants

- Completions are stored in localStorage key `gymmer_completions`.
- When Firebase is available, completions sync to Firestore under the current anonymous or Google-linked user's `users/{uid}/state/history` document while keeping localStorage as the offline fallback.
- Active session is stored in localStorage key `gymmer_session_v1`.
- Session restore supports phases `prep`, `work`, `rest`.
- Up to 50 completion records are kept.

## PWA and lifecycle invariants

- Service worker file `sw.js` is registered from `app.js`.
- Cache asset list includes app shell files: `index.html`, `styles.css`, `app.js`, `firebase-app.js`, `manifest.json`, `icon.svg`.
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
