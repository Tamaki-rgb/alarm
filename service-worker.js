/* ═══════════════════════════════════════════════
   AILARM — service-worker.js  v2.0
   FIX: Periodic Background Sync + alarm notifications
   when screen is off / app is in background
   ═══════════════════════════════════════════════ */

const CACHE_NAME = 'ailarm-v2.0';
const STATIC_ASSETS = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ── Install ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first static, network-first weather ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.hostname.includes('open-meteo') || url.hostname.includes('openweathermap')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});

/* ══════════════════════════════════════════════════
   BUG FIX #1 — ALARM WITH SCREEN OFF
   Strategy: Periodic Background Sync fires every minute.
   SW reads alarms from IndexedDB, compares with current
   time, shows a notification that wakes the device.
   Notification click → opens app → triggerAlarm() runs.
   ══════════════════════════════════════════════════ */

/* ── Periodic Background Sync ── */
self.addEventListener('periodicsync', event => {
  if (event.tag === 'ailarm-check') {
    event.waitUntil(backgroundAlarmCheck());
  }
});

/* ── One-shot Background Sync (fallback) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'ailarm-check') {
    event.waitUntil(backgroundAlarmCheck());
  }
});

async function backgroundAlarmCheck() {
  const alarms = await idbGetAlarms();
  if (!alarms.length) return;

  const now = new Date();
  const h   = now.getHours();
  const m   = now.getMinutes();
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  const dow = (now.getDay() + 6) % 7; // 0 = Mon

  for (const alarm of alarms) {
    if (!alarm.active) continue;
    if (alarm.time !== timeStr) continue;
    if (!alarm.days.includes(dow)) continue;

    // Check we haven't already fired this minute
    const fireKey = `fired_${alarm.id}_${timeStr}`;
    const already = await idbGet(fireKey);
    if (already) continue;
    await idbSet(fireKey, Date.now());

    // Show notification — this wakes the screen
    await self.registration.showNotification('⏰ Ailarm', {
      body: alarm.label || (alarm.type === 'smart' ? '🤖 Умный будильник' : 'Пора просыпаться!'),
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: `alarm-${alarm.id}`,
      renotify: true,
      requireInteraction: true,                 // stays until dismissed
      vibrate: [500, 200, 500, 200, 500, 200, 1000],
      data: { alarmId: alarm.id, type: 'alarm' },
      actions: [
        { action: 'stop',   title: '✅ Выключить' },
        { action: 'snooze', title: '💤 +5 мин'    }
      ]
    });

    // Also wake any open clients
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'TRIGGER_ALARM', alarmId: alarm.id }));
  }
}

/* ── Notification click ── */
self.addEventListener('notificationclick', event => {
  const { action, notification } = event;
  const { alarmId } = notification.data || {};
  notification.close();

  if (action === 'snooze') {
    // Schedule snooze via postMessage when client opens
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
        const msg = { type: 'SNOOZE_ALARM', alarmId };
        if (clients.length) {
          clients[0].postMessage(msg);
          return clients[0].focus();
        }
        // Store snooze intent in IDB so app reads it on open
        await idbSet('pending_snooze', { alarmId, until: Date.now() + 5 * 60 * 1000 });
        return self.clients.openWindow('./index.html');
      })
    );
    return;
  }

  // 'stop' or tap (default) — open app and stop alarm
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      const msg = { type: 'STOP_ALARM', alarmId };
      if (clients.length) {
        clients[0].postMessage(msg);
        return clients[0].focus();
      }
      await idbSet('pending_stop', alarmId);
      return self.clients.openWindow('./index.html');
    })
  );
});

/* ── Push (future server-side alarms) ── */
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'Ailarm', body: 'Время просыпаться!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'ailarm-push',
      renotify: true
    })
  );
});

/* ══════════════════════════════════════════════════
   MINIMAL IndexedDB HELPERS
   SW cannot access localStorage — IDB is the bridge
   between SW and the main thread for alarm data.
   ══════════════════════════════════════════════════ */

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ailarm_sw', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result?.v);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ k: key, v: value });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbGetAlarms() {
  try {
    const raw = await idbGet('alarms');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
