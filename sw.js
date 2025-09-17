const CACHE_NAME = 'jadwal-presentasi-v4'; // Versi cache dinaikkan untuk pembaruan
const urlsToCache = [
  '/',
  'index.html',
  'jadwal.html', // Mengganti rekap.html dengan jadwal.html
  'style.css',
  'script.js',
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
  // Untuk data dari Google Sheets, selalu coba ambil dari internet terlebih dahulu.
  // Jika gagal (offline), baru ambil dari cache.
  if (event.request.url.includes('docs.google.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(response => {
            // Jika berhasil, simpan response ke cache dan kembalikan
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => {
            // Jika fetch gagal, coba cari di cache
            return cache.match(event.request);
          });
      })
    );
    return;
  }

  // Untuk file lain, coba cari di cache dulu. Jika tidak ada, baru ambil dari internet.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Event: Activate
// Hapus cache lama jika ada versi baru.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(cache => {
      if (cache !== CACHE_NAME) return caches.delete(cache);
    }));
  }));
});