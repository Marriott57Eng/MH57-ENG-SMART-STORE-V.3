// ============================================================================
// ENG SMART STORE PWA Service Worker (V3 - Enhanced Offline & Push Engine)
// ============================================================================

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `eng-store-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `eng-store-runtime-${CACHE_VERSION}`;
const API_CACHE = `eng-store-api-${CACHE_VERSION}`;
const FONT_CACHE = `eng-store-fonts-${CACHE_VERSION}`;

const CURRENT_CACHES = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE, FONT_CACHE];

// Core static assets required to boot the application shell offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/logo.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  'https://fonts.googleapis.com/css2?family=Fredericka+the+Great&display=swap'
];

// ============================================================================
// 1. Installation: Resilient pre-caching of application shell & static assets
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Use individual caching with allSettled so one missing asset doesn't abort the whole install
      const cachePromises = STATIC_ASSETS.map(async (url) => {
        try {
          const req = new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          if (res && (res.status === 200 || res.status === 0)) {
            await cache.put(req, res);
          }
        } catch (err) {
          console.warn(`[SW] Pre-caching asset skipped (${url}):`, err?.message || err);
        }
      });
      await Promise.allSettled(cachePromises);
    }).then(() => self.skipWaiting())
  );
});

// ============================================================================
// 2. Activation: Clean up old obsolete cache versions & claim active clients
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!CURRENT_CACHES.includes(key)) {
            console.log(`[SW] Pruning obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================================
// 3. Fetch Event Interceptor with Intelligent Caching Strategies
// ============================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 3.1 Non-GET requests & WebSockets & Real-time AI bypass caching
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/live') ||
    url.pathname.startsWith('/api/chat') ||
    url.pathname.startsWith('/api/analyze')
  ) {
    // If user is offline and makes a POST/PUT/DELETE request, return offline JSON error
    if (event.request.method !== 'GET') {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(
            JSON.stringify({
              error: 'network_offline',
              message: 'ระบบอยู่ในโหมดออฟไลน์ รายการของคุณได้รับการบันทึกในเครื่องแล้ว และจะซิงค์เมื่อเชื่อมต่อเน็ต'
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
      );
    }
    return;
  }

  // 3.2 HTML Navigation requests (Network-First with fast cache fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(event.request, 3500)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline navigation fallback: serve cached index.html
          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedIndex) return cachedIndex;

          // Ultimate offline fallback page if cache is empty
          return new Response(
            `<!DOCTYPE html>
            <html lang="th">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>ENG SMART STORE - Offline</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px 24px; max-width: 420px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                  h1 { font-size: 20px; margin-bottom: 12px; color: #38bdf8; }
                  p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
                  button { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>📡 กำลังอยู่ในโหมดออฟไลน์</h1>
                  <p>ไม่สามารถเชื่อมต่อสัญญาณอินเทอร์เน็ตได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi หรือ Cellular แล้วลองใหม่อีกครั้ง</p>
                  <button onclick="window.location.reload()">ลองใหม่อีกครั้ง</button>
                </div>
              </body>
            </html>`,
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 3.3 Read-Only Inventory & Config APIs (GET /api/inventory, GET /api/line/config)
  // Strategy: Network-First with Cache Fallback for seamless offline viewing
  if (url.pathname.startsWith('/api/inventory') || url.pathname.startsWith('/api/line/config')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return safe empty JSON structure so client parser doesn't break
          return new Response(
            JSON.stringify({
              items: [],
              offline: true,
              message: 'Served offline from service worker fallback'
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 3.4 Web Fonts & Google Fonts (Cache-First with cross-origin opaque support)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.match(/\.(woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              const copy = networkResponse.clone();
              caches.open(FONT_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }

  // 3.5 Images, Icons, Logos, Favicons (Cache-First)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|gif)$/) ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              const copy = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 3.6 Vite Script & Style Bundles (/assets/*, .js, .css, @vite modules)
  // Strategy: Stale-While-Revalidate so app boots instantly from cache offline
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Helper for fetch with timeout
function fetchWithTimeout(request, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network request timeout'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ============================================================================
// 4. Web Push Notification Event Handlers
// ============================================================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'ENG Smart Store แจ้งเตือน', body: event.data.text() };
    }
  }

  const title = data.title || '🚨 ENG Smart Store แจ้งเตือน';
  const options = {
    body: data.body || 'มีการแจ้งเตือนใหม่จากระบบคลังสินค้า Store FL.6',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/icon-192.png',
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      type: data.type || 'general',
      extra: data.data || {}
    },
    tag: data.tag || `eng-push-${Date.now()}`,
    renotify: true,
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    actions: [
      { action: 'open', title: '🔍 เปิดดูระบบ' },
      { action: 'close', title: 'ปิด' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      })
      .catch((err) => {
        console.warn('[SW] pushsubscriptionchange re-subscription failed:', err);
      })
  );
});

// ============================================================================
// 5. Client Messages: Skip Waiting & Version Handshake
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
