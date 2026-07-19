import crypto from 'node:crypto';

const SECRET = crypto.randomBytes(32);
const PASSWORD = process.env.AGENT_DECK_PASSWORD || '';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function authEnabled(): boolean {
  return PASSWORD.length > 0;
}

export function checkPassword(password: unknown): boolean {
  if (!authEnabled()) return true;
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueToken(): string {
  const payload = String(Date.now() + TOKEN_TTL_MS);
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(token: unknown): boolean {
  if (!authEnabled()) return true;
  if (!token) return false;
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(payload) > Date.now();
}
