export interface CliDef {
  id: string;
  label: string;
  command: string;
}

export interface Session {
  id: string;
  title: string;
  cli: string;
  cliLabel: string;
  created: number;
  attached: boolean;
  running: boolean;
}
