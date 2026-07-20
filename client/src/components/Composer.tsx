import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, CornerLeftUp, Folder, FolderPlus, House } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import CliIcon from './CliIcon';
import { api } from '../api';
import type { CliDef } from '../types';

interface Props {
  clis: CliDef[];
  cli: string;
  onCliChange: (id: string) => void;
  cwd: string;
  onCwdChange: (path: string) => void;
  onSubmit: (text: string) => void;
  pending: boolean;
}

interface BrowseState {
  path: string;
  parent: string;
  home: string;
  dirs: string[];
}

function shortenPath(value: string, home?: string): string {
  if (home && value.startsWith(home)) return `~${value.slice(home.length)}` || '~';
  return value;
}

const dropdownMotion = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.13, ease: 'easeOut' as const },
};

export default function Composer({ clis, cli, onCliChange, cwd, onCwdChange, onSubmit, pending }: Props) {
  const [text, setText] = useState('');
  const [cliOpen, setCliOpen] = useState(false);
  const [dirOpen, setDirOpen] = useState(false);
  const [browse, setBrowse] = useState<BrowseState | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [dirError, setDirError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cliRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<HTMLDivElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const selected = clis.find((item) => item.id === cli) || clis[0];

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (newFolder !== null) newFolderRef.current?.focus();
  }, [newFolder]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (!cliOpen && !dirOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!cliRef.current?.contains(target)) setCliOpen(false);
      if (!dirRef.current?.contains(target)) setDirOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [cliOpen, dirOpen]);

  const openBrowser = async (path?: string) => {
    try {
      const data = await api.browse(path ?? cwd);
      setBrowse(data);
      setDirOpen(true);
      setDirError('');
      setNewFolder(null);
    } catch {
      setBrowse(null);
    }
  };

  const createFolder = async () => {
    const name = newFolder?.trim();
    if (!name || !browse) return;
    try {
      const { path } = await api.mkdir(browse.path, name);
      setNewFolder(null);
      await openBrowser(path);
    } catch (error) {
      setDirError(error instanceof Error ? error.message : 'Could not create folder.');
    }
  };

  const submit = () => {
    const value = text.trim();
    if (!value || pending || !selected) return;
    onSubmit(value);
  };

  const displayedCwd = browse ? shortenPath(cwd, browse.home) : cwd;

  return (
    <div className="w-full rounded-2xl border border-border bg-elevated/95 p-3.5 shadow-[0_22px_60px_rgba(0,0,0,.4),inset_0_1px_rgba(255,255,255,.035)] backdrop-blur-xl transition-colors focus-within:border-white/20">
      <textarea
        ref={inputRef}
        rows={1}
        placeholder="Describe the task to run…"
        value={text}
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="min-h-11 max-h-[180px] w-full resize-none bg-transparent px-0.5 text-[15px] leading-relaxed text-text outline-none placeholder:text-faint disabled:opacity-60"
      />
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {selected && (
            <div className="relative" ref={cliRef}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setCliOpen((open) => !open);
                  setDirOpen(false);
                }}
                className="flex h-8 items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-2.5 text-[12.5px] text-text transition-colors hover:border-white/15 hover:bg-hover disabled:opacity-50"
              >
                <CliIcon cli={selected.id} label={selected.label} size={18} />
                <span>{selected.label}</span>
                <ChevronDown size={13} className={clsx('text-dim transition-transform', cliOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {cliOpen && (
                  <motion.div
                    {...dropdownMotion}
                    className="absolute bottom-[calc(100%+8px)] left-0 z-20 min-w-[220px] origin-bottom-left rounded-xl border border-border bg-elevated p-1.5 shadow-[0_16px_44px_rgba(0,0,0,.5)]"
                  >
                    {clis.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onCliChange(item.id);
                          setCliOpen(false);
                        }}
                        className={clsx(
                          'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors hover:bg-hover',
                          item.id === cli && 'bg-active',
                        )}
                      >
                        <CliIcon cli={item.id} label={item.label} size={20} />
                        <span className="flex-1">{item.label}</span>
                        {item.id === cli && <Check size={14} className="text-dim" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="relative min-w-0" ref={dirRef}>
            <button
              type="button"
              disabled={pending}
              title="Working folder"
              onClick={() => {
                setCliOpen(false);
                if (dirOpen) setDirOpen(false);
                else void openBrowser();
              }}
              className="flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-white/[0.02] px-2.5 text-[12.5px] text-dim transition-colors hover:border-white/15 hover:bg-hover hover:text-text disabled:opacity-50 max-sm:max-w-[130px]"
            >
              <Folder size={13} className="shrink-0" />
              <span className="truncate">{displayedCwd}</span>
              <ChevronDown size={13} className={clsx('shrink-0 transition-transform', dirOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {dirOpen && browse && (
                <motion.div
                  {...dropdownMotion}
                  className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[310px] origin-bottom-left rounded-xl border border-border bg-elevated shadow-[0_16px_44px_rgba(0,0,0,.5)] max-sm:w-[262px]"
                >
                  <div className="flex items-center gap-1 border-b border-border-soft px-2 py-2">
                    <button
                      type="button"
                      title="Parent folder"
                      onClick={() => void openBrowser(browse.parent)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dim transition-colors hover:bg-hover hover:text-text"
                    >
                      <CornerLeftUp size={13} />
                    </button>
                    <button
                      type="button"
                      title="Home"
                      onClick={() => void openBrowser(browse.home)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dim transition-colors hover:bg-hover hover:text-text"
                    >
                      <House size={13} />
                    </button>
                    <button
                      type="button"
                      title="New folder"
                      onClick={() => {
                        setNewFolder('');
                        setDirError('');
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-dim transition-colors hover:bg-hover hover:text-text"
                    >
                      <FolderPlus size={13} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-right font-mono text-[10.5px] text-faint">
                      {shortenPath(browse.path, browse.home)}
                    </span>
                  </div>
                  {newFolder !== null && (
                    <div className="border-b border-border-soft p-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={newFolderRef}
                          value={newFolder}
                          placeholder="Folder name"
                          onChange={(event) => setNewFolder(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void createFolder();
                            if (event.key === 'Escape') setNewFolder(null);
                          }}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-bg px-2.5 text-[12.5px] outline-none focus:border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => void createFolder()}
                          disabled={!newFolder?.trim()}
                          className="flex h-8 shrink-0 items-center rounded-lg bg-text px-2.5 text-[12px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-30"
                        >
                          Create
                        </button>
                      </div>
                      {dirError && <div className="px-1 pt-1.5 text-[11.5px] text-danger">{dirError}</div>}
                    </div>
                  )}
                  <div className="max-h-[210px] overflow-y-auto p-1.5">
                    {browse.dirs.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => void openBrowser(`${browse.path}/${name}`)}
                        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors hover:bg-hover"
                      >
                        <Folder size={13} className="shrink-0 text-faint" />
                        <span className="truncate">{name}</span>
                      </button>
                    ))}
                    {browse.dirs.length === 0 && (
                      <div className="px-2 py-3 text-center text-[12px] text-faint">No subfolders</div>
                    )}
                  </div>
                  <div className="border-t border-border-soft p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onCwdChange(browse.path);
                        setDirOpen(false);
                      }}
                      className="flex h-8 w-full items-center justify-center rounded-lg bg-text text-[12.5px] font-medium text-bg transition-opacity hover:opacity-90"
                    >
                      Use this folder
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || pending || !selected}
          aria-label="Start session"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text text-bg shadow-[0_5px_14px_rgba(255,255,255,.08)] transition-all hover:opacity-85 active:scale-95 disabled:opacity-25"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
