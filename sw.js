// ============================================================================
// SERVICE WORKER - M_SIGMATEACHER & M_SIGMATH
// Hỗ trợ hoạt động Offline, tự động tải ngầm và cập nhật tức thì.
// ============================================================================

const CACHE_VERSION = 'v2026.10.13.2';
const CACHE_NAME = `sigmath-cache-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './hocsinh.html',
  './exam.html',
  './app.js',
  './manifest.json',
  './manifest-hocsinh.json',
  './logo-teacher.png',
  './logo-teacher-192.png',
  './logo-student.png',
  './logo-student-192.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Không can thiệp các request API Google Apps Script hoặc phương thức không phải GET
  if (event.request.method !== 'GET' || url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Chiến lược Stale-While-Revalidate chuẩn xác: Trả cache ngay, cập nhật ngầm an toàn với clone()
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});