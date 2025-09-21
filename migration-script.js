// migration-script.js
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Inisialisasi Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Path ke file kunci Anda
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const collectionRef = db.collection('schedules'); // Nama koleksi kita di Firestore
const filePath = './data_jadwal.csv'; // Path ke file CSV Anda

console.log('Memulai proses migrasi...');

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', async (row) => {
    try {
      // --- Transformasi Data ---
      // Google Sheet CSV date format: "MM/DD/YYYY HH:mm:ss"
      const dateParts = row.Tanggal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})/);
      if (!dateParts) {
        console.warn(`Format tanggal tidak valid untuk baris: ${JSON.stringify(row)}. Baris dilewati.`);
        return;
      }
      // parts[1]=MM, parts[2]=DD, parts[3]=YYYY, parts[4]=HH, parts[5]=mm, parts[6]=ss
      const jsDate = new Date(dateParts[3], dateParts[1] - 1, dateParts[2], dateParts[4], dateParts[5], dateParts[6]);

      // Buat objek yang akan disimpan ke Firestore
      const scheduleData = {
        Tanggal: admin.firestore.Timestamp.fromDate(jsDate), // Konversi ke Timestamp Firestore
        searchable_participants: [], // Field baru untuk pencarian fleksibel
        Mata_Pelajaran: row.Mata_Pelajaran || '',
        Institusi: row.Institusi || '',
        'Materi Diskusi': row['Materi Diskusi'] || '',
        // Tambahkan semua kolom peserta
        'Peserta 1': row['Peserta 1'] || '',
        'Peserta 2': row['Peserta 2'] || '',
        'Peserta 3': row['Peserta 3'] || '',
        'Peserta 4': row['Peserta 4'] || '',
        'Peserta 5': row['Peserta 5'] || '',
        'Peserta 6': row['Peserta 6'] || '',
        'Peserta 7': row['Peserta 7'] || '',
        'Peserta 8': row['Peserta 8'] || '',
        'Peserta 9': row['Peserta 9'] || '',
        'Peserta 10': row['Peserta 10'] || '',
        'Peserta 11': row['Peserta 11'] || '',
        'Peserta 12': row['Peserta 12'] || '',
      };

      // Isi field `searchable_participants` dengan nama yang sudah dinormalisasi
      for (let i = 1; i <= 12; i++) {
        const participantName = row[`Peserta ${i}`];
        if (participantName && participantName.trim() !== '') {
          // Normalisasi: ubah ke huruf kecil dan hapus spasi berlebih
          scheduleData.searchable_participants.push(participantName.trim().toLowerCase());
        }
      }

      // Tambahkan dokumen baru ke koleksi 'schedules'
      await collectionRef.add(scheduleData);
      console.log(`Data untuk mapel "${row.Mata_Pelajaran}" berhasil ditambahkan.`);

    } catch (error) {
      console.error('Gagal memproses baris:', row, 'Error:', error);
    }
  })
  .on('end', () => {
    console.log('------------------------------------');
    console.log('🎉 Migrasi CSV ke Firestore selesai.');
    console.log('------------------------------------');
  });
