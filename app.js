/* Panggungrejo Utara - vote tally PWA
   Works in Firebase mode after firebase-config.js is filled.
   Works immediately in DEMO mode with localStorage, so index.html can be opened for UI testing.
*/
(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    eventTitle: 'Pemilihan Kepala Pekon Panggungrejo Utara',
    eventSubtitle: 'Hasil sementara diperbarui secara realtime.',
    totalVoters: 1500,
    status: 'OPEN',
    electionDate: ''
  };
  const DEFAULT_CANDIDATES = [
    { id: 'candidate1', number: 1, name: 'Kandidat 1', photoUrl: 'assets/kandidat-1.png', accent: '#14835a' },
    { id: 'candidate2', number: 2, name: 'Kandidat 2', photoUrl: 'assets/kandidat-2.png', accent: '#3d6dcc' },
    { id: 'candidate3', number: 3, name: 'Kandidat 3', photoUrl: 'assets/kandidat-3.png', accent: '#d08a2e' },
    { id: 'candidate4', number: 4, name: 'Kandidat 4', photoUrl: 'assets/kandidat-4.png', accent: '#9a4f92' }
  ];
  const CANDIDATE_IDS = DEFAULT_CANDIDATES.map(c => c.id);
  const $ = id => document.getElementById(id);
  const fmt = new Intl.NumberFormat('id-ID');
  const STORAGE_KEY = 'panggungrejo-demo-state-v2';
  const DEMO_USER_KEY = 'panggungrejo-demo-admin-v1';
  const state = {
    mode: 'demo',
    config: { ...DEFAULT_CONFIG },
    candidates: DEFAULT_CANDIDATES.map(c => ({ ...c })),
    tally: { candidate1: 0, candidate2: 0, candidate3: 0, candidate4: 0, invalid: 0, lastUpdatedAt: 0 },
    audits: [],
    firebase: null,
    db: null,
    auth: null,
    currentUser: null,
    adminVerified: false
  };

  function hasFirebaseConfig() {
    const c = window.PANGGUNGREJO_FIREBASE_CONFIG || {};
    return ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'messagingSenderId', 'appId'].every(k => typeof c[k] === 'string' && c[k].trim() && !c[k].startsWith('GANTI_'));
  }

  function hideLoader() {
    const el = $('app-loader');
    if (!el) return;
    el.style.opacity = '0';
    window.setTimeout(() => el.classList.add('hidden'), 250);
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }
  function clampInt(value, min, max) {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  }
  function usernameToEmail(username) {
    const clean = String(username || '').trim().toLowerCase();
    const projectId = String((window.PANGGUNGREJO_FIREBASE_CONFIG || {}).projectId || '').trim();
    return `${clean}@${projectId}.firebaseapp.com`;
  }
  function timeLabel(value) {
    if (!value) return '—';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
  }
  function now() { return Date.now(); }
  function totalValid() { return CANDIDATE_IDS.reduce((sum, id) => sum + Number(state.tally[id] || 0), 0); }
  function totalInvalid() { return Number(state.tally.invalid || 0); }
  function totalIncoming() { return totalValid() + totalInvalid(); }
  function candidateList() {
    const value = state.candidates;
    const list = Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {}).filter(Boolean);
    return (list.length ? list : DEFAULT_CANDIDATES).sort((a, b) => Number(a.number) - Number(b.number));
  }
  function setConnection(online) {
    const pill = $('connection-pill');
    pill.classList.toggle('online', !!online);
    pill.classList.toggle('offline', !online);
    $('connection-text').textContent = online ? 'Realtime aktif' : 'Offline / demo';
  }
  function showBanner(message, tone) {
    const banner = $('mode-banner');
    banner.classList.remove('hidden', 'info', 'warn', 'danger');
    banner.classList.add(tone || 'info');
    banner.textContent = message;
  }
  function clearBanner() {
    $('mode-banner').classList.add('hidden');
  }

  function demoDefaultState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.config = { ...DEFAULT_CONFIG, ...(parsed.config || {}) };
      state.candidates = parsed.candidates || DEFAULT_CANDIDATES;
      state.tally = { ...state.tally, ...(parsed.tally || {}) };
      state.audits = Array.isArray(parsed.audits) ? parsed.audits : [];
    } catch (e) {
      console.warn('Demo data could not be restored.', e);
    }
  }
  function demoPersist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      config: state.config,
      candidates: state.candidates,
      tally: state.tally,
      audits: state.audits.slice(0, 100)
    }));
  }
  function renderAll() {
    const cfg = state.config || DEFAULT_CONFIG;
    const voters = Number(cfg.totalVoters || 0);
    const valid = totalValid();
    const invalid = totalInvalid();
    const incoming = valid + invalid;
    const participation = voters > 0 ? Math.min(100, (incoming / voters) * 100) : 0;

    $('event-title').textContent = cfg.eventTitle || DEFAULT_CONFIG.eventTitle;
    $('event-subtitle').textContent = cfg.eventSubtitle || DEFAULT_CONFIG.eventSubtitle;
    $('total-voters').textContent = fmt.format(voters);
    $('votes-in').textContent = fmt.format(incoming);
    $('valid-votes').textContent = fmt.format(valid);
    $('invalid-votes').textContent = fmt.format(invalid);
    $('participation').textContent = `${participation.toFixed(1)}%`;
    $('participation-label').textContent = `${fmt.format(incoming)} / ${fmt.format(voters)}`;
    $('participation-fill').style.width = `${participation}%`;
    $('last-updated').textContent = timeLabel(state.tally.lastUpdatedAt);

    const open = cfg.status !== 'LOCKED';
    $('event-status').textContent = open ? 'PERHITUNGAN BERLANGSUNG' : 'PENGHITUNGAN DIKUNCI';
    $('public-status-box').textContent = open ? 'Status: terbuka untuk input' : 'Status: terkunci — tidak menerima input baru';
    $('public-note').textContent = state.mode === 'demo'
      ? 'MODE DEMO: data disimpan hanya di browser ini. Setelah Firebase dikonfigurasi, data akan tersimpan pada database realtime.'
      : 'Angka di halaman publik mengikuti rekap yang tersimpan pada Firebase Realtime Database.';

    renderCandidates();
    renderAdminFields();
    renderAudits();
  }

  function renderCandidates() {
    const candidates = candidateList();
    const valid = totalValid();
    $('candidate-results').innerHTML = candidates.map(c => {
      const votes = Number(state.tally[c.id] || 0);
      const share = valid ? (votes / valid) * 100 : 0;
      const safePhoto = esc(c.photoUrl || `assets/kandidat-${Number(c.number)}.png`);
      return `<div class="candidate-row" style="--candidate-accent:${esc(c.accent || '#14835a')}">
        <img class="candidate-photo" src="${safePhoto}" alt="Foto ${esc(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/kandidat-${Number(c.number)}.png'">
        <div class="candidate-meta">
          <div class="candidate-number">Nomor urut ${esc(c.number)}</div>
          <div class="candidate-name">${esc(c.name)}</div>
          <div class="bar-bg"><div class="bar-fg" style="width:${Math.max(0, Math.min(100, share))}%;background:${esc(c.accent || '#14835a')}"></div></div>
        </div>
        <div class="candidate-score"><div class="candidate-votes">${fmt.format(votes)}</div><div class="candidate-share">${share.toFixed(2)}%</div></div>
      </div>`;
    }).join('');

    $('chart-legend').innerHTML = candidates.map(c => `<div class="legend-item"><span class="legend-dot" style="background:${esc(c.accent || '#14835a')}"></span><span>No. ${esc(c.number)} — ${esc(c.name)}</span></div>`).join('');
    drawChart(candidates);
    renderQuickCounters(candidates);
  }

  function renderQuickCounters(candidates) {
    if (!state.currentUser || !state.adminVerified) {
      $('quick-counters').innerHTML = '<div class="muted">Login superadmin untuk menampilkan tombol input suara.</div>';
      return;
    }
    const locked = state.config.status === 'LOCKED';
    const items = candidates.map(c => ({ id: c.id, label: `Kandidat ${Number(c.number)}`, value: Number(state.tally[c.id] || 0), accent: c.accent }));
    items.push({ id: 'invalid', label: 'Rusak / Tidak Sah', value: totalInvalid(), accent: '#5e6c66' });
    $('quick-counters').innerHTML = items.map(item => `<div class="counter-card" style="--counter-accent:${esc(item.accent || '#14835a')}">
      <div><div class="counter-label">${esc(item.label)}</div><strong>${fmt.format(item.value)}</strong></div>
      <div class="counter-actions"><button class="mini-btn minus" data-quick-type="${esc(item.id)}" data-quick-delta="-1" ${locked ? 'disabled' : ''} aria-label="Kurangi 1 ${esc(item.label)}">−1</button><button class="mini-btn plus" data-quick-type="${esc(item.id)}" data-quick-delta="1" ${locked ? 'disabled' : ''} aria-label="Tambah 1 ${esc(item.label)}">+1</button></div>
    </div>`).join('');
    document.querySelectorAll('[data-quick-type]').forEach(btn => btn.addEventListener('click', () => quickAdjust(btn.dataset.quickType, Number(btn.dataset.quickDelta))));
  }

  function drawChart(candidates) {
    const canvas = $('vote-chart');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(320, Math.floor(rect.width || 640));
    const height = Math.max(260, Math.floor(rect.height || 320));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { left: 44, right: 12, top: 18, bottom: 58 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const values = candidates.map(c => Number(state.tally[c.id] || 0));
    const maxVal = Math.max(10, ...values);
    const ticks = 4;

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#7a8c83';
    ctx.strokeStyle = '#e2ece7';
    ctx.lineWidth = 1;
    for (let i = 0; i <= ticks; i++) {
      const y = pad.top + (plotH * i / ticks);
      const value = Math.round(maxVal * (1 - i / ticks));
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
      ctx.fillText(fmt.format(value), 3, y + 4);
    }

    const slot = plotW / candidates.length;
    const barW = Math.min(76, slot * 0.56);
    candidates.forEach((c, i) => {
      const value = values[i];
      const barH = value ? Math.max(3, (value / maxVal) * plotH) : 2;
      const x = pad.left + slot * i + (slot - barW) / 2;
      const y = pad.top + plotH - barH;
      ctx.fillStyle = c.accent || '#14835a';
      roundedRect(ctx, x, y, barW, barH, 10);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22352d';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(fmt.format(value), x + barW / 2, Math.max(14, y - 8));
      ctx.fillStyle = '#6a7b73';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`No. ${c.number}`, x + barW / 2, pad.top + plotH + 22);
      const name = String(c.name || '').slice(0, 15);
      ctx.fillText(name, x + barW / 2, pad.top + plotH + 39);
    });
    ctx.textAlign = 'start';
  }
  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function renderAdminFields() {
    $('setting-voters').value = state.config.totalVoters;
    $('setting-title').value = state.config.eventTitle;
    $('setting-subtitle').value = state.config.eventSubtitle;
    const enabled = !!state.currentUser && state.adminVerified;
    const locked = state.config.status === 'LOCKED';
    $('add-votes-btn').disabled = !enabled || locked;
    document.querySelectorAll('.quick-btn').forEach(btn => btn.disabled = !enabled || locked);
    $('apply-correction-btn').disabled = !enabled || locked;
    $('save-settings-btn').disabled = !enabled;
    $('lock-btn').disabled = !enabled;
    $('lock-btn').textContent = locked ? 'Buka kembali' : 'Kunci penghitungan';
    $('batch-amount').disabled = !enabled || locked;
    $('batch-type').disabled = !enabled || locked;
    $('correction-type').disabled = !enabled || locked;
    $('correction-delta').disabled = !enabled || locked;
    $('correction-reason').disabled = !enabled || locked;
  }
  function renderAudits() {
    const list = (state.audits || []).slice().sort((a, b) => Number(b.at || 0) - Number(a.at || 0)).slice(0, 30);
    $('audit-list').innerHTML = list.length ? list.map(a => `<div class="audit-item"><div class="audit-main"><div class="audit-title">${esc(a.action || 'Aktivitas')}</div><div class="audit-meta">${timeLabel(a.at)} • ${esc(a.by || 'superadmin')}${a.reason ? ` • ${esc(a.reason)}` : ''}</div></div><div class="audit-amount">${esc(a.amountLabel || '')}</div></div>`).join('') : '<div class="muted">Belum ada aktivitas.</div>';
  }
  function updateAdminVisibility() {
    const show = !!state.currentUser && state.adminVerified;
    $('admin-section').classList.toggle('hidden', !show);
    $('admin-login-section').classList.toggle('hidden', show);
    renderAll();
  }

  function addDemoAudit(action, amountLabel, reason) {
    state.audits.unshift({ action, amountLabel, reason: reason || '', by: 'superadmin', uid: 'demo', at: now() });
  }
  function applyLocalDelta(type, delta, action, reason) {
    const current = Number(state.tally[type] || 0);
    const next = current + delta;
    if (next < 0) throw new Error('Jumlah tidak boleh menjadi negatif.');
    const total = totalIncoming() + delta;
    if (total > Number(state.config.totalVoters)) throw new Error('Suara masuk tidak boleh melebihi total pemilih.');
    if (state.config.status === 'LOCKED') throw new Error('Penghitungan sedang dikunci.');
    state.tally[type] = next;
    state.tally.lastUpdatedAt = now();
    addDemoAudit(action, `${delta > 0 ? '+' : ''}${fmt.format(delta)}`, reason || '');
    demoPersist();
    renderAll();
  }
  function quickAdjust(type, delta) {
    perform(async () => {
      if (state.mode === 'demo') {
        applyLocalDelta(type, delta, `${delta > 0 ? 'Tambah' : 'Kurangi'} suara — ${type === 'invalid' ? 'rusak/tidak sah' : type}`);
      } else {
        await firebaseAdjust(type, delta, 'Kontrol cepat');
      }
    });
  }

  async function perform(fn) {
    try { await fn(); }
    catch (err) { console.error(err); alert(err && err.message ? err.message : 'Terjadi kesalahan.'); }
  }

  async function firebaseAdjust(type, delta, reason) {
    if (!state.db || !state.currentUser || !state.adminVerified) throw new Error('Sesi superadmin belum aktif.');
    const result = await state.db.ref('tally').transaction(current => {
      const t = current || { candidate1: 0, candidate2: 0, candidate3: 0, candidate4: 0, invalid: 0, lastUpdatedAt: 0 };
      if (state.config.status === 'LOCKED') return;
      const next = { ...t };
      const val = Number(next[type] || 0) + delta;
      if (val < 0) return;
      const incoming = CANDIDATE_IDS.reduce((s, id) => s + Number(next[id] || 0), 0) + Number(next.invalid || 0) - Number(next[type] || 0) + val;
      if (incoming > Number(state.config.totalVoters || 0)) return;
      next[type] = val;
      next.lastUpdatedAt = firebase.database.ServerValue.TIMESTAMP;
      return next;
    });
    if (!result.committed) throw new Error('Perubahan ditolak: cek status penghitungan, angka minimum, dan total pemilih.');
    await firebaseLog(`${delta > 0 ? 'Tambah' : 'Kurangi'} suara — ${type === 'invalid' ? 'rusak/tidak sah' : type}`, `${delta > 0 ? '+' : ''}${fmt.format(delta)}`, reason);
  }

  async function addBatch() {
    const amount = clampInt($('batch-amount').value, 1, 100000);
    if (amount == null) throw new Error('Jumlah suara tidak valid.');
    const type = $('batch-type').value;
    if (state.mode === 'demo') {
      applyLocalDelta(type, amount, `Tambah suara — ${type === 'invalid' ? 'rusak/tidak sah' : type}`);
    } else {
      await firebaseAdjust(type, amount, 'Input batch');
    }
  }

  async function applyCorrection() {
    const delta = clampInt($('correction-delta').value, -100000, 100000);
    const type = $('correction-type').value;
    const reason = $('correction-reason').value.trim();
    if (delta == null || delta === 0) throw new Error('Koreksi harus berupa angka selain 0.');
    if (!reason) throw new Error('Alasan koreksi wajib diisi.');
    if (state.mode === 'demo') {
      applyLocalDelta(type, delta, `Koreksi — ${type === 'invalid' ? 'rusak/tidak sah' : type}`, reason);
    } else {
      await firebaseAdjust(type, delta, `Koreksi: ${reason}`);
    }
    $('correction-delta').value = '';
    $('correction-reason').value = '';
  }

  async function saveSettings() {
    const totalVoters = clampInt($('setting-voters').value, 1, 100000);
    const eventTitle = $('setting-title').value.trim() || DEFAULT_CONFIG.eventTitle;
    const eventSubtitle = $('setting-subtitle').value.trim() || DEFAULT_CONFIG.eventSubtitle;
    if (totalVoters == null) throw new Error('Total pemilih tidak valid.');
    if (totalVoters < totalIncoming()) throw new Error('Total pemilih tidak boleh lebih kecil dari suara masuk saat ini.');
    if (state.mode === 'demo') {
      state.config = { ...state.config, totalVoters, eventTitle, eventSubtitle };
      addDemoAudit('Ubah setelan penghitungan', `Pemilih ${fmt.format(totalVoters)}`);
      demoPersist(); renderAll(); alert('Setelan tersimpan di mode demo.');
    } else {
      await state.db.ref('config').update({ totalVoters, eventTitle, eventSubtitle });
      await firebaseLog('Ubah setelan penghitungan', `Pemilih ${fmt.format(totalVoters)}`);
      alert('Setelan tersimpan.');
    }
  }

  async function toggleLock() {
    const next = state.config.status === 'LOCKED' ? 'OPEN' : 'LOCKED';
    const message = next === 'LOCKED' ? 'Kunci penghitungan? Input +1/−1 dan koreksi akan berhenti.' : 'Buka kembali penghitungan?';
    if (!window.confirm(message)) return;
    if (state.mode === 'demo') {
      state.config.status = next;
      addDemoAudit(next === 'LOCKED' ? 'Kunci penghitungan' : 'Buka kembali penghitungan', next);
      demoPersist(); renderAll();
    } else {
      await state.db.ref('config/status').set(next);
      await firebaseLog(next === 'LOCKED' ? 'Kunci penghitungan' : 'Buka kembali penghitungan', next);
    }
  }

  async function firebaseLog(action, amountLabel, reason) {
    const key = state.db.ref('audit').push().key;
    const userEmail = state.currentUser && state.currentUser.email ? state.currentUser.email : '';
    const username = userEmail.split('@')[0] || 'superadmin';
    const payload = { action, amountLabel, reason: reason || '', by: username, uid: state.currentUser.uid, at: firebase.database.ServerValue.TIMESTAMP };
    await state.db.ref(`audit/${key}`).set(payload);
  }

  async function loadFirebaseSDK() {
    if (window.firebase && window.firebase.apps) return;
    const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
    const files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-database-compat.js'];
    for (const file of files) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = base + file;
        s.async = false;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Gagal memuat Firebase SDK: ${file}`));
        document.head.appendChild(s);
      });
    }
  }

  async function initializeFirebase() {
    try {
      await loadFirebaseSDK();
      const config = window.PANGGUNGREJO_FIREBASE_CONFIG;
      const app = window.firebase.initializeApp(config);
      state.firebase = app;
      state.db = window.firebase.database();
      state.auth = window.firebase.auth();
      state.mode = 'firebase';
      clearBanner();
      state.db.ref('.info/connected').on('value', snap => setConnection(!!snap.val()));
      subscribeFirebasePublic();
      state.auth.onAuthStateChanged(async user => {
        if (!user) {
          state.currentUser = null; state.adminVerified = false; updateAdminVisibility(); return;
        }
        try {
          const adminSnap = await state.db.ref(`admins/${user.uid}`).once('value');
          if (!adminSnap.exists() || adminSnap.val().role !== 'superadmin') {
            state.currentUser = null; state.adminVerified = false;
            $('login-message').textContent = 'Akun terautentikasi tetapi belum terdaftar sebagai superadmin.';
            await state.auth.signOut();
            updateAdminVisibility();
            return;
          }
          state.currentUser = user; state.adminVerified = true;
          $('login-message').textContent = `Masuk sebagai ${user.email.split('@')[0]}.`;
          subscribeFirebaseAudit();
          updateAdminVisibility();
        } catch (err) {
          console.error(err);
          state.currentUser = null; state.adminVerified = false;
          $('login-message').textContent = 'Tidak dapat memeriksa hak akses superadmin.';
          updateAdminVisibility();
        }
      });
      $('public-note').textContent = 'Angka di halaman publik mengikuti rekap yang tersimpan pada Firebase Realtime Database.';
    } catch (err) {
      console.error(err);
      state.mode = 'demo';
      showBanner('Firebase belum berhasil dimuat. Aplikasi tetap tersedia dalam MODE DEMO; untuk hasil realtime, isi firebase-config.js dan deploy ulang.', 'warn');
      demoDefaultState();
      setConnection(false);
    }
  }

  function subscribeFirebasePublic() {
    state.db.ref('config').on('value', snap => { state.config = { ...DEFAULT_CONFIG, ...(snap.val() || {}) }; renderAll(); hideLoader(); });
    state.db.ref('candidates').on('value', snap => { state.candidates = snap.exists() ? snap.val() : DEFAULT_CANDIDATES; renderAll(); });
    state.db.ref('tally').on('value', snap => { state.tally = { ...state.tally, ...(snap.val() || {}) }; renderAll(); });
  }
  function subscribeFirebaseAudit() {
    state.db.ref('audit').on('value', snap => { state.audits = Object.values(snap.val() || {}); renderAudits(); });
  }

  async function loginFirebase(username, password) {
    if (!state.auth) throw new Error('Firebase Authentication belum siap.');
    const cred = await state.auth.signInWithEmailAndPassword(usernameToEmail(username), password);
    state.currentUser = cred.user;
  }
  function loginDemo(username, password) {
    if (username.toLowerCase() !== 'superadmin' || password !== 'admin12345') throw new Error('Mode demo: gunakan superadmin / admin12345.');
    state.currentUser = { uid: 'demo', email: 'superadmin@demo.local' };
    state.adminVerified = true;
    sessionStorage.setItem(DEMO_USER_KEY, '1');
    $('login-message').textContent = 'Mode demo: login berhasil.';
    updateAdminVisibility();
  }
  function logout() {
    if (state.mode === 'demo') {
      state.currentUser = null; state.adminVerified = false; sessionStorage.removeItem(DEMO_USER_KEY); updateAdminVisibility();
    } else if (state.auth) {
      state.auth.signOut();
    }
  }

  function bindUI() {
    $('year').textContent = new Date().getFullYear();
    $('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const username = $('login-username').value.trim();
      const password = $('login-password').value;
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
        $('login-message').textContent = 'Username hanya boleh memakai huruf, angka, titik, garis bawah, atau minus.';
        return;
      }
      $('login-message').textContent = 'Memproses login…';
      perform(async () => {
        if (state.mode === 'demo') loginDemo(username, password);
        else await loginFirebase(username, password);
      });
    });
    $('logout-btn').addEventListener('click', logout);
    $('add-votes-btn').addEventListener('click', () => perform(addBatch));
    document.querySelectorAll('.quick-btn').forEach(btn => btn.addEventListener('click', () => {
      $('batch-amount').value = btn.dataset.delta;
      perform(addBatch);
    }));
    $('save-settings-btn').addEventListener('click', () => perform(saveSettings));
    $('lock-btn').addEventListener('click', () => perform(toggleLock));
    $('apply-correction-btn').addEventListener('click', () => perform(applyCorrection));
    window.addEventListener('resize', () => drawChart(candidateList()));
  }

  function initDemo() {
    demoDefaultState();
    setConnection(false);
    showBanner('MODE DEMO aktif — data hanya tersimpan di browser ini. Login demo: superadmin / admin12345. Jangan dipakai untuk penghitungan resmi.', 'warn');
    if (sessionStorage.getItem(DEMO_USER_KEY) === '1') {
      state.currentUser = { uid: 'demo', email: 'superadmin@demo.local' };
      state.adminVerified = true;
      $('login-message').textContent = 'Mode demo: sesi superadmin dipulihkan.';
    }
    renderAll();
    updateAdminVisibility();
    hideLoader();
  }

  bindUI();
  if (hasFirebaseConfig()) {
    initializeFirebase();
  } else {
    initDemo();
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker:', err)));
  }
})();
