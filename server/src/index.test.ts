import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const serverDir = fileURLToPath(new URL('..', import.meta.url));

async function reservePort(): Promise<number> {
  const socket = net.createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server startup timed out')), 5000);
    const onExit = (code: number | null) => reject(new Error(`server exited with code ${code}`));
    child.once('exit', onExit);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (!chunk.toString().includes('agent-deck listening')) return;
      clearTimeout(timeout);
      child.off('exit', onExit);
      resolve();
    });
  });
}

async function postSession(port: number, body: Record<string, unknown>): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('failed launches return structured errors without sessions or metadata', async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-deck-launch-test-'));
  const socket = `agent-deck-launch-test-${process.pid}`;
  const port = await reservePort();
  await fs.mkdir(path.join(home, '.agent-deck'));
  await fs.writeFile(path.join(home, '.agent-deck', 'clis.json'), JSON.stringify([
    { id: 'missing', label: 'Missing CLI', command: 'agent-deck-command-that-does-not-exist' },
    { id: 'failing', label: 'Failing CLI', command: 'false' },
    { id: 'shell', label: 'Shell', command: '' },
  ]));

  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: serverDir,
    env: {
      ...process.env,
      AGENT_DECK_PASSWORD: '',
      AGENT_DECK_SECRET: '',
      AGENT_DECK_TMUX_SOCKET: socket,
      HOME: home,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    child.kill();
    await execFileAsync('tmux', ['-L', socket, 'kill-server']).catch(() => {});
    await fs.rm(home, { recursive: true, force: true });
  });
  await waitForServer(child);

  const unknownResponse = await postSession(port, { cli: 'unknown' });
  assert.equal(unknownResponse.status, 400);
  assert.deepEqual(await unknownResponse.json(), { code: 'unknown_cli', error: 'CLI inconnue.' });

  const unavailableResponse = await postSession(port, { cli: 'missing' });
  assert.equal(unavailableResponse.status, 422);
  assert.deepEqual(await unavailableResponse.json(), {
    code: 'cli_unavailable',
    error: "La commande « agent-deck-command-that-does-not-exist » n'est pas installée sur cette machine.",
    command: 'agent-deck-command-that-does-not-exist',
  });

  const failedResponse = await postSession(port, { cli: 'failing' });
  assert.equal(failedResponse.status, 500);
  const failedBody = await failedResponse.json() as { code?: string };
  assert.equal(failedBody.code, 'session_create_failed');

  await assert.rejects(fs.readFile(path.join(home, '.agent-deck', 'sessions.json')));
  await assert.rejects(execFileAsync('tmux', ['-L', socket, '-f', '/dev/null', 'list-sessions']));
});
