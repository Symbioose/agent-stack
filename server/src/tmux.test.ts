import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';
import { createSession, hasSession, killSession, listSessions, tmuxArgs } from './tmux.js';

const exec = promisify(execFile);

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

  await createSession('deck_isolated', '', process.cwd());
  assert.equal(await hasSession('deck_isolated'), true);
  assert.equal((await listSessions()).some((s) => s.name === 'deck_isolated'), true);
  await assert.rejects(exec('tmux', ['has-session', '-t', 'deck_isolated']));

  const { stdout } = await exec('tmux', [
    '-L', socket, '-f', '/dev/null', 'show-hooks', '-g', 'after-new-session',
  ]);
  assert.equal(stdout.includes('ensure-sidebar.sh'), false);
  await killSession('deck_isolated');
});
