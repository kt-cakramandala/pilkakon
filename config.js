/**
 * KONFIGURASI PUBLIK PWA PILKADES PANGGUNGREJO UTARA
 *
 * File ini aman berada di GitHub Pages. Firebase Web Config bukan password.
 * Keamanan write/read ditentukan oleh Firebase Security Rules.
 */

window.APP_CONFIG = {
  firebaseConfig: {
  apiKey: "AIzaSyCkf7vSrWdRjBPRlTyA108zrWkzNDYU1KY",
  authDomain: "pilkakon-pgu.firebaseapp.com",
  databaseURL: "https://pilkakon-pgu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pilkakon-pgu",
  storageBucket: "pilkakon-pgu.firebasestorage.app",
  messagingSenderId: "826747479722",
  appId: "1:826747479722:web:478b8205b51e1869ee12d3"
  },

  // Username tanpa @ akan otomatis ditambah suffix ini.
  authDomainSuffix: "@panggungrejo.com",

  // Email superadmin yang diizinkan oleh Security Rules.
  // Samakan dengan akun Firebase Authentication Anda.
  adminEmail: "admin@panggungrejo.com",

  // Data publik:
  // "poll" = hemat koneksi (cocok Spark; near-realtime),
  // "sdk"  = realtime push (disarankan Blaze untuk ribuan viewer).
  publicSyncMode: "sdk",

  // Polling publik. Jitter acak mencegah 5.000 browser melakukan GET serentak.
  publicPollMs: 15000,
  publicHiddenPollMs: 60000,
  publicPollJitterMs: 3500,

  // Cache kandidat karena foto/nama jarang berubah.
  candidateCacheMs: 6 * 60 * 60 * 1000,

  // Batas hasil kompresi foto yang disimpan di RTDB (karakter base64).
  maxPhotoDataUrlLength: 450000,

  // Root data aplikasi.
  statePath: "public/state",
  candidatesPath: "public/candidates",

  appName: "Live Count Pilkades Panggungrejo Utara",
  pekonName: "Pekon Panggungrejo Utara",
  wilayahName: "Sukoharjo, Pringsewu",
  electionYear: 2026,

  // Nilai awal saja. Setelah setup, DPT disimpan di Firebase dan dapat diubah Superadmin.
  defaultDpt: 1500,

  candidateDefaults: [
    { id: "1", number: 1, name: "Calon 1", photoDataUrl: "" },
    { id: "2", number: 2, name: "Calon 2", photoDataUrl: "" },
    { id: "3", number: 3, name: "Calon 3", photoDataUrl: "" },
    { id: "4", number: 4, name: "Calon 4", photoDataUrl: "" }
  ],

  // URL library untuk fitur export. Dimuat hanya saat dibutuhkan.
  exportLibraries: {
    exceljs: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@5.0.8/dist/jspdf.plugin.autotable.min.js"
  }
};

// Aliases kompatibilitas.
window.firebaseConfig = window.APP_CONFIG.firebaseConfig;
