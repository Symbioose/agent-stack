import { LogOut, PanelLeftClose, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import BrandMark from './BrandMark';
import CliIcon from './CliIcon';
import type { Session } from '../types';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onClose, onLogout }: Props) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-2.5 pb-2.5 pt-3">
      <div className="flex h-10 items-center justify-between px-1.5">
        <span className="flex items-center gap-2.5 font-semibold tracking-[-0.015em]">
          <BrandMark size={24} /> Agent Deck
        </span>
        <button
          onClick={onClose}
          title="Close"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <button
        onClick={onNew}
        className="mb-5 mt-2.5 flex h-10 items-center gap-2.5 rounded-[10px] border border-border bg-gradient-to-b from-white/[0.035] to-transparent px-3 text-[13.5px] font-medium shadow-[0_6px_18px_rgba(0,0,0,.12)] transition-colors hover:border-white/15 hover:bg-hover"
      >
        <Plus size={16} /> New session
      </button>

      <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        History
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2">
        {sessions.map((session) => (
          <button
            data-testid="session-row"
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={clsx(
              'flex h-[50px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left transition-colors',
              activeId === session.id ? 'bg-active shadow-[inset_0_0_0_1px_rgba(255,255,255,.025)]' : 'hover:bg-hover',
            )}
          >
            <CliIcon cli={session.cli} label={session.cliLabel} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-text">{session.title}</span>
              <span className="mt-0.5 block truncate text-[11px] text-faint">
                {session.cliLabel} · {timeAgo(session.created)}
              </span>
            </span>
            <span
              aria-label={session.running ? 'Active session' : 'Idle session'}
              title={session.running ? 'Active' : 'Idle'}
              className={clsx(
                'h-[7px] w-[7px] shrink-0 rounded-full',
                session.running ? 'bg-green shadow-[0_0_10px_rgba(66,216,137,.35)]' : 'bg-faint',
              )}
            />
          </button>
        ))}
        {sessions.length === 0 && (
          <div className="px-3 py-10 text-center text-[12px] text-faint">No sessions yet</div>
        )}
      </div>

      <div className="border-t border-border-soft px-1 pt-2.5">
        <button
          onClick={onLogout}
          className="flex h-9 items-center gap-2 rounded-lg px-2 text-[12.5px] text-dim transition-colors hover:bg-hover hover:text-text"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
