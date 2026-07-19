import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { SessionMeta } from './types.js';

const DIR = path.join(os.homedir(), '.agent-deck');
const FILE = path.join(DIR, 'sessions.json');

type Store = Record<string, SessionMeta>;

function load(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function save(data: Store): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getMeta(name: string): SessionMeta | undefined {
  return load()[name];
}

export function setMeta(name: string, meta: SessionMeta): void {
  const data = load();
  data[name] = meta;
  save(data);
}

export function deleteMeta(name: string): void {
  const data = load();
  delete data[name];
  save(data);
}
