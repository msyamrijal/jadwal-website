const CACHE_NAME = 'jadwal-presentasi-v18-public-notif'; // Naikkan versi cache
const urlsToCache = [
  '/',
  'index.html',
  'jadwal.html',
  'login.html',
  'register.html',
  'dashboard.html',
  'manage.html',
  'admin.html',
  'style.css',
  'idb.js',
  'app.js',
  // Skrip Modul
  'firebase-config.js',
  'auth-helpers.js',
  'auth-admin.js',
  'db.js',
  'rekap.js',
  'dashboard.js',
  'manage.js',
  'admin.js',
  'notifications.js',
  'public-notifications.js',
  // Aset PWA
  'site.webmanifest',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'favicon.ico',
  // Ikon dari manifest yang sudah dikonsolidasi
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
];

// Listener untuk pesan dari klien (misalnya, untuk skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Event: Install
// Saat service worker di-install, buka cache dan simpan semua file dasar aplikasi.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache dibuka, menyimpan file dasar aplikasi');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event: Fetch
// Setiap kali halaman meminta sebuah file (gambar, css, dll.), service worker akan mencegatnya.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Selalu abaikan halaman reset, biarkan browser mengambilnya dari jaringan.
  // Ini adalah tombol darurat kita.
  if (url.pathname.endsWith('/reset.html')) {
    return; // Bypass service worker
  }

  // STRATEGI 1: Stale-While-Revalidate untuk halaman HTML (permintaan navigasi).
  // Ini membuat aplikasi terasa instan saat dibuka, bahkan saat offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        // 1. Sajikan dari cache terlebih dahulu
        return cache.match(event.request).then(cachedResponse => {
          // 2. Di latar belakang, ambil versi baru dari jaringan
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // Jika berhasil, perbarui cache
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          // Kembalikan respons dari cache jika ada, atau tunggu dari jaringan jika tidak ada di cache
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // STRATEGI 2: Network-Only untuk API Firebase.
  // Jangan pernah cache permintaan API dinamis.
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis.com')) {
    // Langsung ke jaringan, jangan coba cache.
    event.respondWith(fetchAndCache(event.request));
    return;
  }

  // STRATEGI 2: Cache-first untuk aset statis lainnya (CSS, JS, gambar, font).
  // Aset ini tidak sering berubah dan aman disajikan dari cache untuk kecepatan.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, kembalikan. Jika tidak, ambil dari jaringan.
        return response || fetch(event.request);
      })
  );
});

/**
 * Fungsi helper untuk strategi Network-First.
 * Mencoba fetch, jika berhasil perbarui cache, jika gagal ambil dari cache.
 * @param {Request} request
 */
function fetchAndCache(request) {
  // Untuk API Firebase, kita hanya ingin mengambil dari jaringan.
  // Jika gagal, biarkan saja gagal agar aplikasi tahu sedang offline.
  // Kita tidak lagi menyimpan data dinamis (CSV) di cache Service Worker.
  // Data offline sekarang sepenuhnya ditangani oleh IndexedDB.
  return fetch(request);
}

// Event: Activate
// Hapus cache lama jika ada versi baru.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(cache => {
      if (cache !== CACHE_NAME) return caches.delete(cache);
    }));
  }));
});

// Event: Push
// Menangani notifikasi push yang diterima dari server.
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Diterima.');
  
  // Coba parse data dari push event, jika gagal, gunakan data default.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Gagal mem-parse data push, menggunakan default:', e);
  }

  const title = data.title || 'Jadwaluna';
  const options = {
    body: data.body || 'Ada pembaruan jadwal baru untuk Anda.',
    // --- PENTING UNTUK ANDROID ---
    // 'icon' adalah ikon besar yang muncul di notifikasi.
    // 'badge' adalah ikon kecil monokrom yang muncul di status bar.
    icon: 'icons/icon-192x192.png', // Harus ada
    badge: 'icons/icon-192x192.png', // Sebaiknya ada, akan di-render monokrom oleh Android
    
    // Opsi tambahan untuk pengalaman pengguna yang lebih baik
    vibrate: [100, 50, 100], // Getar, jeda, getar
    tag: 'jadwal-update', // Menggantikan notifikasi lama dengan tag yang sama
    renotify: true, // Bergetar/bersuara lagi meskipun tag sama

    // Data yang akan digunakan saat notifikasi diklik
    data: {
      url: data.data ? data.data.url : '/dashboard.html'
    }
  };

  // Fungsi untuk menampilkan notifikasi
  const showNotification = () => {
    return self.registration.showNotification(title, options);
  };

  // Jaga service worker tetap aktif sampai notifikasi ditampilkan
  event.waitUntil(showNotification());
});

// Event: Notification Click
// Menangani aksi saat pengguna mengklik notifikasi.
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notifikasi diklik.');

  event.notification.close(); // Tutup notifikasi

  // Buka URL yang ada di data notifikasi, atau halaman utama jika tidak ada.
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});