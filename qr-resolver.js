// qr-resolver.jsErr || new Error("Could not load products table JSON.");
}

function recordKey(r) {
  if (r.key) return String(r.key).trim();

  // Support alternate schema if you ever store separate fields
  const gtin = normGTIN(r.gtin);
  const po = normPO(r.po);
  return `${gtin}|${po}`;
}

async function resolveAndRedirect() {
  // URLSearchParams is the standard way to read ?a=b&c=d query params
  // (See MDN docs for URLSearchParams.get()).
  const params = new URLSearchParams(window.location.search);

  const gtin = normGTIN(params.get("01"));
  const po = normPO(params.get("400"));

  // Optional fields (not required for routing)
  const coo = params.get("422") || "";
  const qty = params.get("30") || "";
  const style = params.get("240") || "";

  if (!gtin || gtin.length !== 14 || !po) {
    showError(
      "Missing or invalid required parameters. Need ?01=<GTIN14>&400=<PO>.",
      { got: { "01": params.get("01"), "400": params.get("400"), "422": coo, "30": qty, "240": style } }
    );
    return;
  }

  const key = `${gtin}|${po}`;
  setStatus(`Looking up key: ${key}`);

  const table = await loadProductsTable();
  const rec = table.find(r => recordKey(r) === key);

  if (!rec) {
    showError(`No match found for key: ${key}`, { key, hint: "Verify the key exists in data/products.json" });
    return;
  }

  // Redirect to the same place your scanner flow does:
  // record.page + ?id=record.id (your product-page.js uses ?id=...)
  const page = rec.page || "K87.html";
  const id = rec.id || "";

  setStatus(`Match found. Redirecting to ${page}?id=${id} …`);
  window.location.replace(`${page}?id=${encodeURIComponent(id)}`);
}

window.addEventListener("DOMContentLoaded", () => {
  resolveAndRedirect().catch(err => {
    showError(err.message || "Unexpected error while resolving QR.");
  });
});
``
// Auto.html reads GS1 AI query params and redirects to the correct product page.
// Required for routing: 01 (GTIN) + 400 (PO)

function normGTIN(v) {
  return String(v || "").replace(/\D/g, "").padStart(14, "0");
}
function normPO(v) {
  return String(v || "").trim().toUpperCase();
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}
function showError(msg, extraObj) {
  const e = document.getElementById("autoError");
  if (e) {
    e.textContent = msg;
    e.classList.remove("hidden");
  } else {
    console.error(msg);
  }

  // Optional debug panel
  const d = document.getElementById("debug");
  if (d && extraObj) {
    d.textContent = JSON.stringify(extraObj, null, 2);
    d.classList.remove("hidden");
  }
}

async function loadProductsTable() {
  // Same pattern you use elsewhere: try data/ then root
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
