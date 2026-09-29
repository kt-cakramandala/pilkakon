import { firebaseConfig, restDBUrl, AUTH_DOMAIN_SUFFIX, TOTAL_DPT } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getDatabase, ref, update, increment, set } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Inisialisasi Chart.js
const ctx = document.getElementById('voteChart').getContext('2d');
let voteChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: ['01. Calon 1', '02. Calon 2', '03. Calon 3', '04. Calon 4'],
        datasets: [{
            label: 'Perolehan Suara',
            data: [0, 0, 0, 0],
            backgroundColor: [
                '#2563eb', // Blue
                '#059669', // Emerald
                '#9333ea', // Purple
                '#ea580c'  // Orange
            ],
            borderColor: [
                '#1d4ed8',
                '#047857',
                '#7e22ce',
                '#c2410c'
            ],
            borderWidth: 1,
            borderRadius: 8
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return ` ${context.raw} Suara`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                    stepSize: 1
                },
                grid: {
                    color: '#f1f5f9'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        animation: {
            duration: 400
        }
    }
});

// Update Seluruh Komponen Tampilan (UI)
function updateUI(data) {
    const defaultData = { calon1: 0, calon2: 0, calon3: 0, calon4: 0, rusak: 0 };
    const votes = Object.assign({}, defaultData, data);

    const c1 = Math.max(0, votes.calon1 || 0);
    const c2 = Math.max(0, votes.calon2 || 0);
    const c3 = Math.max(0, votes.calon3 || 0);
    const c4 = Math.max(0, votes.calon4 || 0);
    const rusak = Math.max(0, votes.rusak || 0);

    const suaraSah = c1 + c2 + c3 + c4;
    const suaraMasuk = suaraSah + rusak;

    // Update Chart
    voteChart.data.datasets[0].data = [c1, c2, c3, c4];
    voteChart.update();

    // Update Angka Ringkasan
    document.getElementById('totalMasuk').innerText = suaraMasuk.toLocaleString('id-ID');
    document.getElementById('totalSah').innerText = suaraSah.toLocaleString('id-ID');
    document.getElementById('totalRusak').innerText = rusak.toLocaleString('id-ID');

    // Update Persentase Ringkasan
    const pMasuk = ((suaraMasuk / TOTAL_DPT) * 100).toFixed(1);
    const pSah = suaraMasuk > 0 ? ((suaraSah / suaraMasuk) * 100).toFixed(1) : "0.0";
    const pRusak = suaraMasuk > 0 ? ((rusak / suaraMasuk) * 100).toFixed(1) : "0.0";

    document.getElementById('persenMasuk').innerText = `${pMasuk}% dari DPT`;
    document.getElementById('persenSah').innerText = `${pSah}% dari Suara Masuk`;
    document.getElementById('persenRusak').innerText = `${pRusak}% dari Suara Masuk`;

    // Update Progress Bar
    const progressFill = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressBarText');
    const clampedPercent = Math.min(100, pMasuk);
    progressFill.style.width = `${clampedPercent}%`;
    progressText.innerText = `${suaraMasuk.toLocaleString('id-ID')} / ${TOTAL_DPT.toLocaleString('id-ID')} (${pMasuk}%)`;

    // Update Cards Kandidat
    document.getElementById('c1-votes').innerText = c1.toLocaleString('id-ID');
    document.getElementById('c2-votes').innerText = c2.toLocaleString('id-ID');
    document.getElementById('c3-votes').innerText = c3.toLocaleString('id-ID');
    document.getElementById('c4-votes').innerText = c4.toLocaleString('id-ID');

    const c1P = suaraSah > 0 ? ((c1 / suaraSah) * 100).toFixed(1) : "0.0";
    const c2P = suaraSah > 0 ? ((c2 / suaraSah) * 100).toFixed(1) : "0.0";
    const c3P = suaraSah > 0 ? ((c3 / suaraSah) * 100).toFixed(1) : "0.0";
    const c4P = suaraSah > 0 ? ((c4 / suaraSah) * 100).toFixed(1) : "0.0";

    document.getElementById('c1-persen').innerText = `${c1P}%`;
    document.getElementById('c2-persen').innerText = `${c2P}%`;
    document.getElementById('c3-persen').innerText = `${c3P}%`;
    document.getElementById('c4-persen').innerText = `${c4P}%`;

    // Update Timestamp Last Updated
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('lastUpdated').innerText = `Diperbarui: ${timeString}`;
}

// REST API Polling untuk Warga Publik
// Ini menghindari batas 100 koneksi WebSocket bersamaan di paket gratis Firebase Spark Plan
async function fetchPublicData() {
    try {
        const res = await fetch(`${restDBUrl}/votes.json?nocache=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            updateUI(data);
            setOnlineStatus(true);
        } else {
            setOnlineStatus(false);
        }
    } catch (err) {
        console.warn("Polling error:", err);
        setOnlineStatus(false);
    }
}

function setOnlineStatus(isOnline) {
    const ping = document.getElementById('statusPing');
    const text = document.getElementById('statusText');

    if (isOnline) {
        ping.innerHTML = `
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        `;
        text.innerText = "Sistem Realtime Aktif";
        text.className = "font-semibold text-slate-700";
    } else {
        ping.innerHTML = `<span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>`;
        text.innerText = "Menghubungkan Ulang...";
        text.className = "font-semibold text-amber-600";
    }
}

// Interval polling publik 2.5 detik
let pollingTimer = setInterval(fetchPublicData, 2500);
fetchPublicData();

// Fungsi Tambah Suara Admin (Atomic Increment)
const modifyVote = (field, delta) => {
    if (!auth.currentUser) {
        alert("Sesi admin berakhir, silakan login kembali.");
        return;
    }
    const updates = {};
    updates[field] = increment(delta);
    update(ref(db, 'votes'), updates)
        .then(() => fetchPublicData())
        .catch(err => alert("Gagal memperbarui data: " + err.message));
};

// Event Listeners Tombol Tambah Admin
document.getElementById('btnC1').onclick = () => modifyVote('calon1', 1);
document.getElementById('btnC2').onclick = () => modifyVote('calon2', 1);
document.getElementById('btnC3').onclick = () => modifyVote('calon3', 1);
document.getElementById('btnC4').onclick = () => modifyVote('calon4', 1);
document.getElementById('btnRusak').onclick = () => modifyVote('rusak', 1);

// Event Listeners Tombol Pengurang (Koreksi Data)
document.getElementById('btnDecC1').onclick = () => modifyVote('calon1', -1);
document.getElementById('btnDecC2').onclick = () => modifyVote('calon2', -1);
document.getElementById('btnDecC3').onclick = () => modifyVote('calon3', -1);
document.getElementById('btnDecC4').onclick = () => modifyVote('calon4', -1);
document.getElementById('btnDecRusak').onclick = () => modifyVote('rusak', -1);

// Reset All
document.getElementById('btnReset').onclick = () => {
    if (!auth.currentUser) return;
    if (confirm("APAKAH ANDA YAKIN INGIN MERESET SEMUA PEROLEHAN SUARA MENJADI 0? Action ini tidak bisa dibatalkan!")) {
        set(ref(db, 'votes'), { calon1: 0, calon2: 0, calon3: 0, calon4: 0, rusak: 0 })
            .then(() => fetchPublicData());
    }
};

// Modal Login Logic
const loginModal = document.getElementById('loginModal');
const btnLoginModal = document.getElementById('btnLoginModal');
const btnLogout = document.getElementById('btnLogout');
const adminPanel = document.getElementById('adminPanel');

btnLoginModal.onclick = () => {
    document.getElementById('loginError').classList.add('hidden');
    loginModal.classList.remove('hidden');
    document.getElementById('username').focus();
};

document.getElementById('closeModal').onclick = () => {
    loginModal.classList.add('hidden');
};

document.getElementById('submitLogin').onclick = () => {
    const rawUser = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;

    if (!rawUser || !pass) {
        document.getElementById('loginError').innerText = "Isi username dan password!";
        document.getElementById('loginError').classList.remove('hidden');
        return;
    }

    const email = rawUser.includes('@') ? rawUser : rawUser + AUTH_DOMAIN_SUFFIX;

    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            loginModal.classList.add('hidden');
            document.getElementById('username').value = "";
            document.getElementById('password').value = "";
            document.getElementById('loginError').classList.add('hidden');
        })
        .catch(err => {
            console.error("Auth error:", err);
            document.getElementById('loginError').innerText = "Username atau password salah!";
            document.getElementById('loginError').classList.remove('hidden');
        });
};

btnLogout.onclick = () => signOut(auth);

// Monitor Status Autentikasi Admin
onAuthStateChanged(auth, (user) => {
    if (user) {
        adminPanel.classList.remove('hidden');
        btnLoginModal.classList.add('hidden');
        btnLogout.classList.remove('hidden');
    } else {
        adminPanel.classList.add('hidden');
        btnLoginModal.classList.remove('hidden');
        btnLogout.classList.add('hidden');
    }
});

// Register Service Worker untuk PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.warn('SW Reg Failed:', err));
    });
}
