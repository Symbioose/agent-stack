import { motion } from 'framer-motion';
import Aurora from './Aurora';
import Composer from './Composer';
import SplitText from './SplitText';
import type { CliDef } from '../types';

interface Props {
  clis: CliDef[];
  cli: string;
  onCliChange: (id: string) => void;
  cwd: string;
  onCwdChange: (path: string) => void;
  onSubmit: (text: string) => void;
  pending: boolean;
  error: string | null;
}

export default function NewSessionView({ clis, cli, onCliChange, cwd, onCwdChange, onSubmit, pending, error }: Props) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 pb-[8vh]">
      <Aurora className="pointer-events-none absolute inset-x-0 top-0 h-[62%] opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/35 to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative w-full max-w-[680px] text-center"
      >
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-text max-sm:text-[24px]">
          <SplitText text="What are we running?" />
        </h1>
        <p className="mb-7 mt-2 text-[14px] text-dim max-sm:mx-auto max-sm:max-w-[320px]">
          Pick a folder, pick an agent. Sessions keep running even when you leave.
        </p>
        <Composer
          clis={clis}
          cli={cli}
          onCliChange={onCliChange}
          cwd={cwd}
          onCwdChange={onCwdChange}
          onSubmit={onSubmit}
          pending={pending}
        />
        {error && (
          <div role="alert" className="mt-3 animate-fade-in rounded-xl border border-danger/20 bg-danger/[0.055] px-4 py-3 text-left text-[13px] text-danger">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  );
}
