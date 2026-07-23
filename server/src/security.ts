// Login throttling and WebSocket origin validation.

export class LoginRateLimiter {
  private readonly failures = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  blocked(key: string, now = Date.now()): boolean {
    const record = this.failures.get(key);
    if (!record) return false;
    if (now - record.windowStart >= this.windowMs) {
      this.failures.delete(key);
      return false;
    }
    return record.count >= this.maxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const record = this.failures.get(key);
    if (!record || now - record.windowStart >= this.windowMs) {
      this.failures.set(key, { count: 1, windowStart: now });
      return;
    }
    record.count += 1;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function hostname(hostHeader: string): string {
  // Strip a trailing port, but leave bracketed IPv6 hosts intact.
  return hostHeader.replace(/:\d+$/, '').toLowerCase();
}

export function isLoopbackHost(host: string): boolean {
  const name = hostname(host);
  return LOOPBACK_NAMES.has(name) || name.startsWith('127.');
}

export interface UpgradePolicy {
  origin?: string;
  host?: string;
  forwardedHost?: string;
  authEnabled: boolean;
  allowlist?: string[];
}

// Browsers always send an Origin header on WebSocket handshakes, so rejecting
// unknown origins blocks cross-site WebSocket hijacking and DNS rebinding: a
// malicious page cannot drive this server from a victim's browser. Requests
// without an Origin (curl, native clients) are allowed — they are not made on
// behalf of a third-party web page.
export function upgradeOriginAllowed({ origin, host, forwardedHost, authEnabled, allowlist = [] }: UpgradePolicy): boolean {
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = hostname(new URL(origin).host);
  } catch {
    return false;
  }
  if (allowlist.some((entry) => hostname(entry) === originHost)) return true;
  if (!authEnabled) {
    // No password means the socket is a free shell: only same-machine pages
    // may connect. A DNS-rebound page keeps its own (non-loopback) origin.
    return isLoopbackHost(originHost);
  }
  // Reverse proxies (tailscale serve, Caddy) preserve Host and/or set
  // X-Forwarded-Host, so same-origin traffic matches one of the two.
  const candidates = [host, forwardedHost].filter((value): value is string => !!value);
  return candidates.some((candidate) => hostname(candidate) === originHost);
}

// Extract a bearer token smuggled through the WebSocket subprotocol list
// ("agent-deck, deck.<token>"). Keeping the token out of the URL keeps it out
// of reverse-proxy access logs.
export function tokenFromProtocols(header: string | undefined): string | null {
  if (!header) return null;
  for (const entry of header.split(',')) {
    const value = entry.trim();
    if (value.startsWith('deck.')) return value.slice('deck.'.length);
  }
  return null;
}
