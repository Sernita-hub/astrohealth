/* =========================================================================
   AstroHealth · Service worker (offline support)
   Keeps a copy of the app in the browser, so after the first visit the link
   opens with no connection, as it would aboard a spacecraft.
   Network first: when there is a connection the newest version is used and
   saved; the saved copy is used only when the network fails or is too slow.
   Reports to Mission Control (Supabase) are never cached: they go straight
   to the network, and the app queues them in its outbox when it is offline.
   SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
   tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
'use strict';

const CACHE = 'astrohealth-v1'; // change it when the list below changes
const APP = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'css/styles.css',
  'js/data.js', 'js/icons.js', 'js/logic.js', 'js/i18n.js', 'js/charts.js',
  'js/holo.js', 'js/cloud.js', 'js/app.js'
];
const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const TIMEOUT_MS = 4000; // a slow link counts as no link
const HOME = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Pages are saved under the app's home address; files without their ?query
function keyFor(request) {
  if (request.mode === 'navigate') return HOME;
  const url = new URL(request.url);
  return url.origin + url.pathname;
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  if (request.mode === 'navigate') return (await cache.match(HOME)) || cache.match('index.html');
  return cache.match(request, { ignoreSearch: true });
}

// Answers with the network if it responds in time, otherwise with the saved copy
function networkFirst(request, network) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response) => { if (!settled && response) { settled = true; resolve(response); } };
    const useCache = () => fromCache(request).then((hit) => {
      if (hit) finish(hit);
      else network.then(finish, () => finish(Response.error()));
    });
    const timer = setTimeout(useCache, TIMEOUT_MS);
    network.then(
      (response) => { clearTimeout(timer); finish(response); },
      () => { clearTimeout(timer); useCache(); }
    );
  });
}

// Fonts rarely change: use the saved copy first
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
    return response;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.origin)) { event.respondWith(cacheFirst(request)); return; }
  if (url.origin !== self.location.origin) return; // Supabase and other services: network only
  if (url.href === self.location.href) return;     // the worker itself is updated by the browser

  const network = fetch(request);
  // Save every good answer, so the offline copy follows each new deploy
  event.waitUntil(network.then((response) => {
    if (!response.ok || response.type !== 'basic') return undefined;
    const copy = response.clone();
    return caches.open(CACHE).then((cache) => cache.put(keyFor(request), copy));
  }).catch(() => {}));
  event.respondWith(networkFirst(request, network));
});
