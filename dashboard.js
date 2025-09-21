import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchSchedulesByParticipant, updateSchedule } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const userNameEl = document.getElementById('user-name');
    const schedulesListEl = document.getElementById('my-schedules-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const logoutButton = document.getElementById('logout-button');

    // --- FUNGSI UTAMA ---

    // 1. Gunakan onAuthStateChanged sebagai satu-satunya sumber kebenaran untuk status login
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Pengguna sudah login
            console.log('Pengguna terautentikasi:', user.displayName);
            userNameEl.textContent = user.displayName || 'Peserta';
            fetchUserSchedules(user.displayName);
        } else {
            // Pengguna tidak login, paksa kembali ke halaman login
            console.log('Pengguna tidak terautentikasi, mengarahkan ke login...');
            window.location.replace('/login.html');
        }
    });

    // 2. Ambil data jadwal khusus untuk pengguna yang login dari backend
    async function fetchUserSchedules(participantName) {
        if (!participantName) {
            schedulesListEl.innerHTML = '<p>Nama Anda tidak terdaftar. Silakan perbarui profil Anda.</p>';
            return;
        }

        loadingIndicator.style.display = 'block';
        schedulesListEl.innerHTML = '';

        try {
            // Panggil fungsi baru dari db.js
            const schedules = await fetchSchedulesByParticipant(participantName);

            if (schedules.length === 0) {
                schedulesListEl.innerHTML = '<p>Anda tidak memiliki jadwal mendatang.</p>';
            } else {
                renderSchedules(schedules);
            }

        } catch (error) {
            console.error("Error mengambil jadwal pengguna:", error);
            schedulesListEl.innerHTML = `<p style="color: red;">Terjadi kesalahan saat memuat jadwal Anda.</p>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // 3. Tampilkan jadwal dalam bentuk form yang bisa diedit
    function renderSchedules(schedules) {
        schedules.forEach(schedule => {
            const scheduleDate = schedule.dateObject;
            // Format tanggal untuk input datetime-local: YYYY-MM-DDTHH:mm
            const formattedDate = scheduleDate.getFullYear() + '-' +
                                  ('0' + (scheduleDate.getMonth() + 1)).slice(-2) + '-' +
                                  ('0' + scheduleDate.getDate()).slice(-2) + 'T' +
                                  ('0' + scheduleDate.getHours()).slice(-2) + ':' +
                                  ('0' + scheduleDate.getMinutes()).slice(-2);

            const item = document.createElement('div');
            item.className = 'schedule-item-edit';
            item.innerHTML = `
                <h4>${schedule.Mata_Pelajaran}</h4>
                <form class="edit-form" data-schedule-id="${schedule.id}">
                    <label for="date-${schedule.id}">Tanggal & Waktu:</label>
                    <input type="datetime-local" id="date-${schedule.id}" value="${formattedDate}">

                    <label for="material-${schedule.id}">Materi Diskusi:</label>
                    <textarea id="material-${schedule.id}" rows="3">${schedule['Materi Diskusi']}</textarea>

                    <button type="submit">Simpan Perubahan</button>
                </form>
            `;
            schedulesListEl.appendChild(item);
        });
    }

    // 4. Tangani proses update saat form di-submit
    schedulesListEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.classList.contains('edit-form')) {
            const form = e.target;
            const scheduleId = form.dataset.scheduleId;
            const button = form.querySelector('button');
            button.textContent = 'Menyimpan...';
            button.disabled = true;

            // Buat objek Date dari input datetime-local
            const newDate = new Date(form.querySelector(`#date-${scheduleId}`).value);

            const updatedData = {
                Tanggal: newDate, // Kirim sebagai objek Date
                'Materi Diskusi': form.querySelector(`#material-${scheduleId}`).value,
            };

            try {
                // Panggil fungsi update dari db.js
                await updateSchedule(scheduleId, updatedData);
                alert('Perubahan berhasil disimpan!');
            } catch (error) {
                console.error("Gagal menyimpan perubahan:", error);
                alert(`Gagal menyimpan: ${error.message}`);
            } finally {
                button.textContent = 'Simpan Perubahan';
                button.disabled = false;
            }
        }
    });
    
    // 5. Fungsi Logout
    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
        // onAuthStateChanged akan otomatis mendeteksi perubahan dan me-redirect
        console.log('Pengguna berhasil logout.');
    });
});