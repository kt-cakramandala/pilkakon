# Aplikasi Web PWA Quick Count Pilkades Panggungrejo Utara

Aplikasi Perhitungan Suara Realtime Pemilihan Kepala Pekon Panggungrejo Utara, Kecamatan Sukoharjo, Kabupaten Pringsewu.
Didesain khusus dengan arsitektur **Serverless**: Frontend di-host di **GitHub Pages** dan Backend Realtime Database di-host di **Firebase**.

---

## 🌟 Fitur Utama

1. **Dashboard Warga (Publik):**
   - Transparansi total: Grafik Komparasi Bar Chart dan Pie Chart perolehan suara secara langsung.
   - 4 Kandidat Calon Kepala Pekon + Suara Tidak Sah / Rusak.
   - Ringkasan statistik DPT (1.500 Pemilih), Suara Masuk, Suara Sah, dan Persentase Partisipasi.
   - Siap PWA (*Progressive Web App*): Bisa diinstal di layar utama (Homescreen) HP Android & iPhone layaknya aplikasi native.

2. **Panel Superadmin:**
   - Login simpel: Cukup mengetik username (misal `admin`) dan password.
   - Tombol cepat tambah suara (+1) per calon dan suara rusak.
   - Fitur koreksi berkurang (-1) jika terjadi kesalahan pencatatan.
   - Tombol reset database dengan konfirmasi aman.

3. **Skalabilitas Tahan Banting (5.000+ Akses Warga Gratis di Firebase Spark):**
   - Firebase Realtime Database paket gratis (*Spark Plan*) memiliki batas **100 Concurrent Connections (CCU)** untuk WebSocket.
   - Untuk menangani **5.000 warga** sekaligus tanpa terputus, aplikasi ini menggunakan **Hybrid REST Polling Engine** (tiap 3 detik) untuk publik dan **WebSocket direct** untuk Admin.
   - Ukuran data per fetch sangat ringkas (~80 bytes), sehingga 5.000 warga yang mengakses secara serentak selama 4 jam hanya mengonsumsi **~1.9 GB** kuota (jauh di bawah batas gratis Firebase 10 GB/bulan!).

---

## 🚀 Panduan Cara Setup & Deployment (100% Gratis)

### Langkah 1: Setup Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru bernama `pilkades-panggungrejo`.
2. **Aktifkan Authentication:**
   - Masuk ke menu **Build > Authentication > Get Started**.
   - Pilih metode **Email/Password** dan aktifkan.
   - Masuk ke tab **Users > Add User**.
   - Isikan Email: `admin@panggungrejo.com` dan Password: `passwordpilihananda`.
  baru dibuat >>> password admin321 user id : G92z9OHSg8frQN0WvcTFPNg3OjB3
3. **Aktifkan Realtime Database:**
   - Masuk ke menu **Build > Realtime Database > Create Database**.
   - Pilih lokasi server `Asia Southeast (Singapore)`.
   - Pilih **Start in test mode**.
   - Setelah database terbuat, masuk ke tab **Rules** dan ubah menjadi:
     ```json
     {
       "rules": {
         ".read": true,
         ".write": "auth != null"
       }
     }
     ```
   - Klik **Publish**.
4. **Salin Firebase Config:**
   - Masuk ke **Project Settings** (ikon roda gigi) > **General**.
   - Di bagian bawah, klik ikon Web `</>` untuk mendaftarkan web app.
   - Salin objek `firebaseConfig` yang diberikan.

### Langkah 2: Hubungkan Firebase Config ke `index.html`
1. Buka file `index.html`.
2. Cari variabel `const firebaseConfig = { ... }`.
3. Tempelkan (*paste*) Config Firebase yang Anda dapatkan dari Langkah 1.
4. Simpan file `index.html`.

### Langkah 3: Deploy ke GitHub Pages
1. Buat repository baru di [GitHub](https://github.com/new) dengan nama `pilkades-panggungrejo`.
2. Upload semua file dalam folder ini (`index.html`, `manifest.json`, `sw.js`, `README.md`) ke repository tersebut.
3. Masuk ke tab **Settings** di repo GitHub Anda > scroll ke menu **Pages** (sisi kiri).
4. Di bagian **Source**, pilih branch `main` (atau `master`) dan folder `/ (root)`, lalu klik **Save**.
5. Tunggu 1-2 menit, GitHub Pages akan menerbitkan link web Anda:
   `https://<username-github>.github.io/pilkades-panggungrejo/`

---

## 📱 Cara Menggunakan
- **Warga / Publik:** Tinggal buka link GitHub Pages di browser HP/Laptop. Aplikasi akan memperbarui suara secara otomatis tiap 3 detik.
- **Admin:** Klik tombol **Admin** di kanan atas navbar, ketik username `admin` dan password yang sudah dibuat di Firebase, lalu klik **Masuk**. Panel input suara +1 / -1 akan langsung terbuka di bawah grafik.
