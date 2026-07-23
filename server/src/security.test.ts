import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginRateLimiter, tokenFromProtocols, upgradeOriginAllowed } from './security.js';

test('rate limiter blocks after repeated failures and recovers after the window', () => {
  const limiter = new LoginRateLimiter(3, 1000);
  const t0 = 1_000_000;
  assert.equal(limiter.blocked('ip', t0), false);
  limiter.recordFailure('ip', t0);
  limiter.recordFailure('ip', t0 + 10);
  assert.equal(limiter.blocked('ip', t0 + 20), false);
  limiter.recordFailure('ip', t0 + 20);
  assert.equal(limiter.blocked('ip', t0 + 30), true);
  // Other clients are unaffected; the window eventually expires.
  assert.equal(limiter.blocked('other', t0 + 30), false);
  assert.equal(limiter.blocked('ip', t0 + 2000), false);
});

test('rate limiter resets on successful login', () => {
  const limiter = new LoginRateLimiter(1, 1000);
  limiter.recordFailure('ip', 0);
  assert.equal(limiter.blocked('ip', 1), true);
  limiter.reset('ip');
  assert.equal(limiter.blocked('ip', 2), false);
});

test('non-browser upgrades without an Origin are allowed', () => {
  assert.equal(upgradeOriginAllowed({ host: 'example.com', authEnabled: true }), true);
  assert.equal(upgradeOriginAllowed({ host: 'localhost:3000', authEnabled: false }), true);
});

test('same-origin browser upgrades are allowed, cross-origin rejected', () => {
  const base = { host: 'deck.example.com', authEnabled: true };
  assert.equal(upgradeOriginAllowed({ ...base, origin: 'https://deck.example.com' }), true);
  assert.equal(upgradeOriginAllowed({ ...base, origin: 'http://deck.example.com:3000' }), true);
  assert.equal(upgradeOriginAllowed({ ...base, origin: 'https://evil.example.net' }), false);
  assert.equal(upgradeOriginAllowed({ ...base, origin: 'not a url' }), false);
});

test('reverse proxies are supported through X-Forwarded-Host and the allowlist', () => {
  assert.equal(
    upgradeOriginAllowed({
      origin: 'https://vps.tail1234.ts.net',
      host: '127.0.0.1:3000',
      forwardedHost: 'vps.tail1234.ts.net',
      authEnabled: true,
    }),
    true,
  );
  assert.equal(
    upgradeOriginAllowed({
      origin: 'https://deck.mydomain.dev',
      host: '127.0.0.1:3000',
      authEnabled: true,
      allowlist: ['deck.mydomain.dev'],
    }),
    true,
  );
});

test('without a password only loopback origins may connect (anti DNS-rebinding)', () => {
  assert.equal(upgradeOriginAllowed({ origin: 'http://localhost:3000', host: 'localhost:3000', authEnabled: false }), true);
  assert.equal(upgradeOriginAllowed({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000', authEnabled: false }), true);
  // A DNS-rebound page: Origin and Host both carry the attacker's domain.
  assert.equal(upgradeOriginAllowed({ origin: 'http://evil.com:3000', host: 'evil.com:3000', authEnabled: false }), false);
});

test('tokenFromProtocols extracts the deck token from the subprotocol list', () => {
  assert.equal(tokenFromProtocols('agent-deck, deck.12345.abcdef'), '12345.abcdef');
  assert.equal(tokenFromProtocols('agent-deck'), null);
  assert.equal(tokenFromProtocols(undefined), null);
});
