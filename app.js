/**
 * app.js
 * Logika aplikasi yang digunakan bersama di semua halaman.
 * Termasuk PWA installation prompt dan Service Worker registration.
 */

let deferredPrompt; // Variabel untuk menyimpan event install

// --- Logika Instalasi PWA ---
window.addEventListener('beforeinstallprompt', (e) => {
    // Mencegah browser menampilkan prompt default
    e.preventDefault();
    // Simpan event agar bisa dipanggil nanti
    deferredPrompt = e;
    // Tampilkan tombol install kustom kita
    const installButton = document.getElementById('install-button');
    if (installButton) installButton.hidden = false;
});

function handleInstallClick() {
    const installButton = document.getElementById('install-button');
    if (!installButton) return;

    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Respons pengguna: ${outcome}`);
            deferredPrompt = null;
            installButton.hidden = true;
        }
    });
}

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installButton = document.getElementById('install-button');
    if (installButton) installButton.hidden = true;
});

// --- Inisialisasi Logika Bersama ---
handleInstallClick();
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker berhasil didaftarkan.'))
            .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
    });
}