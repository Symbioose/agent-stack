import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { sessionStateTracker } from './session-state.js';
import type { TmuxSession } from './types.js';

const exec = promisify(execFile);

export const PREFIX = 'deck_';

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

// Resolve the user's real login shell instead of relying on tmux's own
// default-shell option. That option is derived from the tmux SERVER's
// environment at the time it first started; a systemd-managed server has no
// $SHELL and falls back to tmux's compiled-in default (bash) even when the
// user's actual shell (in /etc/passwd) is something else, such as zsh.
export function loginShell(): string {
  try {
    return process.env.SHELL || os.userInfo().shell || '/bin/sh';
  } catch {
    return process.env.SHELL || '/bin/sh';
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
  await runTmux('set-option', '-t', name, 'status', 'off');
  await runTmux('set-option', '-t', name, 'history-limit', '20000');
  if (command) await sendInput(name, command);
}

export async function killSession(name: string): Promise<void> {
  await runTmux('kill-session', '-t', name);
}

export async function sendInput(name: string, text: string): Promise<void> {
  sessionStateTracker.recordInput(name);
  // Send the literal text, then a separate Enter so multi-line stays intact.
  await runTmux('send-keys', '-t', name, '-l', text);
  await runTmux('send-keys', '-t', name, 'Enter');
}

export async function hasSession(name: string): Promise<boolean> {
  try {
    await runTmux('has-session', '-t', name);
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
      name,
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
