# Agent Deck Visual Bugs and Galaxy Background Design

## Goal

Fix the three reported UI/state bugs, replace the login and new-session effects with a subtle galaxy background, and verify the result in real desktop and mobile browsers without changing terminal rendering.

## Delivery structure

The work is divided into four independently testable commits:

1. Fix composer dropdown/background compositing.
2. Fix the session actions menu and its keyboard/outside-click behavior.
3. Replace the activity heuristic with an input-aware, hysteretic state machine.
4. Replace Aurora and Vanta FOG with one reusable OGL galaxy background.

Every bug fix starts with a reproducible failing browser or component/unit test. Each commit message records the confirmed root cause. Unrelated defects are out of scope; closely related regressions discovered during reproduction may be fixed with targeted coverage.

## Bug 1: composer dropdown compositing

### Confirmed code-level risk to reproduce

`Composer` applies `backdrop-blur-xl` over a continuously rendered WebGL canvas. Its Framer Motion dropdowns animate scale, translation, and opacity inside that filtered element. This combination creates overlapping browser compositing layers and is the leading explanation for the reported canvas flicker.

### Design

Reproduce the artifact with both the CLI and folder pickers before editing. Then:

- Remove backdrop blur from the composer and keep its existing near-opaque elevated surface.
- Animate dropdowns with opacity and vertical translation only; do not animate scale.
- Give the WebGL background, readability overlay, and content explicit layer order.
- Isolate the WebGL host in a promoted compositing layer with a stable transform and `will-change`.
- Keep dropdowns opaque so they never sample a repainting canvas through a backdrop filter.

The picker behavior, folder browsing, responsive widths, and Framer Motion entrance/exit behavior remain unchanged.

## Bug 2: session actions menu

### Confirmed code-level risk to reproduce

The menu is inserted correctly and passes the existing jsdom test. The header's backdrop filter creates a stacking context, however, while the terminal is painted in a later sibling. The menu's internal `z-index` cannot escape that header stacking context. The menu also has no Escape handler.

### Design

Reproduce the invisible menu in a real browser and inspect its mounted DOM and paint order. Then:

- Make the header an opaque, positioned layer above the terminal and remove its unnecessary backdrop blur.
- Keep the menu anchored to the actions button and above the terminal.
- Preserve toggle and outside-`mousedown` behavior.
- Add document-level Escape handling while the menu is open.
- Keep Rename and Delete behavior unchanged.

Component tests cover opening, both actions, outside click, and Escape. Paint order is verified in the browser because jsdom cannot validate compositing.

## Bug 3: stable session status state machine

### Root cause

The current state function treats any recent tmux `window_activity` as agent output. Terminal input is echoed through the pane and updates the same timestamp, so typing alone becomes `working`. A single five-second threshold also provides no entry/exit hysteresis. The 15-second `lastActivity` bucket affects display/order update granularity, but the existing state calculation receives the unbucketed timestamp; the state-machine defect is the missing activity source and transition memory.

### State semantics

The public states remain unchanged:

- `working`: amber pulse; fresh agent/process output is being produced.
- `waiting`: green; a non-shell CLI is quiet and waiting for the user.
- `idle`: gray; the pane is at a plain shell or has been inactive for at least 30 minutes.

### Tracker design

Add a focused session-state module with a pure transition reducer and a small per-session runtime tracker. Each record stores:

- previous public state;
- latest observed raw tmux activity timestamp;
- latest accepted non-input output timestamp;
- latest user-input timestamp.

Terminal WebSocket messages and user-input API paths record user input before writing to the pane. On each tmux snapshot:

1. Detect whether the raw tmux activity timestamp advanced.
2. Ignore a newly observed activity timestamp if it falls within 1,000 ms of recorded user input, because it is likely terminal echo or an input-driven repaint.
3. Otherwise accept it as process output.
4. Enter `working` when accepted output is at most 3,000 ms old.
5. Once working, remain working until accepted output has been quiet for 7,500 ms.
6. After that quiet period, return `waiting` for a non-shell command or `idle` for a shell.
7. Return `idle` after 30 minutes without pane activity.

The asymmetric 3,000/7,500 ms windows fit the existing 1,500 ms event poll: entry remains responsive while exit requires several quiet polls and cannot bounce at one threshold. If input and agent output occur in the same one-second tmux timestamp, that sample is conservatively ignored; continued agent output in a later timestamp enters `working`. A very short response may therefore go directly to `waiting`, which is preferable to marking keystrokes as work.

State timing consumes raw activity. Display/sort bucketing is explicitly separate and cannot influence transitions. Tracker records for sessions no longer returned by tmux are pruned.

### Tests

Pure server unit tests cover:

- a shell remaining idle despite recent activity;
- a non-shell CLI entering working on accepted output;
- user-input echo not entering working;
- later output after the echo grace period entering working;
- repeated output preserving working;
- working persisting through the exit hysteresis window;
- working becoming waiting after quiet;
- waiting becoming idle at 30 minutes;
- a command returning to a shell becoming idle;
- stale tracker cleanup.

## Galaxy background

### Selected approach

Use one custom OGL component on login and new-session screens. Do not add a dependency. Retire the Vanta/Three and Aurora implementations after browser comparison.

### Visual design

The full-screen procedural shader renders:

- three sparse star layers at different scales and drift rates to imply depth;
- restrained independent twinkle rather than synchronized pulsing;
- a broad, low-opacity indigo/violet nebula glow;
- a near-black `#090a0c` base with enough contrast behind all foreground UI;
- slower, lower-amplitude motion on mobile.

There is no hyperspeed, camera rush, bright central core, or effect behind an open terminal.

### Rendering and fallback

- Use one WebGL context per visible login or new-session page.
- Cap device pixel ratio at 1.5 and avoid antialiasing.
- Resize through `ResizeObserver`.
- Pause animation while the page is hidden and resume without a time jump.
- Clean up the frame, observer, canvas, and WebGL context on unmount.
- Skip WebGL entirely for `prefers-reduced-motion` and render the static CSS base/nebula.
- Catch initialization/render failures and leave the same static background with no console error.
- Keep the canvas pointer-inert, explicitly behind content, and on its own compositing layer.
- Remove Vanta and Three dependencies if no remaining imports use them; no new package versions are introduced.

## Verification

### Targeted checks per commit

- Bug 1: open/close both composer pickers repeatedly on desktop and mobile; verify no canvas flash, stale frame, or dropdown transparency artifact.
- Bug 2: open the actions menu over a live terminal; verify Rename, Delete, outside click, and Escape.
- Bug 3: exercise shell input, CLI waiting, process output, quiet transition, and inactivity using tests plus a real tmux/browser session.
- Galaxy: inspect motion, readability, resize behavior, reduced motion, page visibility pause, and WebGL fallback.

### Final checks

Run:

```bash
npm run verify
AGENT_DECK_PASSWORD=deck npm run smoke
```

Start the production server with the requested password/secret and verify Chrome at desktop and a viewport narrower than 768 px. Capture login, new-session picker, and open-session menu screenshots as applicable. Check the browser console for errors and confirm the production build does not place Three.js in the main bundle. Screenshots remain local unless explicitly requested for the repository.
