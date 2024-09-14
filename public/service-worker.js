// 'install' event: se activa cuando el service worker se instala
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('v1').then((cache) => {
            return cache.addAll([
                '/', 
                '/index.html',
                '/estilos.css',
                '/parametro.js',
                '/manifest.json',
                '/icons/icon-192x192.png',
                '/icons/icon-512x512.png'
            ]);
        }).catch((error) => {
            console.error('Error al abrir el caché o agregar recursos:', error);
        })
    );
    console.log('Service Worker instalado y recursos cacheados.');
});

// 'fetch' event: intercepta todas las solicitudes de red
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                // Si la solicitud está en el caché, la devuelve
                console.log('Recurso encontrado en caché:', event.request.url);
                return response;
            }
            // Si no está en el caché, hace la solicitud a la red
            console.log('Recurso no encontrado en caché, solicitando de la red:', event.request.url);
            return fetch(event.request).catch((error) => {
                console.error('Error al solicitar el recurso de la red:', error);
            });
        })
    );
});

// 'activate' event: se ejecuta cuando el Service Worker toma el control del alcance
self.addEventListener('activate', (event) => {
    const cacheAllowlist = ['v1']; // Cambia esto según la versión de caché que desees mantener
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheAllowlist.includes(cacheName)) {
                        console.log('Eliminando caché obsoleta:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    console.log('Service Worker activado y cachés obsoletos eliminados.');
});
