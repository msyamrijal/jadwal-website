let scheduleSummary = {};
let allParticipantNames = [];
let currentCalendarDate = new Date();
 
document.addEventListener("DOMContentLoaded", () => {
  // Panggil fungsi dari app.js untuk setup PWA dan Service Worker
  if (typeof setupPWA === 'function') setupPWA();
  if (typeof registerServiceWorker === 'function') registerServiceWorker();
 
  loadRekapData();
});
 
async function loadRekapData() {
  const loadingIndicator = document.getElementById('loading-indicator');
  const initialPrompt = document.getElementById('initial-prompt');
  const searchInput = document.getElementById('rekap-search');
 
  // Sembunyikan prompt dan nonaktifkan input saat memuat
  loadingIndicator.style.display = 'block';
  searchInput.disabled = true;
  initialPrompt.classList.add('hidden');
 
  try {
    // Pola Cache-then-Network dengan async/await
    // 1. Coba muat dari cache terlebih dahulu
    const cachedData = await getRekap();
    if (cachedData && Object.keys(cachedData).length > 0) {
      console.log("Menampilkan data rekap dari cache.");
      processRekapData(cachedData, true); // Tandai sebagai data dari cache
    }
 
    // 2. Selalu coba ambil data terbaru dari jaringan
    const freshData = await fetchScheduleData();
    console.log("Data rekap baru dari jaringan diterima.");
    const freshSummary = createParticipantSummary(freshData);
    processRekapData(freshSummary); // Perbarui UI dengan data baru
    await saveRekap(freshSummary); // Simpan data baru ke IndexedDB
 
  } catch (error) {
    console.error("Gagal memuat data rekap:", error);
    // Hanya tampilkan error jika tidak ada data sama sekali (bahkan dari cache)
    if (Object.keys(scheduleSummary).length === 0) {
      // Tampilkan pesan error di initial-prompt agar tidak merusak layout
      const prompt = document.getElementById('initial-prompt');
      prompt.textContent = 'Gagal memuat data rekap. Periksa koneksi internet Anda.';
      prompt.style.color = 'red';
    }
  } finally {
    // Blok ini DIJAMIN akan selalu berjalan.
    loadingIndicator.style.display = 'none';
    searchInput.disabled = false;
    const detailsVisible = !document.getElementById('participant-details-container').classList.contains('hidden');
    if (!detailsVisible) initialPrompt.classList.remove('hidden');
  }
}

/**
 * Memproses data rekap (baik dari cache maupun jaringan) dan memperbarui UI.
 * @param {Object} summaryData 
 */
function processRekapData(summaryData, fromCache = false) {
  scheduleSummary = summaryData;
  allParticipantNames = Object.keys(scheduleSummary).sort((a, b) => a.localeCompare(b));
  setupRekapSearch();

  // Sembunyikan prompt karena kita akan memproses data
  document.getElementById('initial-prompt').classList.add('hidden');

  const lastParticipant = localStorage.getItem('lastRekapParticipant');
  // Jika data baru dari jaringan, perbarui tampilan.
  // Jika data dari cache, hanya tampilkan jika belum ada yang ditampilkan.
  const detailsVisible = !document.getElementById('participant-details-container').classList.contains('hidden');
  if (lastParticipant && scheduleSummary[lastParticipant] && (!fromCache || !detailsVisible)) {
    displayParticipantDetails(lastParticipant);
  } else {
    // Jika tidak ada peserta sama sekali di summary (karena semua jadwal sudah lewat)
    if (allParticipantNames.length === 0) {
        const initialPrompt = document.getElementById('initial-prompt');
        initialPrompt.textContent = 'Tidak ada jadwal mendatang yang ditemukan untuk peserta manapun.';
    }
    document.getElementById('initial-prompt').classList.remove('hidden');
    document.getElementById('rekap-search').focus();
  }
}
 
function createParticipantSummary(data) {
  const summary = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke tengah malam untuk perbandingan tanggal yang akurat
 
  data.forEach(row => {
    const scheduleDate = parseDateFromString(row.Tanggal);
    if (!scheduleDate || scheduleDate < today) {
      return;
    }

    const participantKeys = Object.keys(row).filter(key => key.startsWith('Peserta_'));
    const allParticipantsInSession = participantKeys.map(k => row[k].trim()).filter(p => p); // Ambil semua nama peserta non-kosong di baris ini
 
    participantKeys.forEach(key => {
      const participantName = row[key];
      if (participantName && participantName.trim() !== '') {
        const name = participantName.trim();
 
        if (!summary[name]) {
          summary[name] = [];
        }

        // Dapatkan daftar peserta lain di sesi yang sama
        const otherParticipants = allParticipantsInSession.filter(p => p !== name);
 
        summary[name].push({
          subject: row['Mata_Pelajaran'], // Tetap ada untuk kalender
          date: scheduleDate,
          institusi: row.Institusi,
          materi: row.Materi_Diskusi || 'Tidak ada data', // FIX: Gunakan underscore
          otherParticipants: otherParticipants // Simpan data peserta lain
        });
      }
    });
  });
 
  // Urutkan jadwal setiap peserta berdasarkan tanggal
  for (const name in summary) {
    summary[name].sort((a, b) => a.date - b.date);
  }
 
  return summary;
}
 
function displayParticipantDetails(name) {
  const detailsContainer = document.getElementById('participant-details-container');
  const nameHeading = document.getElementById('participant-name-heading');
  const scheduleList = document.getElementById('participant-schedule-list');
  const initialPrompt = document.getElementById('initial-prompt');
 
  // Simpan nama peserta yang dipilih ke localStorage
  localStorage.setItem('lastRekapParticipant', name);

  // Sembunyikan prompt dan hasil pencarian
  initialPrompt.classList.add('hidden');
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('rekap-search').value = name;
 
  // Isi detail
  const schedules = scheduleSummary[name];
  nameHeading.textContent = name;
  document.getElementById('schedule-count').textContent = `(${schedules.length} Sisa)`;
 
  scheduleList.innerHTML = ''; // Kosongkan daftar sebelum mengisi
  schedules.forEach(schedule => {
    const listItem = document.createElement('li');
    // Tambahkan atribut data-date untuk identifikasi
    const dateStr = schedule.date.toISOString().split('T')[0]; // Format YYYY-MM-DD
    listItem.setAttribute('data-date', dateStr);

    // Bagian ringkasan yang terlihat
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'schedule-summary';
    summaryDiv.innerHTML = `
      <span class="mapel">${schedule.subject}</span>
      <span class="tanggal">${schedule.date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
    `;

    // Bagian detail yang tersembunyi
    const detailDiv = document.createElement('div');
    detailDiv.className = 'schedule-details';

    let otherParticipantsHTML = '';
    if (schedule.otherParticipants && schedule.otherParticipants.length > 0) {
      otherParticipantsHTML = `<p><strong>Peserta Lain:</strong> ${schedule.otherParticipants.join(', ')}</p>`;
    }

    detailDiv.innerHTML = `
      <p><strong>Institusi:</strong> ${schedule.institusi}</p>
      <p><strong>Materi Diskusi:</strong> ${schedule.materi}</p>
      ${otherParticipantsHTML}
    `;

    // Tambahkan event listener untuk membuka/menutup
    summaryDiv.addEventListener('click', () => {
      detailDiv.classList.toggle('visible');
      summaryDiv.classList.toggle('expanded');
    });

    listItem.appendChild(summaryDiv);
    listItem.appendChild(detailDiv);
    scheduleList.appendChild(listItem);
  });
 
  // Tampilkan kalender dan detail
  currentCalendarDate = new Date(); // Reset ke bulan ini saat memilih peserta baru
  generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), schedules);
  detailsContainer.classList.remove('hidden');
}
 
function generateCalendar(year, month, schedules) {
  const calendarContainer = document.getElementById('calendar-container');
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
 
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay(); // 0 = Minggu, 1 = Senin, ...
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
 
  // Buat MAP tanggal jadwal untuk pencarian cepat dan mendapatkan detail
  const scheduleMap = new Map();
  schedules.forEach(s => {
    const d = s.date;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!scheduleMap.has(dateStr)) {
        scheduleMap.set(dateStr, []);
    }
    scheduleMap.get(dateStr).push(s.subject);
  });
 
  let html = `
    <div class="calendar-header">
      <button class="calendar-nav" id="prev-month">&lt;</button>
      <h3>${monthNames[month]} ${year}</h3>
      <button class="calendar-nav" id="next-month">&gt;</button>
    </div>
    <table class="calendar-grid">
      <thead><tr><th>Min</th><th>Sen</th><th>Sel</th><th>Rab</th><th>Kam</th><th>Jum</th><th>Sab</th></tr></thead>
      <tbody>
  `;
 
  let date = 1;
  html += '<tr>';
 
  // Sel kosong sebelum hari pertama
  for (let i = 0; i < startingDay; i++) {
    html += '<td></td>';
  }
 
  // Isi sel dengan tanggal
  for (let i = startingDay; i < 7; i++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const daySchedules = scheduleMap.get(currentDateStr);
    let divClasses = '';
    let title = '';
    let dateAttr = `data-date="${currentDateStr}"`; // Selalu tambahkan data-date
    if (daySchedules) {
        divClasses = 'has-schedule';
        title = `title="Jadwal: ${daySchedules.join(', ')}"`;
    }
    if (isCurrentMonth && date === today.getDate()) {
        divClasses += ' today';
    }
    html += `<td ${dateAttr}><div class="${divClasses.trim()}" ${title}>${date}</div></td>`;
    date++;
  }
  html += '</tr>';
 
  // Baris-baris berikutnya
  while (date <= daysInMonth) {
    html += '<tr>';
    for (let i = 0; i < 7 && date <= daysInMonth; i++) {
      const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      const daySchedules = scheduleMap.get(currentDateStr);
      let divClasses = '';
      let title = '';
      let dateAttr = `data-date="${currentDateStr}"`; // Selalu tambahkan data-date
      if (daySchedules) {
          divClasses = 'has-schedule';
          title = `title="Jadwal: ${daySchedules.join(', ')}"`;
      }
      if (isCurrentMonth && date === today.getDate()) {
        divClasses += ' today';
      }
      html += `<td ${dateAttr}><div class="${divClasses.trim()}" ${title}>${date}</div></td>`;
      date++;
    }
    html += '</tr>';
  }
 
  html += '</tbody></table>';
  calendarContainer.innerHTML = html;
 
  // Tambahkan event listener untuk navigasi
  document.getElementById('prev-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), schedules);
  });
  document.getElementById('next-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), schedules);
  });

  // Tambahkan event listener untuk setiap tanggal yang punya jadwal
  calendarContainer.querySelectorAll('.has-schedule').forEach(dayEl => {
    dayEl.addEventListener('click', (e) => {
      // FIX: Ambil data-date dari parentElement (td)
      const dateStr = e.currentTarget.parentElement.dataset.date; 
      if (!dateStr) return;

      const targetListItem = document.querySelector(`li[data-date="${dateStr}"]`);
      if (targetListItem) {
        // Gulir ke item jadwal yang sesuai
        targetListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Buka detailnya jika belum terbuka
        const summaryDiv = targetListItem.querySelector('.schedule-summary');
        const detailDiv = targetListItem.querySelector('.schedule-details');
        if (!detailDiv.classList.contains('visible')) {
          summaryDiv.classList.add('expanded');
          detailDiv.classList.add('visible');
        }

        // Beri sorotan sementara
        targetListItem.classList.add('highlighted');
        setTimeout(() => {
          targetListItem.classList.remove('highlighted');
        }, 2500); // Sorotan selama 2.5 detik
      }
    });
  });
}
 
function setupRekapSearch() {
  const searchInput = document.getElementById('rekap-search');
  const searchResultsContainer = document.getElementById('search-results');
  const detailsContainer = document.getElementById('participant-details-container');
  const initialPrompt = document.getElementById('initial-prompt');
 
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    searchResultsContainer.innerHTML = '';
 
    // Sembunyikan detail jika pengguna mulai mencari lagi
    detailsContainer.classList.add('hidden');
    initialPrompt.classList.add('hidden');
 
    if (searchTerm.length === 0) {
      initialPrompt.classList.remove('hidden');
      localStorage.removeItem('lastRekapParticipant'); // Hapus status tersimpan
      return;
    }
 
    const matchingNames = allParticipantNames.filter(name => name.toLowerCase().includes(searchTerm));
 
    matchingNames.forEach(name => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.textContent = name;
      item.addEventListener('click', () => {
        displayParticipantDetails(name);
      });
      searchResultsContainer.appendChild(item);
    });
  });
 
  // Sembunyikan hasil pencarian jika klik di luar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.rekap-search-container') && !e.target.closest('#search-results')) {
      searchResultsContainer.innerHTML = '';
    }
  });
}