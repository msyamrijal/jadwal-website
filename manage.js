import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchScheduleData, updateSchedule, createSchedule } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingIndicator = document.getElementById('loading-indicator');
    const schedulesContainer = document.getElementById('schedules-list-container');
    const addScheduleBtn = document.getElementById('add-schedule-btn');
    const createContainer = document.getElementById('create-schedule-container');
    const createForm = document.getElementById('create-schedule-form');
    const cancelCreateBtn = document.getElementById('cancel-create-btn');

    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Pengguna sudah login, muat data manajemen
            loadManagementData();
        } else {
            // Pengguna tidak login, paksa kembali ke halaman login
            console.log('Akses ditolak. Pengguna tidak terautentikasi.');
            window.location.replace('/login.html');
        }
    });

    async function loadManagementData() {
        loadingIndicator.style.display = 'block';
        schedulesContainer.innerHTML = '';
        try {
            const schedules = await fetchScheduleData();
            renderEditableSchedules(schedules);
        } catch (error) {
            schedulesContainer.innerHTML = `<p style="color: red;">Gagal memuat data jadwal: ${error.message}</p>`;
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function renderEditableSchedules(schedules) {
        schedules.forEach(schedule => {
            const formContainer = document.createElement('div');
            formContainer.className = 'schedule-form-container';

            const date = schedule.dateObject;
            const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

            let participantInputsHTML = '';
            for (let i = 1; i <= 12; i++) {
                participantInputsHTML += `
                    <div>
                        <label for="peserta-${i}-${schedule.id}">Peserta ${i}:</label>
                        <input type="text" id="peserta-${i}-${schedule.id}" value="${schedule[`Peserta ${i}`] || ''}">
                    </div>
                `;
            }

            formContainer.innerHTML = `
                <h4>${schedule.Mata_Pelajaran}</h4>
                <form class="edit-form" data-schedule-id="${schedule.id}">
                    <label for="date-${schedule.id}">Tanggal & Waktu:</label>
                    <input type="datetime-local" id="date-${schedule.id}" value="${formattedDate}">
                    <label for="material-${schedule.id}">Materi Diskusi:</label>
                    <textarea id="material-${schedule.id}" rows="3">${schedule['Materi Diskusi'] || ''}</textarea>
                    <fieldset style="border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; margin-top: 15px;">
                        <legend>Peserta</legend>
                        <div class="participant-grid">${participantInputsHTML}</div>
                    </fieldset>
                    <div class="form-feedback"></div>
                    <button type="submit">Simpan Perubahan</button>
                </form>
            `;
            schedulesContainer.appendChild(formContainer);
        });
    }

    // --- EVENT LISTENERS ---

    // Handle Edit
    schedulesContainer.addEventListener('submit', async (e) => {
        if (e.target.classList.contains('edit-form')) {
            e.preventDefault();
            const form = e.target;
            const scheduleId = form.dataset.scheduleId;
            const button = form.querySelector('button[type="submit"]');
            const feedbackEl = form.querySelector('.form-feedback');

            button.disabled = true;
            button.textContent = 'Menyimpan...';

            try {
                const updatedData = {
                    Tanggal: new Date(form.querySelector(`#date-${scheduleId}`).value),
                    'Materi Diskusi': form.querySelector(`#material-${scheduleId}`).value,
                };
                for (let i = 1; i <= 12; i++) {
                    updatedData[`Peserta ${i}`] = form.querySelector(`#peserta-${i}-${scheduleId}`).value.trim();
                }

                await updateSchedule(scheduleId, updatedData);

                feedbackEl.textContent = 'Perubahan berhasil disimpan!';
                feedbackEl.style.backgroundColor = '#d4edda';
                feedbackEl.style.color = '#155724';
                feedbackEl.style.display = 'block';
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);

            } catch (error) {
                feedbackEl.textContent = `Gagal menyimpan: ${error.message}`;
                feedbackEl.style.backgroundColor = '#f8d7da';
                feedbackEl.style.color = '#721c24';
                feedbackEl.style.display = 'block';
            } finally {
                button.disabled = false;
                button.textContent = 'Simpan Perubahan';
            }
        }
    });

    // Handle Add
    addScheduleBtn.addEventListener('click', () => {
        createContainer.style.display = 'block';
        addScheduleBtn.style.display = 'none';
        generateNewParticipantInputs();
        createContainer.scrollIntoView({ behavior: 'smooth' });
    });

    cancelCreateBtn.addEventListener('click', () => {
        createContainer.style.display = 'none';
        addScheduleBtn.style.display = 'block';
        createForm.reset();
    });

    function generateNewParticipantInputs() {
        const container = document.getElementById('new-participant-inputs');
        container.innerHTML = '';
        for (let i = 1; i <= 12; i++) {
            container.innerHTML += `
                <div>
                    <label for="new-peserta-${i}">Peserta ${i}:</label>
                    <input type="text" id="new-peserta-${i}">
                </div>
            `;
        }
    }

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = createForm.querySelector('button[type="submit"]');
        const feedbackEl = document.getElementById('create-feedback');

        button.disabled = true;
        button.textContent = 'Menyimpan...';

        try {
            const newScheduleData = {
                'Mata_Pelajaran': document.getElementById('new-subject').value,
                'Institusi': document.getElementById('new-institution').value,
                'Tanggal': new Date(document.getElementById('new-date').value),
                'Materi Diskusi': document.getElementById('new-material').value,
            };
            for (let i = 1; i <= 12; i++) {
                newScheduleData[`Peserta ${i}`] = document.getElementById(`new-peserta-${i}`).value.trim();
            }

            await createSchedule(newScheduleData);

            feedbackEl.textContent = 'Jadwal baru berhasil dibuat! Halaman akan dimuat ulang.';
            feedbackEl.style.backgroundColor = '#d4edda';
            feedbackEl.style.color = '#155724';
            feedbackEl.style.display = 'block';

            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            feedbackEl.textContent = `Gagal membuat jadwal: ${error.message}`;
            feedbackEl.style.backgroundColor = '#f8d7da';
            feedbackEl.style.color = '#721c24';
            feedbackEl.style.display = 'block';
            button.disabled = false;
            button.textContent = 'Simpan Jadwal';
        }
    });
});