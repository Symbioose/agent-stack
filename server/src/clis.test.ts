import assert from 'node:assert/strict';
import test from 'node:test';
import { CliUnavailableError, ensureCliAvailable, getDefaultClis } from './clis.js';

test('default catalog includes Devin and Grok Code', () => {
  const clis = getDefaultClis();
  assert.equal(clis.find((cli) => cli.id === 'devin')?.command, 'devin');
  assert.equal(clis.find((cli) => cli.id === 'grok')?.command, 'grok');
});

test('default catalog returns defensive copies', () => {
  const clis = getDefaultClis();
  clis[0].command = 'changed';
  assert.equal(getDefaultClis()[0].command, 'claude');
});

test('Shell is always available', async () => {
  await assert.doesNotReject(ensureCliAvailable({ id: 'shell', label: 'Shell', command: '' }));
});

test('missing executables throw a structured error', async () => {
  const cli = { id: 'missing', label: 'Missing CLI', command: 'agent-deck-command-that-does-not-exist' };
  await assert.rejects(ensureCliAvailable(cli), (error: unknown) => {
    assert.equal(error instanceof CliUnavailableError, true);
    assert.equal((error as CliUnavailableError).command, cli.command);
    return true;
  });
});

test('executable lookup does not evaluate command text', async () => {
  const cli = {
    id: 'unsafe',
    label: 'Unsafe CLI',
    command: 'agent-deck-command-that-does-not-exist; true',
  };
  await assert.rejects(ensureCliAvailable(cli), CliUnavailableError);
});
