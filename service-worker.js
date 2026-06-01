const CACHE_NAME = 'ailarm-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon.svg',
    './sounds/kolokolnyy-perekhod-43-5574f5.mp3',
    './sounds/timer-bell_m1tycbno.mp3'
];

// Установка Service Worker
self.addEventListener('install', e => {
    console.log('📦 Service Worker: Установка...');
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Кэширование ресурсов...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('📦 Ресурсы закэшированы');
                return self.skipWaiting(); // Активировать сразу
            })
            .catch(err => {
                console.error('❌ Ошибка кэширования:', err);
            })
    );
});

// Активация - очистка старых кэшей
self.addEventListener('activate', e => {
    console.log('🔄 Service Worker: Активация...');
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('🗑️ Удаление старого кэша:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('🔄 Service Worker активирован');
            return self.clients.claim(); // Контролировать все вкладки
        })
    );
});

// Стратегия: Network First, затем Cache Fallback
self.addEventListener('fetch', e => {
    // Игнорируем не-HTTP запросы (например, chrome-extension://)
    if (!e.request.url.startsWith('http')) {
        return;
    }
    
    // Для API запросов (погода) - только сеть, без кэширования
    if (e.request.url.includes('wttr.in')) {
        e.respondWith(fetch(e.request));
        return;
    }
    
    e.respondWith(
        fetch(e.request)
            .then(response => {
                // Кэшируем успешные ответы
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                console.log('📡 Оффлайн режим, берём из кэша:', e.request.url);
                return caches.match(e.request);
            })
    );
});
