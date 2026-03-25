// app.js — GTIN + PO lookup
// Uses: window.parseGS1 from gs1.js
// Loads: data/products.json (your repo table)
// Redirects: record.page?id=record.id

const DEBUG = false;

const modal = document.getElementById("scannerModal");
const openLink = document.getElementById("scan-link");
const closeBtn = document.getElementById("closeModal");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas?.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraSelect = document.getElementById("cameraSelect");
const fileInput = document.getElementById("fileInput");

const decodedRaw = document.getElementById("decodedRaw");
const resultTable = document.getElementById("resultTable");

const hidInput = document.getElementById("hidInput");
const hidParseBtn = document.getElementById("hidParseBtn");
const hidClearBtn = document.getElementById("hidClearBtn");
const decodedRawHID = document.getElementById("decodedRawHID");
const resultTableHID = document.getElementById("resultTableHID");

// ---------- Modal ----------
function openModal() {
  modal?.setAttribute("aria-hidden", "false");
  enumerateCameras();
}
function closeModal() {
  modal?.setAttribute("aria-hidden", "true");
  stopCamera();
}
openLink?.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
closeBtn?.addEventListener("click", () => closeModal());

// Tabs (same class names as your HTML)
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tabpane").forEach(p => p.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(t.dataset.tab)?.classList.add("active");
  });
});

// ---------- Product table ----------
let productTable = [];
let tableLoaded = false;

async function loadProductTable() {
  if (tableLoaded) return;
  const res = await fetch("data/products.json");
  if (!res.ok) throw new Error("Could not load data/products.json");
  const data = await res.json();
  productTable = Array.isArray(data) ? data : (data.items || []);
  tableLoaded = true;
}

function normalizeGTIN(v) {
  return String(v || "").replace(/\D/g, "").padStart(14, "0");
}
function normalizePO(v) {
  // IMPORTANT: strip any leftover parentheses or punctuation
  return String(v || "").replace(/[()]/g, "").trim().toUpperCase();
}

function buildKeyFromParsed(parsed) {
  const gtin = normalizeGTIN(parsed.gtin || parsed["01"]);
  const po = normalizePO(parsed.po || parsed["400"]);
  return { gtin, po, key: `${gtin}|${po}` };
}

function recordKey(r) {
  if (r.key) return String(r.key).trim();
  const gtin = normalizeGTIN(r.gtin);
  const po = normalizePO(r.po);
  return `${gtin}|${po}`;
}

function setStatus(el, msg) {
  if (el) el.textContent = msg;
}

async function lookupAndRedirect(parsed) {
  await loadProductTable();

  const { gtin, po, key } = buildKeyFromParsed(parsed);

  if (!gtin || gtin.length !== 14) throw new Error("Invalid/missing GTIN (AI 01).");
  if (!po) throw new Error("Missing PO (AI 400).");

  const rec = productTable.find(r => recordKey(r) === key);
  if (!rec) throw new Error(`No match found for scanned key: ${key}`);

  const page = rec.page || "K87.html";
  const id = rec.id || "";
  window.location.href = `${page}?id=${encodeURIComponent(id)}`;
}

// Optional debug render
function renderDebug(parsed, raw, tableEl) {
  if (!DEBUG || !tableEl) return;
  const rows = [];
  const add = (k, v) => { if (v) rows.push(`<tr><td>${k}</td><td>${v}</td></tr>`); };
  add("GTIN (01)", parsed.gtin || parsed["01"]);
  add("PO (400)", parsed.po || parsed["400"]);
  add("COO (422)", parsed["422"]);
  add("QTY (30)", parsed.qty || parsed["30"]);
  add("STYLE (240)", parsed.style || parsed["240"]);
  add("RAW", raw);
  tableEl.innerHTML = rows.join("");
}

// ---------- ZXing ----------
let stream = null;
let scanning = false;
let rafId = null;

async function ensureZXingReady() {
  if (ZXingWASM?.ready) await ZXingWASM.ready;
}

async function enumerateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter(d => d.kind === "videoinput");
    if (!cameraSelect) return;
    cameraSelect.innerHTML = "";
    vids.forEach((d, idx) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `Camera ${idx + 1}`;
      cameraSelect.appendChild(o);
    });
  } catch { }
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraSelect?.value ? { exact: cameraSelect.value } : undefined,
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    scanning = true;
    setStatus(decodedRaw, "Ready to scan…");
    scanLoop();
  } catch (e) {
    alert("Unable to start camera: " + e.message);
  }
}

function stopCamera() {
  scanning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

startBtn?.addEventListener("click", startCamera);
stopBtn?.addEventListener("click", stopCamera);

async function scanLoop() {
  if (!scanning) return;

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const tw = 640;
  const th = Math.round((vh / vw) * tw);

  canvas.width = tw;
  canvas.height = th;
  ctx.drawImage(video, 0, 0, tw, th);

  const img = ctx.getImageData(0, 0, tw, th);

  try {
    await ensureZXingReady();
    const results = await ZXingWASM.readBarcodes(img, { tryHarder: true, formats: ["DataMatrix"] });
    if (results?.length) handleScanText(results[0].text || "");
  } catch { }

  rafId = requestAnimationFrame(scanLoop);
}

// Upload Image
fileInput?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(decodedRaw, "Decoding image…");
  try {
    await ensureZXingReady();
    const ab = await f.arrayBuffer();
    const results = await ZXingWASM.readBarcodes(new Uint8Array(ab), { tryHarder: true, formats: ["DataMatrix","QRCode","PDF417"] });
    if (results?.length) handleScanText(results[0].text || "");
    else setStatus(decodedRaw, "No barcode found in image.");
  } catch (err) {
    setStatus(decodedRaw, "No barcode found in image.");
  }
});

function handleScanText(text) {
  setStatus(decodedRaw, "Searching product table…");

  const parsed = window.parseGS1 ? window.parseGS1(text) : {};
  lookupAndRedirect(parsed).catch(err => {
    setStatus(decodedRaw, `Scan not accepted: ${err.message}`);
    renderDebug(parsed, text, resultTable);
  });

  // Pause briefly to avoid rapid repeats
  scanning = false;
  setTimeout(() => { scanning = true; scanLoop(); }, 1200);
}

// HID mode
hidInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); parseHID(hidInput.value); }
});
hidParseBtn?.addEventListener("click", () => parseHID(hidInput.value));
hidClearBtn?.addEventListener("click", () => {
  hidInput.value = "";
  decodedRawHID.textContent = "";
  resultTableHID.innerHTML = "";
});

function parseHID(raw) {
  setStatus(decodedRawHID, "Searching product table…");
  const parsed = window.parseGS1 ? window.parseGS1(raw) : {};
  lookupAndRedirect(parsed).catch(err => {
    setStatus(decodedRawHID, `Scan not accepted: ${err.message}`);
    renderDebug(parsed, raw, resultTableHID);
  });
}

// init
window.addEventListener("DOMContentLoaded", async () => {
  try { await loadProductTable(); } catch { }
  await enumerateCameras();
});
