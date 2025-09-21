import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchScheduleData, updateSchedule, deleteSchedule } from './db.js';
import { isAdmin } from './auth-admin.js';

document.addEventListener('DOMContentLoaded', () => {
    const adminTitle = document.getElementById('admin-title');
    const tableWrapper = document.getElementById('table-wrapper');

    let allSchedules = []; // Store all schedules for filtering

    onAuthStateChanged(auth, (user) => {
        if (user && isAdmin(user)) {
            // Pengguna adalah admin, muat data
            adminTitle.textContent = 'Semua Data Jadwal';
            loadAdminData();
        } else {
            // Bukan admin atau tidak login, tendang keluar
            adminTitle.textContent = 'Akses Ditolak';
            adminTitle.style.color = 'red';
            tableWrapper.innerHTML = '<p>Anda tidak memiliki hak akses untuk melihat halaman ini. Anda akan diarahkan kembali ke Dashboard.</p>';
            setTimeout(() => {
                window.location.replace('/dashboard.html');
            }, 3000);
        }
    });

    async function loadAdminData() {
        try {
            allSchedules = await fetchScheduleData();
            setupFilters();
            applyFilters(); // Render initial table
        } catch (error) {
            tableWrapper.innerHTML = `<p style="color: red;">Gagal memuat data: ${error.message}</p>`;
            document.querySelector('.filter-container').style.display = 'none';
        }
    }

    function renderAdminTable(schedules) {
        if (schedules.length === 0) {
            tableWrapper.innerHTML = '<p>Tidak ada data jadwal untuk ditampilkan.</p>';
            return;
        }

        const table = document.createElement('table');
        table.id = 'admin-table';

        // Buat Header Tabel
        const headers = ['Actions', 'ID', 'Tanggal', 'Mata_Pelajaran', 'Institusi', 'Materi Diskusi', ...Array.from({ length: 12 }, (_, i) => `Peserta ${i + 1}`)];
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.dataset.key = headerText; // Simpan key untuk referensi
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Buat Body Tabel
        const tbody = document.createElement('tbody');
        schedules.forEach(schedule => {
            const row = document.createElement('tr');
            row.dataset.scheduleId = schedule.id;

            headers.forEach(header => {
                const td = document.createElement('td');
                td.dataset.key = header;

                switch (header) {
                    case 'Actions':
                        td.classList.add('action-cell');
                        td.innerHTML = `
                            <button class="btn-edit">Edit</button>
                            <button class="btn-save" style="display:none;">Save</button>
                            <button class="btn-cancel" style="display:none;">Cancel</button>
                            <button class="btn-delete">Delete</button>
                        `;
                        break;
                    case 'ID':
                        td.textContent = schedule.id;
                        break;
                    case 'Tanggal':
                        td.textContent = schedule.dateObject.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                        break;
                    default:
                        td.textContent = schedule[header] || '';
                        break;
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        tableWrapper.innerHTML = ''; // Kosongkan wrapper
        tableWrapper.appendChild(table);

        // Tambahkan event listener ke seluruh tabel untuk delegasi event
        table.addEventListener('click', handleTableClick);
    }

    async function handleTableClick(e) {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;

        const scheduleId = row.dataset.scheduleId;

        if (target.classList.contains('btn-edit')) {
            toggleEditMode(row, true);
        } else if (target.classList.contains('btn-cancel')) {
            toggleEditMode(row, false);
        } else if (target.classList.contains('btn-save')) {
            await saveRowChanges(row);
        } else if (target.classList.contains('btn-delete')) {
            if (confirm(`Apakah Anda yakin ingin menghapus jadwal dengan ID: ${scheduleId}?`)) {
                try {
                    await deleteSchedule(scheduleId);
                    row.remove(); // Hapus baris dari tampilan
                } catch (error) {
                    alert(`Gagal menghapus jadwal: ${error.message}`);
                }
            }
        }
    }

    function toggleEditMode(row, isEditing) {
        const cells = row.querySelectorAll('td[data-key]');
        cells.forEach(cell => {
            const key = cell.dataset.key;
            if (key === 'ID' || key === 'Actions') return;

            if (isEditing) {
                const currentValue = cell.textContent;
                cell.dataset.originalValue = currentValue; // Simpan nilai asli
                let input;
                if (key === 'Tanggal') {
                    // Konversi tanggal dari format 'dd MMM yyyy, HH.mm' ke format 'yyyy-MM-ddTHH:mm'
                    // FIX: Ambil tanggal asli dari data yang tersimpan, bukan tanggal saat ini.
                    const scheduleId = row.dataset.scheduleId;
                    const schedule = allSchedules.find(s => s.id === scheduleId);
                    const date = schedule ? schedule.dateObject : new Date();
                    // Konversi ke format yang diterima oleh input datetime-local
                    const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    input = `<input type="datetime-local" value="${isoString}">`;
                } else {
                    input = `<input type="text" value="${currentValue}">`;
                }
                cell.innerHTML = input;
            } else {
                // Mode batal: kembalikan nilai asli
                cell.innerHTML = cell.dataset.originalValue;
            }
        });

        // Toggle tombol
        row.querySelector('.btn-edit').style.display = isEditing ? 'none' : 'inline-block';
        row.querySelector('.btn-delete').style.display = isEditing ? 'none' : 'inline-block';
        row.querySelector('.btn-save').style.display = isEditing ? 'inline-block' : 'none';
        row.querySelector('.btn-cancel').style.display = isEditing ? 'inline-block' : 'none';
    }

    async function saveRowChanges(row) {
        const scheduleId = row.dataset.scheduleId;
        const updatedData = {};
        const inputs = row.querySelectorAll('input');
        let hasError = false;

        inputs.forEach(input => {
            const cell = input.closest('td');
            const key = cell.dataset.key;
            if (key === 'Tanggal') {
                updatedData[key] = new Date(input.value);
                if (isNaN(updatedData[key])) {
                    alert('Format tanggal tidak valid!');
                    hasError = true;
                }
            } else {
                updatedData[key] = input.value;
            }
        });

        if (hasError) return;

        try {
            await updateSchedule(scheduleId, updatedData);

            // Perbarui state lokal agar konsisten tanpa perlu reload
            const scheduleIndex = allSchedules.findIndex(s => s.id === scheduleId);
            if (scheduleIndex > -1) {
                // Gabungkan data lama dengan data yang baru diupdate
                const updatedSchedule = { ...allSchedules[scheduleIndex], ...updatedData };
                // Pastikan dateObject juga diperbarui jika tanggal berubah
                if (updatedData.Tanggal) {
                    updatedSchedule.dateObject = updatedData.Tanggal;
                }
                allSchedules[scheduleIndex] = updatedSchedule;
            }

            // Update tampilan sel dengan data baru
            Object.keys(updatedData).forEach(key => {
                const cell = row.querySelector(`td[data-key="${key}"]`);
                if (cell) {
                    cell.textContent = (key === 'Tanggal') ? updatedData[key].toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : updatedData[key];
                }
            });
            toggleEditMode(row, false); // Kembali ke mode non-edit
        } catch (error) {
            alert(`Gagal menyimpan perubahan: ${error.message}`);
        }
    }

    // --- FILTER FUNCTIONS ---

    function setupFilters() {
        const institutionFilter = document.getElementById('filter-institusi');
        const subjectFilter = document.getElementById('filter-mapel');
        const participantFilter = document.getElementById('filter-peserta');

        populateFilter(institutionFilter, 'Semua Institusi', [...new Set(allSchedules.map(s => s.Institusi))]);
        populateFilter(subjectFilter, 'Semua Mata Pelajaran', [...new Set(allSchedules.map(s => s.Mata_Pelajaran))]);

        institutionFilter.addEventListener('change', applyFilters);
        subjectFilter.addEventListener('change', applyFilters);
        participantFilter.addEventListener('input', applyFilters);
    }

    function populateFilter(selectElement, defaultOptionText, options) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        options.sort().forEach(optionValue => {
            if (optionValue) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                selectElement.appendChild(option);
            }
        });
    }

    function applyFilters() {
        const institusiFilter = document.getElementById('filter-institusi').value;
        const mapelFilter = document.getElementById('filter-mapel').value;
        const pesertaFilter = document.getElementById('filter-peserta').value.toLowerCase();

        const filteredData = allSchedules.filter(row => {
            const institusiMatch = !institusiFilter || row.Institusi === institusiFilter;
            const mapelMatch = !mapelFilter || row['Mata_Pelajaran'] === mapelFilter;
            const pesertaMatch = !pesertaFilter || (row.searchable_participants && row.searchable_participants.some(p => p.includes(pesertaFilter)));
            return institusiMatch && mapelMatch && pesertaMatch;
        });

        renderAdminTable(filteredData);
    }
});