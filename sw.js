const CACHE_NAME = 'msigma-cache-v4'; // <-- Đổi v2, v3... mỗi khi Thầy sửa code

const STATIC_ASSETS = [
    './',
    './index.html',
    './hocsinh.html',
    './manifest.json',
    './logo-teacher.png',
    './logo-student.png'
];

// Cài đặt SW mới và kích hoạt ngay lập tức (không chờ đóng tab cũ)
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
});

// Kích hoạt SW mới và xóa sạch toàn bộ cache phiên bản cũ
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((k) => {
                    if (k !== CACHE_NAME) {
                        return caches.delete(k); // Xóa cache cũ
                    }
                })
            );
        }).then(() => self.clients.claim()) // Chiếm quyền điều khiển trang ngay lập tức
    );
});

// Chiến lược: Network First (Ưu tiên nạp bản mới từ mạng, nếu mất mạng mới dùng cache)
self.addEventListener('fetch', (e) => {
    // Không cache các request gửi dữ liệu lên Google Apps Script
    if (e.request.url.includes('script.google.com') || e.request.method !== 'GET') {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((res) => {
                // Nếu kết nối mạng tốt, sao lưu bản mới vào cache rồi trả về cho giao diện
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request)) // Khi mất mạng hoàn toàn mới dùng cache
    );
});