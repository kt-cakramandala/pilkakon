import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getDatabase, ref, onValue, update, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const CONFIG = window.APP_CONFIG;
if (!CONFIG || !CONFIG.firebaseConfig) {
  throw new Error("config.js belum dikonfigurasi.");
}

const firebaseApp = initializeApp(CONFIG.firebaseConfig);
const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

const stateRef = ref(db, CONFIG.statePath);
const numberFormatter = new Intl.NumberFormat("id-ID");
const percentFormatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

let currentState = {
  dpt: Number(CONFIG.defaultDpt || 1500),
  votes: { calon1: 0, calon2: 0, calon3: 0, calon4: 0, rusak: 0 },
  updatedAt: null
};
let currentCandidates = structuredClone(CONFIG.candidateDefaults);
let pollTimer = null;
let pollInFlight = false;
let pollETag = null;
let firebaseAdminListening = false;
let adminStateUnsubscribe = null;
let candidateCacheAt = 0;
let candidateCacheVersion = "";
let justLoggedIn = false;

const $ = (id) => document.getElementById(id);

function toast(title, message, type = "info") {
  const stack = $("toastStack");
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `<div><b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span></div>`;
  stack.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

function setBusy(show, text = "Memproses…") {
  $("busyText").textContent = text;
  $("busyOverlay").classList.toggle("hidden", !show);
}

function formatDateTime(timestamp) {
  if (!timestamp) return "–";
  const d = new Date(Number(timestamp));
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function normalizeState(data) {
  const dptRaw = Number(data?.dpt);
  const dpt = Number.isFinite(dptRaw) && dptRaw > 0 ? Math.floor(dptRaw) : Number(CONFIG.defaultDpt || 1500);
  const votes = data?.votes || {};
  return {
    dpt,
    votes: {
      calon1: Math.max(0, Number(votes.calon1) || 0),
      calon2: Math.max(0, Number(votes.calon2) || 0),
      calon3: Math.max(0, Number(votes.calon3) || 0),
      calon4: Math.max(0, Number(votes.calon4) || 0),
      rusak: Math.max(0, Number(votes.rusak) || 0)
    },
    updatedAt: data?.updatedAt || null,
    candidateVersion: data?.candidateVersion || null
  };
}

function totalsFromState(state) {
  const v = state.votes;
  const sah = v.calon1 + v.calon2 + v.calon3 + v.calon4;
  const masuk = sah + v.rusak;
  const safeDpt = Math.max(1, state.dpt);
  return {
    sah, masuk, rusak: v.rusak,
    participation: Math.min(100, (masuk / safeDpt) * 100),
    sahPct: masuk ? (sah / masuk) * 100 : 0,
    rusakPct: masuk ? (v.rusak / masuk) * 100 : 0
  };
}

function updateUI(state) {
  currentState = normalizeState(state);
  const t = totalsFromState(currentState);
  $("totalDpt").textContent = numberFormatter.format(currentState.dpt);
  $("totalMasuk").textContent = numberFormatter.format(t.masuk);
  $("totalSah").textContent = numberFormatter.format(t.sah);
  $("totalRusak").textContent = numberFormatter.format(t.rusak);
  $("persenMasuk").textContent = `${percentFormatter.format(t.participation)}% dari DPT`;
  $("persenSah").textContent = `${percentFormatter.format(t.sahPct)}% dari suara masuk`;
  $("persenRusak").textContent = `${percentFormatter.format(t.rusakPct)}% dari suara masuk`;
  $("progressBarFill").style.width = `${t.participation}%`;
  $("progressBarText").textContent = `${numberFormatter.format(t.masuk)} / ${numberFormatter.format(currentState.dpt)} (${percentFormatter.format(t.participation)}%)`;
  $("progressLeft").textContent = t.masuk >= currentState.dpt ? "DPT sudah mencapai batas suara masuk" : `Masih tersedia ${numberFormatter.format(Math.max(0, currentState.dpt - t.masuk))} suara DPT`;
  $("progressState").textContent = t.masuk === 0 ? "Belum dimulai" : (t.masuk >= currentState.dpt ? "Selesai" : "Sedang berjalan");
  $("lastUpdated").textContent = `Pembaruan: ${formatDateTime(currentState.updatedAt)}`;
  renderCandidateCards();
  renderChart(currentState);
  if (auth.currentUser) $("dptInput").value = currentState.dpt;
}

let voteChart;
function initChart() {
  const ctx = $("voteChart").getContext("2d");
  voteChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Calon 1", "Calon 2", "Calon 3", "Calon 4"],
      datasets: [{
        label: "Suara",
        data: [0,0,0,0],
        backgroundColor: ["#2563eb", "#059669", "#7c3aed", "#ea580c"],
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false }, tooltip: { callbacks: { label: c => ` ${numberFormatter.format(c.raw)} suara` } } },
      scales: {
        y: { beginAtZero:true, ticks:{ precision:0 }, grid:{ color:"#edf2f7" } },
        x: { grid:{ display:false } }
      },
      animation: { duration: 300 }
    }
  });
}
function renderChart(state) {
  if (!voteChart) return;
  voteChart.data.datasets[0].data = [state.votes.calon1, state.votes.calon2, state.votes.calon3, state.votes.calon4];
  voteChart.update();
}

function renderCandidateCards() {
  const t = totalsFromState(currentState);
  const host = $("candidateCards");
  host.innerHTML = currentCandidates.map((c) => {
    const value = currentState.votes[`calon${c.number}`] || 0;
    const pct = t.sah ? (value / t.sah) * 100 : 0;
    const photo = c.photoDataUrl ? `<img class="candidate-photo" src="${escapeHtml(c.photoDataUrl)}" alt="Foto ${escapeHtml(c.name)}" loading="lazy">` : `<div class="candidate-fallback">${c.number}</div>`;
    return `<article class="candidate-card"><span class="candidate-no">NO. ${String(c.number).padStart(2,"0")}</span><div class="candidate-top">${photo}<div><div class="candidate-name">${escapeHtml(c.name || `Calon ${c.number}`)}</div><div class="candidate-role">Calon Kepala Pekon</div></div></div><div class="candidate-votes">${numberFormatter.format(value)} <span style="font-size:12px;color:#94a3b8;font-weight:700">suara</span></div><div class="candidate-share"><span>Proporsi suara sah</span><span class="share-badge">${percentFormatter.format(pct)}%</span></div></article>`;
  }).join("");
}

function renderCandidateAdmin() {
  $("candidateAdminGrid").innerHTML = currentCandidates.map((c) => {
    const preview = c.photoDataUrl ? `<img id="preview-${c.id}" class="admin-preview" src="${escapeHtml(c.photoDataUrl)}" alt="Preview ${escapeHtml(c.name)}">` : `<div id="preview-${c.id}" class="admin-preview" style="display:grid;place-items:center;font-weight:900;color:#94a3b8">${String(c.number).padStart(2,"0")}</div>`;
    return `<div class="candidate-admin-card"><div>${preview}</div><div class="candidate-admin-form"><label class="field-label" for="name-${c.id}">Nama calon ${c.number}</label><input id="name-${c.id}" class="field-input" value="${escapeHtml(c.name)}" maxlength="80"><label class="upload-label">▣ Upload Foto<input id="photo-${c.id}" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="btn btn-primary btn-small" data-save-candidate="${c.id}" style="margin-top:8px">Simpan Profil</button><div class="candidate-upload-hint" id="hint-${c.id}" style="margin-top:5px;color:#64748b;font-size:10px">JPG/PNG/WebP · otomatis dikompres</div></div></div>`;
  }).join("");

  currentCandidates.forEach(c => {
    const input = $(`photo-${c.id}`);
    if (input) input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        const hint = $(`hint-${c.id}`);
        hint.textContent = `Foto siap disimpan · ${(dataUrl.length * 0.75 / 1024).toFixed(0)} KB aproksimasi`;
        const preview = $(`preview-${c.id}`);
        if (preview.tagName === "IMG") preview.src = dataUrl;
        else {
          const img = document.createElement("img"); img.id = `preview-${c.id}`; img.className = "admin-preview"; img.alt = `Preview ${c.name}`; img.src = dataUrl; preview.replaceWith(img);
        }
        input.dataset.optimized = dataUrl;
      } catch (err) {
        toast("Upload foto gagal", err.message || "Foto tidak dapat diproses.", "error");
      }
    });
  });
  $("candidateAdminGrid").querySelectorAll("[data-save-candidate]").forEach(btn => btn.addEventListener("click", () => saveCandidate(btn.dataset.saveCandidate)));
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("File yang dipilih bukan gambar.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran foto asli maksimal 8 MB.");
  const loadBitmap = async () => {
    if (window.createImageBitmap) return createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
      });
      return img;
    } finally { URL.revokeObjectURL(url); }
  };
  const bitmap = await loadBitmap();
  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha:false });
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let mime = "image/webp";
  let quality = 0.82;
  let output = canvas.toDataURL(mime, quality);
  if (!output.startsWith("data:image/webp")) { mime = "image/jpeg"; output = canvas.toDataURL(mime, quality); }
  while (output.length > CONFIG.maxPhotoDataUrlLength && quality > 0.48) {
    quality -= 0.07;
    output = canvas.toDataURL(mime, quality);
  }
  if (output.length > CONFIG.maxPhotoDataUrlLength) throw new Error("Foto masih terlalu besar setelah kompresi. Gunakan foto yang lebih ringan.");
  return output;
}

function setConnectionStatus(ok, message = null) {
  const dot = $("statusPing");
  const text = $("statusText");
  const badge = $("publicSyncBadge");
  if (ok) {
    dot.className = "status-dot status-dot-green";
    text.textContent = message || "Terhubung · data tersinkron";
    badge.innerHTML = `<span class="dot dot-green"></span><span>${CONFIG.publicSyncMode === "sdk" ? "Realtime push" : "Polling hemat kuota"}</span>`;
  } else {
    dot.className = "status-dot status-dot-amber";
    text.textContent = message || "Koneksi terganggu · mencoba ulang";
    badge.innerHTML = `<span class="dot dot-amber"></span><span>Mencoba ulang</span>`;
  }
}

function nextPollDelay() {
  const base = document.visibilityState === "hidden" ? CONFIG.publicHiddenPollMs : CONFIG.publicPollMs;
  return Math.max(4000, base + (Math.random() * 2 - 1) * CONFIG.publicPollJitterMs);
}
function schedulePublicPoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => { fetchPublicState().finally(schedulePublicPoll); }, nextPollDelay());
}

async function fetchPublicState(force = false) {
  if (pollInFlight) return;
  if (CONFIG.publicSyncMode === "sdk" && firebaseAdminListening === false) return;
  pollInFlight = true;
  try {
    const url = `${CONFIG.firebaseConfig.databaseURL.replace(/\/$/,"")}/${CONFIG.statePath}.json`;
    const headers = { "Cache-Control": "no-cache" };
    if (!force && pollETag) headers["If-None-Match"] = pollETag;
    const response = await fetch(url, { headers, cache:"no-store" });
    if (response.status === 304) {
      setConnectionStatus(true);
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tag = response.headers.get("ETag");
    if (tag) pollETag = tag;
    const data = await response.json();
    updateUI(data || {});
    if (data?.candidateVersion && String(data.candidateVersion) !== String(candidateCacheVersion)) {
      await loadCandidates(true, data.candidateVersion);
    }
    setConnectionStatus(true);
  } catch (err) {
    console.warn("Public sync error", err);
    setConnectionStatus(false);
  } finally {
    pollInFlight = false;
  }
}

function startPublicSync() {
  if (CONFIG.publicSyncMode === "sdk") {
    onValue(stateRef, snap => { updateUI(snap.val() || {}); setConnectionStatus(true, "Realtime push · Firebase"); }, err => { console.warn(err); setConnectionStatus(false); });
    firebaseAdminListening = true;
    return;
  }
  fetchPublicState(true).finally(schedulePublicPoll);
}

async function loadCandidates(force = false, versionOverride = null) {
  try {
    const cached = JSON.parse(localStorage.getItem("pru_candidates_cache") || "null");
    if (!force && cached && cached.at && Date.now() - cached.at < CONFIG.candidateCacheMs && Array.isArray(cached.data)) {
      currentCandidates = mergeCandidates(cached.data);
      candidateCacheAt = cached.at;
      candidateCacheVersion = versionOverride != null ? String(versionOverride) : (cached.version || "");
      renderCandidateCards(); renderCandidateAdmin();
      return;
    }
  } catch {}
  try {
    const response = await fetch(`${CONFIG.firebaseConfig.databaseURL.replace(/\/$/,"")}/${CONFIG.candidatesPath}.json`, { cache:"no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    currentCandidates = mergeCandidates(Object.values(data || {}));
    const version = versionOverride != null ? String(versionOverride) : (candidateCacheVersion || "");
    candidateCacheVersion = version;
    localStorage.setItem("pru_candidates_cache", JSON.stringify({ at:Date.now(), version, data:currentCandidates }));
    renderCandidateCards(); renderCandidateAdmin();
  } catch (err) {
    console.warn("Candidate load failed", err);
    currentCandidates = mergeCandidates(currentCandidates);
    renderCandidateCards(); renderCandidateAdmin();
  }
}

function mergeCandidates(items) {
  const byId = new Map(CONFIG.candidateDefaults.map(c => [c.id, {...c}]));
  (items || []).forEach(item => {
    if (!item) return;
    const id = String(item.id ?? "");
    const target = byId.get(id);
    if (target) { if (item.name != null) target.name = String(item.name); if (item.photoDataUrl != null) target.photoDataUrl = String(item.photoDataUrl); }
  });
  return [...byId.values()].sort((a,b) => a.number - b.number);
}

async function modifyVote(field, delta) {
  if (!auth.currentUser) { toast("Sesi tidak aktif", "Silakan login kembali.", "error"); return; }
  setBusy(true, delta > 0 ? "Menyimpan suara…" : "Menyimpan koreksi…");
  try {
    const updates = {};
    updates[`${CONFIG.statePath}/votes/${field}`] = increment(delta);
    updates[`${CONFIG.statePath}/updatedAt`] = serverTimestamp();
    await update(ref(db), updates);
    toast("Berhasil", delta > 0 ? "Suara berhasil ditambahkan." : "Koreksi berhasil disimpan.", "success");
  } catch (err) {
    console.error(err);
    toast("Gagal menyimpan", friendlyFirebaseError(err), "error");
  } finally { setBusy(false); }
}

async function saveDpt() {
  const value = Number($("dptInput").value);
  const totals = totalsFromState(currentState);
  if (!Number.isInteger(value) || value < 1 || value > 1000000) { toast("DPT tidak valid", "Masukkan angka bulat 1–1.000.000.", "error"); return; }
  if (value < totals.masuk) { toast("DPT tidak dapat disimpan", "DPT baru lebih kecil daripada jumlah suara yang sudah masuk.", "error"); return; }
  setBusy(true, "Menyimpan total DPT…");
  try {
    await update(ref(db), { [`${CONFIG.statePath}/dpt`]: value, [`${CONFIG.statePath}/updatedAt`]: serverTimestamp() });
    toast("DPT diperbarui", `Total DPT sekarang ${numberFormatter.format(value)}.`, "success");
  } catch (err) { toast("Gagal menyimpan DPT", friendlyFirebaseError(err), "error"); }
  finally { setBusy(false); }
}

async function saveCandidate(id) {
  if (!auth.currentUser) return toast("Sesi tidak aktif", "Login kembali untuk menyimpan profil.", "error");
  const name = $(`name-${id}`).value.trim();
  const fileInput = $(`photo-${id}`);
  if (!name) return toast("Nama calon kosong", "Isi nama calon terlebih dahulu.", "error");
  let photoDataUrl = currentCandidates.find(c => c.id === id)?.photoDataUrl || "";
  if (fileInput?.dataset.optimized) photoDataUrl = fileInput.dataset.optimized;
  setBusy(true, "Menyimpan profil kandidat…");
  try {
    const candidateNumber = Number(id);
    const payload = { id, number:candidateNumber, name, photoDataUrl, updatedAt:serverTimestamp() };
    await update(ref(db), {
      [`${CONFIG.candidatesPath}/${id}`]: payload,
      [`${CONFIG.statePath}/candidateVersion`]: serverTimestamp(),
      [`${CONFIG.statePath}/updatedAt`]: serverTimestamp()
    });
    currentCandidates = currentCandidates.map(c => c.id === id ? {...c, name, photoDataUrl} : c);
    candidateCacheVersion = String(Date.now());
    localStorage.setItem("pru_candidates_cache", JSON.stringify({ at:Date.now(), version:candidateCacheVersion, data:currentCandidates }));
    renderCandidateCards(); renderCandidateAdmin();
    toast("Profil tersimpan", `Profil Calon ${candidateNumber} sudah diperbarui.`, "success");
  } catch (err) {
    toast("Gagal menyimpan profil", friendlyFirebaseError(err), "error");
  } finally { setBusy(false); }
}

async function resetVotes() {
  if (!auth.currentUser) return;
  const ok = confirm("Reset semua perolehan suara menjadi 0? Tindakan ini tidak dapat dibatalkan dari aplikasi.");
  if (!ok) return;
  setBusy(true, "Mereset hasil suara…");
  try {
    await update(ref(db), {
      [`${CONFIG.statePath}/votes`]: {calon1:0,calon2:0,calon3:0,calon4:0,rusak:0},
      [`${CONFIG.statePath}/updatedAt`]: serverTimestamp()
    });
    toast("Hasil direset", "Seluruh perolehan suara kembali ke 0.", "success");
  } catch (err) { toast("Reset gagal", friendlyFirebaseError(err), "error"); }
  finally { setBusy(false); }
}

function friendlyFirebaseError(err) {
  const code = String(err?.code || "");
  if (code.includes("permission-denied")) return "Akses ditolak. Pastikan akun superadmin dan Firebase Security Rules sudah sesuai panduan.";
  if (code.includes("auth/network-request-failed")) return "Koneksi internet ke Firebase terputus. Periksa jaringan lalu coba lagi.";
  if (code.includes("auth/invalid-credential") || code.includes("auth/invalid-login-credentials")) return "Username atau password tidak benar.";
  return err?.message || "Terjadi kesalahan yang tidak diketahui.";
}

function showLoginModal() { $("loginError").classList.add("hidden"); $("loginModal").classList.remove("hidden"); $("username").focus(); }
function hideLoginModal() { $("loginModal").classList.add("hidden"); }

async function login() {
  const rawUser = $("username").value.trim();
  const password = $("password").value;
  if (!rawUser || !password) { showLoginError("Username dan password wajib diisi."); return; }
  const email = rawUser.includes("@") ? rawUser : rawUser + CONFIG.authDomainSuffix;
  setBusy(true, "Memverifikasi login…");
  try {
    justLoggedIn = true;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    justLoggedIn = false;
    console.error(err);
    showLoginError(friendlyFirebaseError(err));
  } finally { setBusy(false); }
}
function showLoginError(message) { $("loginError").textContent = message; $("loginError").classList.remove("hidden"); }

async function exportExcel() {
  if (!auth.currentUser) return toast("Login diperlukan", "Export hanya tersedia untuk Superadmin.", "error");
  setBusy(true, "Mempersiapkan Excel…");
  try {
    await loadScript(CONFIG.exportLibraries.exceljs, "ExcelJS");
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS) throw new Error("Library Excel tidak tersedia.");
    const t = totalsFromState(currentState);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Pilkades Panggungrejo Utara";
    wb.created = new Date();
    const ws = wb.addWorksheet("Hasil Pemilihan");
    ws.columns = [{header:"No",key:"no",width:8},{header:"Kategori",key:"category",width:28},{header:"Perolehan",key:"value",width:16},{header:"Persentase",key:"pct",width:16}];
    ws.addRow(["", CONFIG.appName, "", ""]); ws.addRow(["", `Wilayah: ${CONFIG.wilayahName}`, "", ""]); ws.addRow(["", `Waktu export: ${new Date().toLocaleString("id-ID")}`, "", ""]);
    ws.addRow([]);
    const rows = [
      [1,"Total DPT",currentState.dpt,1],
      [2,"Suara Masuk",t.masuk,t.participation/100],
      [3,"Suara Sah",t.sah,t.sahPct/100],
      [4,"Tidak Sah / Rusak",t.rusak,t.rusakPct/100],
      [5,currentCandidates[0]?.name || "Calon 1",currentState.votes.calon1,t.sah?currentState.votes.calon1/t.sah:0],
      [6,currentCandidates[1]?.name || "Calon 2",currentState.votes.calon2,t.sah?currentState.votes.calon2/t.sah:0],
      [7,currentCandidates[2]?.name || "Calon 3",currentState.votes.calon3,t.sah?currentState.votes.calon3/t.sah:0],
      [8,currentCandidates[3]?.name || "Calon 4",currentState.votes.calon4,t.sah?currentState.votes.calon4/t.sah:0]
    ];
    rows.forEach(r => ws.addRow(r));
    ws.getColumn("pct").numFmt = "0.0%";
    ws.getRow(5).font = {bold:true};
    ws.getRow(1).font = {bold:true,size:16};
    ws.autoFilter = { from:"A5", to:"D13" };
    ws.eachRow(row => row.alignment = {vertical:"middle"});
    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), `hasil-pilkades-panggungrejo-${fileStamp()}.xlsx`);
    toast("Export Excel berhasil", "File .xlsx sudah dibuat di perangkat Anda.", "success");
  } catch (err) { console.error(err); toast("Export Excel gagal", err.message || "Tidak dapat membuat file.", "error"); }
  finally { setBusy(false); }
}

async function exportPdf() {
  if (!auth.currentUser) return toast("Login diperlukan", "Export hanya tersedia untuk Superadmin.", "error");
  setBusy(true, "Mempersiapkan PDF…");
  try {
    await loadScript(CONFIG.exportLibraries.jspdf, "jspdf");
    await loadScript(CONFIG.exportLibraries.autotable, "jspdfAutoTable");
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error("Library PDF tidak tersedia.");
    const t = totalsFromState(currentState);
    const doc = new jsPDF({unit:"mm",format:"a4"});
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.text("HASIL PERHITUNGAN SUARA", 15, 17);
    doc.setFontSize(11); doc.setFont("helvetica","normal"); doc.text(CONFIG.pekonName, 15, 24); doc.text(`Wilayah: ${CONFIG.wilayahName}`, 15, 30);
    doc.setFontSize(9); doc.setTextColor(100); doc.text(`Export: ${new Date().toLocaleString("id-ID")}`, 15, 36); doc.setTextColor(20);
    const body = [
      ["Total DPT", numberFormatter.format(currentState.dpt), "100,0%"],
      ["Suara Masuk", numberFormatter.format(t.masuk), `${percentFormatter.format(t.participation)}%`],
      ["Suara Sah", numberFormatter.format(t.sah), `${percentFormatter.format(t.sahPct)}%`],
      ["Tidak Sah / Rusak", numberFormatter.format(t.rusak), `${percentFormatter.format(t.rusakPct)}%`],
      ...currentCandidates.map(c => [c.name, numberFormatter.format(currentState.votes[`calon${c.number}`]), `${percentFormatter.format(t.sah ? currentState.votes[`calon${c.number}`]/t.sah*100 : 0)}%`])
    ];
    doc.autoTable({startY:42, head:[["Komponen","Perolehan","Persentase"]], body, theme:"grid", styles:{fontSize:9,cellPadding:2.8}, headStyles:{fillColor:[30,58,138]}});
    let finalY = doc.lastAutoTable?.finalY || 90;
    doc.setFontSize(9); doc.setTextColor(100); doc.text("Catatan: suara sah = Calon 1–4. Suara masuk = suara sah + tidak sah/rusak.",15,finalY+10);
    doc.save(`hasil-pilkades-panggungrejo-${fileStamp()}.pdf`);
    toast("Export PDF berhasil", "File .pdf siap dicetak atau dibagikan.", "success");
  } catch (err) { console.error(err); toast("Export PDF gagal", err.message || "Tidak dapat membuat file.", "error"); }
  finally { setBusy(false); }
}

function fileStamp() { const d = new Date(); const pad=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`; }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
function loadScript(src, globalName) { return new Promise((resolve,reject) => { if (window[globalName]) return resolve(); const s=document.createElement("script"); s.src=src; s.async=true; s.onload=()=>resolve(); s.onerror=()=>reject(new Error(`Tidak dapat memuat library ${globalName}.`)); document.head.appendChild(s); }); }

function bindEvents() {
  $("btnLoginModal").addEventListener("click", showLoginModal);
  $("closeModal").addEventListener("click", hideLoginModal);
  $("submitLogin").addEventListener("click", login);
  $("password").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  $("username").addEventListener("keydown", e => { if (e.key === "Enter") $("password").focus(); });
  $("loginModal").addEventListener("click", e => { if (e.target === $("loginModal")) hideLoginModal(); });
  $("btnLogout").addEventListener("click", async () => { await signOut(auth); toast("Logout berhasil", "Sesi Superadmin sudah ditutup.", "info"); });
  $("btnManualRefresh").addEventListener("click", () => fetchPublicState(true));

  ["btnC1","btnC2","btnC3","btnC4","btnRusak"].forEach((id, idx) => $(id).addEventListener("click", () => modifyVote(["calon1","calon2","calon3","calon4","rusak"][idx],1)));
  ["btnDecC1","btnDecC2","btnDecC3","btnDecC4","btnDecRusak"].forEach((id, idx) => $(id).addEventListener("click", () => modifyVote(["calon1","calon2","calon3","calon4","rusak"][idx],-1)));
  $("btnReset").addEventListener("click", resetVotes);
  $("btnSaveDpt").addEventListener("click", saveDpt);
  $("btnExportExcel").addEventListener("click", exportExcel);
  $("btnExportPdf").addEventListener("click", exportPdf);
  document.addEventListener("visibilitychange", () => { if (CONFIG.publicSyncMode === "poll") schedulePublicPoll(); });
}

onAuthStateChanged(auth, async user => {
  if (user) {
    $("adminPanel").classList.remove("hidden");
    $("btnLoginModal").classList.add("hidden");
    $("btnLogout").classList.remove("hidden");
    $("adminIdentity").textContent = user.email || "Superadmin";
    $("dptInput").value = currentState.dpt;
    renderCandidateAdmin();
    if (justLoggedIn) {
      toast("Login berhasil", `Selamat datang, ${user.email || "Superadmin"}.`, "success");
      justLoggedIn = false;
    }
    // Admin selalu mendapatkan push realtime. Pada mode poll publik, listener ini hanya dipakai oleh Superadmin.
    if (CONFIG.publicSyncMode !== "sdk" && !adminStateUnsubscribe) {
      adminStateUnsubscribe = onValue(stateRef, snap => updateUI(snap.val() || {}), err => toast("Realtime admin terganggu", err.message || "Koneksi Firebase terputus.", "error"));
    }
    if (CONFIG.publicSyncMode === "poll") fetchPublicState(true);
  } else {
    adminStateUnsubscribe?.();
    adminStateUnsubscribe = null;
    $("adminPanel").classList.add("hidden");
    $("btnLoginModal").classList.remove("hidden");
    $("btnLogout").classList.add("hidden");
    if (CONFIG.publicSyncMode === "sdk" && !firebaseAdminListening) startPublicSync();
  }
});

$("electionYearLabel").textContent = CONFIG.electionYear;
$("footerYear").textContent = new Date().getFullYear();
$("dptInput").value = CONFIG.defaultDpt;
initChart();
updateUI({ dpt: CONFIG.defaultDpt, votes:{calon1:0,calon2:0,calon3:0,calon4:0,rusak:0} });
renderCandidateCards();
renderCandidateAdmin();
bindEvents();
loadCandidates();
startPublicSync();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW failed", err)));
}
