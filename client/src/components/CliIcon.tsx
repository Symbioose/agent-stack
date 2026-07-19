import ClaudeCode from '@lobehub/icons/es/ClaudeCode/components/Color.js';
import Codex from '@lobehub/icons/es/Codex/components/Color.js';
import Devin from '@lobehub/icons/es/Devin/components/Color.js';
import GeminiCLI from '@lobehub/icons/es/GeminiCLI/components/Color.js';
import Grok from '@lobehub/icons/es/Grok/components/Mono.js';
import OpenCode from '@lobehub/icons/es/OpenCode/components/Mono.js';
import type { IconType } from '@lobehub/icons/es/types/index.js';
import { clsx } from 'clsx';
import { SquareTerminal } from 'lucide-react';

interface Props {
  cli: string;
  label?: string;
  size?: number;
  className?: string;
}

const ICONS: Record<string, IconType> = {
  claude: ClaudeCode,
  codex: Codex,
  gemini: GeminiCLI,
  opencode: OpenCode,
  devin: Devin,
  grok: Grok,
};

const LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
  devin: 'Devin',
  grok: 'Grok Code',
  shell: 'Shell',
};

export default function CliIcon({ cli, label = LABELS[cli] || cli, size = 24, className }: Props) {
  const Icon = ICONS[cli];
  const iconSize = size * 0.72;
  return (
    <span
      role="img"
      aria-label={label}
      className={clsx('inline-flex shrink-0 items-center justify-center text-current', className)}
      style={{ width: size, height: size }}
    >
      {Icon ? <Icon aria-hidden="true" size={iconSize} /> : <SquareTerminal aria-hidden="true" size={iconSize} />}
    </span>
  );
}
