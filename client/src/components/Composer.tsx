import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import CliIcon from './CliIcon';
import type { CliDef } from '../types';

interface Props {
  clis: CliDef[];
  cli: string;
  onCliChange: (id: string) => void;
  onSubmit: (text: string) => void;
  pending: boolean;
}

export default function Composer({ clis, cli, onCliChange, onSubmit, pending }: Props) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = clis.find((item) => item.id === cli) || clis[0];

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const submit = () => {
    const value = text.trim();
    if (!value || pending || !selected) return;
    onSubmit(value);
  };

  return (
    <div className="w-full rounded-[15px] border border-border bg-elevated/95 p-3.5 shadow-[0_22px_60px_rgba(0,0,0,.4),inset_0_1px_rgba(255,255,255,.03)] backdrop-blur-xl transition-colors focus-within:border-white/20">
      <textarea
        ref={inputRef}
        rows={1}
        placeholder="Décris la tâche à exécuter…"
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
      <div className="mt-2 flex items-end justify-between">
        {selected ? (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPickerOpen((open) => !open)}
              className="flex h-8 items-center gap-2 rounded-lg border border-border bg-white/[0.015] px-2.5 text-[12.5px] text-text transition-colors hover:bg-hover disabled:opacity-50"
            >
              <CliIcon cli={selected.id} label={selected.label} size={18} />
              <span>{selected.label}</span>
              <ChevronDown size={13} className={clsx('text-dim transition-transform', pickerOpen && 'rotate-180')} />
            </button>
            {pickerOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 min-w-[220px] animate-fade-in rounded-xl border border-border bg-elevated p-1.5 shadow-[0_16px_44px_rgba(0,0,0,.5)]">
                {clis.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onCliChange(item.id);
                      setPickerOpen(false);
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
              </div>
            )}
          </div>
        ) : <span />}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || pending || !selected}
          aria-label="Lancer la session"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-text text-bg shadow-[0_5px_14px_rgba(255,255,255,.08)] transition-opacity hover:opacity-85 disabled:opacity-25"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
