import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import os from 'node:os';
import test from 'node:test';
import { promisify } from 'node:util';
import { createSession, hasSession, killSession, listSessions, loginShell, tmuxArgs } from './tmux.js';

const exec = promisify(execFile);

test('loginShell prefers $SHELL over the passwd entry', () => {
  const previous = process.env.SHELL;
  process.env.SHELL = '/usr/bin/fish';
  assert.equal(loginShell(), '/usr/bin/fish');
  if (previous === undefined) delete process.env.SHELL;
  else process.env.SHELL = previous;
});

test('loginShell falls back to the real login shell when $SHELL is unset', () => {
  // A systemd-managed process has no $SHELL; tmux's own default-shell option
  // would otherwise silently fall back to its compiled-in default (bash)
  // instead of the user's actual shell from /etc/passwd.
  const previous = process.env.SHELL;
  delete process.env.SHELL;
  assert.equal(loginShell(), os.userInfo().shell || '/bin/sh');
  if (previous !== undefined) process.env.SHELL = previous;
});

test('tmuxArgs uses the Agent Deck socket and no user config', () => {
  const previous = process.env.AGENT_DECK_TMUX_SOCKET;
  process.env.AGENT_DECK_TMUX_SOCKET = 'deck-test';
  assert.deepEqual(tmuxArgs('list-sessions'), [
    '-L',
    'deck-test',
    '-f',
    '/dev/null',
    'list-sessions',
  ]);
  if (previous === undefined) delete process.env.AGENT_DECK_TMUX_SOCKET;
  else process.env.AGENT_DECK_TMUX_SOCKET = previous;
});

test('created sessions live only on the isolated server', async (t) => {
  const socket = `agent-deck-test-${process.pid}`;
  const previous = process.env.AGENT_DECK_TMUX_SOCKET;
  process.env.AGENT_DECK_TMUX_SOCKET = socket;
  t.after(async () => {
    await exec('tmux', ['-L', socket, 'kill-server']).catch(() => {});
    if (previous === undefined) delete process.env.AGENT_DECK_TMUX_SOCKET;
    else process.env.AGENT_DECK_TMUX_SOCKET = previous;
  });

  const previousShell = process.env.SHELL;
  delete process.env.SHELL;
  t.after(() => {
    if (previousShell !== undefined) process.env.SHELL = previousShell;
  });

  await createSession('deck_isolated', '', process.cwd());
  assert.equal(await hasSession('deck_isolated'), true);
  assert.equal((await listSessions()).some((s) => s.name === 'deck_isolated'), true);
  await assert.rejects(exec('tmux', ['has-session', '-t', 'deck_isolated']));

  // The pane must run the user's real login shell, not tmux's compiled-in
  // default, even though $SHELL was unset when the session was created.
  const expectedShell = (os.userInfo().shell || '/bin/sh').split('/').pop();
  const { stdout: paneCommand } = await exec('tmux', [
    '-L', socket, '-f', '/dev/null', 'display-message', '-p', '-t', 'deck_isolated', '#{pane_current_command}',
  ]);
  assert.equal(paneCommand.trim().replace(/^-/, ''), expectedShell);

  const { stdout } = await exec('tmux', [
    '-L', socket, '-f', '/dev/null', 'show-hooks', '-g', 'after-new-session',
  ]);
  assert.equal(stdout.includes('ensure-sidebar.sh'), false);
  await killSession('deck_isolated');
});
