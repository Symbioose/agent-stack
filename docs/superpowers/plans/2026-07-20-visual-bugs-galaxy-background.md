# Agent Deck Visual Bugs and Galaxy Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three reported UI/state defects and replace login/home effects with one subtle, resilient OGL galaxy background.

**Architecture:** Keep the visual fixes local to their existing React components, extract state transitions into a pure server reducer wrapped by a per-session tracker, and reuse one OGL shader component on login and new-session pages. Verify paint/compositing behavior through Chrome DevTools Protocol because jsdom cannot reproduce it.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Framer Motion, OGL, Vitest/Testing Library, Node test runner, tmux, Chrome DevTools Protocol.

---

## File map

- Modify `client/src/components/Composer.tsx`: remove filtered/scaled dropdown compositing.
- Modify `client/src/components/NewSessionView.tsx`: explicit background/content layers and galaxy integration.
- Modify `client/src/components/SessionView.tsx`: menu paint order and Escape handling.
- Modify `client/src/components/SessionView.test.tsx`: menu interaction coverage.
- Create `server/src/session-state.ts`: pure transition reducer and runtime tracker.
- Create `server/src/session-state.test.ts`: complete state-transition coverage.
- Modify `server/src/tmux.ts`: consume raw activity through the tracker and prune stale records.
- Modify `server/src/index.ts`: record user terminal input.
- Create `client/src/components/GalaxyBackground.tsx`: reusable procedural starfield.
- Create `client/src/components/GalaxyBackground.test.tsx`: reduced-motion/static fallback contract.
- Modify `client/src/components/Login.tsx`: use the galaxy background.
- Modify `client/src/index.css`: static nebula fallback and stable canvas layer.
- Remove `client/src/components/Aurora.tsx`, `client/src/components/VantaBackground.tsx`, and `client/src/vanta.d.ts` after replacement.
- Modify `client/package.json` and `package-lock.json`: remove unused Vanta and Three dependencies.

### Task 1: Establish the baseline and reproduce all three defects

**Files:**
- Read: `scripts/smoke-test.mjs`
- Runtime artifacts only: `/tmp/agent-deck-browser/`

- [ ] **Step 1: Install and verify the unmodified baseline**

Run:

```bash
npm install
npm run verify
```

Expected: dependencies install and the existing test/typecheck/build pipeline passes before edits.

- [ ] **Step 2: Start the production server**

Run:

```bash
AGENT_DECK_PASSWORD=deck AGENT_DECK_SECRET=dev PORT=3000 npm start
```

Expected: `agent-deck listening on http://0.0.0.0:3000` (or the configured host) and no startup error.

- [ ] **Step 3: Reproduce Bug 1 in Chrome**

Use installed Chrome with a temporary profile and remote debugging, then inspect `http://localhost:3000` at 1440×900 and 390×844. Log in with `deck`, open the CLI picker ten times, open the folder picker ten times, and capture before/open screenshots plus console output under `/tmp/agent-deck-browser/bug-1/`.

Expected before fix: at least one canvas repaint/flicker, stale frame, or compositing disturbance while a picker animates over the Aurora. Record the exact observed artifact; if the report cannot be reproduced, preserve screenshots and continue with the confirmed risky layer combination.

- [ ] **Step 4: Reproduce Bug 2 in Chrome**

Create/open a shell session, click `Session actions`, inspect the mounted menu and header/terminal paint order, press Escape, and save screenshots under `/tmp/agent-deck-browser/bug-2/`.

Expected before fix: menu DOM mounts but is not reliably painted above the terminal; Escape does not close it.

- [ ] **Step 5: Reproduce Bug 3 with a real session**

At a quiet shell prompt, type characters without pressing Enter and observe event payloads/sidebar state. Then run a command that emits output for several seconds and observe the transition after output stops.

Expected before fix: echoed typing can produce `working`; output/quiet transitions use one five-second threshold.

### Task 2: Fix composer dropdown compositing

**Files:**
- Modify: `client/src/components/Composer.tsx:31-36,106-107,140-190`
- Modify: `client/src/components/NewSessionView.tsx:20-28`

- [ ] **Step 1: Apply stable dropdown motion and surfaces**

In `Composer.tsx`, replace `dropdownMotion` with:

```tsx
const dropdownMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: 0.13, ease: 'easeOut' as const },
};
```

Replace the outer composer class with:

```tsx
className="relative z-10 w-full rounded-2xl border border-border bg-elevated p-3.5 shadow-[0_22px_60px_rgba(0,0,0,.4),inset_0_1px_rgba(255,255,255,.035)] transition-colors focus-within:border-white/20"
```

Keep both dropdowns opaque and change their layer class from `z-20` to `z-30`. Do not add backdrop filters or scale transforms.

- [ ] **Step 2: Make new-session layer order explicit**

In `NewSessionView.tsx`, use these classes while retaining the current Aurora component for this commit:

```tsx
<div className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 pb-[8vh]">
  <Aurora className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[62%] transform-gpu opacity-80 will-change-transform" />
  <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className="relative z-10 w-full max-w-[680px] text-center"
  >
```

- [ ] **Step 3: Run targeted static verification**

Run:

```bash
npm test -w client
npm run typecheck -w client
```

Expected: all client tests and typecheck pass.

- [ ] **Step 4: Verify Bug 1 in desktop and mobile Chrome**

Repeat both picker loops at 1440×900 and 390×844 and save after-fix screenshots.

Expected: no background flash, stale canvas frame, transparent dropdown sampling, or console error.

- [ ] **Step 5: Commit Bug 1 separately**

```bash
git add client/src/components/Composer.tsx client/src/components/NewSessionView.tsx
git commit -m "$(cat <<'EOF'
Fix picker compositing over WebGL background

Backdrop filtering and scaled dropdown layers forced the animated canvas and
picker into overlapping compositor passes. Use opaque surfaces, translation-
only motion, and explicit isolated layers so opening a picker cannot repaint
the background through it.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 3: Fix the session actions menu

**Files:**
- Modify: `client/src/components/SessionView.test.tsx`
- Modify: `client/src/components/SessionView.tsx:27-45,75-105`

- [ ] **Step 1: Write failing interaction tests**

Add these tests to `SessionView.test.tsx`, using a shared `renderView` helper for the existing props:

```tsx
const renderView = (props: Partial<React.ComponentProps<typeof SessionView>> = {}) => {
  const defaults = {
    session,
    sidebarOpen: true,
    onOpenSidebar: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onMissing: vi.fn(),
  };
  return render(<SessionView {...defaults} {...props} />);
};

it('closes the actions menu on outside click and Escape', () => {
  renderView();
  const actions = screen.getByRole('button', { name: 'Session actions' });
  fireEvent.click(actions);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
  fireEvent.click(actions);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
});

it('runs Rename and Delete from the actions menu', () => {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  renderView({ onRename, onDelete });
  fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
  const input = screen.getByDisplayValue(session.title);
  fireEvent.change(input, { target: { value: 'Renamed session' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onRename).toHaveBeenCalledWith('Renamed session');
  fireEvent.click(screen.getByRole('button', { name: 'Session actions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test and confirm the missing Escape behavior**

Run:

```bash
npm test -w client -- SessionView.test.tsx
```

Expected: FAIL because pressing Escape leaves Rename visible.

- [ ] **Step 3: Implement menu lifecycle and paint order**

Replace the menu effect in `SessionView.tsx` with:

```tsx
useEffect(() => {
  if (!menuOpen) return;
  const closeOnPointer = (event: MouseEvent) => {
    if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setMenuOpen(false);
  };
  document.addEventListener('mousedown', closeOnPointer);
  document.addEventListener('keydown', closeOnEscape);
  return () => {
    document.removeEventListener('mousedown', closeOnPointer);
    document.removeEventListener('keydown', closeOnEscape);
  };
}, [menuOpen]);
```

Replace the header class with:

```tsx
className="relative z-20 flex min-h-[52px] items-center gap-2.5 border-b border-border-soft bg-bg px-4 max-md:px-2.5"
```

Retain the menu's `absolute ... z-30` positioning and existing actions.

- [ ] **Step 4: Run tests and browser verification**

Run:

```bash
npm test -w client -- SessionView.test.tsx
npm run typecheck -w client
```

Then verify the menu over a live xterm in desktop/mobile Chrome.

Expected: tests pass; menu paints above xterm, contains Rename/Delete, closes outside and on Escape, and produces no console error.

- [ ] **Step 5: Commit Bug 2 separately**

```bash
git add client/src/components/SessionView.tsx client/src/components/SessionView.test.tsx
git commit -m "$(cat <<'EOF'
Fix session actions menu paint order

The header backdrop filter trapped the mounted menu in a stacking context
beneath the later terminal layer. Give the opaque header an explicit layer and
add Escape handling alongside the existing outside-click lifecycle.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 4: Implement input-aware session status transitions

**Files:**
- Create: `server/src/session-state.ts`
- Create: `server/src/session-state.test.ts`
- Modify: `server/src/tmux.ts:23-67,83-87`
- Modify: `server/src/index.ts:10-18,263-271`

- [ ] **Step 1: Write failing reducer/tracker tests**

Create `server/src/session-state.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDLE_AFTER_MS,
  INPUT_ECHO_GRACE_MS,
  OUTPUT_FRESH_MS,
  SessionStateTracker,
  WORKING_QUIET_MS,
  applySessionInput,
  transitionSessionActivity,
} from './session-state.js';

const NOW = 2_000_000;

function snapshot(command: string, activityAt: number, now = NOW) {
  return { command, activityAt, now };
}

test('shell activity remains idle', () => {
  const next = transitionSessionActivity(undefined, snapshot('zsh', NOW));
  assert.equal(next.state, 'idle');
});

test('fresh CLI output enters working', () => {
  const next = transitionSessionActivity(undefined, snapshot('claude', NOW));
  assert.equal(next.state, 'working');
});

test('input echo does not enter working', () => {
  const waiting = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS - 1));
  const withInput = applySessionInput(waiting, NOW);
  const echoed = transitionSessionActivity(withInput, snapshot('claude', NOW));
  assert.equal(echoed.state, 'waiting');
  assert.equal(echoed.outputAt, waiting.outputAt);
});

test('output after the input grace period enters working', () => {
  const waiting = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS - 1));
  const withInput = applySessionInput(waiting, NOW);
  const nextAt = NOW + INPUT_ECHO_GRACE_MS + 1;
  const output = transitionSessionActivity(withInput, snapshot('claude', nextAt, nextAt));
  assert.equal(output.state, 'working');
});

test('working uses a longer quiet exit window', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const stillWorking = transitionSessionActivity(working, snapshot('claude', NOW, NOW + WORKING_QUIET_MS - 1));
  const waiting = transitionSessionActivity(stillWorking, snapshot('claude', NOW, NOW + WORKING_QUIET_MS));
  assert.equal(stillWorking.state, 'working');
  assert.equal(waiting.state, 'waiting');
});

test('repeated output refreshes working', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const nextAt = NOW + WORKING_QUIET_MS - 1;
  const refreshed = transitionSessionActivity(working, snapshot('claude', nextAt, nextAt));
  assert.equal(refreshed.state, 'working');
  assert.equal(refreshed.outputAt, nextAt);
});

test('quiet CLI becomes idle after thirty minutes', () => {
  const activityAt = NOW - IDLE_AFTER_MS;
  const next = transitionSessionActivity(undefined, snapshot('claude', activityAt));
  assert.equal(next.state, 'idle');
});

test('returning to a shell becomes idle immediately', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const shell = transitionSessionActivity(working, snapshot('zsh', NOW));
  assert.equal(shell.state, 'idle');
});

test('tracker prunes sessions no longer reported by tmux', () => {
  const tracker = new SessionStateTracker();
  tracker.state('deck_one', 'claude', NOW, NOW);
  tracker.state('deck_two', 'claude', NOW, NOW);
  tracker.prune(new Set(['deck_two']));
  assert.equal(tracker.size, 1);
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm exec -w server -- node --import tsx --test src/session-state.test.ts
```

Expected: FAIL because `session-state.ts` does not exist.

- [ ] **Step 3: Implement the pure reducer and tracker**

Create `server/src/session-state.ts`:

```ts
import type { TmuxSession } from './types.js';

export const INPUT_ECHO_GRACE_MS = 1000;
export const OUTPUT_FRESH_MS = 3000;
export const WORKING_QUIET_MS = 7500;
export const IDLE_AFTER_MS = 30 * 60 * 1000;

const SHELLS = new Set(['bash', 'zsh', 'fish', 'sh', 'dash', 'tmux']);

type SessionState = TmuxSession['state'];

export interface SessionActivityRecord {
  state: SessionState;
  observedActivityAt: number;
  outputAt: number;
  inputAt: number;
}

export interface SessionActivitySnapshot {
  command: string;
  activityAt: number;
  now: number;
}

function emptyRecord(): SessionActivityRecord {
  return { state: 'idle', observedActivityAt: 0, outputAt: 0, inputAt: 0 };
}

export function applySessionInput(record: SessionActivityRecord | undefined, inputAt: number): SessionActivityRecord {
  return { ...(record ?? emptyRecord()), inputAt };
}

export function transitionSessionActivity(
  previous: SessionActivityRecord | undefined,
  snapshot: SessionActivitySnapshot,
): SessionActivityRecord {
  const record = previous ?? emptyRecord();
  const advanced = snapshot.activityAt > record.observedActivityAt;
  const outputAt = advanced && snapshot.activityAt > record.inputAt + INPUT_ECHO_GRACE_MS
    ? snapshot.activityAt
    : record.outputAt;
  const shell = SHELLS.has(snapshot.command);
  let state: SessionState;

  if (shell || snapshot.now - snapshot.activityAt >= IDLE_AFTER_MS) state = 'idle';
  else if (record.state === 'working' && snapshot.now - outputAt < WORKING_QUIET_MS) state = 'working';
  else if (snapshot.now - outputAt <= OUTPUT_FRESH_MS) state = 'working';
  else state = 'waiting';

  return {
    state,
    observedActivityAt: Math.max(record.observedActivityAt, snapshot.activityAt),
    outputAt,
    inputAt: record.inputAt,
  };
}

export class SessionStateTracker {
  private readonly records = new Map<string, SessionActivityRecord>();

  get size(): number {
    return this.records.size;
  }

  recordInput(name: string, inputAt = Date.now()): void {
    this.records.set(name, applySessionInput(this.records.get(name), inputAt));
  }

  state(name: string, command: string, activityAt: number, now = Date.now()): SessionState {
    const next = transitionSessionActivity(this.records.get(name), { command, activityAt, now });
    this.records.set(name, next);
    return next.state;
  }

  prune(activeNames: Set<string>): void {
    for (const name of this.records.keys()) {
      if (!activeNames.has(name)) this.records.delete(name);
    }
  }
}

export const sessionStateTracker = new SessionStateTracker();
```

- [ ] **Step 4: Integrate raw tmux activity and input recording**

In `server/src/tmux.ts`, import the tracker:

```ts
import { sessionStateTracker } from './session-state.js';
```

Remove `SHELLS`, `WORKING_WINDOW_MS`, `IDLE_AFTER_MS`, and the old `sessionState` function. Refactor `listSessions()` so each prefixed line computes:

```ts
const activityAt = Number(activity) * 1000;
const lastActivity = Math.floor(activityAt / 15000) * 15000;
return {
  name,
  created: Number(created) * 1000,
  lastActivity,
  attached: attached !== '0',
  state: sessionStateTracker.state(name, cmd, activityAt, now),
  command: cmd,
};
```

After constructing the filtered array, call:

```ts
sessionStateTracker.prune(new Set(sessions.map((session) => session.name)));
return sessions;
```

At the start of `sendInput`, record input:

```ts
sessionStateTracker.recordInput(name);
```

In `server/src/index.ts`, import `sessionStateTracker` and record direct terminal input immediately before `term.write(str)`:

```ts
sessionStateTracker.recordInput(sessionId);
term.write(str);
```

Resize control messages remain excluded.

- [ ] **Step 5: Run server and full tests**

Run:

```bash
npm exec -w server -- node --import tsx --test src/session-state.test.ts
npm test -w server
npm run typecheck -w server
```

Expected: all transition, integration, and type checks pass.

- [ ] **Step 6: Verify status behavior in a real browser**

Verify: shell prompt is gray; typing alone stays gray/green; multi-second process output becomes amber; amber remains stable through short pauses; a quiet non-shell CLI becomes green; 30-minute logic is covered by unit tests.

Expected: no state flicker or user-input-only amber transition.

- [ ] **Step 7: Commit Bug 3 separately**

```bash
git add server/src/session-state.ts server/src/session-state.test.ts server/src/tmux.ts server/src/index.ts
git commit -m "$(cat <<'EOF'
Stabilize session activity state transitions

Tmux activity merged user-input echo with process output, and one five-second
threshold made status changes bounce. Track input separately, accept only later
output, and use asymmetric entry/quiet windows before returning to waiting.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 5: Replace Aurora and Vanta with the OGL galaxy

**Files:**
- Create: `client/src/components/GalaxyBackground.tsx`
- Create: `client/src/components/GalaxyBackground.test.tsx`
- Modify: `client/src/components/Login.tsx`
- Modify: `client/src/components/NewSessionView.tsx`
- Modify: `client/src/index.css`
- Remove: `client/src/components/Aurora.tsx`
- Remove: `client/src/components/VantaBackground.tsx`
- Remove: `client/src/vanta.d.ts`
- Modify: `client/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the reduced-motion fallback test**

Create `client/src/components/GalaxyBackground.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GalaxyBackground from './GalaxyBackground';

describe('GalaxyBackground', () => {
  it('keeps a static fallback and skips WebGL for reduced motion', () => {
    render(<GalaxyBackground className="test-layer" />);
    const background = screen.getByTestId('galaxy-background');
    expect(background).toHaveClass('galaxy-background', 'test-layer');
    expect(background).toHaveAttribute('aria-hidden', 'true');
    expect(background.querySelector('canvas')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm test -w client -- GalaxyBackground.test.tsx
```

Expected: FAIL because `GalaxyBackground` does not exist.

- [ ] **Step 3: Implement the galaxy component**

Create `client/src/components/GalaxyBackground.tsx` with these shader constants followed by the component implementation:

```tsx
import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const VERTEX = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uMotion;
uniform vec2 uResolution;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float starLayer(vec2 uv, float scale, float drift, float seed) {
  float time = uTime * uMotion;
  vec2 grid = uv * scale + vec2(time * drift, time * drift * 0.37);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float presence = step(0.982, hash21(cell + seed));
  vec2 offset = vec2(
    hash21(cell + seed + 1.7),
    hash21(cell + seed + 5.3)
  ) - 0.5;
  float variation = hash21(cell + seed + 9.1);
  float radius = mix(0.018, 0.07, pow(variation, 9.0));
  float point = 1.0 - smoothstep(0.0, radius, length(local - offset * 0.65));
  float twinkle = 0.72 + 0.28 * sin(time * (0.45 + variation * 0.8) + variation * 6.28318);
  return presence * point * twinkle;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float time = uTime * uMotion;
  float cloud = valueNoise(uv * 1.65 + vec2(time * 0.006, -time * 0.004));
  vec2 nebulaUv = uv - vec2(0.2, 0.08);
  float nebula = exp(-dot(nebulaUv * vec2(0.85, 2.15), nebulaUv * vec2(0.85, 2.15)) * 2.35);
  nebula *= smoothstep(0.28, 0.82, cloud);

  vec3 color = vec3(0.0353, 0.0392, 0.0471);
  vec3 nebulaColor = mix(vec3(0.09, 0.12, 0.3), vec3(0.29, 0.11, 0.4), cloud);
  color += nebulaColor * nebula * 0.16;

  float farStars = starLayer(uv, 24.0, 0.004, 3.0);
  float midStars = starLayer(uv, 42.0, -0.007, 17.0);
  float nearStars = starLayer(uv, 68.0, 0.011, 41.0);
  color += vec3(0.5, 0.58, 0.9) * farStars * 0.35;
  color += vec3(0.68, 0.72, 1.0) * midStars * 0.55;
  color += vec3(0.88, 0.82, 1.0) * nearStars * 0.72;

  float vignette = 1.0 - smoothstep(0.38, 1.28, length(uv));
  color *= mix(0.64, 1.0, vignette);
  gl_FragColor = vec4(color, 1.0);
}
`;

export default function GalaxyBackground({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let elapsed = 0;
    let previousTime = performance.now();
    let observer: ResizeObserver | undefined;
    let renderer: Renderer | undefined;

    const stop = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      const canvas = renderer?.gl.canvas;
      renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas?.remove();
    };

    try {
      renderer = new Renderer({ alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio, 1.5) });
      const gl = renderer.gl;
      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uMotion: { value: host.offsetWidth < 768 ? 0.65 : 1 },
          uResolution: { value: [1, 1] },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });
      host.appendChild(gl.canvas);

      const resize = () => {
        renderer?.setSize(host.offsetWidth, host.offsetHeight);
        program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
        program.uniforms.uMotion.value = host.offsetWidth < 768 ? 0.65 : 1;
      };
      const loop = (time: number) => {
        elapsed += Math.min(time - previousTime, 32) / 1000;
        previousTime = time;
        program.uniforms.uTime.value = elapsed;
        try {
          renderer?.render({ scene: mesh });
          frame = requestAnimationFrame(loop);
        } catch {
          stop();
        }
      };
      const visibility = () => {
        cancelAnimationFrame(frame);
        if (!document.hidden) {
          previousTime = performance.now();
          frame = requestAnimationFrame(loop);
        }
      };

      resize();
      observer = new ResizeObserver(resize);
      observer.observe(host);
      document.addEventListener('visibilitychange', visibility);
      frame = requestAnimationFrame(loop);

      return () => {
        document.removeEventListener('visibilitychange', visibility);
        stop();
      };
    } catch {
      stop();
    }
  }, []);

  return <div ref={hostRef} data-testid="galaxy-background" aria-hidden="true" className={clsx('galaxy-background', className)} />;
}
```

Define `VERTEX` and `FRAGMENT` above the component. The fragment must use deterministic hash/value-noise functions, aspect-correct coordinates, fixed loops only, star scales near 24/42/68, drift below 0.02 units/second, independent hash-seeded twinkle, nebula opacity below 0.18, and final colors centered on `#090a0c`, indigo, and violet. Do not add pointer/mouse listeners.

- [ ] **Step 4: Add the static fallback/compositing CSS**

Append to `client/src/index.css`:

```css
.galaxy-background {
  contain: strict;
  isolation: isolate;
  transform: translateZ(0);
  will-change: transform;
  background:
    radial-gradient(circle at 72% 24%, rgba(92, 67, 163, 0.14), transparent 38%),
    radial-gradient(circle at 24% 72%, rgba(42, 55, 130, 0.1), transparent 44%),
    #090a0c;
}

.galaxy-background canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: Integrate the shared background**

In `Login.tsx`, replace the Vanta import/use with:

```tsx
import GalaxyBackground from './GalaxyBackground';
```

```tsx
<GalaxyBackground className="pointer-events-none absolute inset-0 z-0" />
<div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-bg via-transparent to-bg/60" />
```

Make the login form `relative z-10` and replace its translucent blurred surface with `bg-elevated/95` without `backdrop-blur-xl`.

In `NewSessionView.tsx`, replace the Aurora import/use with:

```tsx
import GalaxyBackground from './GalaxyBackground';
```

```tsx
<GalaxyBackground className="pointer-events-none absolute inset-0 z-0" />
<div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
```

Keep the content at `relative z-10` and do not mount the component in `SessionView` or `Terminal`.

- [ ] **Step 6: Remove obsolete implementations and dependencies**

After confirming no imports remain, remove:

```text
client/src/components/Aurora.tsx
client/src/components/VantaBackground.tsx
client/src/vanta.d.ts
```

Run:

```bash
npm uninstall -w client three vanta
```

Expected: `client/package.json` and `package-lock.json` no longer contain direct `three` or `vanta` dependencies; no new dependency is added.

- [ ] **Step 7: Run targeted tests and production bundle checks**

Run:

```bash
npm test -w client -- GalaxyBackground.test.tsx NewSessionView.test.tsx
npm run typecheck -w client
npm run build -w client
```

Inspect `client/dist/assets` names and bundle output.

Expected: tests/typecheck/build pass; no Vanta/Three chunk or main-bundle reference remains.

- [ ] **Step 8: Verify galaxy and fallback in real browsers**

Capture login and new-session screenshots at 1440×900 and 390×844. Inspect steady animation, resize, page hide/resume, reduced-motion emulation, WebGL-disabled fallback, dropdown opening, text contrast, and console output.

Expected: subtle depth/twinkle/nebula, no effect in xterm, no dropdown interference, static fallback without errors, and no console errors.

- [ ] **Step 9: Commit the redesign separately**

```bash
git add client/src/components/GalaxyBackground.tsx client/src/components/GalaxyBackground.test.tsx client/src/components/Login.tsx client/src/components/NewSessionView.tsx client/src/index.css client/package.json package-lock.json
git add -u client/src/components/Aurora.tsx client/src/components/VantaBackground.tsx client/src/vanta.d.ts
git commit -m "$(cat <<'EOF'
Replace page effects with a stable galaxy field

Vanta FOG and the Aurora shader used separate repainting backgrounds and left
filtered UI competing with their canvases. Reuse one isolated OGL starfield
with a static fallback, reduced-motion support, and no Three.js dependency.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
EOF
)"
```

### Task 6: Full verification and final review

**Files:**
- Review: all files changed by Tasks 2–5
- Runtime artifacts only: `/tmp/agent-deck-browser/final/`

- [ ] **Step 1: Review all commits and diffs**

Run:

```bash
git status --short
git log --oneline -6
git diff 75ebd03..HEAD --check
git diff 75ebd03..HEAD --stat
```

Expected: four implementation commits after planning commits, no whitespace errors, and no unrelated source changes.

- [ ] **Step 2: Run the complete verification pipeline**

Run:

```bash
npm run verify
```

Expected: server tests, client tests, both typechecks, and both production builds pass.

- [ ] **Step 3: Run the authenticated smoke test**

With the production server running under the required environment, run:

```bash
AGENT_DECK_PASSWORD=deck npm run smoke
```

Expected: `Agent Deck smoke test passed` and its temporary tmux session is removed.

- [ ] **Step 4: Perform final desktop/mobile browser checks**

At 1440×900 and 390×844, verify and capture:

1. Login galaxy and readable form.
2. New-session galaxy with CLI picker open.
3. New-session galaxy with folder picker open.
4. Open terminal with actions menu visible.
5. Rename, Delete confirmation path, outside click, and Escape.
6. Status behavior during input, output, quiet, and shell return.
7. No effect behind xterm.

Expected: acceptance criteria pass and browser console remains empty of errors.

- [ ] **Step 5: Inspect the production bundle and working tree**

Run:

```bash
git status --short
```

Expected: clean working tree. Confirm build output contains no `three` or `vanta` module/chunk and screenshots remain under `/tmp`, not in git.

- [ ] **Step 6: Dispatch final spec and code-quality review**

Compare implementation against `docs/superpowers/specs/2026-07-20-visual-bugs-galaxy-background-design.md`, inspect edge cases and test quality, fix any blocking findings in the relevant implementation commit or a clearly named follow-up commit, and rerun affected verification.
