import { useEffect, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import NewSessionView from './components/NewSessionView';
import SessionView from './components/SessionView';
import { api, clearToken } from './api';
import { useSessions } from './useSessions';
import type { CliDef } from './types';

const isMobile = () => window.innerWidth < 768;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [clis, setClis] = useState<CliDef[]>([]);
  const [cli, setCli] = useState('');
  const [cwd, setCwd] = useState('~');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const sessions = useSessions(authed === true, () => setAuthed(false));

  useEffect(() => {
    void (async () => {
      try {
        const config = await api.config();
        if (!config.authRequired) {
          setAuthed(true);
          return;
        }
        await api.sessions();
        setAuthed(true);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (authed !== true) return;
    api.clis().then((list) => {
      setClis(list);
      setCli((current) => current || list[0]?.id || '');
    }).catch(() => setCreateError('Failed to load the agent list.'));
  }, [authed]);

  if (authed === null) return <div className="flex h-full items-center justify-center text-dim">…</div>;
  if (authed === false) return <Login onLogin={() => setAuthed(true)} />;

  const activeSession = sessions.find((session) => session.id === active) || null;

  const createSession = async (input: string) => {
    setCreating(true);
    setCreateError(null);
    try {
      const { id } = await api.createSession({ cli, title: input.slice(0, 60), input, cwd });
      setActive(id);
      if (isMobile()) setSidebarOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to start the session.');
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session? Its process will be stopped.')) return;
    await api.deleteSession(id);
    if (active === id) setActive(null);
  };

  const openSession = (id: string) => {
    setActive(id);
    setCreateError(null);
    if (isMobile()) setSidebarOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside
        className={clsx(
          'z-50 h-full w-[254px] shrink-0 border-r border-border-soft transition-[margin] duration-200 ease-out max-md:fixed max-md:shadow-[8px_0_32px_rgba(0,0,0,.48)]',
          sidebarOpen ? 'ml-0' : '-ml-[254px]',
        )}
      >
        <Sidebar
          sessions={sessions}
          activeId={active}
          onSelect={openSession}
          onNew={() => {
            setActive(null);
            setCreateError(null);
            if (isMobile()) setSidebarOpen(false);
          }}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => {
            clearToken();
            setAuthed(false);
          }}
        />
      </aside>
      {sidebarOpen && isMobile() && (
        <button aria-label="Close sidebar" className="fixed inset-0 z-40 bg-black/55" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {!active && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg text-dim transition-colors hover:bg-hover hover:text-text"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
        {active && activeSession ? (
          <SessionView
            session={activeSession}
            sidebarOpen={sidebarOpen}
            onOpenSidebar={() => setSidebarOpen(true)}
            onRename={(title) => api.renameSession(activeSession.id, title)}
            onDelete={() => void deleteSession(activeSession.id)}
            onMissing={() => setActive(null)}
          />
        ) : active ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-dim">Opening session…</div>
        ) : (
          <NewSessionView
            clis={clis}
            cli={cli}
            onCliChange={setCli}
            cwd={cwd}
            onCwdChange={setCwd}
            onSubmit={(input) => void createSession(input)}
            pending={creating}
            error={createError}
          />
        )}
      </main>
    </div>
  );
}
