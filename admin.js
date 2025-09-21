import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { db } from './firebase-config.js';
import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { fetchScheduleData, updateSchedule, deleteSchedule } from './db.js';
import { isAdmin } from './auth-admin.js';

document.addEventListener('DOMContentLoaded', () => {
    const adminTitle = document.getElementById('admin-title');
    const tableWrapper = document.getElementById('table-wrapper');

    let allSchedules = []; // Store all schedules for filtering
    let dateSortDirection = 'desc'; // Default sort: newest first

    // Definisikan header di scope yang lebih tinggi agar bisa diakses oleh beberapa fungsi
    const headers = ['Actions', 'ID', 'Tanggal', 'Mata_Pelajaran', 'Institusi', 'Materi Diskusi', ...Array.from({ length: 12 }, (_, i) => `Peserta ${i + 1}`)];

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
            renderAdminTableShell(); // Render kerangka tabel sekali
            updateTableView(); // Terapkan filter dan sort awal
            setupBulkReplace();
        } catch (error) {
            tableWrapper.innerHTML = `<p style="color: red;">Gagal memuat data: ${error.message}</p>`;
        }
    }

    /**
     * Membuat kerangka tabel (header dan body kosong) sekali saja.
     */
    function renderAdminTableShell() {
        const table = document.createElement('table');
        table.id = 'admin-table';

        // Buat Header Tabel
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.dataset.key = headerText;

            const titleSpan = document.createElement('span');
            titleSpan.textContent = headerText;
            th.appendChild(titleSpan);

            // Tambahkan input filter untuk kolom yang relevan
            // Kolom 'Actions' dan 'ID' tidak perlu filter
            if (headerText === 'Tanggal') {
                const sortButton = document.createElement('button');
                sortButton.id = 'sort-date-btn';
                sortButton.className = 'sort-btn';
                sortButton.innerHTML = 'Urutkan <span>▼</span>'; // Panah ke bawah untuk descending
                sortButton.addEventListener('click', toggleDateSort);
                th.appendChild(sortButton);
            } else if (!['Actions', 'ID'].includes(headerText)) {
                const filterInput = document.createElement('input');
                filterInput.type = 'text';
                filterInput.placeholder = `Filter...`;
                filterInput.dataset.filterKey = headerText; // Tandai input ini sebagai filter
                th.appendChild(filterInput);
            }
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Buat Body Tabel
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        tableWrapper.innerHTML = ''; // Kosongkan wrapper
        tableWrapper.appendChild(table);

        // Tambahkan event listener untuk filter di header
        thead.addEventListener('input', updateTableView);

        // Tambahkan event listener untuk klik pada body tabel (delegasi)
        if (tbody) { // Gunakan variabel tbody yang sudah dideklarasikan di atas
            tbody.addEventListener('click', handleTableClick);
        }
    }

    /**
     * Mengisi atau memperbarui baris-baris di dalam body tabel.
     * @param {Array} schedules Data jadwal yang akan ditampilkan.
     */
    function renderTableBody(schedules) {
        const tbody = document.querySelector('#admin-table tbody');
        if (!tbody) return;

        tbody.innerHTML = ''; // Kosongkan body tabel sebelum mengisi ulang

        schedules.forEach(schedule => {
            const row = document.createElement('tr');
            row.dataset.scheduleId = schedule.id;
            // `headers` sekarang bisa diakses di sini

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
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            const key = cell.dataset.key;
            if (key === 'ID' || key === 'Actions') return;

            if (isEditing) {
                const currentValue = cell.textContent;
                cell.dataset.originalValue = currentValue; // Simpan nilai asli
                let input;
                if (key === 'Tanggal') {
                    // Konversi tanggal dari format 'dd MMM yyyy, HH.mm' ke format 'yyyy-MM-ddTHH:mm' untuk input
                    // FIX: Ambil tanggal asli dari data yang tersimpan, bukan tanggal saat ini.
                    const scheduleId = row.dataset.scheduleId;
                    const schedule = allSchedules.find(s => s.id === scheduleId);
                    const date = schedule ? schedule.dateObject : new Date();
                    // Konversi ke format yang diterima oleh input datetime-local
                    const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    input = `<input type="datetime-local" value="${isoString}">`;

                    // Buat elemen untuk opsi cascade update
                    const cascadeOptionDiv = document.createElement('div');
                    cascadeOptionDiv.className = 'cascade-update-option';
                    cascadeOptionDiv.innerHTML = `
                        <label>
                            <input type="checkbox" id="cascade-update-checkbox"> Update tanggal jadwal berikutnya secara berurutan?
                        </label>
                    `;
                    cell.innerHTML = input; // Masukkan input dulu
                    cell.appendChild(cascadeOptionDiv); // Baru tambahkan opsi di bawahnya
                } else {
                    input = `<input type="text" value="${currentValue}">`;
                    cell.innerHTML = input;
                }
            } else {
                // Mode batal: kembalikan nilai asli
                cell.innerHTML = cell.dataset.originalValue;
            }

            // Tampilkan opsi cascade hanya saat input tanggal di-fokus
            const dateInput = row.querySelector('input[type="datetime-local"]');
            if (dateInput) {
                dateInput.addEventListener('focus', () => row.querySelector('.cascade-update-option').style.display = 'block');
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

        const cascadeCheckbox = row.querySelector('#cascade-update-checkbox');

        // --- LOGIKA CASCADE UPDATE ---
        if (cascadeCheckbox && cascadeCheckbox.checked) {
            const originalSchedule = allSchedules.find(s => s.id === scheduleId);
            if (!originalSchedule) {
                alert('Error: Jadwal asli tidak ditemukan untuk melakukan update berurutan.');
                return;
            }

            const originalDate = originalSchedule.dateObject;
            const newDate = updatedData.Tanggal;

            // Hitung selisih hari (mengabaikan jam/menit untuk menghindari masalah timezone)
            const startOriginal = new Date(Date.UTC(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate()));
            const startNew = new Date(Date.UTC(newDate.getFullYear(), newDate.getMonth(), newDate.getDate()));
            const dayDiff = (startNew.getTime() - startOriginal.getTime()) / (1000 * 3600 * 24);

            if (dayDiff !== 0) {
                const schedulesToCascade = allSchedules.filter(s =>
                    s.id !== scheduleId &&
                    s.Institusi === originalSchedule.Institusi &&
                    s.Mata_Pelajaran === originalSchedule.Mata_Pelajaran &&
                    s.dateObject > originalSchedule.dateObject
                );

                if (schedulesToCascade.length > 0) {
                    if (!confirm(`Anda akan mengubah tanggal untuk ${schedulesToCascade.length + 1} jadwal (${originalSchedule.Mata_Pelajaran} - ${originalSchedule.Institusi}) secara berurutan. Lanjutkan?`)) {
                        row.querySelector('.btn-save').disabled = false;
                        row.querySelector('.btn-save').textContent = 'Save';
                        return; // Batalkan jika pengguna menekan "Cancel"
                    }
                }

                try {
                    const batch = writeBatch(db);
                    // 1. Update dokumen utama
                    batch.update(doc(db, 'schedules', scheduleId), updatedData);
                    // 2. Update dokumen berikutnya
                    schedulesToCascade.forEach(schedule => {
                        const newSubsequentDate = new Date(schedule.dateObject.getTime());
                        newSubsequentDate.setDate(newSubsequentDate.getDate() + dayDiff);
                        batch.update(doc(db, 'schedules', schedule.id), { Tanggal: newSubsequentDate });
                    });

                    await batch.commit();
                    alert('Jadwal berhasil diperbarui secara berurutan! Halaman akan dimuat ulang.');
                    window.location.reload();
                    return; // Hentikan eksekusi setelah berhasil

                } catch (error) {
                    alert(`Gagal memperbarui jadwal secara berurutan: ${error.message}`);
                    row.querySelector('.btn-save').disabled = false;
                    row.querySelector('.btn-save').textContent = 'Save';
                    return;
                }
            }
        }

        // --- LOGIKA UPDATE TUNGGAL (JIKA CASCADE TIDAK DIPILIH) ---
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

    function toggleDateSort() {
        const sortButton = document.getElementById('sort-date-btn');
        const arrow = sortButton.querySelector('span');
        if (dateSortDirection === 'desc') {
            dateSortDirection = 'asc';
            arrow.innerHTML = ' ▲'; // Panah ke atas
        } else if (dateSortDirection === 'asc') {
            dateSortDirection = 'none';
            arrow.innerHTML = ' ↕'; // Panah dua arah
        } else {
            dateSortDirection = 'desc';
            arrow.innerHTML = ' ▼'; // Panah ke bawah
        }
        updateTableView();
    }

    function updateTableView() {
        const filterInputs = document.querySelectorAll('#admin-table thead input[data-filter-key]');
        const filters = {};
        filterInputs.forEach(input => {
            if (input.value) {
                filters[input.dataset.filterKey] = input.value.toLowerCase();
            }
        });

        // 1. Filter data
        let filteredData = allSchedules.filter(row => {
            for (const key in filters) {
                const filterValue = filters[key];
                const rowValue = (row[key] || '').toString().toLowerCase();
                if (!rowValue.includes(filterValue)) {
                    return false;
                }
            }
            return true;
        });

        // 2. Sort data
        if (dateSortDirection === 'asc') {
            filteredData.sort((a, b) => a.dateObject - b.dateObject);
        } else if (dateSortDirection === 'desc') {
            filteredData.sort((a, b) => b.dateObject - a.dateObject);
        }

        // 3. Render ulang body tabel
        renderTableBody(filteredData);
    }

    // --- BULK REPLACE FUNCTIONS ---

    function setupBulkReplace() {
        const select = document.getElementById('replace-column-select');
        const btn = document.getElementById('replace-all-btn');

        // Isi dropdown dengan nama kolom yang relevan
        const relevantHeaders = ['Mata_Pelajaran', 'Institusi', ...Array.from({ length: 12 }, (_, i) => `Peserta ${i + 1}`)];
        select.innerHTML = relevantHeaders.map(h => `<option value="${h}">${h.replace('_', ' ')}</option>`).join('');

        btn.addEventListener('click', handleBulkReplace);
    }

    async function handleBulkReplace() {
        const column = document.getElementById('replace-column-select').value;
        const findText = document.getElementById('find-text').value;
        const replaceText = document.getElementById('replace-text').value;

        if (!column || findText === '') {
            alert('Kolom, dan teks yang dicari tidak boleh kosong.');
            return;
        }

        const schedulesToUpdate = allSchedules.filter(s => s[column] === findText);

        if (schedulesToUpdate.length === 0) {
            alert('Tidak ada data yang cocok dengan teks yang dicari.');
            return;
        }

        if (!confirm(`Anda akan mengubah "${findText}" menjadi "${replaceText}" di kolom "${column}" pada ${schedulesToUpdate.length} jadwal. Lanjutkan?`)) {
            return;
        }

        const button = document.getElementById('replace-all-btn');
        button.disabled = true;
        button.textContent = 'Memproses...';

        try {
            // Firestore batch writes dibatasi 500 operasi per batch
            const batchPromises = [];
            for (let i = 0; i < schedulesToUpdate.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = schedulesToUpdate.slice(i, i + 500);
                chunk.forEach(schedule => {
                    const docRef = doc(db, 'schedules', schedule.id);
                    const updatePayload = { [column]: replaceText };
                    batch.update(docRef, updatePayload);
                });
                batchPromises.push(batch.commit());
            }

            await Promise.all(batchPromises);

            alert(`${schedulesToUpdate.length} data berhasil diperbarui! Halaman akan dimuat ulang.`);
            window.location.reload();

        } catch (error) {
            alert(`Gagal melakukan pembaruan massal: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = 'Ganti Semua';
        }
    }
});