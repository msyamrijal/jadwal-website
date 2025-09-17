let deferredPrompt; // Variabel untuk menyimpan event install

/**
 * Menangani logika instalasi PWA.
 */
function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installButton = document.getElementById('install-button');
        if (installButton) installButton.hidden = false;
    });

    const installButton = document.getElementById('install-button');
    if (installButton) {
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
}

/**
 * Mendaftarkan Service Worker.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker berhasil didaftarkan.');

            // Cek jika ada worker baru yang sedang menunggu.
            if (registration.waiting) {
                showUpdateNotification(registration.waiting);
                return;
            }

            // Cek jika ada worker baru yang sedang dalam proses instalasi.
            if (registration.installing) {
                trackInstalling(registration.installing);
                return;
            }

            // Dengarkan event 'updatefound' untuk mendeteksi worker baru di masa depan.
            registration.onupdatefound = () => {
                console.log('Service Worker baru ditemukan, sedang diinstall.');
                trackInstalling(registration.installing);
            };
        }).catch(error => {
            console.error('Pendaftaran Service Worker gagal:', error);
        });

        // Muat ulang halaman ketika controller service worker berubah.
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }
}

/**
 * Mem-parsing data CSV menjadi array of objects.
 * @param {string} csvData - String data CSV.
 * @returns {Array<Object>}
 */
function parseCSV(csvData) {
    const lines = csvData.split("\n");
    const headers = lines[0].split(",").map(header => header.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(value => value.trim());
        if (values.length === headers.length) {
            const entry = {};
            for (let j = 0; j < headers.length; j++) {
                entry[headers[j]] = values[j];
            }
            data.push(entry);
        }
    }
    return data;
}

/**
 * Melacak proses instalasi service worker baru.
 * @param {ServiceWorker} worker 
 */
function trackInstalling(worker) {
    worker.addEventListener('statechange', () => {
        // Jika state menjadi 'installed', berarti worker baru siap dan menunggu.
        if (worker.state === 'installed') {
            showUpdateNotification(worker);
        }
    });
}

/**
 * Menampilkan notifikasi bahwa versi baru tersedia.
 * @param {ServiceWorker} worker 
 */
function showUpdateNotification(worker) {
    const updateBanner = document.getElementById('update-notification');
    const updateButton = document.getElementById('update-button');

    if (!updateBanner || !updateButton) return;

    updateBanner.style.display = 'block';
    updateButton.onclick = () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    };
}