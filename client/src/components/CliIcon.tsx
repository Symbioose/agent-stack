import { clsx } from 'clsx';

interface Props {
  cli: string;
  size?: number;
  className?: string;
}

const GLYPHS: Record<string, { bg: string; svg: React.ReactNode }> = {
  claude: {
    bg: '#d97757',
    svg: (
      <svg viewBox="0 0 24 24" fill="#fff" width="62%" height="62%">
        <path d="M4.7 15.3 8.9 3.4h2.3l4.2 11.9h-2.2l-.9-2.7H7.8l-.9 2.7H4.7Zm3.6-4.4h3.3L10 6.1l-1.7 4.8Z" />
        <path d="M14.5 15.3 18.7 3.4H21l-4.2 11.9h-2.3Z" opacity="0.55" />
      </svg>
    ),
  },
  codex: {
    bg: '#0b0c0e',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" width="58%" height="58%">
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
      </svg>
    ),
  },
  gemini: {
    bg: '#1a73e8',
    svg: (
      <svg viewBox="0 0 24 24" fill="#fff" width="60%" height="60%">
        <path d="M12 2c.4 5.3 4.7 9.6 10 10-5.3.4-9.6 4.7-10 10-.4-5.3-4.7-9.6-10-10 5.3-.4 9.6-4.7 10-10Z" />
      </svg>
    ),
  },
  opencode: {
    bg: '#a78bfa',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#0b0c0e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" width="58%" height="58%">
        <path d="M7 7 3 12l4 5" />
        <path d="m17 7 4 5-4 5" />
        <path d="m14 5-4 14" />
      </svg>
    ),
  },
  shell: {
    bg: '#2b303b',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#e6e9ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="58%" height="58%">
        <path d="m5 8 4 4-4 4" />
        <path d="M12 16h6" />
      </svg>
    ),
  },
};

export default function CliIcon({ cli, size = 24, className }: Props) {
  const g = GLYPHS[cli] || GLYPHS.shell;
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-md', className)}
      style={{ width: size, height: size, background: g.bg }}
    >
      {g.svg}
    </span>
  );
}
