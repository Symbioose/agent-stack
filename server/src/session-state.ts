import type { TmuxSession } from './types.js';

export const INPUT_ECHO_GRACE_MS = 1000;
export const OUTPUT_FRESH_MS = 3000;
export const WORKING_QUIET_MS = 7500;
export const IDLE_AFTER_MS = 30 * 60 * 1000;

export const SHELLS = new Set(['bash', 'zsh', 'fish', 'sh', 'dash', 'tmux']);

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
