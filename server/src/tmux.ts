import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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

// Commands that mean the pane is "idle" (just a shell prompt waiting).
const SHELLS = new Set(['bash', 'zsh', 'fish', 'sh', 'dash', 'tmux']);

export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const { stdout } = await runTmux(
      'list-sessions',
      '-F',
      '#{session_name}\t#{session_created}\t#{session_attached}\t#{pane_current_command}',
    );
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line): TmuxSession => {
        const [name, created, attached, cmd] = line.split('\t');
        return {
          name,
          created: Number(created) * 1000,
          attached: attached !== '0',
          running: !SHELLS.has(cmd),
          command: cmd,
        };
      })
      .filter((s) => s.name.startsWith(PREFIX));
  } catch {
    return []; // no tmux server running yet
  }
}

export async function createSession(name: string, command: string, cwd?: string): Promise<void> {
  const args = ['new-session', '-d', '-s', name, '-x', '200', '-y', '50', '-c', cwd || process.env.HOME || '.'];
  if (command) args.push(command);
  await runTmux(...args);
  await runTmux('set-option', '-t', name, 'status', 'off');
  await runTmux('set-option', '-t', name, 'history-limit', '20000');
  // Keep the window alive after the command exits so the terminal stays usable.
  await runTmux('set-option', '-t', name, 'remain-on-exit', 'off').catch(() => {});
}

export async function killSession(name: string): Promise<void> {
  await runTmux('kill-session', '-t', name);
}

export async function sendInput(name: string, text: string): Promise<void> {
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
