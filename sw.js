// Đổi chuỗi phiên bản này (VD: v2026.1, v2026.2...) mỗi khi Thầy sửa code để máy học sinh tự cập nhật ngay
const CACHE_VERSION = 'v2026.10.09.1';
const CACHE_NAME = `msigma-cache-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    './',
    './index.html',
    './hocsinh.html',
    './manifest.json',
    './manifest-hocsinh.json',
    './logo-teacher.png',
    './logo-student.png'
];

// 1. Cài đặt SW mới và kích hoạt ngay lập tức
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Lỗi lưu cache tĩnh:', err);
            });
        })
    );
});

// 2. Kích hoạt SW mới và xóa sạch toàn bộ cache cũ
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((k) => {
                    if (k !== CACHE_NAME) {
                        return caches.delete(k); // Xóa sạch phiên bản cũ
                    }
                })
            );
        }).then(() => self.clients.claim()) // Chiếm quyền điều khiển trang ngay
    );
});

// 3. Lắng nghe thông điệp từ client để cập nhật tức thì
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 4. Chiến lược Fetch: Luôn ưu tiên mạng đối với trang HTML để đảm bảo code mới nhất
self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // Không can thiệp API Google Apps Script hoặc request gửi dữ liệu POST
    if (url.includes('script.google.com') || e.request.method !== 'GET') {
        return;
    }

    // Với các trang HTML hoặc điều hướng: Network-First (Ưu tiên mạng, mất mạng mới dùng cache)
    if (e.request.mode === 'navigate' || url.endsWith('.html')) {
        e.respondWith(
            fetch(e.request)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
                    }
                    return networkRes;
                })
                .catch(() => {
                    return caches.match(e.request).then((cachedRes) => {
                        if (cachedRes) return cachedRes;
                        if (url.includes('hocsinh')) return caches.match('./hocsinh.html');
                        return caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // Với tài nguyên hình ảnh, script CDN: Stale-While-Revalidate
    e.respondWith(
        caches.match(e.request).then((cached) => {
            const networkFetch = fetch(e.request)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
                    }
                    return networkRes;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});