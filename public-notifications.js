import { requestNotificationPermission, subscribeToPush } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    const notificationButton = document.getElementById('notification-button');

    if (!notificationButton) return;

    // Cek apakah notifikasi didukung oleh browser
    const isPushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    if (isPushSupported) {
        // Tampilkan tombol hanya jika izin belum diberikan atau ditolak
        if (Notification.permission !== 'granted') {
            notificationButton.style.display = 'inline-block';
        }

        notificationButton.addEventListener('click', async () => {
            notificationButton.disabled = true;
            notificationButton.textContent = 'Memproses...';

            try {
                const permission = await requestNotificationPermission();

                if (permission === 'granted') {
                    await subscribeToPush();
                    notificationButton.textContent = 'Notifikasi Aktif';
                    // Tombol tetap disabled karena sudah berhasil
                } else {
                    alert('Anda tidak memberikan izin untuk notifikasi. Anda bisa mengaktifkannya nanti di pengaturan browser.');
                    notificationButton.disabled = false;
                    notificationButton.textContent = 'Aktifkan Notifikasi';
                }
            } catch (err) {
                console.error('Gagal mengaktifkan notifikasi:', err);
                alert('Gagal mengaktifkan notifikasi: ' + err.message);
                notificationButton.disabled = false;
                notificationButton.textContent = 'Aktifkan Notifikasi';
            }
        });
    } else {
        // Jika tidak didukung, jangan tampilkan tombol
        console.warn('Notifikasi tidak didukung di browser ini.');
    }
});