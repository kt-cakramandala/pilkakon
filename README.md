# Aplikasi Web PWA Perhitungan Suara Realtime Pilkades Pekon Panggungrejo Utara

Aplikasi Perhitungan Suara (*Realtime Live Count*) Pemilihan Kepala Pekon Panggungrejo Utara dengan 4 Kandidat Calon dan Kapasitas Pemilih 1.500+ DPT.

Didesain khusus untuk di-host secara gratis di **GitHub Pages** (Frontend PWA) dan menggunakan **Firebase Realtime Database** (Backend & Storage).

---

## 🛠️ Fitur Utama & Keunggulan

1. **Skalabilitas Tinggi (Handal untuk 5.000+ Warga):**
   - Menggunakan teknik **REST API Polling** untuk pengunjung publik.
   - **Bypass Limit Spark Plan (Paket Gratis Firebase):** Paket gratis Firebase memiliki batasan *100 Concurrent Connections* jika menggunakan WebSocket SDK secara langsung. Dengan REST Polling tiap 2,5 detik, 5.000+ warga dapat mengakses aplikasi secara serentak tanpa pernah mengalami *connection dropped* atau *quota exceeded*.

2. **Dua Hak Akses (Akses Bertingkat):**
   - **Publik / Warga:** Akses langsung tanpa login, tampilan *read-only*, ringan, dan responsif di HP/Desktop.
   - **Superadmin:** Login khusus untuk input hitung suara, koreksi suara, dan reset data.

3. **Login Admin Praktis (Username Only):**
   - Admin cukup mengetik username (contoh: `admin`) dan password tanpa repot mengetik email. Di latar belakang, sistem secara otomatis menambahkan sufiks domain `@panggungrejo.com`.

4. **Kategori Perhitungan Lengkap:**
   - Suara Sah untuk **Calon 1, 2, 3, dan 4**.
   - Suara **Tidak Sah / Rusak**.
   - Otomatis kalkulasi Total Suara Masuk, Total Suara Sah, Persentase Partisipasi dari DPT (1.500), serta *Progress Bar* interaktif.

5. **Visualisasi Data & PWA Ready:**
   - Grafik Batang (Bar Chart) interaktif via Chart.js.
   - Dapat diinstal di layar utama (Homescreen) Smartphone Android/iOS seperti aplikasi native (Progressive Web App).

---

## 📁 Struktur File dalam ZIP

```
pilkades-panggungrejo-utara/
├── index.html        # Antarmuka Pengguna (UI Utama, Chart, Ringkasan, Modal Login, Panel Admin)
├── config.js        # File Konfigurasi Firebase & Parameter Aplikasi (Terpisah & Aman)
├── app.js           # Logika Utama (Firebase Modular v10, Chart Update, Polling, Autentikasi)
├── manifest.json    # Konfigurasi PWA (Icon, Color Theme, Standalone Display)
├── sw.js            # Service Worker untuk Offline Caching & Akses Cepat
└── README.md        # Dokumentasi & Panduan Instalasi
```

---

## 🚀 Panduan Langkah Instalasi & Konfigurasi

### Langkah 1: Persiapan Firebase Console (Backend)
1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru (contoh nama: `pilkades-panggungrejo`).
2. **Aktifkan Autentikasi:**
   - Masuk ke menu **Authentication** > Klik **Get Started**.
   - Pilih metode **Email/Password**, lalu aktifkan switch **Enable** dan klik **Save**.
   - Masuk ke tab **Users** > Klik **Add User**.
   - Masukkan Email: `admin@panggungrejo.com` (Sesuai username `admin`).
   - Masukkan Password rahasia Anda (contoh: `Panggungrejo2026!`).
3. **Aktifkan Realtime Database:**
   - Masuk ke menu **Realtime Database** > Klik **Create Database**.
   - Pilih lokasi server terdekat (misal: `Singapore / asia-southeast1`).
   - Pilih mode **Start in test mode**.
4. **Atur Keamanan Database (Database Rules):**
   - Buka tab **Rules** pada Realtime Database.
   - Ubah kodenya menjadi seperti berikut agar warga bisa membaca data tetapi **HANYA Admin** yang terautentikasi yang bisa menginput suara:
   ```json
   {
     "rules": {
       "votes": {
         ".read": true,
         ".write": "auth != null"
       }
     }
   }
   ```
   - Klik **Publish**.

5. **Ambil Kredensial Firebase:**
   - Buka **Project Settings** (Ikon Gerigi) > Tab **General**.
   - Scroll ke bawah pada bagian *Your apps*, klik ikon Web `</>`.
   - Beri nama aplikasi (misal: `Web Pilkades`), centang *Firebase Hosting* (opsional), lalu klik **Register app**.
   - Salin objek `firebaseConfig` yang muncul di layar.

---

### Langkah 2: Konfigurasi Kode Lokal
1. Ekstrak file ZIP ini ke komputer Anda.
2. Buka file `config.js` menggunakan Notepad atau Code Editor (VS Code).
3. Ganti nilai `YOUR_API_KEY`, `YOUR_PROJECT_ID`, dsb. dengan kredensial yang disalin dari Firebase Console pada Langkah 1.5.
4. Simpan file `config.js`.

---

### Langkah 3: Hosting Gratis di GitHub Pages
1. Login ke akun [GitHub](https://github.com/) Anda.
2. Buat Repository baru dengan nama `pilkades-panggungrejo` (pilih opsi **Public**).
3. Upload seluruh file (`index.html`, `config.js`, `app.js`, `manifest.json`, `sw.js`, `README.md`) ke repository tersebut.
4. Masuk ke **Settings** Repository > Pilih menu **Pages** di bilah sisi kiri.
5. Pada bagian **Build and deployment** > **Branch**, pilih `main` atau `master` dan folder `/ (root)`. Klik **Save**.
6. Tunggu 1 - 2 menit. GitHub Pages akan menerbitkan link web resmi Anda (misal: `https://username.github.io/pilkades-panggungrejo/`).

---

## 📱 Cara Penggunaan Aplikasi

1. **Untuk Pengunjung Warga (Publik):**
   - Warga cukup membuka URL GitHub Pages melalui browser HP atau komputer.
   - Data perolehan suara, grafik, persentase, dan status realtime akan terupdate secara otomatis tanpa perlu merefresh halaman.
   - Warga dapat menekan menu browser "Tambahkan ke Layar Utama" / "Add to Home Screen" untuk menginstal aplikasi ke HP.

2. **Untuk Petugas TPS / Superadmin:**
   - Klik tombol **Login Admin** di pojok kanan atas.
   - Masukkan Username: `admin`
   - Masukkan Password yang telah Anda daftarkan di Firebase Console.
   - Setelah berhasil login, **Panel Superadmin** berwarna kuning emas akan muncul di bawah grafik.
   - Setiap ada surat suara yang dihitung dari kotak suara, klik tombol yang sesuai (`+ Calon 1`, `+ Calon 2`, `+ Calon 3`, `+ Calon 4`, atau `+ Suara Rusak`).
   - Jika terjadi kesalahan input, gunakan tombol koreksi (`- C1`, `- C2`, dsb.) untuk mengurangi angka.
