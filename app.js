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
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker berhasil didaftarkan.'))
            .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
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