import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchSchedulesByParticipant } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const userNameEl = document.getElementById('user-name');
    const loadingIndicator = document.getElementById('loading-indicator');
    const logoutButton = document.getElementById('logout-button');
    const updateProfileContainer = document.getElementById('update-profile-container');
    const updateProfileForm = document.getElementById('update-profile-form');
    const detailsContainer = document.getElementById('participant-details-container');

    // --- FUNGSI UTAMA ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let currentUser = user;

            if (!currentUser.displayName) {
                try {
                    await currentUser.reload();
                    currentUser = auth.currentUser;
                } catch (reloadError) {
                    console.error('Gagal memuat ulang profil pengguna:', reloadError);
                }
            }

            if (currentUser.displayName) {
                updateProfileContainer.style.display = 'none';
                renderDashboardForUser(currentUser);
            } else {
                userNameEl.textContent = 'Peserta';
                updateProfileContainer.style.display = 'block';
            }
        } else {
            window.location.replace('/login.html');
        }
    });

    async function renderDashboardForUser(user) {
        userNameEl.textContent = user.displayName;
        loadingIndicator.style.display = 'block';
        detailsContainer.style.display = 'none';

        try {
            const userSchedules = await fetchSchedulesByParticipant(user.displayName);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingSchedules = userSchedules.filter(s => s.dateObject >= today);

            document.getElementById('schedule-count').textContent = upcomingSchedules.length;
            renderCalendar(new Date(), upcomingSchedules);
            renderScheduleList(upcomingSchedules);

            detailsContainer.style.display = 'block';
        } catch (error) {
            console.error("Error rendering dashboard:", error);
            detailsContainer.innerHTML = `<p style="color: red;">Gagal memuat jadwal Anda.</p>`;
            detailsContainer.style.display = 'block';
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function renderCalendar(date, schedules) {
        const calendarContainer = document.getElementById('calendar-container');
        const month = date.getMonth();
        const year = date.getFullYear();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const scheduleDates = new Set(schedules.map(s => s.dateObject.toDateString()));

        let html = `
            <div class="calendar-header">
                <h3>${date.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div class="calendar-grid">
                ${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => `<div class="calendar-day-name">${d}</div>`).join('')}
        `;

        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const hasSchedule = scheduleDates.has(currentDate.toDateString());
            const scheduleTitles = schedules
                .filter(s => s.dateObject.toDateString() === currentDate.toDateString())
                .map(s => s.Mata_Pelajaran)
                .join(', ');

            html += `<div class="calendar-day ${hasSchedule ? 'has-schedule' : ''}" title="${hasSchedule ? scheduleTitles : ''}">${day}</div>`;
        }

        html += `</div>`;
        calendarContainer.innerHTML = html;
    }

    function renderScheduleList(schedules) {
        const listEl = document.getElementById('participant-schedule-list');
        listEl.innerHTML = '';
        if (schedules.length === 0) {
            listEl.innerHTML = '<li>Tidak ada jadwal mendatang untuk Anda.</li>';
            return;
        }

        schedules.forEach(s => {
            const li = document.createElement('li');
            const dateString = s.dateObject.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const timeString = s.dateObject.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            li.innerHTML = `
                <strong>${s.Mata_Pelajaran}</strong> (${s.Institusi})<br>
                <small>${dateString}, Pukul ${timeString}</small><br>
                <em>Materi: ${s['Materi Diskusi'] || 'Tidak ada'}</em>
            `;
            listEl.appendChild(li);
        });
    }

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
                window.location.reload();
            } catch (error) {
                console.error('Gagal memperbarui profil:', error);
                errorMessageEl.textContent = 'Gagal menyimpan nama. Silakan coba lagi.';
                button.disabled = false;
                button.textContent = 'Simpan Nama & Tampilkan Jadwal';
            }
        });
    }

    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
        console.log('Pengguna berhasil logout.');
    });
});