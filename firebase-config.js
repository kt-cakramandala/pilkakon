/*
  KONFIGURASI FIREBASE
  1. Buka Firebase Console > Project settings > Your apps > Web app.
  2. Salin object firebaseConfig ke bawah.
  3. Jangan pernah menaruh service-account private key di sini.

  Aplikasi otomatis masuk MODE DEMO bila projectId/apiKey/databaseURL masih kosong.
*/
window.PANGGUNGREJO_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkf7vSrWdRjBPRlTyA108zrWkzNDYU1KY",
  authDomain: "pilkakon-pgu.firebaseapp.com",
  databaseURL: "https://pilkakon-pgu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pilkakon-pgu",
  storageBucket: "pilkakon-pgu.firebasestorage.app",
  messagingSenderId: "826747479722",
  appId: "1:826747479722:web:478b8205b51e1869ee12d3"
};

/*
  UI tetap meminta USERNAME + PASSWORD.
  Di Firebase Authentication username dipetakan secara internal ke:
  username@<projectId>.firebaseapp.com
*/
window.PANGGUNGREJO_ADMIN_EMAIL_DOMAIN = "admin.panggungrejo.local";
