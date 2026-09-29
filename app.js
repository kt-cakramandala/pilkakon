import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, ref, onValue, runTransaction, update, push, serverTimestamp, get, onDisconnect } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, ADMIN_EMAIL_DOMAIN } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const DEFAULT_CONFIG = {
  eventTitle: "Pemilihan Kepala Pekon Panggungrejo Utara",
  eventSubtitle: "Hasil sementara diperbarui secara realtime.",
  totalVoters: 1500,
  status: "OPEN",
  electionDate: ""
};

const DEFAULT_CANDIDATES = [
  { id: "candidate1", number: 1, name: "Kandidat 1", photoUrl: "assets/kandidat-1.svg", accent: "#1f8a70" },
  { id: "candidate2", number: 2, name: "Kandidat 2", photoUrl: "assets/kandidat-2.svg", accent: "#3d6dcc" },
  { id: "candidate3", number: 3, name: "Kandidat 3", photoUrl: "assets/kandidat-3.svg", accent: "#d08a2e" },
  { id: "candidate4", number: 4, name: "Kandidat 4", photoUrl: "assets/kandidat-4.svg", accent: "#9a4f92" }
];

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat("id-ID");
const state = { config: { ...DEFAULT_CONFIG }, candidates: DEFAULT_CANDIDATES, tally: {}, audits: [], currentUser: null, presenceKey: null };
const candidateIds = DEFAULT_CANDIDATES.map(c => c.id);

function hideLoader() { const el = $("app-loader"); el.style.opacity = "0"; setTimeout(() => el.classList.add("hidden"), 280); }
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function normalizeUsername(username) { return String(username).trim().toLowerCase(); }
function usernameToEmail(username) { return `${normalizeUsername(username)}@${ADMIN_EMAIL_DOMAIN}`; }
function formatTime(value) { if (!value) return "—"; return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)); }
function setConnection(online) { const pill = $("connection-pill"); pill.classList.toggle("online", online); pill.classList.toggle("offline", !online); $("connection-text").textContent = online ? "Realtime aktif" : "Offline / menunggu koneksi"; }

function candidateMap() {
  const fromDb = state.candidates;
  if (Array.isArray(fromDb)) return fromDb.filter(Boolean);
  return Object.values(fromDb || {}).filter(Boolean).sort((a,b) => Number(a.number)-Number(b.number));
}

function renderCandidates() {
  const candidates = candidateMap();
  const valid = candidateIds.reduce((sum, id) => sum + Number(state.tally?.[id] || 0), 0);
  const rows = candidates.map((c) => {
    const votes = Number(state.tally?.[c.id] || 0);
    const share = valid ? (votes / valid) * 100 : 0;
    const width = valid ? Math.max(0, Math.min(100, share)) : 0;
    return `<div class="candidate-row"><img class="candidate-photo" src="${esc(c.photoUrl || '')}" alt="Foto ${esc(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/kandidat-${Number(c.number)}.svg'"><div class="candidate-meta"><div class="candidate-number">Nomor urut ${esc(c.number)}</div><div class="candidate-name">${esc(c.name)}</div><div class="bar-bg"><div class="bar-fg" style="width:${width}%;background:${esc(c.accent || '#0f7a4b')}"></div></div></div><div class="candidate-score"><div class="candidate-votes">${fmt.format(votes)}</div><div class="candidate-share">${share.toFixed(2)}%</div></div></div>`;
  }).join("");
  $("candidate-results").innerHTML = rows || "<div class='muted'>Data kandidat belum dikonfigurasi.</div>";
  $("chart-legend").innerHTML = candidates.map(c => `<div class="legend-item"><span class="legend-dot" style="background:${esc(c.accent || '#0f7a4b')}"></span><span>No. ${esc(c.number)} — ${esc(c.name)}</span></div>`).join("");
  drawChart(candidates, valid);
}

function drawChart(candidates, valid) {
  const canvas = $("vote-chart"); const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio)); canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  const pad = { l: 36, r: 14, t: 18, b: 50 }, w = rect.width - pad.l - pad.r, h = rect.height - pad.t - pad.b;
  const values = candidates.map(c => Number(state.tally?.[c.id] || 0));
  const maxVal = Math.max(10, ...values);
  const ticks = 4;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#7a8c83"; ctx.strokeStyle = "#e7efeb"; ctx.lineWidth = 1;
  for (let i=0;i<=ticks;i++) { const y=pad.t+(h*i/ticks); const value=Math.round(maxVal*(1-i/ticks)); ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();ctx.fillText(fmt.format(value),2,y+4); }
  const slot = w / Math.max(1,candidates.length), bar = Math.min(72, slot*.58);
  candidates.forEach((c,i)=>{ const value=values[i]; const bh=maxVal?Math.max(2,(value/maxVal)*h):2; const x=pad.l+i*slot+(slot-bar)/2; const y=pad.t+h-bh; ctx.fillStyle=c.accent || "#0f7a4b"; roundRect(ctx,x,y,bar,bh,10); ctx.fill(); ctx.fillStyle="#22352d"; ctx.textAlign="center"; ctx.font="700 12px Inter, system-ui, sans-serif"; ctx.fillText(fmt.format(value),x+bar/2,Math.max(14,y-8)); ctx.fillStyle="#6a7b73";ctx.font="11px Inter, system-ui, sans-serif";ctx.fillText(`No. ${c.number}`,x+bar/2,pad.t+h+23); ctx.fillText(String(c.name).slice(0,16),x+bar/2,pad.t+h+39); });
  ctx.textAlign="start";
}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}

function renderAll() {
  const c = state.config || DEFAULT_CONFIG, t = state.tally || {};
  const voters = Number(c.totalVoters || 0);
  const valid = candidateIds.reduce((s,id)=>s+Number(t[id]||0),0);
  const invalid = Number(t.invalid || 0);
  const incoming = valid + invalid;
  const participation = voters ? Math.min(100, incoming / voters * 100) : 0;
  $("event-title").textContent = c.eventTitle || DEFAULT_CONFIG.eventTitle;
  $("event-subtitle").textContent = c.eventSubtitle || DEFAULT_CONFIG.eventSubtitle;
  $("total-voters").textContent = fmt.format(voters);
  $("votes-in").textContent = fmt.format(incoming);
  $("valid-votes").textContent = fmt.format(valid);
  $("invalid-votes").textContent = fmt.format(invalid);
  $("participation").textContent = `${participation.toFixed(1)}%`;
  $("participation-label").textContent = `${fmt.format(incoming)} / ${fmt.format(voters)}`;
  $("participation-fill").style.width = `${participation}%`;
  $("last-updated").textContent = formatTime(t.lastUpdatedAt || null);
  const open = c.status !== "LOCKED";
  $("event-status").textContent = open ? "PERHITUNGAN BERLANGSUNG" : "PENGHITUNGAN DIKUNCI";
  $("public-status-box").textContent = open ? "Status: terbuka untuk input" : "Status: terkunci — hasil tidak menerima input baru";
  $("lock-btn").textContent = open ? "Kunci penghitungan" : "Buka kembali penghitungan";
  $("lock-btn").classList.toggle("warn", open); $("lock-btn").classList.toggle("primary", !open);
  renderCandidates();
  renderAdminFields();
  renderAudits();
}

function renderAdminFields() {
  $("setting-voters").value = state.config?.totalVoters ?? DEFAULT_CONFIG.totalVoters;
  $("setting-title").value = state.config?.eventTitle ?? DEFAULT_CONFIG.eventTitle;
  $("setting-subtitle").value = state.config?.eventSubtitle ?? DEFAULT_CONFIG.eventSubtitle;
  const locked = state.config?.status === "LOCKED";
  $("add-votes-btn").disabled = !state.currentUser || locked;
  document.querySelectorAll(".quick-btn").forEach(b => b.disabled = !state.currentUser || locked);
  $("apply-correction-btn").disabled = !state.currentUser || locked;
  $("save-settings-btn").disabled = !state.currentUser;
  $("lock-btn").disabled = !state.currentUser;
}

function renderAudits() {
  const audits = state.audits || [];
  const html = audits.slice().sort((a,b)=>Number(b.at||0)-Number(a.at||0)).slice(0,30).map(a => `<div class="audit-item"><div class="audit-main"><div class="audit-title">${esc(a.action || 'Aktivitas')}</div><div class="audit-meta">${formatTime(a.at)} • ${esc(a.by || 'superadmin')}${a.reason ? ` • ${esc(a.reason)}` : ''}</div></div><div class="audit-amount">${esc(a.amountLabel || '')}</div></div>`).join("");
  $("audit-list").innerHTML = html || "<div class='muted'>Belum ada aktivitas.</div>";
}

async function logAudit(action, amountLabel, reason="") {
  const uid = state.currentUser?.uid || "unknown";
  const username = state.currentUser?.displayName || state.currentUser?.email?.split("@")[0] || "superadmin";
  const key = push(ref(db,"audit")).key;
  await update(ref(db), {[`audit/${key}`]: { action, amountLabel, reason, by: username, uid, at: serverTimestamp() }});
}

async function addVotes(type, amount) {
  amount = Math.trunc(Number(amount));
  if (!Number.isFinite(amount) || amount < 1) throw new Error("Jumlah suara harus lebih dari 0.");
  const result = await runTransaction(ref(db,"tally"), current => {
    const t = current || {};
    const cfg = state.config || DEFAULT_CONFIG;
    const existingIn = candidateIds.reduce((s,id)=>s+Number(t[id]||0),0) + Number(t.invalid||0);
    if (cfg.status === "LOCKED") return;
    if (existingIn + amount > Number(cfg.totalVoters||0)) return;
    return { ...t, [type]: Number(t[type]||0)+amount, lastUpdatedAt: Date.now() };
  });
  if (!result.committed) throw new Error("Data tidak berubah. Pastikan penghitungan masih terbuka dan tidak melebihi total pemilih.");
  await logAudit(`Tambah suara — ${type === 'invalid' ? 'rusak/tidak sah' : type}`, `+${fmt.format(amount)}`);
}

async function applyCorrection(type, delta, reason) {
  delta = Math.trunc(Number(delta));
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Koreksi harus berupa angka bukan 0.");
  if (!String(reason).trim()) throw new Error("Alasan koreksi wajib diisi.");
  const result = await runTransaction(ref(db,"tally"), current => {
    const t = current || {};
    const cfg = state.config || DEFAULT_CONFIG;
    if (cfg.status === "LOCKED") return;
    const next = { ...t, [type]: Math.max(0, Number(t[type]||0)+delta), lastUpdatedAt: Date.now() };
    const incoming = candidateIds.reduce((s,id)=>s+Number(next[id]||0),0) + Number(next.invalid||0);
    if (incoming > Number(cfg.totalVoters||0)) return;
    return next;
  });
  if (!result.committed) throw new Error("Koreksi gagal atau akan membuat total suara tidak valid.");
  await logAudit(`Koreksi — ${type === 'invalid' ? 'rusak/tidak sah' : type}`, `${delta>0?'+':''}${fmt.format(delta)}`, reason.trim());
}

async function saveSettings() {
  const totalVoters = Math.trunc(Number($("setting-voters").value));
  const eventTitle = $("setting-title").value.trim(); const eventSubtitle = $("setting-subtitle").value.trim();
  if (!Number.isFinite(totalVoters) || totalVoters < 1) throw new Error("Total pemilih tidak valid.");
  const currentIn = candidateIds.reduce((s,id)=>s+Number(state.tally?.[id]||0),0)+Number(state.tally?.invalid||0);
  if (totalVoters < currentIn) throw new Error("Total pemilih tidak boleh lebih kecil dari suara masuk saat ini.");
  await update(ref(db,"config"), { totalVoters, eventTitle: eventTitle || DEFAULT_CONFIG.eventTitle, eventSubtitle: eventSubtitle || DEFAULT_CONFIG.eventSubtitle });
  await logAudit("Ubah setelan penghitungan", `Pemilih ${fmt.format(totalVoters)}`);
}

async function toggleLock() {
  const locked = state.config?.status === "LOCKED";
  const next = locked ? "OPEN" : "LOCKED";
  const ok = confirm(next === "LOCKED" ? "Kunci penghitungan? Setelah dikunci, tombol input dan koreksi akan berhenti." : "Buka kembali penghitungan?");
  if (!ok) return;
  await update(ref(db,"config"), { status: next });
  await logAudit(next === "LOCKED" ? "Kunci penghitungan" : "Buka kembali penghitungan", next);
}

async function handleLogin(e) {
  e.preventDefault();
  $("login-message").textContent = "Memproses login…";
  try {
    const username = normalizeUsername($("login-username").value);
    const password = $("login-password").value;
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username hanya boleh berisi huruf, angka, titik, garis bawah, dan minus.");
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    state.currentUser = cred.user; $("login-message").textContent = "Login berhasil.";
  } catch (err) {
    console.error(err); $("login-message").textContent = "Login gagal. Periksa username/password atau akun Firebase.");
  }
}

function bindUI() {
  $("login-form").addEventListener("submit", handleLogin);
  $("logout-btn").addEventListener("click", () => signOut(auth));
  $("add-votes-btn").addEventListener("click", async () => { try { await addVotes($("batch-type").value, $("batch-amount").value); } catch(e){ alert(e.message); } });
  document.querySelectorAll(".quick-btn").forEach(b => b.addEventListener("click", async () => { $("batch-amount").value = b.dataset.delta; try { await addVotes($("batch-type").value, b.dataset.delta); } catch(e){ alert(e.message); } }));
  $("save-settings-btn").addEventListener("click", async () => { try { await saveSettings(); alert("Setelan tersimpan."); } catch(e){ alert(e.message); } });
  $("lock-btn").addEventListener("click", async () => { try { await toggleLock(); } catch(e){ alert(e.message); } });
  $("apply-correction-btn").addEventListener("click", async () => { try { await applyCorrection($("correction-type").value, $("correction-delta").value, $("correction-reason").value); $("correction-delta").value="";$("correction-reason").value=""; alert("Koreksi diterapkan dan dicatat pada audit."); } catch(e){ alert(e.message); } });
  window.addEventListener("resize", ()=>drawChart(candidateMap(), candidateIds.reduce((s,id)=>s+Number(state.tally?.[id]||0),0)));
  $("year").textContent = new Date().getFullYear();
}

function subscribePublic() {
  onValue(ref(db,"config"), snap => { state.config = { ...DEFAULT_CONFIG, ...(snap.val() || {}) }; renderAll(); hideLoader(); setConnection(true); }, err => { console.error(err); hideLoader(); setConnection(false); });
  onValue(ref(db,"candidates"), snap => { if (snap.exists()) state.candidates = snap.val(); else state.candidates = DEFAULT_CANDIDATES; renderAll(); });
  onValue(ref(db,"tally"), snap => { state.tally = snap.val() || {}; renderAll(); });
  onValue(ref(db,".info/connected"), snap => { setConnection(!!snap.val()); if (auth.currentUser && snap.val()) maybePresence(); });
}

function subscribeAdmin() {
  onValue(ref(db,"audit"), snap => { state.audits = Object.values(snap.val() || {}); renderAudits(); });
}

async function maybePresence() {
  if (!state.currentUser || state.presenceKey) return;
  state.presenceKey = state.currentUser.uid;
  await update(ref(db,`presence/${state.currentUser.uid}`), { online: true, at: serverTimestamp() }).catch(()=>{});
  onDisconnect(ref(db,`presence/${state.currentUser.uid}`)).set({ online:false, at:serverTimestamp() }).catch(()=>{});
}

onAuthStateChanged(auth, user => {
  state.currentUser = user;
  const show = !!user;
  $("admin-section").classList.toggle("hidden", !show);
  $("admin-login-section").classList.toggle("hidden", show);
  $("login-message").textContent = show ? `Masuk sebagai ${user.email?.split("@")[0] || 'superadmin'}.` : "";
  renderAll();
  if (show) { subscribeAdmin(); maybePresence(); }
});

bindUI();
subscribePublic();

if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW registration failed", err))); }
