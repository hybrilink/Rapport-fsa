// sw.js - Service Worker Principal PWA Étudiant
// Version: 2.0 - Gestion des notifications push

const CACHE_NAME = 'fac-agro-etudiant-v2';
const STATIC_CACHE = 'fac-agro-static-v2';

// ============================================
// 1. RESSOURCES À METTRE EN CACHE
// ============================================
const urlsToCache = [
    '/',
    'index.html',
   
    'manifest.json',
    'firebase-messaging-sw.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'
];

// ============================================
// 2. INSTALLATION
// ============================================
self.addEventListener('install', event => {
    console.log('[SW] 📦 Installation en cours...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] 📥 Mise en cache des ressources...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[SW] ✅ Installation terminée');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] ❌ Erreur installation:', error);
            })
    );
});

// ============================================
// 3. ACTIVATION
// ============================================
self.addEventListener('activate', event => {
    console.log('[SW] 🚀 Activation en cours...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Supprimer les anciens caches
                        if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
                            console.log('[SW] 🗑️ Suppression ancien cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] ✅ Activation terminée');
                return self.clients.claim();
            })
    );
});

// ============================================
// 4. STRATÉGIE DE CACHE (Network First)
// ============================================
self.addEventListener('fetch', event => {
    // Ignorer les appels Firebase et API
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('googleapis.com') ||
        event.request.url.includes('gstatic.com') ||
        event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Mettre en cache les réponses réussies
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        })
                        .catch(() => {});
                }
                return response;
            })
            .catch(() => {
                // Fallback au cache
                return caches.match(event.request)
                    .then(cached => {
                        if (cached) {
                            return cached;
                        }
                        // Pour les navigations, retourner la page d'accueil
                        if (event.request.mode === 'navigate') {
                            return caches.match('etudiant.html');
                        }
                        return new Response('Hors ligne', { status: 503 });
                    });
            })
    );
});

// ============================================
// 5. GESTION DES NOTIFICATIONS PUSH
// ============================================
// Cette fonction s'exécute quand une notification est reçue
// (relais depuis firebase-messaging-sw.js)

self.addEventListener('push', function(event) {
    console.log('[SW] 📨 Notification push reçue');
    
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch(e) {
            data = {
                title: 'Faculté Agronomique',
                body: event.data.text() || 'Nouvelle notification'
            };
        }
    }

    const title = data.notification?.title || data.title || 'Faculté Agronomique';
    const body = data.notification?.body || data.body || 'Nouvelle information';
    
    const options = {
        body: body,
        icon: '/icon-192x192.png',
        badge: '/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.data?.url || '/etudiant.html',
            type: data.data?.type || 'notification'
        },
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ============================================
// 6. GESTION DU CLIC SUR NOTIFICATION
// ============================================
self.addEventListener('notificationclick', function(event) {
    console.log('[SW] 👆 Clic sur notification');
    
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/etudiant.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(clientList) {
                for (let client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICKED',
                            url: urlToOpen
                        });
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================
// 7. MESSAGES DES CLIENTS
// ============================================
self.addEventListener('message', event => {
    console.log('[SW] 📨 Message du client:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'SAVE_STUDENT_SESSION') {
        // Sauvegarder la session pour une utilisation ultérieure
        caches.open('session-cache').then(cache => {
            cache.put(
                'student-session',
                new Response(JSON.stringify({
                    studentId: event.data.studentId,
                    timestamp: Date.now()
                }))
            );
        }).catch(() => {});
    }
});

console.log('[SW] ✅ Service Worker Principal initialisé');