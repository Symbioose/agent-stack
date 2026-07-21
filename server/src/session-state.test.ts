import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDLE_AFTER_MS,
  INPUT_ECHO_GRACE_MS,
  OUTPUT_FRESH_MS,
  SessionStateTracker,
  WORKING_QUIET_MS,
  applySessionInput,
  transitionSessionActivity,
} from './session-state.js';

const NOW = 2_000_000;

function snapshot(command: string, activityAt: number, now = NOW) {
  return { command, activityAt, now };
}

test('shell activity remains idle', () => {
  const next = transitionSessionActivity(undefined, snapshot('zsh', NOW));
  assert.equal(next.state, 'idle');
});

test('fresh CLI output enters working through the freshness boundary', () => {
  const fresh = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const boundary = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS));
  assert.equal(fresh.state, 'working');
  assert.equal(boundary.state, 'working');
});

test('an initial stale CLI snapshot starts waiting', () => {
  const activityAt = NOW - OUTPUT_FRESH_MS - 1;
  const next = transitionSessionActivity(undefined, snapshot('claude', activityAt));
  assert.equal(next.state, 'waiting');
  assert.equal(next.observedActivityAt, activityAt);
  assert.equal(next.outputAt, activityAt);
});

test('input echo does not enter working', () => {
  const waiting = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS - 1));
  const withInput = applySessionInput(waiting, NOW);
  const echoed = transitionSessionActivity(withInput, snapshot('claude', NOW));
  assert.equal(echoed.state, 'waiting');
  assert.equal(echoed.outputAt, waiting.outputAt);
});

test('activity at the input grace boundary is still treated as echo', () => {
  const waiting = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS - 1));
  const withInput = applySessionInput(waiting, NOW);
  const boundary = NOW + INPUT_ECHO_GRACE_MS;
  const echoed = transitionSessionActivity(withInput, snapshot('claude', boundary, boundary));
  assert.equal(echoed.state, 'waiting');
  assert.equal(echoed.outputAt, waiting.outputAt);
});

test('output after the input grace period enters working', () => {
  const waiting = transitionSessionActivity(undefined, snapshot('claude', NOW - OUTPUT_FRESH_MS - 1));
  const withInput = applySessionInput(waiting, NOW);
  const nextAt = NOW + INPUT_ECHO_GRACE_MS + 1;
  const output = transitionSessionActivity(withInput, snapshot('claude', nextAt, nextAt));
  assert.equal(output.state, 'working');
});

test('working uses a longer quiet exit window', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const stillWorking = transitionSessionActivity(working, snapshot('claude', NOW, NOW + WORKING_QUIET_MS - 1));
  const waiting = transitionSessionActivity(stillWorking, snapshot('claude', NOW, NOW + WORKING_QUIET_MS));
  assert.equal(stillWorking.state, 'working');
  assert.equal(waiting.state, 'waiting');
});

test('repeated output refreshes working', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const nextAt = NOW + WORKING_QUIET_MS - 1;
  const refreshed = transitionSessionActivity(working, snapshot('claude', nextAt, nextAt));
  assert.equal(refreshed.state, 'working');
  assert.equal(refreshed.outputAt, nextAt);
});

test('quiet CLI becomes idle after thirty minutes', () => {
  const activityAt = NOW - IDLE_AFTER_MS;
  const next = transitionSessionActivity(undefined, snapshot('claude', activityAt));
  assert.equal(next.state, 'idle');
});

test('returning to a shell becomes idle immediately', () => {
  const working = transitionSessionActivity(undefined, snapshot('claude', NOW));
  const shell = transitionSessionActivity(working, snapshot('zsh', NOW));
  assert.equal(shell.state, 'idle');
});

test('tracker prunes sessions no longer reported by tmux', () => {
  const tracker = new SessionStateTracker();
  tracker.state('deck_one', 'claude', NOW, NOW);
  tracker.state('deck_two', 'claude', NOW, NOW);
  tracker.prune(new Set(['deck_two']));
  assert.equal(tracker.size, 1);
});
