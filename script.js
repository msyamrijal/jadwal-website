 let allData = []; // Variabel untuk menyimpan semua data asli dari spreadsheet
 let allParticipantNames = []; // Variabel untuk menyimpan semua nama peserta unik

 async function loadData() {
  const loadingIndicator = document.getElementById('loading-indicator');
  loadingIndicator.style.display = 'block'; // Tampilkan indikator loading
 
  try {
    // Pola Cache-then-Network dengan async/await
    // 1. Coba muat dari cache terlebih dahulu
    const cachedData = await getSchedules();
    if (cachedData && cachedData.length > 0) {
      console.log("Menampilkan data jadwal dari cache.");
      processScheduleData(cachedData);
    }
 
    // 2. Selalu coba ambil data terbaru dari jaringan
    const freshData = await fetchScheduleData();
    console.log("Data jadwal baru dari jaringan diterima.");
    processScheduleData(freshData); // Perbarui UI dengan data baru
    await saveSchedules(freshData); // Simpan data baru ke IndexedDB
 
  } catch (error) {
    console.error("Gagal memuat data:", error);
    // Hanya tampilkan error jika tidak ada data sama sekali (bahkan dari cache)
    if (allData.length === 0) {
      document.querySelector("#jadwal-table tbody").innerHTML = `<tr><td colspan="3" style="text-align:center; color: red;">Gagal memuat data. Periksa koneksi atau URL spreadsheet.</td></tr>`;
    }
  } finally {
    // Blok ini DIJAMIN akan selalu berjalan, baik sukses maupun gagal.
    loadingIndicator.style.display = 'none'; // Sembunyikan indikator loading
  }
 }

/**
 * Memproses data jadwal (baik dari cache maupun jaringan) dan memperbarui UI.
 * @param {Array<Object>} parsedData 
 */
function processScheduleData(parsedData) {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  allData = parsedData
    .map(row => ({ ...row, dateObject: parseDateFromString(row.Tanggal) }))
    .filter(row => row.dateObject && row.dateObject >= today)
    .sort((a, b) => a.dateObject - b.dateObject);

  const participantSet = new Set();
  allData.forEach(row => {
    Object.keys(row).filter(key => key.startsWith('Peserta_') && row[key])
      .forEach(key => participantSet.add(row[key].trim()));
  });
  allParticipantNames = [...participantSet].sort();

  populateTable(allData);
  populateInstitutionFilter(allData);
  populateSubjectFilter(allData);
  setupFilters();

  const savedParticipant = localStorage.getItem('lastParticipantFilter');
  if (savedParticipant) {
    document.getElementById('filter-peserta').value = savedParticipant;
    applyFilters();
  }
}

 function populateTable(data) {
  const tableBody = document.querySelector("#jadwal-table tbody");
  tableBody.innerHTML = ''; // Kosongkan tabel sebelum mengisi data baru
 
  if (data.length === 0) {
    // Cek apakah ada filter yang aktif.
    const institusiFilter = document.getElementById('filter-institusi').value;
    const mapelFilter = document.getElementById('filter-mapel').value;
    const pesertaFilter = document.getElementById('filter-peserta').value;
    if (institusiFilter || mapelFilter || pesertaFilter) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Tidak ada jadwal yang cocok dengan filter yang dipilih.</td></tr>`;
    } else {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Tidak ada jadwal mendatang yang ditemukan. Semua jadwal mungkin sudah lewat.</td></tr>`;
    }
    return;
  }
 
  data.forEach(row => {
    // 1. Buat baris ringkasan yang terlihat
    const summaryRow = document.createElement("tr");
    summaryRow.className = 'summary-row';
    summaryRow.setAttribute('role', 'button'); // Baik untuk aksesibilitas
    summaryRow.setAttribute('tabindex', '0'); // Agar bisa di-fokus dengan keyboard

    const tanggal = document.createElement("td");
    tanggal.setAttribute('data-label', 'Tanggal');
    const datePart = row.dateObject.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = row.dateObject.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    tanggal.textContent = `${datePart}, ${timePart}`;
    summaryRow.appendChild(tanggal);

    const mataPelajaran = document.createElement("td");
    mataPelajaran.setAttribute('data-label', 'Mata Pelajaran');
    mataPelajaran.textContent = row['Mata_Pelajaran'];
    summaryRow.appendChild(mataPelajaran);

    const pesertaList = Object.keys(row).filter(key => key.startsWith('Peserta_') && row[key]).map(key => row[key]);
    const pesertaTd = document.createElement("td");
    pesertaTd.setAttribute('data-label', 'Peserta');
    pesertaTd.textContent = pesertaList.join(', ');
    summaryRow.appendChild(pesertaTd);

    // 2. Buat baris detail yang tersembunyi
    const detailRow = document.createElement("tr");
    detailRow.className = 'detail-row';

    const detailCell = document.createElement("td");
    detailCell.colSpan = 3; // Agar mengisi seluruh lebar tabel
    detailCell.innerHTML = `
      <div class="detail-content">
        <p><strong>Institusi:</strong> ${row.Institusi || 'Tidak ada data'}</p>
        <p><strong>Materi Diskusi:</strong> ${row.Materi_Diskusi || 'Tidak ada data'}</p>
      </div>
    `;
    detailRow.appendChild(detailCell);

    // 3. Tambahkan event listener untuk membuka/menutup detail
    const toggleDetails = () => {
      summaryRow.classList.toggle('expanded');
      detailRow.classList.toggle('visible');
    };
    summaryRow.addEventListener('click', toggleDetails);
    summaryRow.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggleDetails(); });

    tableBody.appendChild(summaryRow);
    tableBody.appendChild(detailRow);
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
    // Cek apakah teks filter adalah nama lengkap yang ada di daftar peserta.
    const isCompleteName = allParticipantNames.some(name => name.toLowerCase() === pesertaFilter);

    if (isCompleteName) {
      // Jika nama lengkap, lakukan pencocokan persis (exact match).
      for (let i = 1; i <= 12; i++) {
        const pesertaKey = `Peserta_${i}`;
        if (row[pesertaKey] && row[pesertaKey].toLowerCase() === pesertaFilter) {
          pesertaMatch = true;
          break;
        }
      }
    } else {
      // Jika bukan nama lengkap (sedang mengetik), lakukan pencocokan parsial (substring match).
      for (let i = 1; i <= 12; i++) {
        const pesertaKey = `Peserta_${i}`;
        if (row[pesertaKey] && row[pesertaKey].toLowerCase().includes(pesertaFilter)) {
          pesertaMatch = true;
          break;
        }
      }
    }
  }

  return institusiMatch && mapelMatch && pesertaMatch;
  });

  populateTable(filteredData);
 }

function setupFilters() {
  const institutionFilter = document.getElementById('filter-institusi');
  const subjectFilter = document.getElementById('filter-mapel');
  const participantFilter = document.getElementById('filter-peserta');

  institutionFilter.addEventListener('change', () => {
    const selectedInstitution = institutionFilter.value;

    // Tentukan data yang relevan berdasarkan institusi yang dipilih
    const relevantData = selectedInstitution
      ? allData.filter(row => row.Institusi === selectedInstitution)
      : allData; // Jika tidak ada institusi dipilih, gunakan semua data

    // Perbarui opsi filter mata pelajaran dengan data yang relevan
    populateSubjectFilter(relevantData);

    // Terapkan kembali semua filter untuk memperbarui tabel
    applyFilters();
  });

  subjectFilter.addEventListener('change', applyFilters);
  
  const searchResultsContainer = document.getElementById('jadwal-search-results');

  participantFilter.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    searchResultsContainer.innerHTML = '';

    if (searchTerm.length > 0) {
      const matchingNames = allParticipantNames.filter(name => name.toLowerCase().includes(searchTerm));
      
      matchingNames.slice(0, 10).forEach(name => { // Batasi hingga 10 hasil
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = name;
        item.addEventListener('click', () => {
          participantFilter.value = name;
          searchResultsContainer.innerHTML = '';
          localStorage.setItem('lastParticipantFilter', name);
          applyFilters();
        });
        searchResultsContainer.appendChild(item);
      });
    }

    // Tetap terapkan filter saat mengetik
    localStorage.setItem('lastParticipantFilter', participantFilter.value);
    applyFilters();
  });

  // Sembunyikan hasil pencarian jika klik di luar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.participant-search-wrapper')) {
      searchResultsContainer.innerHTML = '';
    }
  });
 }

 document.addEventListener("DOMContentLoaded", () => {
  // Panggil fungsi dari app.js untuk setup PWA dan Service Worker
  if (typeof setupPWA === 'function') setupPWA();
  if (typeof registerServiceWorker === 'function') registerServiceWorker();

  loadData();
 });
