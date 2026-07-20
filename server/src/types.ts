export interface CliDef {
  id: string;
  label: string;
  command: string;
}

export type SessionCreateErrorCode =
  | 'unknown_cli'
  | 'cli_unavailable'
  | 'invalid_cwd'
  | 'session_create_failed';

export interface ApiErrorBody {
  code: SessionCreateErrorCode;
  error: string;
  command?: string;
}

export interface SessionMeta {
  title: string;
  cli: string;
  cliLabel: string;
  created: number;
}

// working: the process is actively producing output.
// waiting: a CLI is open but silent (most likely waiting for the user).
// idle: nothing but a shell prompt.
export type SessionState = 'working' | 'waiting' | 'idle';

export interface TmuxSession {
  name: string;
  created: number;
  attached: boolean;
  state: SessionState;
  command: string;
}

export interface SessionDTO {
  id: string;
  title: string;
  cli: string;
  cliLabel: string;
  created: number;
  attached: boolean;
  state: SessionState;
}
