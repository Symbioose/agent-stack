interface ServiceWorkerTarget {
  addEventListener(type: 'controllerchange', listener: () => void): void;
  register(scriptURL: string, options: { scope: string; updateViaCache: 'none' }): Promise<unknown>;
}

export function registerServiceWorker(
  serviceWorker: ServiceWorkerTarget = navigator.serviceWorker,
  reload = () => window.location.reload(),
  version = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? location.href,
): void {
  let refreshing = false;
  serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    reload();
  });
  void serviceWorker
    .register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: '/', updateViaCache: 'none' })
    .catch(() => {});
}
