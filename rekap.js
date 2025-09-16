document.addEventListener("DOMContentLoaded", () => {
    loadRekapData();
    setupRekapSearch();

    // Daftarkan Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker berhasil didaftarkan.'))
            .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
    }
});

function loadRekapData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const rekapContainer = document.getElementById('rekap-container');
    loadingIndicator.style.display = 'block';

    // URL yang sama dengan script utama
    const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcEUYNKssh36NHW_Rk7D89EFDt-ZWFdKxQI32L_Q1exbwNhHuGHWKh_W8VFSA8E58vjhVrumodkUv9/pub?gid=0&single=true&output=csv";

    fetch(spreadsheetUrl)
        .then(response => {
            if (!response.ok) throw new Error('Gagal mengambil data dari jaringan');
            return response.text();
        })
        .then(csvData => {
            const parsedData = parseCSV(csvData);
            const participantSummary = createParticipantSummary(parsedData);
            displaySummary(participantSummary);
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            rekapContainer.innerHTML = `<p style="text-align:center; color: red;">Gagal memuat data rekap.</p>`;
        })
        .finally(() => {
            loadingIndicator.style.display = 'none';
        });
}

function createParticipantSummary(data) {
    const summary = {};

    data.forEach(row => {
        for (let i = 1; i <= 10; i++) {
            const participantName = row[`Peserta ${i}`];
            if (participantName && participantName.trim() !== '') {
                const name = participantName.trim();
                
                // Jika peserta belum ada di rekap, buat entri baru
                if (!summary[name]) {
                    summary[name] = [];
                }

                // Tambahkan jadwal ke rekap peserta
                summary[name].push({
                    subject: row['Mata_Pelajaran'],
                    date: new Date(row.Tanggal) // Simpan sebagai objek Date untuk diurutkan
                });
            }
        }
    });

    // Urutkan jadwal setiap peserta berdasarkan tanggal
    for (const name in summary) {
        summary[name].sort((a, b) => a.date - b.date);
    }

    return summary;
}

function displaySummary(summary) {
    const rekapContainer = document.getElementById('rekap-container');
    rekapContainer.innerHTML = '';

    // Ambil nama peserta dan urutkan berdasarkan alfabet
    const sortedNames = Object.keys(summary).sort((a, b) => a.localeCompare(b));

    if (sortedNames.length === 0) {
        rekapContainer.innerHTML = '<p>Tidak ada data peserta untuk ditampilkan.</p>';
        return;
    }

    sortedNames.forEach(name => {
        const card = document.createElement('div');
        card.className = 'rekap-card';

        const scheduleList = summary[name].map(schedule => `
            <li>
                <span class="mapel">${schedule.subject}</span>
                <span class="tanggal">${schedule.date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </li>
        `).join('');

        card.innerHTML = `
            <h2>${name}</h2>
            <ul>${scheduleList}</ul>
        `;
        rekapContainer.appendChild(card);
    });
}

// Fungsi parseCSV (sama seperti di script.js)
function parseCSV(csvData) {
    const lines = csvData.split("\n");
    const headers = lines[0].split(",").map(header => header.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(value => value.trim());
        if (values.length === headers.length) {
            const entry = {};
            for (let j = 0; j < headers.length; j++) {
                entry[headers[j]] = values[j];
            }
            data.push(entry);
        }
    }
    return data;
}

function setupRekapSearch() {
    const searchInput = document.getElementById('rekap-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const allCards = document.querySelectorAll('.rekap-card');

        allCards.forEach(card => {
            const participantName = card.querySelector('h2').textContent.toLowerCase();
            card.style.display = participantName.includes(searchTerm) ? '' : 'none';
        });
    });
}