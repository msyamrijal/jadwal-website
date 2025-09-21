import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchSchedulesByParticipant, updateSchedule, createSchedule } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const userNameEl = document.getElementById('user-name');
    const schedulesListEl = document.getElementById('my-schedules-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const logoutButton = document.getElementById('logout-button');

    // Elemen untuk form update profil
    const updateProfileContainer = document.getElementById('update-profile-container');
    const updateProfileForm = document.getElementById('update-profile-form');

    // Elemen untuk form create jadwal
    const addScheduleButton = document.getElementById('add-schedule-button');
    const createScheduleContainer = document.getElementById('create-schedule-container');
    const createScheduleForm = document.getElementById('create-schedule-form');
    const cancelCreateButton = document.getElementById('cancel-create-button');

    // --- FUNGSI UTAMA ---

    // 1. Gunakan onAuthStateChanged sebagai satu-satunya sumber kebenaran untuk status login
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let currentUser = user;

            // SOLUSI: Jika displayName tidak ada setelah login/redirect, coba muat ulang data profil.
            // Ini mengatasi race condition setelah pendaftaran.
            if (!currentUser.displayName) {
                console.log('DisplayName kosong, mencoba memuat ulang profil pengguna...');
                try {
                    await currentUser.reload();
                    currentUser = auth.currentUser; // Ambil objek pengguna yang sudah diperbarui
                    console.log('Profil berhasil dimuat ulang. Nama baru:', currentUser.displayName);
                } catch (reloadError) {
                    console.error('Gagal memuat ulang profil pengguna:', reloadError);
                }
            }

            if (currentUser.displayName) {
                // KASUS NORMAL: Pengguna punya nama, tampilkan jadwal.
                updateProfileContainer.style.display = 'none';
                addScheduleButton.style.display = 'block'; // Tampilkan tombol tambah jadwal
                userNameEl.textContent = currentUser.displayName;
                fetchUserSchedules(currentUser.displayName);
            } else {
                // KASUS PERBAIKAN: Pengguna tidak punya nama, tampilkan form update.
                userNameEl.textContent = 'Peserta';
                updateProfileContainer.style.display = 'block';
            }
            generateParticipantInputs(); // Buat input peserta untuk form create
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

    // 5. Tangani submit form untuk memperbarui profil
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('new-displayName').value.trim();
            const button = updateProfileForm.querySelector('button');
            const errorMessageEl = document.getElementById('update-profile-error');

            if (!newName) {
                errorMessageEl.textContent = 'Nama tidak boleh kosong.';
                return;
            }

            button.disabled = true;
            button.textContent = 'Menyimpan...';
            errorMessageEl.textContent = '';

            try {
                await updateProfile(auth.currentUser, { displayName: newName });
                // Setelah berhasil, muat ulang seluruh halaman untuk mendapatkan state terbaru.
                // Ini adalah cara paling sederhana dan andal.
                window.location.reload();
            } catch (error) {
                console.error('Gagal memperbarui profil:', error);
                errorMessageEl.textContent = 'Gagal menyimpan nama. Silakan coba lagi.';
                button.disabled = false;
                button.textContent = 'Simpan Nama & Tampilkan Jadwal';
            }
        });
    }
    
    // 6. Logika untuk menampilkan/menyembunyikan form tambah jadwal
    addScheduleButton.addEventListener('click', () => {
        createScheduleContainer.style.display = 'block';
        addScheduleButton.style.display = 'none';
        schedulesListEl.style.display = 'none'; // Sembunyikan daftar jadwal saat form aktif
    });

    cancelCreateButton.addEventListener('click', () => {
        createScheduleContainer.style.display = 'none';
        addScheduleButton.style.display = 'block';
        schedulesListEl.style.display = 'block';
        createScheduleForm.reset(); // Bersihkan form
    });

    // 7. Fungsi untuk membuat input peserta secara dinamis
    function generateParticipantInputs() {
        const container = document.getElementById('participant-inputs');
        container.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.innerHTML = `
                <label for="new-participant-${i}" style="font-weight: normal; font-size: 0.9em;">Peserta ${i}:</label>
                <input type="text" id="new-participant-${i}" name="participant-${i}">
            `;
            container.appendChild(div);
        }
    }

    // 8. Tangani submit form untuk membuat jadwal baru
    createScheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = createScheduleForm.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = 'Menyimpan...';

        try {
            const newScheduleData = {
                'Mata_Pelajaran': document.getElementById('new-subject').value,
                'Institusi': document.getElementById('new-institution').value,
                'Tanggal': new Date(document.getElementById('new-date').value),
                'Materi Diskusi': document.getElementById('new-material').value,
            };

            // Kumpulkan nama peserta
            for (let i = 1; i <= 12; i++) {
                const participantName = document.getElementById(`new-participant-${i}`).value.trim();
                newScheduleData[`Peserta ${i}`] = participantName || '';
            }

            // Panggil fungsi dari db.js untuk membuat dokumen
            await createSchedule(newScheduleData);

            alert('Jadwal baru berhasil ditambahkan!');
            // Muat ulang halaman untuk menampilkan data terbaru, termasuk jadwal baru
            window.location.reload();

        } catch (error) {
            console.error('Gagal membuat jadwal baru:', error);
            alert(`Terjadi kesalahan: ${error.message}`);
            button.disabled = false;
            button.textContent = 'Simpan Jadwal';
        }
    });

    // 9. Fungsi Logout
    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
        // onAuthStateChanged akan otomatis mendeteksi perubahan dan me-redirect
        console.log('Pengguna berhasil logout.');
    });
});