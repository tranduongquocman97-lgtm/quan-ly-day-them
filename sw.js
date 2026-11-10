const CACHE_VERSION = 'v2026.11.03.modular_1';
const CACHE_NAME = `sigmath-cache-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './hocsinh.html',
  './exam.html',
  './js/core.js',
  './js/sync.js',
  './js/students.js',
  './js/attendance-schedule.js',
  './js/tuition.js',
  './js/qbank.js',
  './js/main.js',
  './manifest.json',
  './manifest-hocsinh.json',
  './logo-teacher.png',
  './logo-teacher-192.png',
  './logo-teacher-512.png',
  './logo-student.png',
  './logo-student-192.png',
  './logo-student-512.png'
];

// Cài đặt và nạp tài nguyên vào cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Kích hoạt phiên bản mới và dọn dẹp các bản cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Phản hồi yêu cầu mạng: ưu tiên mạng, lỗi mạng mới dùng cache (Network First)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Bỏ qua các yêu cầu gọi trực tiếp lên Google Apps Script API
  if (event.request.url.includes('script.google.com') || event.request.url.includes('script.googleusercontent.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});