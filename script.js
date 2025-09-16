 let deferredPrompt; // Variabel untuk menyimpan event install
 let allData = []; // Variabel untuk menyimpan semua data asli dari spreadsheet

 window.addEventListener('beforeinstallprompt', (e) => {
  // Mencegah browser menampilkan prompt default
  e.preventDefault();
  // Simpan event agar bisa dipanggil nanti
  deferredPrompt = e;
  // Tampilkan tombol install kustom kita
  const installButton = document.getElementById('install-button');
  if (installButton) installButton.hidden = false;
 });

 function loadData() {
  const loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.style.display = 'block'; // Tampilkan indikator loading

  const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcEUYNKssh36NHW_Rk7D89EFDt-ZWFdKxQI32L_Q1exbwNhHuGHWKh_W8VFSA8E58vjhVrumodkUv9/pub?gid=0&single=true&output=csv";

  fetch(spreadsheetUrl)
  .then(response => {
  if (!response.ok) {
  throw new Error('Gagal mengambil data dari jaringan');
  }
  return response.text();
  })
  .then(csvData => {
  const parsedData = parseCSV(csvData);

  // Fungsi bantuan untuk mengubah string tanggal menjadi objek Date
  const parseDateFromString = (dateString) => {
    if (!dateString || dateString.trim() === '') return null;

    // Format seperti "9/15/2025 8:00:00" dapat langsung diproses oleh constructor Date.
    const date = new Date(dateString);

    // Periksa apakah tanggal yang dihasilkan valid.
    if (!isNaN(date.getTime())) {
      return date;
    }
    console.warn(`Format tanggal tidak valid atau tidak dapat diproses: "${dateString}".`);
    return null;
  }

  // 1. Filter data untuk tanggal mendatang & tambahkan objek Date untuk pengurutan
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke tengah malam untuk perbandingan tanggal yang akurat

  allData = parsedData
  .map(row => ({ ...row, dateObject: parseDateFromString(row.Tanggal) }))
  .filter(row => row.dateObject && row.dateObject >= today)
  .sort((a, b) => a.dateObject - b.dateObject); // 2. Urutkan dari tanggal terdekat

  populateTable(allData); // Tampilkan data yang sudah difilter dan diurutkan
  populateInstitutionFilter(allData); // Buat opsi dropdown institusi
  populateSubjectFilter(allData); // Buat opsi dropdown mata pelajaran
  setupFilters(); // Siapkan event listener untuk input filter
  })
  .catch(error => {
  console.error("Error fetching data:", error);
  document.querySelector("#jadwal-table tbody").innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Gagal memuat data. Periksa koneksi atau URL spreadsheet.</td></tr>`;
  })
  .finally(() => {
  loadingIndicator.style.display = 'none'; // Sembunyikan indikator loading
  });
 }

 function parseCSV(csvData) {
  const lines = csvData.split("\n");
  const headers = lines[0].split(",").map(header => header.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(",").map(value => value.trim());
  if (values.length === headers.length) {
  const entry = {};
  for (let j = 0; j < headers.length; j++) {
  entry[headers[j]] = values[j];
  }
  data.push(entry);
  }
  }

  return data;
 }

 function populateTable(data) {
  const tableBody = document.querySelector("#jadwal-table tbody");
  tableBody.innerHTML = ''; // Kosongkan tabel sebelum mengisi data baru

  data.forEach(row => {
  const tr = document.createElement("tr");

  const institusi = document.createElement("td");
  institusi.setAttribute('data-label', 'Institusi');
  institusi.textContent = row.Institusi;
  tr.appendChild(institusi);

  const mataPelajaran = document.createElement("td");
  mataPelajaran.setAttribute('data-label', 'Mata Pelajaran');
  mataPelajaran.textContent = row['Mata_Pelajaran']; // Perubahan di sini
  tr.appendChild(mataPelajaran);

  const tanggal = document.createElement("td");
  tanggal.setAttribute('data-label', 'Tanggal');
  // Format tanggal agar lebih mudah dibaca
  tanggal.textContent = row.dateObject.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  tr.appendChild(tanggal);

  const materiDiskusi = document.createElement("td");
  materiDiskusi.setAttribute('data-label', 'Materi Diskusi');
  materiDiskusi.textContent = row['Materi Diskusi']; // Perubahan di sini
  tr.appendChild(materiDiskusi);
  
  let peserta = "";
  for(let i = 1; i <= 10; i++){
  if(row["Peserta " + i]){
  peserta += row["Peserta " + i] + ", ";
  }
  }

  const pesertaTd = document.createElement("td");
  pesertaTd.setAttribute('data-label', 'Peserta');
  pesertaTd.textContent = peserta.slice(0, -2);
  tr.appendChild(pesertaTd);

  tableBody.appendChild(tr);
  });
 }

 function populateInstitutionFilter(data) {
  const institutionFilter = document.getElementById('filter-institusi');
  institutionFilter.innerHTML = ''; // Kosongkan opsi yang ada

  // Buat opsi default "Semua"
  const defaultOption = document.createElement('option');
  defaultOption.value = "";
  defaultOption.textContent = "Semua Institusi";
  institutionFilter.appendChild(defaultOption);

  // Ambil institusi unik dan urutkan
  const institutions = [...new Set(data.map(row => row.Institusi))].sort();

  // Buat opsi untuk setiap institusi unik
  institutions.forEach(inst => {
    if (inst) { // Pastikan tidak ada nilai kosong
      const option = document.createElement('option');
      option.value = inst;
      option.textContent = inst;
      institutionFilter.appendChild(option);
    }
  });
 }

 function populateSubjectFilter(data) {
  const subjectFilter = document.getElementById('filter-mapel');
  subjectFilter.innerHTML = ''; // Kosongkan opsi yang ada

  // Buat opsi default "Semua"
  const defaultOption = document.createElement('option');
  defaultOption.value = "";
  defaultOption.textContent = "Semua Mata Pelajaran";
  subjectFilter.appendChild(defaultOption);

  // Ambil mata pelajaran unik dan urutkan
  const subjects = [...new Set(data.map(row => row['Mata_Pelajaran']))].sort();

  // Buat opsi untuk setiap mata pelajaran unik
  subjects.forEach(subj => {
    if (subj) { // Pastikan tidak ada nilai kosong
      const option = document.createElement('option');
      option.value = subj;
      option.textContent = subj;
      subjectFilter.appendChild(option);
    }
  });
 }

 function applyFilters() {
  const institusiFilter = document.getElementById('filter-institusi').value;
  const mapelFilter = document.getElementById('filter-mapel').value;
  const pesertaFilter = document.getElementById('filter-peserta').value.toLowerCase();

  const filteredData = allData.filter(row => {
  // Cek filter institusi (pencocokan persis, atau tampilkan semua jika filter kosong)
  const institusiMatch = !institusiFilter || row.Institusi === institusiFilter;

  // Cek filter mata pelajaran
  const mapelMatch = !mapelFilter || row['Mata_Pelajaran'] === mapelFilter;

  // Cek filter peserta di semua kolom peserta
  let pesertaMatch = false;
  if (!pesertaFilter) {
  pesertaMatch = true; // Jika filter peserta kosong, anggap cocok
  } else {
  for (let i = 1; i <= 10; i++) {
  const pesertaKey = `Peserta ${i}`;
  if (row[pesertaKey] && row[pesertaKey].toLowerCase().includes(pesertaFilter)) {
  pesertaMatch = true;
  break; // Jika sudah ketemu, hentikan pencarian di kolom peserta lain
  }
  }
  }

  return institusiMatch && mapelMatch && pesertaMatch;
  });

  populateTable(filteredData);
 }

 function setupFilters() {
  document.getElementById('filter-institusi').addEventListener('change', applyFilters);
  document.getElementById('filter-mapel').addEventListener('change', applyFilters);
  document.getElementById('filter-peserta').addEventListener('input', applyFilters);
 }

 document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const installButton = document.getElementById('install-button');
  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        // Tampilkan prompt instalasi
        deferredPrompt.prompt();
        // Tunggu respons pengguna
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Respons pengguna: ${outcome}`);
        // Kita hanya bisa menggunakan prompt sekali, jadi reset variabelnya
        deferredPrompt = null;
        // Sembunyikan tombol setelah digunakan
        installButton.hidden = true;
      }
    });
  }

  // Daftarkan Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker berhasil didaftarkan.'))
      .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
  }
 });

 window.addEventListener('appinstalled', () => {
  // Kosongkan deferredPrompt dan sembunyikan tombol jika aplikasi berhasil diinstal
  deferredPrompt = null;
  const installButton = document.getElementById('install-button');
  if (installButton) installButton.hidden = true;
 });
