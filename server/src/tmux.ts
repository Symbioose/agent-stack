import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { SHELLS, sessionStateTracker } from './session-state.js';
import { loginShell } from './shell.js';
import type { TmuxSession } from './types.js';

export { loginShell } from './shell.js';

const exec = promisify(execFile);

export const PREFIX = 'deck_';

// tmux matches "-t name" by prefix; "=name" forces an exact match so a
// truncated id can never target another session. Session-target commands
// (has-session, kill-session, attach-session) take "=name", but pane-target
// commands (send-keys, capture-pane, set-option…) only resolve the exact
// form when the session is spelled out as "=name:".
export function exactSession(name: string): string {
  return `=${name}`;
}

function exactPane(name: string): string {
  return `=${name}:`;
}

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

export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const { stdout } = await runTmux(
      'list-sessions',
      '-F',
      '#{session_name}\t#{session_created}\t#{session_attached}\t#{pane_current_command}\t#{window_activity}',
    );
    const now = Date.now();
    const sessions = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line): TmuxSession => {
        const [name, created, attached, cmd, activity] = line.split('\t');
        const activityAt = Number(activity) * 1000;
        // Bucket activity to 15s so the event stream is not spammed with
        // near-identical payloads while an agent produces output.
        const lastActivity = Math.floor(activityAt / 15000) * 15000;
        return {
          name,
          created: Number(created) * 1000,
          lastActivity,
          attached: attached !== '0',
          state: sessionStateTracker.state(name, cmd, activityAt, now),
          command: cmd,
        };
      })
      .filter((s) => s.name.startsWith(PREFIX));
    sessionStateTracker.prune(new Set(sessions.map((session) => session.name)));
    return sessions;
  } catch {
    return []; // no tmux server running yet
  }
}

export async function createSession(name: string, command: string, cwd?: string): Promise<void> {
  // Always start a real login shell, then launch the CLI inside it. The user
  // keeps a usable shell (cd, ls, git...) when the CLI exits instead of the
  // whole session dying with it.
  await runTmux(
    'new-session', '-d', '-s', name, '-x', '200', '-y', '50',
    '-c', cwd || process.env.HOME || '.',
    `${loginShell()} -l`,
  );
  await runTmux('set-option', '-t', exactPane(name), 'status', 'off');
  await runTmux('set-option', '-t', exactPane(name), 'history-limit', '20000');
  if (command) await sendInput(name, command);
}

export async function killSession(name: string): Promise<void> {
  await runTmux('kill-session', '-t', exactSession(name));
}

export async function sendInput(name: string, text: string): Promise<void> {
  sessionStateTracker.recordInput(name);
  // Send the literal text, then a separate Enter so multi-line stays intact.
  await runTmux('send-keys', '-t', exactPane(name), '-l', text);
  await runTmux('send-keys', '-t', exactPane(name), 'Enter');
}

// Type the first prompt only once the pane stopped running a shell, i.e. the
// agent CLI actually booted. On a fixed timer, a slow-starting CLI would let
// the prompt text reach the shell instead — and get executed as a command.
export async function sendInputWhenReady(name: string, text: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let command: string;
    try {
      const { stdout } = await runTmux(
        'display-message', '-p', '-t', exactPane(name), '#{pane_current_command}',
      );
      command = stdout.trim();
    } catch {
      return; // session is gone
    }
    if (command && !SHELLS.has(command)) {
      await delay(300); // let the CLI finish drawing its input widget
      await sendInput(name, text);
      return;
    }
    await delay(250);
  }
  // The CLI never started: drop the prompt rather than typing it into the shell.
}

// Scrolling history from the web client goes through tmux copy-mode, which
// only engages when tmux owns the mouse: with it off, wheel events reach the
// pane as arrow keys and touch gestures do nothing at all. Global so that
// sessions created before this option existed pick it up on their next attach.
export async function enableMouse(): Promise<void> {
  await runTmux('set-option', '-g', 'mouse', 'on');
}

export async function hasSession(name: string): Promise<boolean> {
  try {
    await runTmux('has-session', '-t', exactSession(name));
    return true;
  } catch {
    return false;
  }
}

// Capture the scrollback (with ANSI colors) so a reconnecting client can see history.
export async function captureScrollback(name: string, lines = 2000): Promise<string> {
  try {
    const { stdout } = await runTmux(
      'capture-pane',
      '-t',
      exactPane(name),
      '-p',
      '-e',
      '-J',
      '-S',
      `-${lines}`,
    );
    return stdout.replace(/\n/g, '\r\n');
  } catch {
    return '';
  }
}
