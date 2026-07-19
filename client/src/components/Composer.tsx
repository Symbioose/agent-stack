import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import CliIcon from './CliIcon';
import type { CliDef } from '../types';

interface Props {
  clis: CliDef[];
  cli?: string;
  onCliChange?: (id: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  showCliPicker?: boolean;
  autoFocus?: boolean;
}

export default function Composer({
  clis,
  cli,
  onCliChange,
  onSubmit,
  placeholder,
  showCliPicker = true,
  autoFocus,
}: Props) {
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = clis.find((c) => c.id === cli) || clis[0];

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [text]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [pickerOpen]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-elevated p-3 shadow-[0_10px_40px_rgba(0,0,0,0.4)] transition-colors focus-within:border-[#3a3f4a]">
      <textarea
        ref={inputRef}
        rows={1}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className="max-h-[200px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-text outline-none placeholder:text-faint"
      />
      <div className="mt-2 flex items-center justify-between">
        {showCliPicker && selected ? (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 text-[13px] text-text transition-colors hover:bg-hover"
            >
              <CliIcon cli={selected.id} size={18} />
              <span>{selected.label}</span>
              <ChevronDown size={14} className={clsx('transition-transform', pickerOpen && 'rotate-180')} />
            </button>
            {pickerOpen && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 min-w-[210px] animate-fade-in rounded-xl border border-border bg-elevated p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
                {clis.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onCliChange?.(c.id);
                      setPickerOpen(false);
                    }}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors hover:bg-hover',
                      c.id === cli && 'bg-active',
                    )}
                  >
                    <CliIcon cli={c.id} size={20} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          title="Envoyer"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-text text-bg transition-opacity hover:opacity-85 disabled:opacity-30"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
