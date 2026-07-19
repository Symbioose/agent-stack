import type { CliDef, Session } from './types';

export function getToken(): string {
  return localStorage.getItem('deck_token') || '';
}
export function setToken(token: string): void {
  localStorage.setItem('deck_token', token);
}
export function clearToken(): void {
  localStorage.removeItem('deck_token');
}

class ApiError extends Error {
  unauthorized = false;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    const err = new ApiError('unauthorized');
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error || res.statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  config: () => request<{ authRequired: boolean }>('/api/config'),
  login: (password: string) =>
    request<{ token: string }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  clis: () => request<CliDef[]>('/api/clis'),
  sessions: () => request<Session[]>('/api/sessions'),
  createSession: (body: { cli: string; title?: string; input?: string }) =>
    request<{ id: string }>('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  sendInput: (id: string, text: string) =>
    request<{ ok: boolean }>(`/api/sessions/${id}/input`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  renameSession: (id: string, title: string) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteSession: (id: string) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' }),
};
