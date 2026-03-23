// sw.js — BFL Fantasy IPL 2026
const CACHE_NAME = 'bfl-cache-v1.2';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/predictions.html',
  '/squad.html',
  '/leaderboard.html',
  '/analytics.html',
  '/blogs.html',
  '/css/styles.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/api.js',
  '/js/navbar.js',
  '/images/bfl/bfl-logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // ONLY cache GET requests with http/https schemes. Strictly skip POST/PUT/etc.
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return; 
  if (!url.protocol.startsWith('http')) return;

  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        const fetchedResponse = fetch(e.request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
