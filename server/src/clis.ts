import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
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
  const shell = process.env.SHELL || '/bin/sh';
  try {
    await execFileAsync(shell, ['-lc', 'command -v -- "$1" >/dev/null', 'agent-deck', executable]);
  } catch {
    throw new CliUnavailableError(executable);
  }
}

export function getClis(): CliDef[] {
  const file = path.join(os.homedir(), '.agent-deck', 'clis.json');
  try {
    const custom = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(custom) && custom.length) return custom as CliDef[];
  } catch {
    // fall through to defaults
  }
  return getDefaultClis();
}
