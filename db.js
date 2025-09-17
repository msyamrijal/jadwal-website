// URL Spreadsheet Anda
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTcEUYNKssh36NHW_Rk7D89EFDt-ZWFdKxQI32L_Q1exbwNhHuGHWKh_W8VFSA8E58vjhVrumodkUv9/pub?gid=0&single=true&output=csv';

// --- FUNGSI PENGAMBILAN DATA --- //

async function fetchScheduleData() {
  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error("Gagal mengambil atau mem-parsing data spreadsheet:", error);
    throw error; // Lemparkan kembali error agar bisa ditangani oleh pemanggil
  }
}

function parseCSV(text) {
  const rows = text.split(/\r?\n/).map(row => row.split(','));
  if (rows.length < 1) return [];

  const header = rows[0].map(h => h.trim());
  const data = rows.slice(1).map(row => {
    let obj = {};
    row.forEach((val, index) => {
      if (header[index]) {
        obj[header[index]] = val.trim();
      }
    });
    return obj;
  });

  return data;
}

function parseDateFromString(dateStr) {
    if (!dateStr) return null;
    // Format: M/D/YYYY H:mm:ss
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return null;

    const [month, day, year] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    if (!year || !month || !day || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;

    // The month in JavaScript's Date is 0-indexed (0-11)
    return new Date(year, month - 1, day, hours, minutes, seconds);
}


// --- FUNGSI DATABASE (INDEXEDDB) --- //

const DB_NAME = 'jadwalDB';
const SCHEDULE_STORE = 'schedules';
const REKAP_STORE = 'rekap';

function openDB() {
  return idb.openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
        db.createObjectStore(SCHEDULE_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(REKAP_STORE)) {
        // Menggunakan 'name' sebagai keyPath untuk rekap, karena unik
        db.createObjectStore(REKAP_STORE, { keyPath: 'name' });
      }
    },
  });
}

async function saveSchedules(data) {
  const db = await openDB();
  const tx = db.transaction(SCHEDULE_STORE, 'readwrite');
  await tx.store.clear(); // Hapus data lama
  for (const item of data) {
    await tx.store.put(item);
  }
  await tx.done;
  console.log("Jadwal baru berhasil disimpan ke IndexedDB.");
}

async function getSchedules() {
  const db = await openDB();
  return await db.getAll(SCHEDULE_STORE);
}

async function saveRekap(summaryData) {
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

async function getRekap() {
    const db = await openDB();
    const allRekap = await db.getAll(REKAP_STORE);
    // Ubah kembali dari array of objects ke format summary object
    const summary = {};
    allRekap.forEach(item => {
        summary[item.name] = item.schedules;
    });
    return summary;
}
