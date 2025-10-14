const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {onSchedule} = require("firebase-functions/v2/scheduler"); // Impor sintaks v2
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

// Konfigurasi VAPID Keys.
// PENTING: Kunci ini harus diatur di environment Firebase, bukan di hardcode.
// Jalankan perintah ini di terminal Anda (ganti dengan kunci Anda):
// firebase functions:config:set vapid.public_key="YOUR_PUBLIC_KEY"
// firebase functions:config:set vapid.private_key="YOUR_PRIVATE_KEY"
const vapidConfig = functions.config().vapid;

// --- LOG DEBUGGING SEMENTARA ---
console.log("Membaca functions.config().vapid:", JSON.stringify(vapidConfig || 'undefined'));

if (!vapidConfig || !vapidConfig.public_key || !vapidConfig.private_key) {
  throw new Error("VAPID keys are not set in the functions config. " +
    "Run 'firebase functions:config:set vapid.public_key=...' and 'vapid.private_key=...'");
}

const vapidKeys = {
    publicKey: vapidConfig.public_key,
    privateKey: vapidConfig.private_key,
};

webpush.setVapidDetails(
    "mailto:admin@jadwaluna.web.app", // Ganti dengan email kontak Anda
    vapidKeys.publicKey,
    vapidKeys.privateKey,
);

// --- PERUBAHAN SINTAKS KE V2 ---
// Fungsi yang dijadwalkan berjalan setiap hari jam 14:10 siang (WIB/GMT+7) untuk pengujian
exports.sendDailyScheduleNotifications = onSchedule({
    schedule: "10 14 * * *", // Diubah ke jam 14:10
    timeZone: "Asia/Jakarta",
}, async (event) => {
    console.log("Menjalankan fungsi notifikasi ringkasan harian (Tes jam 14:10)...");

        const today = new Date();
        const tomorrow = new Date();
        today.setHours(0, 0, 0, 0);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        // 1. Ambil semua jadwal untuk hari ini
        const schedulesSnapshot = await db.collection("schedules")
            .where("Tanggal", ">=", admin.firestore.Timestamp.fromDate(today))
            .where("Tanggal", "<", admin.firestore.Timestamp.fromDate(tomorrow))
            .get();

        if (schedulesSnapshot.empty) {
            console.log("Tidak ada jadwal untuk hari ini. Fungsi selesai.");
            return null;
        }

        // --- LOGIKA BARU: BUAT RINGKASAN ---
        let notificationBody = "Jadwal hari ini:\n";
        const allParticipantsToday = new Set();

        // 1. Kumpulkan semua jadwal dan peserta unik
        for (const doc of schedulesSnapshot.docs) {
            const schedule = doc.data();
            const scheduleTime = schedule.Tanggal.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            notificationBody += `\n• ${schedule.Mata_Pelajaran} (${scheduleTime}): `;

            const participantsInSchedule = [];
            for (let i = 1; i <= 12; i++) {
                if (schedule[`Peserta ${i}`]) {
                    const name = schedule[`Peserta ${i}`].trim();
                    participantsInSchedule.push(name);
                    allParticipantsToday.add(name);
                }
            }
            notificationBody += participantsInSchedule.join(", ") || "Belum ada peserta.";
        }

        // 2. Siapkan payload notifikasi
        const notificationPayload = {
            title: `Ringkasan Jadwal Hari Ini (${schedulesSnapshot.size} Sesi)`,
            body: notificationBody,
            data: {
                url: "/jadwal.html", // Arahkan ke halaman jadwal umum
            },
        };

        // 3. Cari semua pengguna yang merupakan peserta hari ini
        if (allParticipantsToday.size === 0) {
            console.log("Tidak ada peserta yang terdaftar untuk jadwal hari ini. Fungsi selesai.");
            return null;
        }

        const participantNamesArray = Array.from(allParticipantsToday);
        const usersSnapshot = await db.collection("users").where("displayName", "in", participantNamesArray).get();

        const notificationsToSend = [];
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            if (user.pushTokens && user.pushTokens.length > 0) {
                user.pushTokens.forEach(token => {
                    notificationsToSend.push(webpush.sendNotification(token, JSON.stringify(notificationPayload)));
                });
            }
        });

        // 4. Kirim semua notifikasi ke peserta secara paralel
        await Promise.allSettled(notificationsToSend);
        console.log(`${notificationsToSend.length} notifikasi ringkasan telah dikirim ke peserta.`);

        return null;
    });
