const CACHE_NAME = 'jadwal-presentasi-v9-indexeddb'; // Versi baru dengan IndexedDB
const urlsToCache = [
  '/',
  'index.html',
  'jadwal.html', // Menambahkan jadwal.html
  'style.css',
  'script.js',
  'db.js', // File database baru
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
  // STRATEGI 1: Network-first untuk permintaan navigasi (HTML) dan data Google Sheets.
  // Ini memastikan pengguna online selalu mendapatkan HTML dan data jadwal terbaru.
  if (event.request.mode === 'navigate' || event.request.url.includes('docs.google.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Jika berhasil, simpan ke cache dan kembalikan responsnya
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // Jika jaringan gagal, coba ambil dari cache sebagai fallback
          return caches.match(event.request);
        })
    );
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

// Event: Activate
// Hapus cache lama jika ada versi baru.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(cache => {
      if (cache !== CACHE_NAME) return caches.delete(cache);
    }));
  }));
});