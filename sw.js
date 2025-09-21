const CACHE_NAME = 'jadwal-presentasi-v17-admin'; // Versi baru dengan halaman admin
const urlsToCache = [
  '/',
  'index.html',
  'jadwal.html', // Menambahkan jadwal.html
  'login.html',
  'register.html',
  'dashboard.html',
  'manage.html',
  'admin.html',
  'style.css',
  'script.js',
  'idb.js', // File library IDB lokal
  'firebase-config.js', // File konfigurasi Firebase
  'login.js',
  'dashboard.js',
  'db.js', // File database baru
  'manage.js',
  'admin.js',
  'auth-admin.js',
  'app.js', // File baru
  'rekap.js',
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