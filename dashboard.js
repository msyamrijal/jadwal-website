import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchScheduleData, updateSchedule, createSchedule } from './db.js';

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

    // Variabel global untuk menyimpan data dan filter
    let allSchedules = [];
    let allParticipantNames = [];


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
                initializeDashboard(currentUser);
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

    // 2. Inisialisasi Dashboard: Ambil semua data dan siapkan filter
    async function initializeDashboard(user) {
        userNameEl.textContent = user.displayName;
        loadingIndicator.style.display = 'block';

        try {
            allSchedules = await fetchScheduleData(); // Ambil SEMUA jadwal
            
            // Ekstrak semua nama peserta unik untuk fitur pencarian
            const participantSet = new Set();
            allSchedules.forEach(row => {
                Object.keys(row).filter(key => key.startsWith('Peserta ') && row[key])
                .forEach(key => participantSet.add(row[key].trim()));
            });
            allParticipantNames = [...participantSet].sort();

            setupFilters(); // Siapkan event listener untuk filter
            applyFilters(); // Terapkan filter (awalnya akan menampilkan semua)
        } catch (error) {
            console.error("Error menginisialisasi dashboard:", error);
            schedulesListEl.innerHTML = `<p style="color: red;">Terjadi kesalahan saat memuat jadwal Anda.</p>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // 3. Tampilkan jadwal dalam bentuk form yang bisa diedit
    function renderSchedules(schedules) {
        schedulesListEl.innerHTML = ''; // Selalu kosongkan sebelum render
        if (schedules.length === 0) {
            schedulesListEl.innerHTML = '<p>Tidak ada jadwal yang cocok dengan filter yang dipilih.</p>';
            return;
        }
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

                    <div class="form-feedback" style="display: none; margin-top: 10px; padding: 8px; border-radius: 4px; font-size: 0.9em;"></div>
                    <button type="submit">Simpan Perubahan</button>
                </form>
            `;
            schedulesListEl.appendChild(item);
        });
    }

    // 4. Tangani proses update jadwal saat form di-submit
    schedulesListEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.classList.contains('edit-form')) {
            const form = e.target;
            const scheduleId = form.dataset.scheduleId;
            const button = form.querySelector('button');
            const feedbackEl = form.querySelector('.form-feedback');
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

                // Perbarui data di state lokal (allSchedules) agar UI konsisten tanpa reload
                const scheduleIndex = allSchedules.findIndex(s => s.id === scheduleId);
                if (scheduleIndex > -1) {
                    allSchedules[scheduleIndex] = { ...allSchedules[scheduleIndex], ...updatedData, dateObject: newDate };
                }

                // Tampilkan pesan sukses
                feedbackEl.textContent = 'Perubahan berhasil disimpan!';
                feedbackEl.style.backgroundColor = '#d4edda';
                feedbackEl.style.color = '#155724';
                feedbackEl.style.display = 'block';

                // Sembunyikan pesan setelah beberapa detik
                setTimeout(() => {
                    feedbackEl.style.display = 'none';
                }, 3000);

            } catch (error) {
                console.error("Gagal menyimpan perubahan:", error);
                feedbackEl.textContent = `Gagal menyimpan: ${error.message}`;
                feedbackEl.style.backgroundColor = '#f8d7da';
                feedbackEl.style.color = '#721c24';
                feedbackEl.style.display = 'block';
            } finally {
                button.textContent = 'Simpan Perubahan';
                button.disabled = false;
            }
        }
    });

    // 5. Tangani submit form untuk memperbarui profil pengguna
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

    // --- FUNGSI-FUNGSI FILTER ---

    function populateInstitutionFilter() {
        const institutionFilter = document.getElementById('filter-institusi');
        institutionFilter.innerHTML = '<option value="">Semua Institusi</option>';
        const institutions = [...new Set(allSchedules.map(row => row.Institusi))].sort();
        institutions.forEach(inst => {
            if (inst) {
                institutionFilter.innerHTML += `<option value="${inst}">${inst}</option>`;
            }
        });
    }

    function populateSubjectFilter(data) {
        const subjectFilter = document.getElementById('filter-mapel');
        const currentValue = subjectFilter.value;
        subjectFilter.innerHTML = '<option value="">Semua Mata Pelajaran</option>';
        const subjects = [...new Set(data.map(row => row['Mata_Pelajaran']))].sort();
        subjects.forEach(subj => {
            if (subj) {
                subjectFilter.innerHTML += `<option value="${subj}">${subj}</option>`;
            }
        });
        subjectFilter.value = currentValue; // Pertahankan filter jika memungkinkan
    }

    function applyFilters() {
        const institusiFilter = document.getElementById('filter-institusi').value;
        const mapelFilter = document.getElementById('filter-mapel').value;
        const pesertaFilter = document.getElementById('filter-peserta').value.toLowerCase();

        const filteredData = allSchedules.filter(row => {
            const institusiMatch = !institusiFilter || row.Institusi === institusiFilter;
            const mapelMatch = !mapelFilter || row['Mata_Pelajaran'] === mapelFilter;

            let pesertaMatch = true;
            if (pesertaFilter) {
                pesertaMatch = row.searchable_participants.some(p => p.includes(pesertaFilter));
            }

            return institusiMatch && mapelMatch && pesertaMatch;
        });

        renderSchedules(filteredData);
    }

    function setupFilters() {
        const institutionFilter = document.getElementById('filter-institusi');
        const subjectFilter = document.getElementById('filter-mapel');
        const participantFilter = document.getElementById('filter-peserta');
        const searchResultsContainer = document.getElementById('jadwal-search-results');

        populateInstitutionFilter();
        populateSubjectFilter(allSchedules);

        institutionFilter.addEventListener('change', () => {
            const relevantData = institutionFilter.value 
                ? allSchedules.filter(row => row.Institusi === institutionFilter.value)
                : allSchedules;
            populateSubjectFilter(relevantData);
            applyFilters();
        });

        subjectFilter.addEventListener('change', applyFilters);

        participantFilter.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            searchResultsContainer.innerHTML = '';
            if (searchTerm.length > 1) {
                const matchingNames = allParticipantNames.filter(name => name.toLowerCase().includes(searchTerm));
                matchingNames.slice(0, 5).forEach(name => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.textContent = name;
                    item.addEventListener('click', () => {
                        participantFilter.value = name;
                        searchResultsContainer.innerHTML = '';
                        applyFilters();
                    });
                    searchResultsContainer.appendChild(item);
                });
            }
            applyFilters();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.participant-search-wrapper')) {
                searchResultsContainer.innerHTML = '';
            }
        });
    }

    // --- FUNGSI-FUNGSI UI LAINNYA ---
    
    // 6. Logika untuk menampilkan/menyembunyikan form tambah jadwal
    addScheduleButton.addEventListener('click', () => {
        createScheduleContainer.style.display = 'block';
        addScheduleButton.style.display = 'none';
        schedulesListEl.style.display = 'none';
        document.querySelector('.filters').style.display = 'none';
    });

    cancelCreateButton.addEventListener('click', () => {
        createScheduleContainer.style.display = 'none';
        addScheduleButton.style.display = 'block';
        schedulesListEl.style.display = 'block';
        createScheduleForm.reset(); // Bersihkan form
        document.querySelector('.filters').style.display = 'flex';
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