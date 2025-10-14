import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { fetchScheduleData } from './db.js';
import { isAdmin } from './auth-admin.js';
import { subscribeUserToPush } from './notifications.js'; // 1. Impor fungsi notifikasi

document.addEventListener('DOMContentLoaded', () => {
    const userNameEl = document.getElementById('user-name');
    const loadingIndicator = document.getElementById('loading-indicator');
    const logoutButton = document.getElementById('logout-button');
    const notificationButton = document.getElementById('enable-notifications-btn'); // 2. Dapatkan elemen tombol

    // Elemen untuk form update profil
    const updateProfileContainer = document.getElementById('update-profile-container');
    const updateProfileForm = document.getElementById('update-profile-form');

    // Elemen untuk detail jadwal
    const detailsContainer = document.getElementById('participant-details-container');
    const nameHeading = document.getElementById('participant-name-heading');
    const scheduleList = document.getElementById('participant-schedule-list');
    const calendarContainer = document.getElementById('calendar-container');

    let currentCalendarDate = new Date();

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

                // Tampilkan link admin jika pengguna adalah admin
                if (isAdmin(currentUser)) {
                    const adminLink = document.getElementById('admin-panel-link');
                    if (adminLink) adminLink.style.display = 'inline-block';
                }

                // 3. Logika untuk menampilkan tombol notifikasi
                if (notificationButton) {
                    // Cek apakah notifikasi didukung dan belum diizinkan
                    if ('Notification' in window && 'serviceWorker' in navigator && Notification.permission !== 'granted') {
                        notificationButton.style.display = 'block';
                    }

                    notificationButton.addEventListener('click', () => {
                        notificationButton.disabled = true;
                        notificationButton.textContent = 'Memproses...';
                        subscribeUserToPush(currentUser.uid)
                            .then(() => {
                                notificationButton.textContent = 'Notifikasi Aktif';
                            });
                    });
                }
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
        nameHeading.textContent = user.displayName;
        loadingIndicator.style.display = 'block';
        detailsContainer.style.display = 'none';

        try {
            const allSchedules = await fetchScheduleData();
            const scheduleSummary = createParticipantSummary(allSchedules);
            const userSchedules = scheduleSummary[user.displayName] || [];

            if (userSchedules.length > 0) {
                document.getElementById('schedule-count').textContent = `(${userSchedules.length} Sisa)`;
                currentCalendarDate = new Date(); // Reset ke bulan ini
                generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), userSchedules);
                renderScheduleList(userSchedules);
                detailsContainer.style.display = 'block';
            } else {
                detailsContainer.innerHTML = `<p>Tidak ada jadwal mendatang yang ditemukan untuk Anda.</p>`;
                detailsContainer.style.display = 'block';
            }
        } catch (error) {
            console.error("Error rendering dashboard:", error);
            detailsContainer.innerHTML = `<p style="color: red;">Gagal memuat jadwal Anda.</p>`;
            detailsContainer.style.display = 'block';
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function createParticipantSummary(data) {
        const summary = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        data.forEach(row => {
            if (!row.dateObject || row.dateObject < today) return;

            const allParticipantsInSession = Object.keys(row)
                .filter(key => key.startsWith('Peserta ') && row[key])
                .map(k => row[k].trim());

            allParticipantsInSession.forEach(name => {
                if (!summary[name]) summary[name] = [];
                const otherParticipants = allParticipantsInSession.filter(p => p !== name);
                summary[name].push({
                    subject: row['Mata_Pelajaran'],
                    date: row.dateObject,
                    institusi: row.Institusi,
                    materi: row['Materi Diskusi'] || 'Tidak ada data',
                    otherParticipants: otherParticipants
                });
            });
        });

        for (const name in summary) {
            summary[name].sort((a, b) => a.date - b.date);
        }
        return summary;
    }

    function generateCalendar(year, month, schedules) {
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDay = firstDay.getDay();

        const scheduleMap = new Map();
        schedules.forEach(s => {
            const d = s.date;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!scheduleMap.has(dateStr)) scheduleMap.set(dateStr, []);
            scheduleMap.get(dateStr).push(s.subject);
        });

        let html = `
            <div class="calendar-header">
                <button id="prev-month">&lt;</button>
                <h3>${monthNames[month]} ${year}</h3>
                <button id="next-month">&gt;</button>
            </div>
            <div class="calendar-grid">
                ${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => `<div class="calendar-day-name">${d}</div>`).join('')}
        `;

        for (let i = 0; i < startingDay; i++) html += `<div></div>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySchedules = scheduleMap.get(currentDateStr);
            const hasSchedule = !!daySchedules;
            const title = hasSchedule ? `Jadwal: ${daySchedules.join(', ')}` : '';
            html += `<div class="calendar-day ${hasSchedule ? 'has-schedule' : ''}" data-date="${currentDateStr}" title="${title}">${day}</div>`;
        }
        html += `</div>`;
        calendarContainer.innerHTML = html;

        document.getElementById('prev-month').addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), schedules);
        });
        document.getElementById('next-month').addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            generateCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), schedules);
        });

        calendarContainer.querySelectorAll('.has-schedule').forEach(dayEl => {
            dayEl.addEventListener('click', (e) => {
                const dateStr = e.currentTarget.dataset.date;
                const targetListItem = document.querySelector(`li[data-date="${dateStr}"]`);
                if (targetListItem) {
                    targetListItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const summaryDiv = targetListItem.querySelector('.schedule-summary');
                    const detailDiv = targetListItem.querySelector('.schedule-details');
                    if (!detailDiv.classList.contains('visible')) {
                        summaryDiv.classList.add('expanded');
                        detailDiv.classList.add('visible');
                    }
                    targetListItem.classList.add('highlighted');
                    setTimeout(() => targetListItem.classList.remove('highlighted'), 2500);
                }
            });
        });
    }

    function renderScheduleList(schedules) {
        scheduleList.innerHTML = '';
        schedules.forEach(s => {
            const li = document.createElement('li');
            const dateStr = s.date.toISOString().split('T')[0];
            li.setAttribute('data-date', dateStr);

            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'schedule-summary';
            summaryDiv.innerHTML = `
                <span class="mapel">${s.subject}</span>
                <span class="tanggal">${s.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            `;

            const detailDiv = document.createElement('div');
            detailDiv.className = 'schedule-details';
            const otherParticipantsHTML = s.otherParticipants.length > 0 ? `<p><strong>Peserta Lain:</strong> ${s.otherParticipants.join(', ')}</p>` : '';
            detailDiv.innerHTML = `
                <p><strong>Institusi:</strong> ${s.institusi}</p>
                <p><strong>Materi Diskusi:</strong> ${s.materi}</p>
                ${otherParticipantsHTML}
            `;

            summaryDiv.addEventListener('click', () => {
                detailDiv.classList.toggle('visible');
                summaryDiv.classList.toggle('expanded');
            });

            li.appendChild(summaryDiv);
            li.appendChild(detailDiv);
            scheduleList.appendChild(li);
        });
    }

    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('new-displayName').value.trim();
            const button = updateProfileForm.querySelector('button');
            const errorMessageEl = document.getElementById('update-profile-error');
            if (!newName) { errorMessageEl.textContent = 'Nama tidak boleh kosong.'; return; }
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