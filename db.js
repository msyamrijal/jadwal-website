
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, updateDoc, doc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export async function fetchScheduleData() {
  try {
    const querySnapshot = await getDocs(collection(db, "schedules"));
    const schedules = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // --- PERBAIKAN: Pemeriksaan Defensif ---
      // Cek apakah field 'Tanggal' ada dan merupakan Timestamp yang valid sebelum diproses.
      if (data.Tanggal && typeof data.Tanggal.toDate === 'function') {
        const scheduleWithDate = {
          id: doc.id,
          ...data,
          dateObject: data.Tanggal.toDate()
        };
        schedules.push(scheduleWithDate);
      } else {
        // Jika ada data yang tidak valid, catat di console dan lewati agar tidak merusak aplikasi.
        console.warn(`[PERINGATAN] Dokumen dengan ID: ${doc.id} dilewati karena field 'Tanggal' tidak valid atau tidak ada.`, data);
      }
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
    // Normalisasi nama input agar cocok dengan data di database
    const normalizedName = participantName.trim().toLowerCase();

    // Gunakan query 'array-contains' yang lebih efisien dan fleksibel
    const q = query(collection(db, "schedules"), where("searchable_participants", "array-contains", normalizedName));
    const querySnapshot = await getDocs(q);

    const schedules = [];
    querySnapshot.forEach(doc => {
      schedules.push({
        id: doc.id,
        ...doc.data(),
        dateObject: doc.data().Tanggal.toDate()
      });
    });

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
    const dataToUpdate = { ...data };

    // Cek apakah ada field 'Peserta' yang diupdate.
    // Jika ya, hitung ulang array `searchable_participants`.
    const hasParticipantChanges = Object.keys(dataToUpdate).some(key => key.startsWith('Peserta '));

    if (hasParticipantChanges) {
        dataToUpdate.searchable_participants = [];
        for (let i = 1; i <= 12; i++) {
            const participantName = dataToUpdate[`Peserta ${i}`];
            if (participantName && participantName.trim() !== '') {
                dataToUpdate.searchable_participants.push(participantName.trim().toLowerCase());
            }
        }
    }

    const scheduleRef = doc(db, "schedules", scheduleId);
    // Firestore secara otomatis mengonversi objek Date JavaScript ke Timestamp
    await updateDoc(scheduleRef, dataToUpdate);
}

/**
 * Membuat dokumen jadwal baru di Firestore.
 * @param {Object} scheduleData Objek dengan data jadwal baru.
 */
export async function createSchedule(scheduleData) {
    // 1. Siapkan data final untuk Firestore
    const dataToSave = { ...scheduleData };

    // 2. Buat array `searchable_participants` dari data peserta, sama seperti di migration-script
    dataToSave.searchable_participants = [];
    for (let i = 1; i <= 12; i++) {
        const participantName = dataToSave[`Peserta ${i}`];
        if (participantName && participantName.trim() !== '') {
            dataToSave.searchable_participants.push(participantName.trim().toLowerCase());
        }
    }

    // 3. Tambahkan dokumen baru ke koleksi 'schedules'
    // Firestore SDK akan otomatis mengonversi objek Date JavaScript ke Timestamp
    const docRef = await addDoc(collection(db, "schedules"), dataToSave);
    console.log("Jadwal baru berhasil dibuat dengan ID:", docRef.id);
    return docRef;
}

/**
 * Menghapus dokumen jadwal dari Firestore.
 * @param {string} scheduleId ID dokumen yang akan dihapus.
 */
export async function deleteSchedule(scheduleId) {
    const scheduleRef = doc(db, "schedules", scheduleId);
    await deleteDoc(scheduleRef);
    console.log(`Jadwal dengan ID: ${scheduleId} berhasil dihapus.`);
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
