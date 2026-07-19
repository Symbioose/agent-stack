import { useEffect, useRef, useState } from 'react';
import { Plus, PanelLeftClose, Trash2, LogOut, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';
import CliIcon from './CliIcon';
import type { Session } from '../types';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

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

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onClose,
  onLogout,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editRef.current?.select();
  }, [editing]);

  const startEdit = (s: Session) => {
    setEditing(s.id);
    setDraft(s.title);
  };
  const commit = () => {
    if (editing && draft.trim()) onRename(editing, draft.trim());
    setEditing(null);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3.5">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <LayoutGrid size={18} className="text-green" /> Agent Deck
        </span>
        <button
          onClick={onClose}
          title="Fermer"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <button
        onClick={onNew}
        className="mx-2.5 mb-2.5 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[13.5px] font-medium transition-colors hover:bg-hover"
      >
        <Plus size={16} /> Nouvelle session
      </button>

      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Récent
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => editing !== s.id && onSelect(s.id)}
            className={clsx(
              'group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors',
              activeId === s.id ? 'bg-active' : 'hover:bg-hover',
            )}
          >
            <CliIcon cli={s.cli} size={28} />
            <div className="min-w-0 flex-1">
              {editing === s.id ? (
                <input
                  ref={editRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="w-full rounded-md border border-border bg-bg px-1.5 py-0.5 text-[13.5px] outline-none"
                />
              ) : (
                <div
                  className="truncate text-[13.5px]"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEdit(s);
                  }}
                >
                  {s.title}
                </div>
              )}
              <div className="mt-0.5 truncate text-[11.5px] text-dim">
                {s.cliLabel} · {timeAgo(s.created)}
              </div>
            </div>
            <span
              title={s.running ? 'En cours' : 'En attente'}
              className={clsx(
                'h-2 w-2 shrink-0 rounded-full',
                s.running ? 'animate-pulse-ring bg-green' : 'bg-faint',
              )}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              title="Supprimer"
              className="flex h-6 w-6 items-center justify-center rounded-md text-dim opacity-0 transition-all hover:bg-active hover:text-danger group-hover:opacity-100 max-md:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="mt-10 text-center text-[12.5px] text-faint">Aucune session active</div>
        )}
      </div>

      <div className="border-t border-border-soft px-3 py-2.5">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-dim transition-colors hover:bg-hover hover:text-text"
        >
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </div>
  );
}
