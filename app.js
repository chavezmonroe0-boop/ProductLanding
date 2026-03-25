// App logic for modal + scanning loop + HID support
// Updated: Scan -> parse -> validate -> search data/products.json -> redirect to record.page?id=record.id
// No immediate decoded data display (status only unless DEBUG is enabled)

const DEBUG = false; // set true to show decoded/parsed data on failures

// Modal
const modal = document.getElementById("scannerModal");
const openLink = document.getElementById("scan-link");
const closeBtn = document.getElementById("closeModal");

function openModal() {
  modal.setAttribute("aria-hidden", "false");
  enumerateCameras();
}
function closeModal() {
  modal.setAttribute("aria-hidden", "true");
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

// Existing product card elements (kept, but now used only for optional debug fallback)
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

// Accept either:
// - record.key (preferred), OR
// - record.gtin + record.serial/lot
function recordKey(record) {
  if (record.key) return String(record.key);

  const gtin = String(record.gtin || "").replace(/\D/g, "").padStart(14, "0");
  const serial = String(record.serial || "").trim();
  const lot = String(record.lot || "").trim();
  if (!gtin) return "";
  if (serial) return `${gtin}|${serial}`;
  if (lot) return `${gtin}|${lot}`;
  return "";
}

function validateRequiredAIs(parsed) {
  const gtin = String(parsed.gtin || parsed["01"] || "").replace(/\D/g, "").padStart(14, "0");
  const serial = String(parsed.serial || parsed["21"] || "").trim();
  const lot = String(parsed.lot || parsed["10"] || "").trim();

  // Customize validation rules here
  if (!gtin || gtin.length !== 14) {
    return { ok: false, message: "Invalid or missing GTIN (AI 01). Expect 14 digits." };
  }
  if (!serial && !lot) {
    return { ok: false, message: "Missing Serial (AI 21) or Lot (AI 10)." };
  }
  if (serial && serial.length > 20) {
    return { ok: false, message: "Serial (AI 21) too long (max 20)." };
  }
  if (lot && lot.length > 20) {
    return { ok: false, message: "Lot (AI 10) too long (max 20)." };
  }

  // Optional: validate COO if required
  // const coo = String(parsed["422"] || parsed.cooNumeric || "").padStart(3, "0");
  // if (!coo) return { ok: false, message: "Missing Country of Origin (AI 422)." };

  return { ok: true, gtin, serial, lot };
}

function buildLookupKey(v) {
  return v.serial ? `${v.gtin}|${v.serial}` :
