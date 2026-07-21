import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const { apiMocks, getTokenMock } = vi.hoisted(() => ({
  apiMocks: {
    config: vi.fn(),
    sessions: vi.fn(),
    clis: vi.fn(),
  },
  getTokenMock: vi.fn(),
}));

vi.mock('./api', () => ({
  api: apiMocks,
  clearToken: vi.fn(),
  getToken: getTokenMock,
  setToken: vi.fn(),
}));

vi.mock('./useSessions', () => ({
  useSessions: vi.fn(() => []),
}));

vi.mock('./components/SessionView', () => ({
  default: () => <div>Session</div>,
}));

describe('App authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.clis.mockResolvedValue([]);
    apiMocks.sessions.mockResolvedValue([]);
  });

  it('renders login without probing sessions when authentication is required and no token exists', async () => {
    apiMocks.config.mockResolvedValue({ authRequired: true });
    getTokenMock.mockReturnValue('');

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(apiMocks.sessions).not.toHaveBeenCalled();
  });

  it('validates an existing token and renders login when it is stale', async () => {
    apiMocks.config.mockResolvedValue({ authRequired: true });
    getTokenMock.mockReturnValue('stale-token');
    apiMocks.sessions.mockRejectedValue(new Error('unauthorized'));

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(apiMocks.sessions).toHaveBeenCalledOnce();
  });

  it('skips token validation when authentication is disabled', async () => {
    apiMocks.config.mockResolvedValue({ authRequired: false });
    getTokenMock.mockReturnValue('');

    render(<App />);

    await waitFor(() => expect(apiMocks.clis).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText('Describe the task to run…')).toBeInTheDocument();
    expect(apiMocks.sessions).not.toHaveBeenCalled();
  });
});
