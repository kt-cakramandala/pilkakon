// Salin konfigurasi Web App dari Firebase Console ke objek di bawah.
// Jangan masukkan service-account private key ke file frontend.
export const firebaseConfig = {
  apiKey: "AIzaSyCkf7vSrWdRjBPRlTyA108zrWkzNDYU1KY",
  authDomain: "pilkakon-pgu.firebaseapp.com",
  databaseURL: "https://pilkakon-pgu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pilkakon-pgu",
  storageBucket: "pilkakon-pgu.firebasestorage.app",
  messagingSenderId: "826747479722",
  appId: "1:826747479722:web:478b8205b51e1869ee12d3"
};

// Format internal akun superadmin.
// Warga tidak melihat alamat email ini; UI login hanya username + password.
export const ADMIN_EMAIL_DOMAIN = "admin.panggungrejo.local";
