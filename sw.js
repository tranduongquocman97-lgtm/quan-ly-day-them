// ==================== SERVICE WORKER SIGMAMATH ====================
const CACHE_NAME = 'sigmamath-pwa-v2026.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './hocsinh.html',
  './exam.html',
  './manifest.json',
  './manifest-hocsinh.json',
  './logo-teacher.png',
  './logo-student.png',
  './logo-teacher-192.png',
  './logo-student-192.png',
  './logo-teacher-512.png',
  './logo-student-512.png'
];

// Cài đặt và kích hoạt ngay bản mới
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

// Xóa cache cũ khi có phiên bản mới
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

// Chiến lược Network-First: Ưu tiên nạp bản mới nhất từ mạng
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Bỏ qua các yêu cầu gọi sang Google Apps Script API (không cache dữ liệu động)
  if (event.request.url.includes('script.google.com') || event.request.url.includes('vietqr.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});