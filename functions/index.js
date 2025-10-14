const functions = require("firebase-functions");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

// Konfigurasi VAPID Keys.
// PENTING: Kunci ini harus diatur di environment Firebase, bukan di hardcode.
// Jalankan perintah ini di terminal Anda (ganti dengan kunci Anda):
// firebase functions:config:set vapid.public_key="YOUR_PUBLIC_KEY"
// firebase functions:config:set vapid.private_key="YOUR_PRIVATE_KEY"
const vapidKeys = {
    publicKey: functions.config().vapid.public_key,
    privateKey: functions.config().vapid.private_key,
};

webpush.setVapidDetails(
    "mailto:admin@jadwaluna.web.app", // Ganti dengan email kontak Anda
    vapidKeys.publicKey,
    vapidKeys.privateKey,
);

// Fungsi yang dijadwalkan berjalan setiap hari jam 10 pagi (WIB/GMT+7)
exports.sendDailyScheduleNotifications = functions.pubsub
    .schedule("0 10 * * *") // Format cron: menit jam hari bulan hari_minggu
    .timeZone("Asia/Jakarta")
    .onRun(async (context) => {
        console.log("Menjalankan fungsi notifikasi jadwal harian (Tes jam 10:00)...");

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

        const notificationsToSend = [];

        // 2. Proses setiap jadwal
        for (const doc of schedulesSnapshot.docs) {
            const schedule = doc.data();
            const scheduleTime = schedule.Tanggal.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

            // Ambil semua nama peserta dari jadwal
            const participantNames = [];
            for (let i = 1; i <= 12; i++) {
                if (schedule[`Peserta ${i}`]) {
                    participantNames.push(schedule[`Peserta ${i}`].trim());
                }
            }

            if (participantNames.length === 0) continue;

            // 3. Cari pengguna yang cocok dengan nama peserta
            const usersSnapshot = await db.collection("users")
                .where("displayName", "in", participantNames)
                .get();

            usersSnapshot.forEach((userDoc) => {
                const user = userDoc.data();
                // Cek apakah pengguna punya token notifikasi
                if (user.pushTokens && user.pushTokens.length > 0) {
                    const notificationPayload = {
                        title: `Jadwal Anda Hari Ini (${scheduleTime} WIB)`,
                        body: `Mata Kuliah: ${schedule.Mata_Pelajaran}`,
                        data: {
                            url: "/dashboard.html", // Arahkan ke dashboard saat notifikasi diklik
                        },
                    };

                    // Tambahkan semua token pengguna ke daftar pengiriman
                    user.pushTokens.forEach((token) => {
                        notificationsToSend.push(
                            webpush.sendNotification(token, JSON.stringify(notificationPayload)),
                        );
                    });
                }
            });
        }

        // 4. Kirim semua notifikasi secara paralel
        await Promise.allSettled(notificationsToSend);
        console.log(`${notificationsToSend.length} notifikasi telah diproses.`);

        return null;
    });
