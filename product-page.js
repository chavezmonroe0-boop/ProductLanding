// product-page.js
// Populates a product page (e.g., K87.html) from data/products.json using ?id=...

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
  if (el && value != null) el.textContent = value;
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
  setText("productTitle", record.title);
  setText("productMeta", record.meta);
  setSrc("productImage", record.image);

  setText("productKey", record.key);
  setText("productId", record.id);

  const f = record.fields || {};
  setText("materials", f.materials);
  setText("care", f.care);
  setText("coo", f.coo);
  setText("po", f.po);
  setText("style", f.style);
  setText("description", f.description);

  const dump = document.getElementById("recordDump");
  if (dump) dump.textContent = JSON.stringify(record, null, 2);
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const id = getParam("id");
    const filename = currentFileName();
    const table = await loadTable();

    const record =
      (id ? table.find(r => String(r.id) === String(id)) : null) ||
      table.find(r => String(r.page || "").toLowerCase() === filename.toLowerCase());

    if (!record) {
      showError(`No product record found for id='${id}' or page='${filename}'.`);
      return;
    }

    populate(record);
  } catch (e) {
    showError(e?.message || "Unable to load product data.");
  }
});
