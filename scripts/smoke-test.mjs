import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const base = process.env.AGENT_DECK_URL || 'http://localhost:3000';
const password = process.env.AGENT_DECK_PASSWORD || '';
const wsBase = base.replace(/^http/, 'ws');

const login = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password }),
});
assert.equal(login.ok, true, `login failed: ${login.status}`);
const { token } = await login.json();
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
let sessionId;

try {
  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ cli: 'shell', title: 'Smoke test', input: 'echo AGENT-DECK-SMOKE' }),
  });
  assert.equal(created.ok, true, `create failed: ${created.status}`);
  ({ id: sessionId } = await created.json());

  const sessions = await fetch(`${base}/api/sessions`, { headers }).then((response) => response.json());
  assert.equal(sessions.some((session) => session.id === sessionId), true);

  await new Promise((resolve, reject) => {
    const events = new WebSocket(`${wsBase}/ws/events?token=${encodeURIComponent(token)}`);
    const timeout = setTimeout(() => reject(new Error('events WebSocket timeout')), 5000);
    events.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'sessions') {
        clearTimeout(timeout);
        events.close();
        resolve();
      }
    };
    events.onerror = () => reject(new Error('events WebSocket failed'));
  });

  await new Promise((resolve, reject) => {
    const terminal = new WebSocket(`${wsBase}/ws/${sessionId}?token=${encodeURIComponent(token)}`);
    const timeout = setTimeout(() => reject(new Error('terminal output timeout')), 7000);
    let output = '';
    terminal.onopen = () => terminal.send('\x00resize:100x30');
    terminal.onmessage = (event) => {
      output += event.data;
      if (output.includes('AGENT-DECK-SMOKE')) {
        clearTimeout(timeout);
        terminal.close();
        resolve();
      }
    };
    terminal.onerror = () => reject(new Error('terminal WebSocket failed'));
  });

  await assert.rejects(exec('tmux', ['has-session', '-t', sessionId]));
  await exec('tmux', ['-L', process.env.AGENT_DECK_TMUX_SOCKET || 'agent-deck', '-f', '/dev/null', 'has-session', '-t', sessionId]);
  console.log('Agent Deck smoke test passed');
} finally {
  if (sessionId) {
    await fetch(`${base}/api/sessions/${sessionId}`, { method: 'DELETE', headers }).catch(() => {});
  }
}
