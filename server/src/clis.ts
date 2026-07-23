import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { loginShell } from './shell.js';
import type { CliDef } from './types.js';

const execFileAsync = promisify(execFile);

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
    super(`"${command}" is not installed on this machine.`);
  }
}

export function getDefaultClis(): CliDef[] {
  return DEFAULT_CLIS.map((cli) => ({ ...cli }));
}

export async function ensureCliAvailable(cli: CliDef): Promise<void> {
  if (!cli.command) return;
  const executable = cli.command.trim().split(/\s+/)[0];
  // Check availability through the user's real login shell (see shell.ts):
  // under systemd there is no $SHELL, and a plain /bin/sh wouldn't see PATH
  // entries set up in the user's own shell dotfiles (custom CLI installs).
  try {
    await execFileAsync(loginShell(), ['-lic', 'command -v -- "$1" >/dev/null', 'agent-deck', executable]);
  } catch {
    throw new CliUnavailableError(executable);
  }
}

function isCliDef(value: unknown): value is CliDef {
  if (!value || typeof value !== 'object') return false;
  const cli = value as Partial<CliDef>;
  return typeof cli.id === 'string' && cli.id.length > 0
    && typeof cli.label === 'string' && cli.label.length > 0
    && typeof cli.command === 'string';
}

export function getClis(): CliDef[] {
  const file = path.join(os.homedir(), '.agent-deck', 'clis.json');
  try {
    const custom = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(custom)) {
      // Keep only well-formed entries so a hand-edited file cannot produce
      // sessions with undefined commands.
      const valid = custom.filter(isCliDef).map(({ id, label, command }) => ({ id, label, command }));
      if (valid.length) return valid;
    }
  } catch {
    // fall through to defaults
  }
  return getDefaultClis();
}
