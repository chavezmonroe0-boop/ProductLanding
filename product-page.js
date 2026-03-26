// product-page.js
// Populates a product page (e.g., K87.html, 100615.html) from data/products.json using ?id=...

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function currentFileName() {
  const p = window.location.pathname;
  return p.substring(p.lastIndexOf("/") + 1);
}

async function loadTable() {
  const tryUrls = ["data/products.json", "products.json"];
  let lastErr;

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items || []);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Could not load products table JSON.");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = String(value);
}

function setSrc(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.src = value;
}

function showError(msg) {
  const el = document.getElementById("pageError");
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  } else {
    console.error(msg);
  }
}

function populate(record) {
  // Core
  setText("productTitle", record.title);
  setText("productMeta", record.meta);
  setSrc("productImage", record.image);

  // Debug/identifiers (optional IDs in your HTML)
  setText("productKey", record.key);
  setText("productId", record.id);

  // Fields (support both legacy lower-case and your new Title-Case keys)
  const f = record.fields || {};

  setText("materials", f.materials ?? f.Materials);
  setText("care", f.care ?? f.Care);

  // NEW fields in your JSON
  setText("coo", f.COO ?? f.coo);
  setText("po", f.PO ?? f.po);
  setText("style", f.Style ?? f.style);
  setText("description", f.Description ?? f.description);

  // Optional raw record dump
  const dump = document.getElementById("recordDump");
  if (dump) dump.textContent = JSON.stringify(record, null, 2);
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const id = getParam("id");
    const filename = currentFileName();
    const table = await loadTable();

    let record = null;

    // 1) Prefer explicit id
    if (id) {
      record = table.find(r => String(r.id) === String(id));
      if (!record) {
        showError(`No product record found for id='${id}'.`);
        return;
      }
      populate(record);
      return;
    }

    // 2) Fallback by page ONLY if unambiguous
    const matches = table.filter(
      r => String(r.page || "").toLowerCase() === filename.toLowerCase()
    );

    if (matches.length === 1) {
      populate(matches[0]);
      return;
    }

    if (matches.length > 1) {
      showError(
        `Multiple product variants exist for ${filename}. Please open this page via a scan/QR so it includes ?id=...`
      );
      return;
    }

    showError(`No product record found for page='${filename}'.`);
  } catch (e) {
    showError(e?.message || "Unable to load product data.");
  }
});
``
