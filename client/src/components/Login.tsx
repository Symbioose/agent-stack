import { useState } from 'react';
import BrandMark from './BrandMark';
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
    <div className="flex h-full items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="flex w-[340px] flex-col gap-3.5 rounded-2xl border border-border bg-elevated p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
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
      </form>
    </div>
  );
}
