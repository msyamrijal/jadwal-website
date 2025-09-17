const DB_NAME = 'jadwal-db';
const DB_VERSION = 1;
const SCHEDULE_STORE = 'schedules';
const REKAP_STORE = 'rekap';

/**
 * Membuka koneksi ke database IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
    return idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
                db.createObjectStore(SCHEDULE_STORE);
            }
            if (!db.objectStoreNames.contains(REKAP_STORE)) {
                db.createObjectStore(REKAP_STORE);
            }
        },
    });
}

/**
 * Menyimpan data jadwal lengkap ke IndexedDB.
 * @param {Array<Object>} data Data jadwal yang akan disimpan.
 */
async function saveSchedules(data) {
    const db = await openDb();
    const tx = db.transaction(SCHEDULE_STORE, 'readwrite');
    await tx.store.put(data, 'full-schedule');
    await tx.done;
    console.log('Data jadwal lengkap disimpan ke IndexedDB.');
}

/**
 * Mengambil data jadwal lengkap dari IndexedDB.
 * @returns {Promise<Array<Object>|undefined>}
 */
async function getSchedules() {
    const db = await openDb();
    const data = await db.get(SCHEDULE_STORE, 'full-schedule');
    if (data) {
        console.log('Data jadwal lengkap diambil dari IndexedDB.');
    }
    return data;
}

/**
 * Menyimpan data rekap peserta ke IndexedDB.
 * @param {Object} data Data rekap yang akan disimpan.
 */
async function saveRekap(data) {
    const db = await openDb();
    const tx = db.transaction(REKAP_STORE, 'readwrite');
    await tx.store.put(data, 'participant-summary');
    await tx.done;
    console.log('Data rekap disimpan ke IndexedDB.');
}

/**
 * Mengambil data rekap peserta dari IndexedDB.
 * @returns {Promise<Object|undefined>}
 */
async function getRekap() {
    const db = await openDb();
    const data = await db.get(REKAP_STORE, 'participant-summary');
    if (data) {
        // Objek Date hilang saat disimpan di IndexedDB, jadi kita perlu mengonversinya kembali
        for (const name in data) {
            data[name].forEach(schedule => {
                schedule.date = new Date(schedule.date);
            });
        }
        console.log('Data rekap diambil dari IndexedDB.');
    }
    return data;
}