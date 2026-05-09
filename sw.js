const CACHE_NAME = 'invest-v17-cache'; // Bumped to v16 to force a reset
const ASSETS_TO_CACHE = [
    './',              // Added root path
    './index.html',    // Fixed: changed from invest.html
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0'
];

// 1. Install & Cache Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force new service worker to activate immediately
});

// 2. Activate & Clean Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Take control of all pages immediately
});

// 3. Fetch from Cache First (Offline Mode)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached version if found, else fetch from network
            return cachedResponse || fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Cache the new network response for future offline use
                    // Only cache valid responses (GET requests)
                    if (event.request.method === 'GET' && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        }).catch(() => {
            // Failsafe for complete offline failure
            console.error('[Service Worker] Fetch failed entirely.');
        })
    );
});

// 4. Push Notification Engine (For Maturity/Goal Alerts)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: "Invest OS", body: "Check your portfolio." };
    
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/192/10398/10398188.png',
        badge: 'https://cdn-icons-png.flaticon.com/192/10398/10398188.png',
        vibrate: [200, 100, 200, 100, 200],
        data: { url: './index.html' } // Fixed: changed from invest.html
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// 5. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
