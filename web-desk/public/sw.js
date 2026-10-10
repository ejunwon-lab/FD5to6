// 설치 가능 PWA 조건용 최소 서비스 워커 — 캐시 없음(네트워크 패스스루). 오프라인 지원은 의도적으로 안 함.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
