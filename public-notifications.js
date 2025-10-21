import { requestNotificationPermission, subscribeToPush } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    const notificationBellButton = document.getElementById('notification-bell-btn');
    const popupOverlay = document.getElementById('public-notification-popup-overlay');
    const activateBtn = document.getElementById('public-popup-activate-btn');
    const laterBtn = document.getElementById('public-popup-later-btn');

    if (!notificationBellButton || !popupOverlay || !activateBtn || !laterBtn) return;

    // Cek apakah notifikasi didukung oleh browser
    const isPushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    if (isPushSupported) {
        // Tampilkan ikon lonceng hanya jika izin belum diberikan (granted)
        if (Notification.permission !== 'granted') {
            notificationBellButton.style.display = 'inline-flex';
        }

        // Klik ikon lonceng akan menampilkan pop-up
        notificationBellButton.addEventListener('click', () => {
            popupOverlay.style.display = 'flex';
        });

        // Tombol "Nanti Saja" akan menutup pop-up
        laterBtn.addEventListener('click', () => {
            popupOverlay.style.display = 'none';
        });

        // Tombol "Aktifkan" di dalam pop-up akan menjalankan proses
        activateBtn.addEventListener('click', async () => {
            activateBtn.disabled = true;
            laterBtn.disabled = true;
            activateBtn.textContent = 'Memproses...';

            try {
                const permission = await requestNotificationPermission();

                if (permission === 'granted') {
                    await subscribeToPush();
                    popupOverlay.style.display = 'none';
                    notificationBellButton.style.display = 'none'; // Sembunyikan ikon lonceng karena sudah aktif
                    alert('Notifikasi berhasil diaktifkan!');
                } else {
                    alert('Anda tidak memberikan izin untuk notifikasi. Anda bisa mengaktifkannya nanti di pengaturan browser.');
                    popupOverlay.style.display = 'none'; // Tutup pop-up
                }
            } catch (err) {
                console.error('Gagal mengaktifkan notifikasi:', err);
                alert('Gagal mengaktifkan notifikasi: ' + err.message);
                popupOverlay.style.display = 'none'; // Tutup pop-up jika error
            } finally {
                // Kembalikan state tombol di pop-up
                activateBtn.disabled = false;
                laterBtn.disabled = false;
                activateBtn.textContent = 'Aktifkan';
            }
        });
    } else {
        // Jika tidak didukung, jangan tampilkan ikon
        console.warn('Notifikasi tidak didukung di browser ini.');
    }
});