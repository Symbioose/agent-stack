# Terminal Isolation and Minimal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken terminal rendering by isolating Agent Deck from the user's tmux configuration, then replace the current UI with the approved terminal-first minimal premium design.

**Architecture:** Every tmux invocation and PTY attachment targets a dedicated `agent-deck` socket started with `/dev/null` as its config. The server validates requested CLI executables before creating sessions and returns structured errors. The React client keeps the real-time event stream but separates the new-session composer from the terminal-only session view and uses locally bundled AI brand icons.

**Tech Stack:** Node.js 22+, TypeScript, Express, ws, node-pty, tmux, React 18, Vite, Tailwind CSS v4, xterm.js, `@lobehub/icons@5.11.0`, Node test runner, Vitest, Testing Library.

---

## File structure

### Server

- `server/src/tmux.ts`: owns the isolated tmux command prefix and all tmux operations.
- `server/src/tmux.test.ts`: unit and integration coverage for socket/config isolation and session persistence.
- `server/src/clis.ts`: owns the default CLI catalog and executable validation.
- `server/src/clis.test.ts`: validates catalog entries, missing-command behavior, and Shell handling.
- `server/src/types.ts`: shared server-side CLI and session types.
- `server/src/index.ts`: HTTP/WebSocket orchestration; consumes tmux/CLI services without duplicating policy.
- `server/package.json`: Node test runner script.

### Client

- `client/src/components/BrandMark.tsx`: compact monochrome Agent Deck mark.
- `client/src/components/CliIcon.tsx`: maps CLI IDs to official `@lobehub/icons` components.
- `client/src/components/CliIcon.test.tsx`: icon mapping and fallback tests.
- `client/src/components/Composer.tsx`: new-session-only task composer and CLI picker.
- `client/src/components/NewSessionView.tsx`: new-session heading, composer, pending state, and inline launch error.
- `client/src/components/NewSessionView.test.tsx`: empty state and launch-error tests.
- `client/src/components/SessionView.tsx`: compact session header, terminal surface, rename/delete actions, and no composer.
- `client/src/components/SessionView.test.tsx`: verifies terminal-first layout and absence of status/composer UI.
- `client/src/components/Sidebar.tsx`: chronological history, official icons, and green/gray dots only.
- `client/src/components/Sidebar.test.tsx`: chronology, status dot, and brand tests.
- `client/src/components/Terminal.tsx`: PTY lifecycle, missing-session callback, and terminal sizing.
- `client/src/App.tsx`: authentication, selection, and composition of the three main views.
- `client/src/api.ts`: structured API errors.
- `client/src/index.css`: approved visual tokens, responsive layout, focus, and reduced motion.
- `client/src/types.ts`: client CLI/session types.
- `client/src/test/setup.ts`: Testing Library DOM setup.
- `client/vite.config.ts`: Vitest configuration.
- `client/package.json`: icon and test dependencies/scripts.
- `client/public/favicon.svg`: monochrome Agent Deck mark.
- `client/public/pwa-192.png`, `client/public/pwa-512.png`, `client/public/apple-touch-icon.png`: regenerated PWA assets.

### Verification and docs

- `scripts/smoke-test.mjs`: production HTTP/WebSocket/tmux regression test.
- `package.json`: aggregate `test` and `verify` scripts.
- `README.md`: isolated tmux behavior, new built-in CLIs, and verification commands.

---

### Task 1: Isolate every tmux operation

**Files:**
- Modify: `server/src/tmux.ts`
- Create: `server/src/tmux.test.ts`
- Modify: `server/src/index.ts:172-179`
- Modify: `server/package.json`

- [ ] **Step 1: Add a failing command-prefix unit test**

Create `server/src/tmux.test.ts` with Node's test runner:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { tmuxArgs } from './tmux.js';

test('tmuxArgs uses the Agent Deck socket and no user config', () => {
  const previous = process.env.AGENT_DECK_TMUX_SOCKET;
  process.env.AGENT_DECK_TMUX_SOCKET = 'deck-test';
  assert.deepEqual(tmuxArgs('list-sessions'), [
    '-L',
    'deck-test',
    '-f',
    '/dev/null',
    'list-sessions',
  ]);
  if (previous === undefined) delete process.env.AGENT_DECK_TMUX_SOCKET;
  else process.env.AGENT_DECK_TMUX_SOCKET = previous;
});
```

- [ ] **Step 2: Add the server test script and verify the test fails**

Update `server/package.json`:

```json
"test": "node --import tsx --test src/**/*.test.ts"
```

Run:

```bash
npm test -w server
```

Expected: FAIL because `tmuxArgs` is not exported.

- [ ] **Step 3: Implement the isolated command prefix**

Add to `server/src/tmux.ts`:

```ts
export function tmuxArgs(...args: string[]): string[] {
  return [
    '-L',
    process.env.AGENT_DECK_TMUX_SOCKET || 'agent-deck',
    '-f',
    '/dev/null',
    ...args,
  ];
}

async function runTmux(...args: string[]) {
  return exec('tmux', tmuxArgs(...args));
}
```

Replace every `exec('tmux', args)` call with `runTmux(...args)`. Keep the existing parsing, scrollback conversion, and error boundaries unchanged.

- [ ] **Step 4: Attach node-pty to the same isolated socket**

In `server/src/index.ts`, replace the raw PTY arguments with:

```ts
term = pty.spawn('tmux', tmuxArgs('attach-session', '-t', sessionId), {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  env: { ...process.env, TERM: 'xterm-256color' },
});
```

Import `tmuxArgs` from `./tmux.js`.

- [ ] **Step 5: Add an isolated-server integration test**

Append to `server/src/tmux.test.ts`:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createSession, hasSession, killSession, listSessions } from './tmux.js';

const exec = promisify(execFile);

test('created sessions live only on the isolated server', async (t) => {
  const socket = `agent-deck-test-${process.pid}`;
  const previous = process.env.AGENT_DECK_TMUX_SOCKET;
  process.env.AGENT_DECK_TMUX_SOCKET = socket;
  t.after(async () => {
    await exec('tmux', ['-L', socket, 'kill-server']).catch(() => {});
    if (previous === undefined) delete process.env.AGENT_DECK_TMUX_SOCKET;
    else process.env.AGENT_DECK_TMUX_SOCKET = previous;
  });

  await createSession('deck_isolated', '', process.cwd());
  assert.equal(await hasSession('deck_isolated'), true);
  assert.equal((await listSessions()).some((s) => s.name === 'deck_isolated'), true);
  await assert.rejects(exec('tmux', ['has-session', '-t', 'deck_isolated']));

  const { stdout } = await exec('tmux', [
    '-L', socket, '-f', '/dev/null', 'show-hooks', '-g', 'after-new-session',
  ]);
  assert.equal(stdout.includes('ensure-sidebar.sh'), false);
  await killSession('deck_isolated');
});
```

- [ ] **Step 6: Run the isolation tests**

Run:

```bash
npm test -w server
```

Expected: 2 tests PASS; no `deck_isolated` session exists on the default tmux server.

- [ ] **Step 7: Commit the tmux fix**

```bash
git add server/src/tmux.ts server/src/tmux.test.ts server/src/index.ts server/package.json
git commit -m "Fix terminals by isolating Agent Deck tmux sessions"
```

---

### Task 2: Validate CLIs before session creation and extend the catalog

**Files:**
- Modify: `server/src/clis.ts`
- Create: `server/src/clis.test.ts`
- Modify: `server/src/index.ts:62-86`
- Modify: `server/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/types.ts`

- [ ] **Step 1: Write failing catalog and availability tests**

Create `server/src/clis.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { CliUnavailableError, ensureCliAvailable, getDefaultClis } from './clis.js';

test('default catalog includes Devin and Grok Code', () => {
  const clis = getDefaultClis();
  assert.equal(clis.find((cli) => cli.id === 'devin')?.command, 'devin');
  assert.equal(clis.find((cli) => cli.id === 'grok')?.command, 'grok');
});

test('Shell is always available', async () => {
  await assert.doesNotReject(ensureCliAvailable({ id: 'shell', label: 'Shell', command: '' }));
});

test('missing executables throw a structured error', async () => {
  const cli = { id: 'missing', label: 'Missing CLI', command: 'agent-deck-command-that-does-not-exist' };
  await assert.rejects(ensureCliAvailable(cli), (error: unknown) => {
    assert.equal(error instanceof CliUnavailableError, true);
    assert.equal((error as CliUnavailableError).command, cli.command);
    return true;
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -w server
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the extended catalog and safe executable lookup**

In `server/src/clis.ts`, export a defensive catalog copy and structured error:

```ts
const DEFAULT_CLIS: CliDef[] = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'codex', label: 'Codex', command: 'codex' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini' },
  { id: 'opencode', label: 'OpenCode', command: 'opencode' },
  { id: 'devin', label: 'Devin', command: 'devin' },
  { id: 'grok', label: 'Grok Code', command: 'grok' },
  { id: 'shell', label: 'Shell', command: '' },
];

export class CliUnavailableError extends Error {
  code = 'cli_unavailable' as const;
  constructor(public command: string) {
    super(`La commande « ${command} » n'est pas installée sur cette machine.`);
  }
}

export function getDefaultClis(): CliDef[] {
  return DEFAULT_CLIS.map((cli) => ({ ...cli }));
}

export async function ensureCliAvailable(cli: CliDef): Promise<void> {
  if (!cli.command) return;
  const executable = cli.command.trim().split(/\s+/)[0];
  const shell = process.env.SHELL || '/bin/sh';
  try {
    await execFileAsync(shell, ['-lc', 'command -v -- "$1" >/dev/null', 'agent-deck', executable]);
  } catch {
    throw new CliUnavailableError(executable);
  }
}
```

Import `execFile` and `promisify`, and make `getClis()` return `getDefaultClis()` on fallback.

- [ ] **Step 4: Reject unknown or unavailable CLIs before creating sessions**

In `server/src/index.ts`, replace the fallback selection with:

```ts
const def = getClis().find((candidate) => candidate.id === cli);
if (!def) {
  res.status(400).json({ code: 'unknown_cli', error: 'CLI inconnue.' });
  return;
}
try {
  await ensureCliAvailable(def);
  await createSession(id, def.command, cwd);
} catch (err) {
  if (err instanceof CliUnavailableError) {
    res.status(422).json({ code: err.code, error: err.message, command: err.command });
    return;
  }
  res.status(500).json({ code: 'session_create_failed', error: String((err as Error).message || err) });
  return;
}
```

Import `CliUnavailableError` and `ensureCliAvailable`. Keep `setMeta()` after this block so failed launches produce no metadata.

- [ ] **Step 5: Preserve structured API errors in the client**

Export `ApiError` from `client/src/api.ts` and add fields:

```ts
export class ApiError extends Error {
  unauthorized = false;
  code?: string;
  command?: string;
}
```

When parsing a non-OK response, assign `body.code` and `body.command` before throwing. Add a matching `ApiErrorBody` interface. No caller should parse stringified JSON.

- [ ] **Step 6: Run server tests, typecheck, and build**

Run:

```bash
npm test -w server
npm run typecheck
npm run build
```

Expected: all tests PASS; typecheck and build exit 0.

- [ ] **Step 7: Commit CLI validation**

```bash
git add server/src/clis.ts server/src/clis.test.ts server/src/index.ts server/src/types.ts client/src/api.ts client/src/types.ts
git commit -m "Validate CLI availability before creating sessions"
```

---

### Task 3: Replace improvised icons with official brand icons

**Files:**
- Modify: `client/package.json`
- Modify: `package-lock.json`
- Create: `client/src/components/BrandMark.tsx`
- Modify: `client/src/components/CliIcon.tsx`
- Create: `client/src/components/CliIcon.test.tsx`
- Modify: `client/vite.config.ts`
- Create: `client/src/test/setup.ts`

- [ ] **Step 1: Install vetted icon and test dependencies**

Run:

```bash
npm add -w client @lobehub/icons@5.11.0
npm add -D -w client vitest@3.2.4 @testing-library/react@16.3.0 @testing-library/jest-dom@6.6.3 jsdom@26.1.0
```

Use `5.11.0`, published more than seven days before this plan, instead of the two-day-old latest icon release.

- [ ] **Step 2: Configure Vitest**

Add to `client/vite.config.ts`:

```ts
/// <reference types="vitest/config" />

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  // existing plugins/server config
});
```

Create `client/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `client/package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write failing icon mapping tests**

Create `client/src/components/CliIcon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CliIcon from './CliIcon';

describe('CliIcon', () => {
  for (const cli of ['claude', 'codex', 'gemini', 'opencode', 'devin', 'grok', 'shell']) {
    it(`renders an accessible ${cli} icon`, () => {
      render(<CliIcon cli={cli} label={cli} />);
      expect(screen.getByLabelText(cli)).toBeInTheDocument();
    });
  }

  it('falls back to Shell for custom CLI IDs', () => {
    render(<CliIcon cli="custom" label="Custom CLI" />);
    expect(screen.getByLabelText('Custom CLI')).toBeInTheDocument();
  });
});
```

Run `npm test -w client`; expected FAIL because `label`, Devin, and Grok are unsupported.

- [ ] **Step 4: Implement official icon mapping**

Replace handcrafted glyphs in `CliIcon.tsx` with `@lobehub/icons` components:

```tsx
import { ClaudeCode, Devin, GeminiCLI, Grok, OpenAI, OpenCode } from '@lobehub/icons';
import { SquareTerminal } from 'lucide-react';

const ICONS = {
  claude: ClaudeCode.Color,
  codex: OpenAI,
  gemini: GeminiCLI.Color,
  opencode: OpenCode,
  devin: Devin.Color,
  grok: Grok,
};
```

Render the selected component in a neutral, fixed-size container; render `SquareTerminal` for Shell and unknown IDs. Accept `label` and set `role="img" aria-label={label}` on the container. Do not reintroduce arbitrary colored square backgrounds.

- [ ] **Step 5: Create the monochrome Agent Deck mark**

Create `BrandMark.tsx` as a 24 px neutral container with a simple four-part deck/agent SVG:

```tsx
export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-label="Agent Deck"
      role="img"
      className="inline-flex items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.035] text-white"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 8.25 12 4l7 4.25L12 12.5 5 8.25Z" />
        <path d="m5 12 7 4.25L19 12" />
        <path d="m5 15.75 7 4.25 7-4.25" />
      </svg>
    </span>
  );
}
```

- [ ] **Step 6: Run icon tests and typecheck**

Run:

```bash
npm test -w client
npm run typecheck -w client
```

Expected: all icon tests PASS and TypeScript exits 0. If the package's named export shape differs, inspect `node_modules/@lobehub/icons/es/<Brand>/index.d.ts` and use the documented `Color`/`Mono` exports without replacing the package with handmade glyphs.

- [ ] **Step 7: Commit the icon system**

```bash
git add client/package.json package-lock.json client/vite.config.ts client/src/test/setup.ts client/src/components/BrandMark.tsx client/src/components/CliIcon.tsx client/src/components/CliIcon.test.tsx
git commit -m "Use official CLI brands and add Agent Deck mark"
```

---

### Task 4: Redesign the chronological sidebar

**Files:**
- Modify: `client/src/components/Sidebar.tsx`
- Create: `client/src/components/Sidebar.test.tsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Write failing sidebar behavior tests**

Create `Sidebar.test.tsx` with two sessions in newest-first order:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const sessions = [
  { id: 'deck_new', title: 'Nouvelle', cli: 'devin', cliLabel: 'Devin', created: 2, attached: false, running: true },
  { id: 'deck_old', title: 'Ancienne', cli: 'shell', cliLabel: 'Shell', created: 1, attached: false, running: false },
];

describe('Sidebar', () => {
  it('renders one chronological history with only dot status labels', () => {
    render(<Sidebar sessions={sessions} activeId={null} onSelect={vi.fn()} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getAllByTestId('session-row').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Nouvelle'),
      expect.stringContaining('Ancienne'),
    ]);
    expect(screen.getByLabelText('Session active')).toHaveClass('bg-green');
    expect(screen.getByLabelText('Session inactive')).toHaveClass('bg-faint');
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });

  it('opens a session from its row', () => {
    const onSelect = vi.fn();
    render(<Sidebar sessions={sessions} activeId={null} onSelect={onSelect} onNew={vi.fn()} onClose={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('Nouvelle'));
    expect(onSelect).toHaveBeenCalledWith('deck_new');
  });
});
```

Remove `onDelete` and `onRename` from the test/API because those actions move to the session header.

- [ ] **Step 2: Run the test and verify it fails**

Run `npm test -w client -- Sidebar`; expected FAIL on missing test IDs/labels and mismatched props.

- [ ] **Step 3: Implement the approved sidebar**

Update `Sidebar.tsx` to:

- use `BrandMark` instead of `LayoutGrid`;
- label the section `Historique`;
- render the supplied array unchanged (the event layer already sorts descending);
- render each row at roughly 50 px with `data-testid="session-row"`;
- call `CliIcon` with `label={s.cliLabel}`;
- render only an accessible green or gray dot:

```tsx
<span
  aria-label={s.running ? 'Session active' : 'Session inactive'}
  className={clsx('h-[7px] w-[7px] shrink-0 rounded-full', s.running ? 'bg-green shadow-[0_0_10px_rgba(66,216,137,.35)]' : 'bg-faint')}
/>
```

Remove inline rename, delete buttons, pulse rings, and the `onDelete`/`onRename` props. Preserve mobile close and logout.

- [ ] **Step 4: Apply sidebar visual tokens**

In `index.css`, set the approved warm-black tokens, use subtle tonal surfaces, and remove `.animate-pulse-ring`. Add `@media (prefers-reduced-motion: reduce)` that disables nonessential transitions.

- [ ] **Step 5: Run sidebar tests and typecheck**

Run:

```bash
npm test -w client -- Sidebar
npm run typecheck -w client
```

Expected: sidebar tests PASS. Typecheck may still fail in `App.tsx` until Task 6; update `App` prop wiring immediately if needed without changing its layout yet.

- [ ] **Step 6: Commit the sidebar redesign**

```bash
git add client/src/components/Sidebar.tsx client/src/components/Sidebar.test.tsx client/src/index.css client/src/App.tsx
git commit -m "Redesign session history with minimal status dots"
```

---

### Task 5: Build the new-session-only creation view

**Files:**
- Modify: `client/src/components/Composer.tsx`
- Create: `client/src/components/NewSessionView.tsx`
- Create: `client/src/components/NewSessionView.test.tsx`
- Modify: `client/src/api.ts`

- [ ] **Step 1: Write failing new-session tests**

Create `NewSessionView.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewSessionView from './NewSessionView';

const clis = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'devin', label: 'Devin', command: 'devin' },
  { id: 'grok', label: 'Grok Code', command: 'grok' },
];

describe('NewSessionView', () => {
  it('shows every CLI and submits a non-empty task', () => {
    const onSubmit = vi.fn();
    render(<NewSessionView clis={clis} cli="claude" onCliChange={vi.fn()} onSubmit={onSubmit} pending={false} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Claude Code/i }));
    expect(screen.getByText('Devin')).toBeInTheDocument();
    expect(screen.getByText('Grok Code')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Décris la tâche à exécuter…'), { target: { value: 'Corriger le terminal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lancer la session' }));
    expect(onSubmit).toHaveBeenCalledWith('Corriger le terminal');
  });

  it('renders a missing CLI error inline', () => {
    render(<NewSessionView clis={clis} cli="grok" onCliChange={vi.fn()} onSubmit={vi.fn()} pending={false} error="La commande « grok » n'est pas installée sur cette machine." />);
    expect(screen.getByRole('alert')).toHaveTextContent('grok');
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run `npm test -w client -- NewSessionView`; expected FAIL because the component does not exist.

- [ ] **Step 3: Make Composer specific to creation**

Keep `Composer.tsx`, but remove `showCliPicker`. Its props become:

```ts
interface Props {
  clis: CliDef[];
  cli: string;
  onCliChange: (id: string) => void;
  onSubmit: (text: string) => void;
  pending: boolean;
}
```

Use `CliIcon label={selected.label}` in the picker. Set `aria-label="Lancer la session"` on the submit button. Disable the textarea and submit button while pending. Do not clear the text until submission succeeds; expose an optional `resetKey` if App needs to reset after navigation.

- [ ] **Step 4: Implement `NewSessionView`**

Create a centered layout containing:

```tsx
<h1>Que veux-tu lancer ?</h1>
<p>Démarre un agent sur ta machine. La session continuera même hors ligne.</p>
<Composer ... />
{error && <div role="alert">{error}</div>}
```

Use the approved restrained ambient gradient and max width near 680 px. Keep the error directly under the composer.

- [ ] **Step 5: Run creation-view tests**

Run:

```bash
npm test -w client -- NewSessionView
npm run typecheck -w client
```

Expected: NewSessionView tests PASS.

- [ ] **Step 6: Commit the creation view**

```bash
git add client/src/components/Composer.tsx client/src/components/NewSessionView.tsx client/src/components/NewSessionView.test.tsx client/src/api.ts
git commit -m "Create dedicated new-session experience"
```

---

### Task 6: Build the terminal-only session view and recompose App

**Files:**
- Create: `client/src/components/SessionView.tsx`
- Create: `client/src/components/SessionView.test.tsx`
- Modify: `client/src/components/Terminal.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Write the failing terminal-first layout test**

Create `SessionView.test.tsx`, mocking Terminal so xterm does not require canvas:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SessionView from './SessionView';

vi.mock('./Terminal', () => ({ default: () => <div data-testid="terminal" /> }));

const session = {
  id: 'deck_1', title: 'Corriger le terminal', cli: 'claude', cliLabel: 'Claude Code',
  created: 1, attached: false, running: true,
};

describe('SessionView', () => {
  it('renders the terminal without a status badge or composer', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    expect(screen.getByTestId('terminal')).toBeInTheDocument();
    expect(screen.getByText('Corriger le terminal')).toBeInTheDocument();
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Envoyer une commande/i)).not.toBeInTheDocument();
  });

  it('exposes rename and delete from the overflow menu', () => {
    render(<SessionView session={session} sidebarOpen onOpenSidebar={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} onMissing={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la session' }));
    expect(screen.getByRole('button', { name: 'Renommer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run `npm test -w client -- SessionView`; expected FAIL because the component does not exist.

- [ ] **Step 3: Implement `SessionView`**

Create a component with:

- a 48–52 px header;
- sidebar-open button only when needed;
- `CliIcon`, title, and `MoreHorizontal` action button;
- no status text;
- a menu containing Rename and Delete;
- a compact inline rename input in the header;
- `<TerminalView sessionId={session.id} onMissing={onMissing} />` filling all remaining height.

The delete button delegates to `onDelete`; App retains the confirmation boundary.

- [ ] **Step 4: Handle missing terminal sessions explicitly**

Change `Terminal.tsx` props to:

```ts
interface Props {
  sessionId: string;
  onMissing?: () => void;
}
```

In `ws.onclose`, call `onMissing` only when `event.code === 4004`; otherwise retain a concise terminal disconnect message. Do not treat normal React cleanup as a missing session.

- [ ] **Step 5: Recompose App around the two distinct modes**

In `App.tsx`:

- remove the session-level `Composer` import and JSX;
- remove the status pill;
- render `NewSessionView` when `active === null`;
- render `SessionView` when `activeSession` exists;
- keep a short loading state while a newly created session waits for its first pushed snapshot;
- maintain `creating` and `createError` state;
- catch `ApiError` from `createSession()` and keep the user on the creation screen;
- clear `active` if the terminal reports a missing session;
- pass rename/delete callbacks to `SessionView`.

Use this creation boundary:

```ts
const createSession = async (input: string) => {
  setCreating(true);
  setCreateError(null);
  try {
    const { id } = await api.createSession({ cli, title: input.slice(0, 60), input });
    setActive(id);
    if (isMobile()) setSidebarOpen(false);
  } catch (error) {
    setCreateError(error instanceof Error ? error.message : 'Impossible de lancer la session.');
  } finally {
    setCreating(false);
  }
};
```

- [ ] **Step 6: Run session/App tests and typecheck**

Run:

```bash
npm test -w client
npm run typecheck -w client
```

Expected: all client tests PASS; no rendered session view contains the creation composer or textual status.

- [ ] **Step 7: Commit terminal-first session UI**

```bash
git add client/src/components/SessionView.tsx client/src/components/SessionView.test.tsx client/src/components/Terminal.tsx client/src/App.tsx
git commit -m "Make open sessions terminal-only"
```

---

### Task 7: Apply final visual system, responsive behavior, and PWA brand

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/index.html`
- Modify: `client/public/favicon.svg`
- Modify: `client/public/pwa-192.png`
- Modify: `client/public/pwa-512.png`
- Modify: `client/public/apple-touch-icon.png`

- [ ] **Step 1: Replace visual tokens with the approved palette**

Set exact theme values in `index.css`:

```css
@theme {
  --color-bg: #090a0c;
  --color-sidebar: #0e1013;
  --color-elevated: #14171b;
  --color-hover: #181b20;
  --color-active: #1d2127;
  --color-border: #252a31;
  --color-border-soft: #1c2025;
  --color-text: #f0f1f3;
  --color-dim: #8b929d;
  --color-faint: #565d68;
  --color-green: #42d889;
  --color-danger: #ef6a79;
}
```

Keep shadows restrained and use one cool accent only for primary/focus actions. Ensure focus-visible outlines meet contrast requirements.

- [ ] **Step 2: Make the terminal near-full-screen**

Give the terminal host one subtle border/radius surface on desktop and reduce both on mobile. Remove bottom spacing reserved for the old composer. Ensure `.xterm`, `.xterm-viewport`, and the host remain height `100%` with no page-level scroll.

- [ ] **Step 3: Finish mobile behavior**

At widths below 768 px:

- sidebar is a fixed overlay with a scrim;
- terminal outer padding is 6–8 px;
- header respects `env(safe-area-inset-top)`;
- no fixed bottom control exists;
- buttons have at least 40 px touch targets;
- composer on the creation screen uses `calc(100vw - 24px)`.

- [ ] **Step 4: Update PWA metadata warning**

Add to `client/index.html`:

```html
<meta name="mobile-web-app-capable" content="yes" />
```

Keep the existing Apple-specific meta tag.

- [ ] **Step 5: Regenerate brand assets**

Replace `favicon.svg` with the approved monochrome stacked-deck mark on the warm-black background. Generate committed PNGs from that SVG:

```bash
rsvg-convert -w 192 -h 192 client/public/favicon.svg -o client/public/pwa-192.png
rsvg-convert -w 512 -h 512 client/public/favicon.svg -o client/public/pwa-512.png
rsvg-convert -w 180 -h 180 client/public/favicon.svg -o client/public/apple-touch-icon.png
```

If `rsvg-convert` is unavailable, use macOS `sips` after rendering a 512 px source; do not add a runtime image dependency.

- [ ] **Step 6: Run all client checks**

Run:

```bash
npm test -w client
npm run typecheck -w client
npm run build -w client
```

Expected: tests PASS; Vite emits the PWA manifest/service worker; build exits 0.

- [ ] **Step 7: Commit the visual system**

```bash
git add client/src/index.css client/index.html client/public/favicon.svg client/public/pwa-192.png client/public/pwa-512.png client/public/apple-touch-icon.png
git commit -m "Polish responsive terminal-first visual system"
```

---

### Task 8: Add a production smoke test and verify the complete flow

**Files:**
- Create: `scripts/smoke-test.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Create a production smoke test**

Create `scripts/smoke-test.mjs` that:

1. logs in with `AGENT_DECK_PASSWORD`;
2. creates a Shell session with `echo AGENT-DECK-SMOKE`;
3. asserts `/api/sessions` returns the session;
4. opens `/ws/events` and receives a sessions snapshot;
5. opens `/ws/<id>`, sends a resize frame, and waits for `AGENT-DECK-SMOKE` in scrollback/live output;
6. runs `tmux has-session -t <id>` on the default socket and asserts failure;
7. runs `tmux -L agent-deck -f /dev/null has-session -t <id>` and asserts success;
8. deletes the session in a `finally` block.

Use Node's built-in `fetch`, `WebSocket`, `child_process.execFile`, and `assert`; add no dependency.

- [ ] **Step 2: Add aggregate scripts**

Update root `package.json`:

```json
"test": "npm test -w server && npm test -w client",
"verify": "npm run test && npm run typecheck && npm run build",
"smoke": "node scripts/smoke-test.mjs"
```

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
npm run verify
AGENT_DECK_PASSWORD=deck AGENT_DECK_SECRET=local-test PORT=3000 npm start
```

In another shell run:

```bash
AGENT_DECK_PASSWORD=deck npm run smoke
```

Expected: unit/component tests PASS, typecheck/build exit 0, smoke prints success, and the default tmux server never contains the smoke session.

- [ ] **Step 4: Perform browser UI verification**

Using Chrome at `http://localhost:3000`, verify:

- login succeeds;
- the new-session screen is the only screen with a composer;
- picker includes Claude Code, Codex, Gemini CLI, OpenCode, Devin, Grok Code, and Shell with official icons;
- missing Grok returns an inline error and creates no row;
- Shell opens a clean terminal with no injected `SESSIONS` panel;
- session header has no status badge;
- sidebar has only green/gray dots;
- rename and delete work from the header actions;
- reloading restores scrollback;
- at 390×844 the sidebar overlays and terminal fills the viewport.

Capture desktop new-session, desktop terminal, and mobile terminal screenshots for review; do not commit screenshots unless requested.

- [ ] **Step 5: Update README**

Document:

- the dedicated tmux socket and why it prevents user-config contamination;
- Devin and Grok Code in the built-in CLI list;
- the missing-CLI launch error behavior;
- `npm test`, `npm run verify`, and `npm run smoke`;
- how to override `AGENT_DECK_TMUX_SOCKET` for testing.

- [ ] **Step 6: Final diff review**

Run:

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Check that no generated `dist`, `node_modules`, test session metadata, secrets, or screenshots are staged.

- [ ] **Step 7: Commit verification and docs**

```bash
git add scripts/smoke-test.mjs package.json README.md
git commit -m "Add end-to-end regression coverage for Agent Deck"
```

- [ ] **Step 8: Final clean verification**

Run:

```bash
npm run verify
git status --short
```

Expected: all checks PASS and the working tree is clean.
