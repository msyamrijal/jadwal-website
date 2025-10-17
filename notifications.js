import { db } from './firebase-config.js';
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/**
 * Mengonversi VAPID public key dari URL-safe base64 ke Uint8Array.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Fungsi helper untuk menunggu Service Worker siap dengan timeout.
 * @param {number} timeoutMs - Waktu timeout dalam milidetik.
 */
function getReadyServiceWorker(timeoutMs = 10000) {
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker tidak siap dalam waktu yang ditentukan.')), timeoutMs))
    ]);
}

/**
 * Meminta izin notifikasi dan mendaftarkan push subscription.
 * @param {string} userId - ID pengguna yang sedang login.
 */
export async function subscribeUserToPush(userId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging tidak didukung oleh browser ini.');
        throw new Error('Push messaging tidak didukung oleh browser ini.');
    }

    if (Notification.permission === 'denied') {
        console.warn('Izin notifikasi telah diblokir oleh pengguna.');
        throw new Error('Izin notifikasi telah diblokir.');
    }

    try {
        // Gunakan fungsi dengan timeout
        const registration = await getReadyServiceWorker();
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            console.log('Pengguna sudah terdaftar untuk notifikasi.');
            // Opsional: Anda bisa memperbarui token di server di sini jika perlu
            await saveSubscription(userId, existingSubscription);
            return;
        }

        // Ganti dengan VAPID Public Key dari Firebase Cloud Messaging Anda
        const VAPID_PUBLIC_KEY = 'BKKvmTWHsEOCJlR0GwsVOU8EGLAZ73zf3YZKm846emf36nWQD6kZ-RD5jexJXTKBJPcaRnr39JQbcI1kkBVf3E8';
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });

        console.log('Berhasil mendaftar untuk notifikasi:', subscription);
        await saveSubscription(userId, subscription);

    } catch (error) {
        console.error('Gagal mendaftar untuk notifikasi:', error);
        if (Notification.permission === 'denied') {
            alert('Anda telah memblokir notifikasi. Harap aktifkan secara manual di pengaturan browser jika ingin menerima pengingat jadwal.');
        }
        throw error; // Lemparkan error agar bisa ditangkap oleh pemanggil
    }
}

/**
 * Menyimpan subscription token ke profil pengguna di Firestore.
 * @param {string} userId
 * @param {PushSubscription} subscription
 */
async function saveSubscription(userId, subscription) {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);
    // Menggunakan arrayUnion untuk menambahkan token baru tanpa duplikasi
    await updateDoc(userDocRef, {
        pushTokens: arrayUnion(JSON.parse(JSON.stringify(subscription)))
    });
    console.log('Subscription token berhasil disimpan ke Firestore.');
}

/**
 * Menghapus subscription token dari profil pengguna.
 * @param {string} userId
 * @param {PushSubscription} subscription
 */
export async function unsubscribeUserFromPush(userId, subscription) {
    if (!userId || !subscription) return;
    const userDocRef = doc(db, 'users', userId);
    // Menggunakan arrayRemove untuk menghapus token
    await updateDoc(userDocRef, {
        pushTokens: arrayRemove(JSON.parse(JSON.stringify(subscription)))
    });
    console.log('Subscription token berhasil dihapus dari Firestore.');
}