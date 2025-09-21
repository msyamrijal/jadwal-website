import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchScheduleData } from './db.js';
import { isAdmin } from './auth-admin.js';

document.addEventListener('DOMContentLoaded', () => {
    const adminTitle = document.getElementById('admin-title');
    const tableWrapper = document.getElementById('table-wrapper');

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
            const schedules = await fetchScheduleData();
            renderAdminTable(schedules);
        } catch (error) {
            tableWrapper.innerHTML = `<p style="color: red;">Gagal memuat data: ${error.message}</p>`;
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
        const headers = ['ID', 'Tanggal', 'Mata_Pelajaran', 'Institusi', 'Materi Diskusi', ...Array.from({ length: 12 }, (_, i) => `Peserta ${i + 1}`)];
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Buat Body Tabel
        const tbody = document.createElement('tbody');
        schedules.forEach(schedule => {
            const row = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                if (header === 'ID') {
                    td.textContent = schedule.id;
                } else if (header === 'Tanggal') {
                    td.textContent = schedule.dateObject.toLocaleString('id-ID');
                } else {
                    td.textContent = schedule[header] || ''; // Tampilkan string kosong jika data tidak ada
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        tableWrapper.innerHTML = ''; // Kosongkan wrapper
        tableWrapper.appendChild(table);
    }
});