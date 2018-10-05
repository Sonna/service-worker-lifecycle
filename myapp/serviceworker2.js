const CACHE_NAME = 'myapp-site-cache-v1';
const urlsToCache = [
  // '/myapp/another.html',
];

self.addEventListener('install', event => {
  console.log('MY_APP Service worker installing...');
  self.skipWaiting();

  // Perform install steps
  const preLoaded = caches.open(CACHE_NAME) // 1. Open a cache
    .then(cache => cache.addAll(urlsToCache)) // 2. Cache our files
    .catch(error => {
      console.error('Error installing MY_APP Service Worker 😬:', error);
      /* TODO: log `error` to remote API */
    });
  event.waitUntil(preLoaded); // 3. Confirm whether all the required assets are cached or not
});

// Remember that caches are shared across the whole origin,
// so be careful which caches are removed
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, 'root-site-cache-v1'];

  const cleanCaches = caches.keys().then(cacheNames =>
    Promise.all(
      cacheNames.map(cacheName => {
        if (cacheWhitelist.indexOf(cacheName) === -1) {
          return caches.delete(cacheName);
        }
      })
    )
  );
  event.waitUntil(cleanCaches);
});

self.addEventListener('fetch', event => {
  console.log('MY_APP Fetching:', event.request.url);

  const response = caches.match(event.request)
  //   .then(match => match || fetch(event.request));
    .then(match => {
      if (match) {
        console.log('Match found in', CACHE_NAME, 'for:', event.request.url)
        return match;
      } else {
        console.log('No Match in', CACHE_NAME, 'found for:', event.request.url)
        return fetch(event.request);
      }
    })
  event.respondWith(response);
});

self.addEventListener('message', (event) => {
  messageHandler(event);
});

const PURGE_CACHE_ACTION = 'purge_cache';

function messageHandler(event) {
  if (event.data === PURGE_CACHE_ACTION) {
    caches.delete(CACHE_NAME)
      .then((success) => { console.log(CACHE_NAME, 'Cache removal status:', success); })
      .catch((err) => { console.log(CACHE_NAME, 'Cache removal error:', err); });
  }
}
