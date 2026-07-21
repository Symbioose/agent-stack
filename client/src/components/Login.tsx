import { useState } from 'react';
import { motion } from 'framer-motion';
import BrandMark from './BrandMark';
import GalaxyBackground from './GalaxyBackground';
import { api, setToken } from '../api';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.login(password);
      setToken(token);
      onLogin();
    } catch {
      setError('Incorrect password');
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-4">
      <GalaxyBackground className="pointer-events-none absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-bg via-transparent to-bg/60" />
      <motion.form
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onSubmit={submit}
        className="relative z-10 flex w-[340px] flex-col gap-3.5 rounded-2xl border border-white/10 bg-elevated/95 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_rgba(255,255,255,.05)]"
      >
        <div className="mb-1 flex items-center justify-center gap-2.5 text-[17px] font-semibold">
          <BrandMark size={26} /> Agent Deck
        </div>
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-white/20"
        />
        {error && <div className="text-center text-[13px] text-danger">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-text py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Sign in
        </button>
      </motion.form>
    </div>
  );
}
