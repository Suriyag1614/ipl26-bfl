// sw.js — BFL Fantasy IPL 2026
const CACHE_NAME = 'bfl-cache-v1.15';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/predictions.html',
  '/squad.html',
  '/leaderboard.html',
  '/analytics.html',
  '/admin.html',
  '/css/styles.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/api.js',
  '/js/admin.js',
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
  // DO NOT cache Supabase API calls
  if (url.hostname.includes('supabase.co')) return;

  // For HTML page navigations use network-first so the browser never
  // gets a stale cached page (e.g. index.html served for admin.html).
  const isNavigate = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isNavigate) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || new Response('Offline', {status: 408, headers: {'Content-Type':'text/plain'}})))
    );
    return;
  }

  // For other assets (JS, CSS, images) use stale-while-revalidate
  e.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(e.request).then((cachedResponse) => {
        const fetchedResponse = fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            var clone = networkResponse.clone();
            cache.put(e.request, clone);
          }
          return networkResponse;
        });
        
        if (cachedResponse) {
          fetchedResponse.catch(() => {});
          return cachedResponse;
        }
        
        return fetchedResponse.catch(() => {
          return new Response('Offline', {status: 408, headers: { 'Content-Type': 'text/plain' }});
        });
      });
    })
  );
});
