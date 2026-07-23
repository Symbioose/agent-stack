import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MoreHorizontal, PanelLeftOpen, Pencil, Trash2 } from 'lucide-react';
import CliIcon from './CliIcon';
import TerminalView from './Terminal';
import { api } from '../api';
import type { Session } from '../types';

interface Props {
  session: Session;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  onRename: (title: string) => void | Promise<unknown>;
  onDelete: () => void;
  onMissing: () => void;
}

export default function SessionView({ session, sidebarOpen, onOpenSidebar, onRename, onDelete, onMissing }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [quickText, setQuickText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing straight into xterm.js on a phone is painful (virtual keyboard,
  // autocorrect). This bar sends whole messages through the input API instead.
  const sendQuick = () => {
    const text = quickText.trim();
    if (!text) return;
    setQuickText('');
    void api.sendInput(session.id, text).catch(() => setQuickText(text));
  };

  useEffect(() => setTitle(session.title), [session.title]);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const commitRename = () => {
    const next = title.trim();
    if (next && next !== session.title) void onRename(next);
    else setTitle(session.title);
    setRenaming(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="relative z-20 flex min-h-[52px] items-center gap-2.5 border-b border-border-soft bg-bg px-4 max-md:px-2.5 max-md:pt-[env(safe-area-inset-top)]">
        {!sidebarOpen && (
          <button
            onClick={onOpenSidebar}
            title="Open sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
        <CliIcon cli={session.cli} label={session.cliLabel} size={22} />
        {renaming ? (
          <input
            ref={inputRef}
            value={title}
            maxLength={100}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') {
                setTitle(session.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 max-w-[520px] flex-1 rounded-md border border-border bg-elevated px-2 py-1 text-[13.5px] font-medium outline-none focus:border-white/20"
          />
        ) : (
          <span className="min-w-0 truncate text-[13.5px] font-medium tracking-[-0.01em]">{session.title}</span>
        )}
        <div className="relative ml-auto" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Session actions"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-40 animate-fade-in rounded-xl border border-border bg-elevated p-1.5 shadow-[0_14px_40px_rgba(0,0,0,.5)]">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] transition-colors hover:bg-hover"
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-danger transition-colors hover:bg-danger/[0.08]"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 p-3 max-md:p-1.5">
        <div className="h-full overflow-hidden rounded-xl border border-border-soft bg-[#090b0d] shadow-[0_14px_45px_rgba(0,0,0,.16),inset_0_1px_rgba(255,255,255,.012)] max-md:rounded-lg">
          <TerminalView key={session.id} sessionId={session.id} onMissing={onMissing} />
        </div>
      </div>
      <form
        className="px-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
        onSubmit={(event) => {
          event.preventDefault();
          sendQuick();
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-3 py-1.5">
          <input
            value={quickText}
            onChange={(event) => setQuickText(event.target.value)}
            placeholder="Message the agent…"
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className="min-w-0 flex-1 bg-transparent py-1 text-[16px] outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={!quickText.trim()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text text-bg transition-opacity active:scale-95 disabled:opacity-25"
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  );
}
