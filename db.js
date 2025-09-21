
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export async function fetchScheduleData() {
  try {
    const querySnapshot = await getDocs(collection(db, "schedules"));
    const schedules = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Konversi Firestore Timestamp kembali ke objek Date JavaScript
      // dan tambahkan ke dalam data agar bisa digunakan oleh fungsi lain.
      const scheduleWithDate = {
        id: doc.id, // <-- Tambahkan ID dokumen Firestore
        ...data,
        // Firestore menyimpan 'Tanggal' sebagai Timestamp, kita ubah jadi JS Date
        // Fungsi lain seperti parseDateFromString tidak diperlukan lagi
        dateObject: data.Tanggal.toDate()
      };
      schedules.push(scheduleWithDate);
    });
    console.log("Data berhasil diambil dari Firestore.");
    return schedules;
  } catch (error) {
    console.error("Gagal mengambil data dari Firestore:", error);
    throw error;
  }
}

/**
 * Mengambil jadwal di mana nama peserta yang diberikan muncul.
 * @param {string} participantName Nama lengkap peserta.
 * @returns {Promise<Array<Object>>} Array of schedule objects.
 */
export async function fetchSchedulesByParticipant(participantName) {
  try {
    // Firestore tidak mendukung query OR pada field yang berbeda secara native.
    // Jadi, kita harus melakukan 12 query terpisah dan menggabungkan hasilnya.
    const participantQueries = [];
    for (let i = 1; i <= 12; i++) {
      const q = query(collection(db, "schedules"), where(`Peserta ${i}`, "==", participantName));
      participantQueries.push(getDocs(q));
    }

    const querySnapshots = await Promise.all(participantQueries);
    const schedulesMap = new Map(); // Gunakan Map untuk menghindari duplikat

    querySnapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        if (!schedulesMap.has(doc.id)) {
          schedulesMap.set(doc.id, {
            id: doc.id,
            ...doc.data(),
            dateObject: doc.data().Tanggal.toDate()
          });
        }
      });
    });

    const schedules = Array.from(schedulesMap.values());
    // Urutkan berdasarkan tanggal
    schedules.sort((a, b) => a.dateObject - b.dateObject);
    
    console.log(`Ditemukan ${schedules.length} jadwal untuk ${participantName}`);
    return schedules;

  } catch (error) {
    console.error(`Gagal mengambil jadwal untuk ${participantName}:`, error);
    throw error;
  }
}

/**
 * Memperbarui dokumen jadwal tertentu di Firestore.
 * @param {string} scheduleId ID dokumen yang akan diupdate.
 * @param {Object} data Objek dengan field yang akan diupdate.
 */
export async function updateSchedule(scheduleId, data) {
    const scheduleRef = doc(db, "schedules", scheduleId);
    // Firestore secara otomatis mengonversi objek Date JavaScript ke Timestamp
    await updateDoc(scheduleRef, data);
}

// --- FUNGSI DATABASE (INDEXEDDB) --- //

const DB_NAME = 'jadwalDB';
const SCHEDULE_STORE = 'schedules';
const REKAP_STORE = 'rekap';
const RAW_SCHEDULE_STORE = 'raw_schedules'; // Store baru untuk data mentah

function openDB() {
  return idb.openDB(DB_NAME, 2, { // Naikkan versi DB untuk upgrade
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
        db.createObjectStore(SCHEDULE_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(REKAP_STORE)) {
        // Menggunakan 'name' sebagai keyPath untuk rekap, karena unik
        db.createObjectStore(REKAP_STORE, { keyPath: 'name' });
      }
      // Buat object store baru untuk data mentah di versi 2
      if (oldVersion < 2 && !db.objectStoreNames.contains(RAW_SCHEDULE_STORE)) {
        db.createObjectStore(RAW_SCHEDULE_STORE);
      }
    },
  });
}

export async function saveSchedules(data) {
  const db = await openDB(); // Fungsi ini sekarang akan digunakan oleh rekap.js
  const tx = db.transaction(SCHEDULE_STORE, 'readwrite');
  await tx.store.clear(); // Hapus data lama
  for (const item of data) {
    await tx.store.put(item);
  }
  await tx.done;
  console.log("Jadwal baru berhasil disimpan ke IndexedDB.");
}

export async function saveRawSchedules(data) {
    const db = await openDB();
    const tx = db.transaction(RAW_SCHEDULE_STORE, 'readwrite');
    await tx.store.clear(); // Hapus semua data lama
    // Simpan data baru sebagai satu entri dengan kunci 'all'
    await tx.store.put(data, 'all');
    await tx.done;
    console.log("Data jadwal mentah berhasil disimpan ke IndexedDB.");
}

export async function getSchedules() {
  const db = await openDB();
  return await db.getAll(SCHEDULE_STORE);
}

export async function getRawSchedules() {
    const db = await openDB();
    return await db.get(RAW_SCHEDULE_STORE, 'all');
}

export async function saveRekap(summaryData) {
    const db = await openDB();
    const tx = db.transaction(REKAP_STORE, 'readwrite');
    await tx.store.clear();
    for (const name in summaryData) {
        // Pastikan formatnya { name: 'nama', schedules: [...] }
        await tx.store.put({ name: name, schedules: summaryData[name] });
    }
    await tx.done;
    console.log("Rekap baru berhasil disimpan ke IndexedDB.");
}

export async function getRekap() {
    const db = await openDB();
    const allRekap = await db.getAll(REKAP_STORE);
    // Ubah kembali dari array of objects ke format summary object
    const summary = {};
    allRekap.forEach(item => {
        summary[item.name] = item.schedules;
    });
    return summary;
}
