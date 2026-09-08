/**
 * Converts a base64url-encoded VAPID public key (as returned by the API)
 * into the Uint8Array shape PushManager.subscribe expects for
 * applicationServerKey. Standard, widely-used snippet.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Resolves an active ServiceWorkerRegistration, without hanging forever if
 * no service worker ever registers (e.g. `npm run dev`, where the PWA plugin
 * is disabled by default).
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            'Timed out waiting for the service worker to register. This usually only works in a production build.',
          ),
        ),
      8000,
    );
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}
