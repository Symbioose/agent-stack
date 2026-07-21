import { describe, expect, it, vi } from 'vitest';
import { reloadOnServiceWorkerUpdate } from './serviceWorker';

describe('reloadOnServiceWorkerUpdate', () => {
  it('reloads once when a new service worker takes control', () => {
    let listener: (() => void) | undefined;
    const serviceWorker = {
      addEventListener: vi.fn((_type: 'controllerchange', next: () => void) => {
        listener = next;
      }),
    };
    const reload = vi.fn();

    reloadOnServiceWorkerUpdate(serviceWorker, reload);
    listener?.();
    listener?.();

    expect(serviceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
    expect(reload).toHaveBeenCalledOnce();
  });
});
