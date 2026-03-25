// product-page.js
// Populates K87.html / 100615.html (and any future product pages) from data/products.json
// Finds the record by URL param ?id=... OR by matching the current filename to record.page

async function loadProductTable() {
  const res = await fetch("data/products.json");
  if (!res.ok) throw new Error("Could not load data/products.json");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.items || []);
}

function currentFileName() {
  const p = window.location.pathname;
  return p.substring(p.lastIndexOf("/") + 1);
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function setIfExists(id, value, attr) {
  const el = document.getElementById(id);
  if (!el) return;
  if (attr) el.setAttribute(attr, value ?? "");
  else el.textContent = value ?? "";
}

// Flexible mapping: supports either "pTitle/pImage/..." OR "productTitle/productImage/..." IDs.
// Add whichever IDs you prefer to your HTML.
function populate(record) {
  // Title/meta
  document.title = record.title ? `${record.title}` : document.title;

  setIfExists("pTitle", record.title);
  setIfExists("productTitle", record.title);
  setIfExists("pageTitle", record.title);

  setIfExists("pMeta", record.meta);
  setIfExists("productMeta", record.meta);
  setIfExists("pageMeta", record.meta);

  // Image
  if (record.image) {
    setIfExists("pImage", record.image, "src");
    setIfExists("productImage", record.image, "src");
    setIfExists("heroImage", record.image, "src");
  }

  // Fields block
  const f = record.fields || {};
  setIfExists("pMaterials", f.materials);
  setIfExists("materials", f.materials);

  setIfExists("pCare", f.care);
  setIfExists("care", f.care);

  setIfExists("pWarranty", f.warranty);
  setIfExists("warranty", f.warranty);

  // Optional: dump everything if you add <pre id="recordDump"></pre>
  const dump = document.getElementById("recordDump");
  if (dump) dump.textContent = JSON.stringify(record, null, 2);
}

function showError(msg) {
  const el = document.getElementById("pError") || document.getElementById("pageError");
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  } else {
    console.error(msg);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const table = await loadProductTable();

    const id = getParam("id");
    const file = currentFileName();

    // Find record by id first (if scanner passed ?id=...), else by matching page filename
    const record =
      (id ? table.find(r => String(r.id) === String(id)) : null) ||
      table.find(r => String(r.page || "").toLowerCase() === file.toLowerCase());

    if (!record) {
      showError(`No matching product record found for id='${id}' or page='${file}'.`);
      return;
    }

    populate(record);
  } catch (e) {
    showError(e.message || "Unable to load product data.");
  }
});
``
