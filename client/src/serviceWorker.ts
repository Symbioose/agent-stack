interface ControllerChangeTarget {
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export function reloadOnServiceWorkerUpdate(
  serviceWorker: ControllerChangeTarget = navigator.serviceWorker,
  reload = () => window.location.reload(),
): void {
  let refreshing = false;
  serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    reload();
  });
}
