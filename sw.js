const CACHE_NAME = 'jadwal-presentasi-v2'; // Versi cache dinaikkan!
const urlsToCache = [
  '/',
  'index.html',
  'rekap.html',
  'style.css',
  'script.js',
  'rekap.js',
  // File-file ikon standar dari RealFaviconGenerator
  'site.webmanifest',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'favicon.ico',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png'
];

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
  if (event.request.url.includes('docs.google.com')) {
    event.respondWith(fetch(event.request));
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