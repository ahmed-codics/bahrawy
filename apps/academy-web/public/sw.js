const CACHE_NAME = 'bahrawy-public-v1';
const SAFE_SHELL = ['/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_PRIVATE_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const url = new URL(request.url);
  const isPrivate =
    url.pathname.startsWith('/student') ||
    url.pathname.startsWith('/guardian') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/learn') ||
    url.pathname.includes('/checkout') ||
    url.pathname.includes('/assessments');
  if (isPrivate) return;

  event.respondWith(fetch(request).catch(() => caches.match('/offline')));
});
