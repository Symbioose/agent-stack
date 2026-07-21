import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './serviceWorker';

describe('registerServiceWorker', () => {
  it('bypasses script caches and reloads once when the worker takes control', async () => {
    let listener: (() => void) | undefined;
    const serviceWorker = {
      addEventListener: vi.fn((_type: 'controllerchange', next: () => void) => {
        listener = next;
      }),
      register: vi.fn().mockResolvedValue(undefined),
    };
    const reload = vi.fn();

    registerServiceWorker(serviceWorker, reload, 'bundle-123');
    await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalledOnce());
    listener?.();
    listener?.();

    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js?v=bundle-123', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(reload).toHaveBeenCalledOnce();
  });
});
