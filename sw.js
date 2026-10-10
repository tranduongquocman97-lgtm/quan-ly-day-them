// ============================================================================
// FILE 1: sw.js - SERVICE WORKER CHUẨN HÓA CHO SIGMAMATH & SIGMATEACHER
// ============================================================================

// Đổi chuỗi phiên bản này mỗi khi cập nhật code để thiết bị tự động làm mới
const CACHE_VERSION = 'v2026.10.10.2';
const CACHE_NAME = `msigma-cache-${CACHE_VERSION}`;

// Danh sách các tài nguyên tĩnh cốt lõi cần nạp sẵn vào bộ nhớ đệm
const STATIC_ASSETS = [
    './',
    './index.html',
    './hocsinh.html',
    './exam.html',
    './test_parser.html',
    './manifest.json',
    './manifest-hocsinh.json',
    './logo-teacher.png',
    './logo-teacher-192.png',
    './logo-student.png',
    './logo-student-192.png'
];

// 1. CÀI ĐẶT SERVICE WORKER MỚI VÀ NẠP CACHE
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                STATIC_ASSETS.map((asset) =>
                    cache.add(asset).catch((err) => {
                        console.warn(`[SW] Bỏ qua file chưa có sẵn khi nạp cache: ${asset}`, err);
                    })
                )
            );
        })
    );
});

// 2. KÍCH HOẠT VÀ TỰ ĐỘNG XÓA BỎ BỘ NHỚ ĐỆM PHIÊN BẢN CŨ
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

// 3. LẮNG NGHE THÔNG ĐIỆP ĐỂ ÉP CẬP NHẬT TỨC THÌ
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 4. ĐIỀU PHỐI DỮ LIỆU MẠNG (FETCH STRATEGY)
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = request.url;

    // Không can thiệp các request không phải GET, API Google Apps Script, hoặc VietQR
    if (
        request.method !== 'GET' ||
        url.includes('script.google.com') ||
        url.includes('vietqr.io') ||
        !url.startsWith('http')
    ) {
        return;
    }

    // CHIẾN LƯỢC 1: Network-First đối với các trang HTML (Ưu tiên mạng để luôn có bản mới nhất)
    if (request.mode === 'navigate' || url.endsWith('.html') || url === self.registration.scope) {
        event.respondWith(
            fetch(request)
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const resClone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
                    }
                    return networkRes;
                })
                .catch(() => {
                    // Xử lý khi mất mạng: Fallback chính xác theo từng trang
                    return caches.match(request).then((cachedRes) => {
                        if (cachedRes) return cachedRes;
                        if (url.includes('exam')) return caches.match('./exam.html');
                        if (url.includes('hocsinh')) return caches.match('./hocsinh.html');
                        if (url.includes('test_parser')) return caches.match('./test_parser.html');
                        return caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // CHIẾN LƯỢC 2: Cache-First đối với tài nguyên tĩnh (Hình ảnh, CSS, JS, Fonts)
    event.respondWith(
        caches.match(request).then((cachedRes) => {
            if (cachedRes) {
                // Trả về bản cache ngay, đồng thời âm thầm fetch để cập nhật bản mới phía sau
                fetch(request)
                    .then((networkRes) => {
                        if (networkRes && networkRes.status === 200) {
                            const resClone = networkRes.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
                        }
                    })
                    .catch(() => {});
                return cachedRes;
            }

            // Nếu chưa có trong cache thì nạp từ mạng
            return fetch(request).then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                    const resClone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
                }
                return networkRes;
            });
        })
    );
});