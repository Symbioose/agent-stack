import { useEffect, useRef, useState } from 'react';
import { LogOut, PanelLeftClose, Pencil, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Lenis from 'lenis';
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
  idle: { label: 'Paused', className: 'bg-faint' },
};

interface Props {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete, onRename, onClose, onLogout }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [, setClock] = useState(0);

  // Re-render periodically so the "x min ago" labels do not go stale while
  // the session list itself is unchanged.
  useEffect(() => {
    const timer = setInterval(() => setClock((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  const startRename = (session: Session) => {
    setRenamingId(session.id);
    setDraftTitle(session.title);
  };

  const commitRename = (session: Session) => {
    const next = draftTitle.trim();
    if (next && next !== session.title) onRename(session.id, next);
    setRenamingId(null);
  };

  // Buttery smooth scrolling for the history list (Lenis) — desktop only.
  // On touch screens Lenis intercepts the swipe without driving its own
  // scroll, so the list becomes impossible to scroll; native momentum
  // scrolling handles touch far better there.
  useEffect(() => {
    const wrapper = listRef.current;
    if (
      !wrapper
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || window.matchMedia('(pointer: coarse)').matches
    ) return;
    const lenis = new Lenis({ wrapper, lerp: 0.16 });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-sidebar px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pl-[max(0.625rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      <div ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2">
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
                  {renamingId === session.id ? (
                    <input
                      ref={renameInputRef}
                      value={draftTitle}
                      maxLength={100}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onBlur={() => commitRename(session)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRename(session);
                        if (event.key === 'Escape') setRenamingId(null);
                      }}
                      className="block w-full rounded-md border border-border bg-bg px-1.5 py-0.5 text-[13px] font-medium text-text outline-none focus:border-white/20"
                    />
                  ) : (
                    <span className="block truncate text-[13px] font-medium text-text">{session.title}</span>
                  )}
                  <span className="mt-0.5 block truncate text-[11px] text-faint">
                    {session.cliLabel} · {timeAgo(session.lastActivity)}
                  </span>
                </span>
                {renamingId !== session.id && (
                  <span
                    aria-label={`${dot.label} session`}
                    title={dot.label}
                    className={clsx('h-[7px] w-[7px] shrink-0 rounded-full transition-opacity group-hover:opacity-0', dot.className)}
                  />
                )}
                {renamingId !== session.id && (
                  <>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        startRename(session);
                      }}
                      title="Rename session"
                      aria-label={`Rename session ${session.title}`}
                      className="absolute right-9 flex h-7 w-7 items-center justify-center rounded-md text-dim opacity-0 transition-all hover:bg-white/[0.06] hover:text-text group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Pencil size={13} />
                    </button>
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
                  </>
                )}
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
