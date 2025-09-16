 let allData = []; // Variabel untuk menyimpan semua data asli dari spreadsheet

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
  institusi.textContent = row.Institusi;
  tr.appendChild(institusi);

  const mataPelajaran = document.createElement("td");
  mataPelajaran.textContent = row['Mata_Pelajaran']; // Perubahan di sini
  tr.appendChild(mataPelajaran);

  const tanggal = document.createElement("td");
  tanggal.textContent = row.Tanggal;
  tr.appendChild(tanggal);

  const materiDiskusi = document.createElement("td");
  materiDiskusi.textContent = row['Materi Diskusi']; // Perubahan di sini
  tr.appendChild(materiDiskusi);
  
  let peserta = "";
  for(let i = 1; i <= 10; i++){
  if(row["Peserta " + i]){
  peserta += row["Peserta " + i] + ", ";
  }
  }

  const pesertaTd = document.createElement("td");
  pesertaTd.textContent = peserta.slice(0, -2);
  tr.appendChild(pesertaTd);

  tableBody.appendChild(tr);
  });
 }

 function applyFilters() {
  const institusiFilter = document.getElementById('filter-institusi').value.toLowerCase();
  const mapelFilter = document.getElementById('filter-mapel').value.toLowerCase();
  const pesertaFilter = document.getElementById('filter-peserta').value.toLowerCase();

  const filteredData = allData.filter(row => {
  // Cek filter institusi
  const institusiMatch = row.Institusi.toLowerCase().includes(institusiFilter);

  // Cek filter mata pelajaran
  const mapelMatch = row['Mata_Pelajaran'].toLowerCase().includes(mapelFilter); // Perubahan di sini

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
  document.getElementById('filter-institusi').addEventListener('input', applyFilters);
  document.getElementById('filter-mapel').addEventListener('input', applyFilters);
  document.getElementById('filter-peserta').addEventListener('input', applyFilters);
 }

 document.addEventListener("DOMContentLoaded", loadData);
