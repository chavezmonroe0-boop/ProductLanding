// app.js
// Scan -> parse GS1 -> validate GTIN(01) + PO(400) -> search data/products.json -> redirect to record.page?id=record.id
// No immediate decoded data display (status only unless DEBUG is enabled)

const DEBUG = false; // set true to show decoded/parsed data on failures

// Modal
const modal = document.getElementById("scannerModal");
const openLink = document.getElementById("scan-link");
const closeBtn = document.getElementById("closeModal");

function openModal() {
  modal?.setAttribute("aria-hidden", "false");
  enumerateCameras();
}
function closeModal() {
  modal?.setAttribute("aria-hidden", "true");
  stopCamera();
}

openLink?.addEventListener("click", (e) => {
  e.preventDefault();
  openModal();
});
closeBtn?.addEventListener("click", () => closeModal());

// Tabs
const tabs = document.querySelectorAll(".tab");
const panes = document.querySelectorAll(".tabpane");
tabs.forEach((t) =>
  t.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    panes.forEach((p) => p.classList.remove("active"));
    t.classList.add("active");
    document.getElementById(t.dataset.tab)?.classList.add("active");
  })
);

// Camera scanning
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas?.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraSelect = document.getElementById("cameraSelect");
const fileInput = document.getElementById("fileInput");

const resultTable = document.getElementById("resultTable");
const decodedRaw = document.getElementById("decodedRaw");

// Debug-only product card elements (optional)
const productCard = document.getElementById("productCard");
const productImage = document.getElementById("productImage");
const productTitle = document.getElementById("productTitle");
const productMeta = document.getElementById("productMeta");

let stream = null;
let scanning = false;
let rafId = null;

// === Repo "table" (JSON database) ===
let productTable = { items: [] };
let productTableLoaded = false;

async function loadProductTable() {
  if (productTableLoaded) return;
  const r = await fetch("data/products.json");
  if (!r.ok) throw new Error("Could not load data/products.json");

  const data = await r.json();
  productTable.items = Array.isArray(data) ? data : (data.items || []);
  productTableLoaded = true;
}

// Normalize GTIN to 14 digits, and PO to trimmed uppercase (so scans match reliably)
function normalizeGTIN(v) {
  return String(v || "").replace(/\D/g, "").padStart(14, "0");
}
function normalizePO(v) {
  return String(v || "").trim().toUpperCase();
}

// Record key supports either record.key OR record.gtin + record.po
function recordKey(record) {
  if (record.key) return String(record.key);

  const gtin = normalizeGTIN(record.gtin);
  const po = normalizePO(record.po);
  if (!gtin || !po) return "";
  return `${gtin}|${po}`;
}

function validateRequiredAIs(parsed) {
  const gtin = normalizeGTIN(parsed.gtin || parsed["01"]);
  const po = normalizePO(parsed.po || parsed["400"]);

  // Validation rules: adjust as needed
  if (!gtin || gtin.length !== 14) {
    return { ok: false, message: "Invalid or missing GTIN (AI 01). Expect 14 digits." };
  }
  if (!po) {
    return { ok: false, message: "Missing Purchase Order (AI 400)." };
  }
  // Your gs1.js caps AI400 at 30 chars; keep the same assumption
  if (po.length > 30) {
    return { ok: false, message: "Purchase Order (AI 400) too long (max 30)." };
  }

  return { ok: true, gtin, po };
}

function buildLookupKey(v) {
  return `${v.gtin}|${v.po}`;
}

function setStatus(el, msg) {
  if (!el) return;
  el.textContent = msg;
}

async function lookupAndRedirect(parsed) {
  await loadProductTable();

  const v = validateRequiredAIs(parsed);
  if (!v.ok) throw new Error(v.message);

  const key = buildLookupKey(v);

  const record = productTable.items.find(r => recordKey(r) === key);
  if (!record) throw new Error(`No match found for scanned key: ${key}`);

  const page = record.page || "product.html";
  const id = record.id || "";
  if (!id) throw new Error("Matched record is missing an 'id' field.");

  window.location.href = `${page}?id=${encodeURIComponent(id)}`;
}

// Optional debug render (kept from earlier)
function renderTableGeneric(parsed, raw, tableEl) {
  if (!tableEl) return;
  const rows = [];
  const add = (k, v) => {
    if (v !== undefined && v !== "") rows.push(`<tr><td>${k}</td><td>${v}</td></tr>`);
  };

  add("GTIN (01)", parsed.gtin || parsed["01"]);
  add("PO (400)", parsed.po || parsed["400"]);
  add("COO (422)", parsed.coo || parsed["422"]);
  add("Style (240/241)", parsed.style || parsed["240"] || parsed["241"]);
  add("Lot (10)", parsed.lot || parsed["10"]);
  add("Serial (21)", parsed.serial || parsed["21"]);
  add("Expiry (17)", parsed.expiry || parsed["17"]);

  const escaped = String(raw).replace(/\u001d/g, "<GS>").replace(/\\u001d/g, "<GS>");
  add("Raw (escaped GS)", escaped);

  tableEl.innerHTML = rows.join("");
}

function tryShowProductDebug(parsed, cardEl, imgEl, titleEl, metaEl) {
  if (!cardEl) return;
  const gtin = normalizeGTIN(parsed.gtin || parsed["01"]);
  const po = normalizePO(parsed.po || parsed["400"]);
  if (gtin && po) {
    titleEl.textContent = "Scan Debug";
    metaEl.textContent = `GTIN: ${gtin} • PO: ${po}`;
    cardEl.classList.remove("hidden");
    imgEl?.removeAttribute("src");
  } else {
    cardEl.classList.add("hidden");
  }
}

// ZXing
async function ensureZXingReady() {
  if (ZXingWASM?.ready) await ZXingWASM.ready;
}

// Camera enumeration
async function enumerateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter((d) => d.kind === "videoinput");
    if (!cameraSelect) return;
    cameraSelect.innerHTML = "";
    for (const d of vids) {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `Camera ${cameraSelect.length + 1}`;
      cameraSelect.appendChild(o);
    }
  } catch (e) {}
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Camera API not available in this browser.");
    return;
  }
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
  } catch (err) {
    alert("Unable to start camera: " + err.message);
  }
}

function stopCamera() {
  scanning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

startBtn?.addEventListener("click", startCamera);
stopBtn?.addEventListener("click", stopCamera);

// Upload image decode
fileInput?.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  setStatus(decodedRaw, "Decoding image…");

  const ab = await f.arrayBuffer();
  try {
    await ensureZXingReady();
    const results = await ZXingWASM.readBarcodes(new Uint8Array(ab), {
      tryHarder: true,
      formats: ["DataMatrix", "QRCode", "PDF417"]
    });
    handleResults(results);
  } catch (err) {
    setStatus(decodedRaw, "No barcode found in image.");
  }
});

// Main scan loop
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

    if (results && results.length) {
      handleResults(results);

      // Pause briefly to avoid repeated triggers
      scanning = false;
      setTimeout(() => {
        scanning = true;
        scanLoop();
      }, 1200);
      return;
    }
  } catch (e) {}

  rafId = requestAnimationFrame(scanLoop);
}

// UPDATED: handleResults -> parse -> validate -> lookup -> redirect
function handleResults(results) {
  const best = results[0];
  const text = best?.text || "";

  setStatus(decodedRaw, "Searching product table…");

  try {
    const parsed = window.parseGS1 ? window.parseGS1(text) : {};

    lookupAndRedirect(parsed).catch((err) => {
      setStatus(decodedRaw, `Scan not accepted: ${err.message}`);

      if (DEBUG) {
        decodedRaw.textContent += "\n\nRAW:\n" + String(text).replace(/\u001d/g, "<GS>").replace(/\\u001d/g, "<GS>");
        renderTableGeneric(parsed, text, resultTable);
        tryShowProductDebug(parsed, productCard, productImage, productTitle, productMeta);
      }
    });
  } catch (e) {
    setStatus(decodedRaw, "Scan not accepted: Unable to parse GS1 data.");
  }
}

// === HID mode ===
const hidInput = document.getElementById("hidInput");
const hidParseBtn = document.getElementById("hidParseBtn");
const hidClearBtn = document.getElementById("hidClearBtn");

const decodedRawHID = document.getElementById("decodedRawHID");
const resultTableHID = document.getElementById("resultTableHID");

const productCardHID = document.getElementById("productCardHID");
const productImageHID = document.getElementById("productImageHID");
const productTitleHID = document.getElementById("productTitleHID");
const productMetaHID = document.getElementById("productMetaHID");

hidInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    parseHID(hidInput.value);
  }
});
hidParseBtn?.addEventListener("click", () => parseHID(hidInput.value));
hidClearBtn?.addEventListener("click", () => {
  hidInput.value = "";
  decodedRawHID && (decodedRawHID.textContent = "");
  resultTableHID && (resultTableHID.innerHTML = "");
  productCardHID?.classList.add("hidden");
});

function parseHID(raw) {
  const normalized = String(raw).replace(/<GS>/g, String.fromCharCode(29));
  setStatus(decodedRawHID, "Searching product table…");

  try {
    const parsed = window.parseGS1 ? window.parseGS1(normalized) : {};

    lookupAndRedirect(parsed).catch((err) => {
      setStatus(decodedRawHID, `Scan not accepted: ${err.message}`);

      if (DEBUG) {
        decodedRawHID.textContent += "\n\nRAW:\n" + normalized.replace(/\u001d/g, "<GS>");
        renderTableGeneric(parsed, normalized, resultTableHID);
        tryShowProductDebug(parsed, productCardHID, productImageHID, productTitleHID, productMetaHID);
      }
    });
  } catch (e) {
    setStatus(decodedRawHID, "Scan not accepted: Unable to parse GS1 data.");
  }
}

// Load product table and camera list on page load (NO CAMERA START)
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadProductTable();
  } catch (e) {
    // Table missing: scanning will fail with a friendly message later
  }
  await enumerateCameras();
});
``
