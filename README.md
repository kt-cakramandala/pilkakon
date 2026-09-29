# PWA Perhitungan Suara — Panggungrejo Utara

Web app PWA statis untuk transparansi perhitungan suara dengan 4 kandidat dan total pemilih default 1.500. Frontend dapat di-host di GitHub Pages, sementara Firebase Authentication + Realtime Database menjadi backend/data.

## Konsep utama
- Dashboard publik tanpa login.
- Ringkasan: total pemilih, suara masuk, suara sah, suara rusak/tidak sah, partisipasi.
- Bar chart 4 kandidat + persentase.
- Panel Superadmin untuk menambah suara per kategori, mengubah setelan, mengunci penghitungan, dan koreksi dengan alasan.
- Audit log untuk aktivitas operator.
- Realtime listener hanya ke node kecil `config`, `tally`, dan `candidates` pada halaman publik.
- PWA: manifest + service worker.

## Arsitektur yang direkomendasikan
`GitHub Pages (frontend)` → `Firebase Authentication` → `Firebase Realtime Database`

Tidak perlu Google Apps Script untuk loop pembacaan publik. Perubahan `tally` dipantau dengan listener realtime Firebase.

## Struktur database
```text
config/
candidates/
tally/
audit/
presence/
admins/{uid}/
```

### Arti angka
- **Suara masuk** = kandidat 1 + kandidat 2 + kandidat 3 + kandidat 4 + rusak/tidak sah.
- **Suara sah** = kandidat 1 + kandidat 2 + kandidat 3 + kandidat 4.
- **Partisipasi** = suara masuk / total pemilih × 100%.

## Instalasi
1. Buat project Firebase.
2. Tambahkan Web App pada Firebase Project.
3. Aktifkan Authentication → Email/Password.
4. Buat Realtime Database.
5. Import `seed-data.json` (atau masukkan struktur yang sama secara manual).
6. Salin `firebaseConfig` Web App ke `firebase-config.js`.
7. Terapkan `database.rules.json` pada Realtime Database Rules.
8. Di Firebase Authentication, buat user admin dengan alamat internal:
   `username@admin.panggungrejo.local`
   Contoh username `superadmin` → `superadmin@admin.panggungrejo.local`.
   UI aplikasi tetap hanya menampilkan field Username + Password.
9. Ambil UID user tersebut dari Authentication → Users.
10. Buat node `admins/{UID}` dengan isi:
```json
{"role":"superadmin"}
```
11. Edit nama 4 kandidat, foto, dan aksen warna pada node `candidates/`.
12. Upload seluruh folder ke repository GitHub dan aktifkan GitHub Pages dari branch yang dipakai.
13. Buka URL GitHub Pages melalui HTTPS. Service worker PWA akan aktif setelah halaman dibuka.

## Penggantian foto kandidat
Foto placeholder disimpan di `assets/kandidat-1.svg` hingga `assets/kandidat-4.svg`.
Untuk foto resmi, upload JPG/PNG ke repository, misalnya `assets/kandidat-1.jpg`, lalu ubah `photoUrl` pada node kandidat di Firebase.

## Operasional hari pemungutan
- Pastikan total pemilih pada `config/totalVoters` sesuai DPT/angka resmi yang digunakan.
- Lakukan input melalui satu akun superadmin yang terkontrol; akun tambahan hanya bila operasional membutuhkannya.
- Setiap input menambah kategori dan total suara masuk menggunakan transaksi Firebase.
- Setelah final, tekan **Kunci penghitungan**.
- Koreksi hanya untuk kesalahan administrasi dan wajib diberi alasan.
- Simpan/backup data Firebase sesuai prosedur resmi penyelenggara.

## Pengujian sebelum dipakai
- Tes 4 kandidat + rusak/tidak sah.
- Tes batas total: sistem menolak input bila suara masuk melampaui total pemilih.
- Tes 2–20 tab superadmin melakukan input hampir bersamaan.
- Tes halaman publik di beberapa perangkat dan jaringan seluler.
- Tes offline/reconnect; angka publik harus kembali tersinkron setelah koneksi pulih.
- Tes install PWA di Android.

## Catatan keamanan
- `firebase-config.js` berisi konfigurasi web Firebase, bukan private key service account.
- Jangan pernah memasukkan service-account JSON/private key ke GitHub Pages.
- Database Rules sudah membatasi tulis ke akun dengan `admins/{uid}/role == superadmin`.
- Public hanya membaca `config`, `candidates`, dan `tally`.
