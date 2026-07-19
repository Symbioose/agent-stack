import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { CliDef } from './types.js';

const DEFAULT_CLIS: CliDef[] = [
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'codex', label: 'Codex', command: 'codex' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini' },
  { id: 'opencode', label: 'OpenCode', command: 'opencode' },
  { id: 'shell', label: 'Shell', command: '' },
];

export function getClis(): CliDef[] {
  const file = path.join(os.homedir(), '.agent-deck', 'clis.json');
  try {
    const custom = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(custom) && custom.length) return custom as CliDef[];
  } catch {
    // fall through to defaults
  }
  return DEFAULT_CLIS;
}
