// ─── Service worker di Dominio ────────────────────────────────────────────────
// Rende il gioco installabile e giocabile anche offline dopo la prima visita.
// - pagine: rete prima, copia in cache se offline
// - /assets/ (file con hash di Vite): cache prima, non cambiano mai
// - modelli 3D, decoder, immagini, icone, font: subito dalla cache e
//   aggiornati in sottofondo
// Cambiare VERSION per buttare le cache vecchie.

const VERSION = 'dominio-v1';
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const RUNTIME = `${VERSION}-runtime`;
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PAGES).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then(response => { if (response.ok || response.type === 'opaque') cache.put(request, response.clone()); return response; })
    .catch(() => hit ?? Response.error());
  return hit ?? update;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') { event.respondWith(networkFirst(request)); return; }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(request)); return; }
    if (/^\/(models|draco|ui|icons)\//.test(url.pathname) || url.pathname === '/favicon.svg') {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
