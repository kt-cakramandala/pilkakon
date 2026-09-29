/**
 * Firebase Configuration File
 * Pekon Panggungrejo Utara Pilkades Web App
 * 
 * PETUNJUK:
 * Ganti nilai di bawah ini dengan kredensial Firebase milik Anda.
 * Ambil kredensial ini di Firebase Console -> Project Settings -> General -> Your Apps.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCkf7vSrWdRjBPRlTyA108zrWkzNDYU1KY",
  authDomain: "pilkakon-pgu.firebaseapp.com",
  databaseURL: "https://pilkakon-pgu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pilkakon-pgu",
  storageBucket: "pilkakon-pgu.firebasestorage.app",
  messagingSenderId: "826747479722",
  appId: "1:826747479722:web:478b8205b51e1869ee12d3"
};

// URL khusus REST API Realtime Database untuk pengunjung umum (Bypass limit 100 websocket)
export const restDBUrl = firebaseConfig.databaseURL;

// Domain virtual untuk autentikasi username-only
export const AUTH_DOMAIN_SUFFIX = "@panggungrejo.com";

// Total DPT Pekon Panggungrejo Utara
export const TOTAL_DPT = 1500;
