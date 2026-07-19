export interface CliDef {
  id: string;
  label: string;
  command: string;
}

export type SessionCreateErrorCode =
  | 'unknown_cli'
  | 'cli_unavailable'
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

export interface TmuxSession {
  name: string;
  created: number;
  attached: boolean;
  running: boolean;
  command: string;
}

export interface SessionDTO {
  id: string;
  title: string;
  cli: string;
  cliLabel: string;
  created: number;
  attached: boolean;
  running: boolean;
}
