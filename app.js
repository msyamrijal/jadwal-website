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
    // Regex untuk menangani koma di dalam field yang diapit kutip (jika ada)
    // dan untuk memisahkan baris dengan benar (CRLF atau LF)
    const lines = csvData.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/ /g, '_')); // Ganti spasi di header
    
    return lines.slice(1).map(line => {
        // Regex ini memisahkan berdasarkan koma, tetapi mengabaikan koma di dalam tanda kutip.
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        
        const entry = {};
        headers.forEach((header, index) => {
            if (values[index]) {
                // Hapus tanda kutip di awal/akhir dan trim spasi
                entry[header] = values[index].replace(/^"|"$/g, '').trim();
            } else {
                entry[header] = '';
            }
        });
        return entry;
    });
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