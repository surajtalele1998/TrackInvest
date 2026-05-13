const CACHE_NAME = 'invest-pro-v70';

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './icons/icon-maskable-512.svg',
    './style.css',
    './app_part1.js',
    './app_part2.js',
    './app_part3.js'
];

const CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// 1. Install — cache core shell first, then CDN assets best-effort
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Caching core assets');
            await cache.addAll(CORE_ASSETS);
            // CDN assets — don't block install if one fails
            for (const url of CDN_ASSETS) {
                try { await cache.add(url); } catch (e) { console.warn('[SW] Failed to cache CDN:', url); }
            }
        })
    );
    self.skipWaiting();
});

// 2. Activate — purge old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter(n => n !== CACHE_NAME).map(n => {
                console.log('[SW] Deleting old cache:', n);
                return caches.delete(n);
            }))
        )
    );
    self.clients.claim();
});

// 3. Fetch — stale-while-revalidate for CDN, cache-first for local
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET and chrome-extension requests
    if (event.request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;

    // For API calls (mfapi, groq, generativelanguage) → network only, no cache
    if (url.hostname.includes('mfapi.in') ||
        url.hostname.includes('groq.com') ||
        url.hostname.includes('generativelanguage.googleapis.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // For same-origin: cache-first
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached =>
                cached || fetch(event.request).then(resp => {
                    if (resp.status === 200) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return resp;
                })
            ).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // For CDN: stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then(cached => {
            const networkFetch = fetch(event.request).then(resp => {
                if (resp.status === 200) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return resp;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});

// 4. Push Notification
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'TrackInvest', body: 'Check your portfolio.' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: './icons/icon-192.svg',
            badge: './icons/icon-192.svg',
            vibrate: [200, 100, 200],
            data: { url: './index.html' }
        })
    );
});

// 5. Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
