import { useEffect, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import NewSessionView from './components/NewSessionView';
import SessionView from './components/SessionView';
import ConfirmDialog from './components/ConfirmDialog';
import { api, clearToken, getToken } from './api';
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sessions = useSessions(authed === true, () => setAuthed(false));

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Cmd/Ctrl+K jumps to the new-session composer, like a chat app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setActive(null);
        setCreateError(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const config = await api.config();
        if (!config.authRequired) {
          setAuthed(true);
          return;
        }
        if (!getToken()) {
          setAuthed(false);
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
    setConfirmDeleteId(null);
    try {
      await api.deleteSession(id);
      if (active === id) setActive(null);
    } catch {
      setToast('Could not delete the session.');
    }
  };

  const renameSession = (id: string, title: string) => {
    void api.renameSession(id, title).catch(() => setToast('Could not rename the session.'));
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
          onDelete={(id) => setConfirmDeleteId(id)}
          onRename={renameSession}
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
            onRename={(title) => renameSession(activeSession.id, title)}
            onDelete={() => setConfirmDeleteId(activeSession.id)}
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

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete this session?"
          body="The process running inside it will be stopped."
          confirmLabel="Delete"
          onConfirm={() => void deleteSession(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {toast && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 animate-fade-in rounded-xl border border-danger/25 bg-elevated px-4 py-2.5 text-[13px] text-danger shadow-[0_14px_40px_rgba(0,0,0,.5)]">
          {toast}
        </div>
      )}
    </div>
  );
}
