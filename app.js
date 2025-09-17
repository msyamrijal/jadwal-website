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
 * Mengambil dan mem-parsing data dari Google Sheets.
 * Fungsi ini menjadi satu-satunya sumber untuk mendapatkan data jadwal.
 * @returns {Promise<Array<Object>>} Promise yang akan resolve dengan data yang sudah diparsing.
 */
function fetchScheduleData() {
    // Gunakan URL yang sama untuk semua
    const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcEUYNKssh36NHW_Rk7D89EFDt-ZWFdKxQI32L_Q1exbwNhHuGHWKh_W8VFSA8E58vjhVrumodkUv9/pub?gid=0&single=true&output=csv";

    return new Promise((resolve, reject) => {
        fetch(spreadsheetUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Gagal mengambil data dari jaringan');
                }
                return response.text();
            })
            .then(csvData => {
                const parsedData = parseCSV(csvData);
                resolve(parsedData);
            })
            .catch(error => {
                console.error("Error fetching central data:", error);
                reject(error);
            });
    });
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

    updateBanner.style.display = 'flex'; // Gunakan 'flex' agar sesuai dengan styling di CSS
    updateButton.onclick = () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    };
}

/**
 * Menambahkan fungsionalitas pada tombol reset aplikasi.
 */
function setupResetFunctionality() {
    const resetButton = document.getElementById('reset-app-button');
    if (!resetButton) return;

    resetButton.addEventListener('click', (e) => {
        e.preventDefault();
        showResetConfirmation();
    });
}

/**
 * Menampilkan modal konfirmasi untuk reset.
 */
function showResetConfirmation() {
    // Hapus modal lama jika ada
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="modal-content">
            <h3>Reset Aplikasi?</h3>
            <p>Tindakan ini akan menghapus semua data yang tersimpan (cache) dan memuat ulang aplikasi ke versi terbaru. Anda yakin?</p>
            <div class="modal-buttons">
                <button id="cancel-reset">Batal</button>
                <button id="confirm-reset">Ya, Hapus</button>
            </div>
        </div>
    `;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = modalHTML;
    document.body.appendChild(modalOverlay);

    document.getElementById('confirm-reset').addEventListener('click', () => {
        hardResetApplication();
    });

    document.getElementById('cancel-reset').addEventListener('click', () => {
        modalOverlay.remove();
    });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

/**
 * Melakukan reset total: unregister service worker, hapus semua cache, dan reload.
 */
async function hardResetApplication() {
    try {
        console.log('Memulai reset aplikasi...');
        // 1. Unregister semua service worker
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('Service worker berhasil di-unregister.');
            }
        }

        // 2. Hapus semua cache
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        console.log('Semua cache berhasil dihapus.');

        // 3. Muat ulang halaman dari server
        console.log('Memuat ulang halaman...');
        window.location.reload(true);
    } catch (error) {
        console.error('Gagal melakukan reset:', error);
        alert('Gagal melakukan reset. Silakan coba bersihkan cache browser secara manual.');
    }
}