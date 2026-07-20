import { LogOut, PanelLeftClose, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import BrandMark from './BrandMark';
import CliIcon from './CliIcon';
import type { Session, SessionState } from '../types';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const DOT: Record<SessionState, { label: string; className: string }> = {
  working: { label: 'Working', className: 'bg-amber shadow-[0_0_10px_rgba(232,163,75,.45)] animate-glow' },
  waiting: { label: 'Done — waiting for you', className: 'bg-green shadow-[0_0_9px_rgba(66,216,137,.4)]' },
  idle: { label: 'Idle', className: 'bg-faint' },
};

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onClose, onLogout }: Props) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-2.5 pb-2.5 pt-3">
      <div className="flex h-10 items-center justify-between px-1.5">
        <span className="flex items-center gap-2.5 text-[14px] font-semibold tracking-[-0.015em]">
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
        className="mb-5 mt-2.5 flex h-10 items-center gap-2.5 rounded-[10px] border border-border bg-gradient-to-b from-white/[0.045] to-transparent px-3 text-[13.5px] font-medium shadow-[0_6px_18px_rgba(0,0,0,.14),inset_0_1px_rgba(255,255,255,.04)] transition-all hover:border-white/20 hover:bg-hover active:scale-[0.99]"
      >
        <Plus size={16} className="text-dim" /> New session
      </button>

      <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
        History
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2">
        <AnimatePresence initial={false}>
          {sessions.map((session) => {
            const dot = DOT[session.state] ?? DOT.idle;
            return (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.14 } }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                data-testid="session-row"
                onClick={() => onSelect(session.id)}
                className={clsx(
                  'group relative flex h-[50px] w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 transition-colors',
                  activeId === session.id
                    ? 'bg-active shadow-[inset_0_0_0_1px_rgba(255,255,255,.035)]'
                    : 'hover:bg-hover',
                )}
              >
                <CliIcon cli={session.cli} label={session.cliLabel} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text">{session.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-faint">
                    {session.cliLabel} · {timeAgo(session.created)}
                  </span>
                </span>
                <span
                  aria-label={`${dot.label} session`}
                  title={dot.label}
                  className={clsx('h-[7px] w-[7px] shrink-0 rounded-full transition-opacity group-hover:opacity-0', dot.className)}
                />
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(session.id);
                  }}
                  title="Close session"
                  aria-label={`Close session ${session.title}`}
                  className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md text-dim opacity-0 transition-all hover:bg-white/[0.06] hover:text-danger group-hover:opacity-100 max-md:opacity-100"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sessions.length === 0 && (
          <div className="px-3 py-12 text-center">
            <div className="text-[12.5px] text-dim">No sessions yet</div>
            <div className="mt-1 text-[11.5px] text-faint">Start one from the composer</div>
          </div>
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
