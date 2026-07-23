import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button aria-label="Cancel" className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="relative w-[340px] rounded-2xl border border-border bg-elevated p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_rgba(255,255,255,.05)]"
      >
        <div className="text-[14.5px] font-semibold">{title}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="flex h-9 items-center rounded-lg border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="flex h-9 items-center rounded-lg bg-danger px-3 text-[12.5px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
