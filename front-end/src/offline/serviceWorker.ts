export function registerOfflineServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/offline-sw.js');
  });
}

