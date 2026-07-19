import { useEffect, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import Composer from './components/Composer';
import TerminalView from './components/Terminal';
import CliIcon from './components/CliIcon';
import { api, clearToken } from './api';
import { useSessions } from './useSessions';
import type { CliDef } from './types';

const isMobile = () => window.innerWidth < 768;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [clis, setClis] = useState<CliDef[]>([]);
  const [cli, setCli] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());

  const sessions = useSessions(authed === true, () => setAuthed(false));

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.config();
        if (!cfg.authRequired) return setAuthed(true);
        await api.sessions();
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authed !== true) return;
    api
      .clis()
      .then((list) => {
        setClis(list);
        setCli((c) => c || list[0]?.id || '');
      })
      .catch(() => {});
  }, [authed]);

  if (authed === null)
    return <div className="flex h-full items-center justify-center text-dim">…</div>;
  if (authed === false) return <Login onLogin={() => setAuthed(true)} />;

  const activeSession = sessions.find((s) => s.id === active) || null;

  const createSession = async (input: string) => {
    const { id } = await api.createSession({
      cli,
      title: input ? input.slice(0, 60) : undefined,
      input: input || undefined,
    });
    setActive(id);
    if (isMobile()) setSidebarOpen(false);
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Supprimer cette session ? Le processus sera arrêté.')) return;
    await api.deleteSession(id);
    if (active === id) setActive(null);
  };

  const openSession = (id: string) => {
    setActive(id);
    if (isMobile()) setSidebarOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          'z-50 h-full w-[268px] shrink-0 border-r border-border-soft transition-[margin] duration-200 ease-out max-md:fixed max-md:shadow-[6px_0_30px_rgba(0,0,0,0.5)]',
          sidebarOpen ? 'ml-0' : '-ml-[268px]',
        )}
      >
        <Sidebar
          sessions={sessions}
          activeId={active}
          onSelect={openSession}
          onNew={() => {
            setActive(null);
            if (isMobile()) setSidebarOpen(false);
          }}
          onDelete={deleteSession}
          onRename={(id, title) => api.renameSession(id, title)}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => {
            clearToken();
            setAuthed(false);
          }}
        />
      </aside>
      {sidebarOpen && isMobile() && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[46px] items-center gap-2.5 border-b border-border-soft px-3.5 py-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              title="Ouvrir le menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}
          {activeSession && (
            <>
              <CliIcon cli={activeSession.cli} size={20} />
              <span className="truncate text-[13.5px] font-semibold">{activeSession.title}</span>
              <span
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[11px]',
                  activeSession.running
                    ? 'border-green/35 text-green'
                    : 'border-border text-dim',
                )}
              >
                {activeSession.running ? 'en cours' : 'en attente'}
              </span>
            </>
          )}
        </div>

        {active ? (
          <>
            <div className="min-h-0 flex-1 px-2 pt-2">
              <TerminalView key={active} sessionId={active} />
            </div>
            <div className="flex justify-center px-3.5 pb-3.5 pt-2">
              <div className="w-full max-w-[760px]">
                <Composer
                  clis={clis}
                  cli={activeSession?.cli}
                  showCliPicker={false}
                  placeholder="Envoyer une commande à la session…"
                  onSubmit={(text) => active && api.sendInput(active, text)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-5 pb-16">
            <h1 className="text-[27px] font-semibold tracking-tight">Qu'est-ce qu'on lance ?</h1>
            <p className="mb-4 text-center text-dim">
              Choisis ta CLI et décris ta tâche — la session tournera sur la machine.
            </p>
            <div className="w-full max-w-[680px]">
              <Composer
                clis={clis}
                cli={cli}
                onCliChange={setCli}
                placeholder="Décris ta tâche à l'agent…"
                onSubmit={createSession}
                autoFocus
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
