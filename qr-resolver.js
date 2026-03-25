// qr-resolver.jsIN/PO fields later
  const gtin = normGTIN(r.gtin);
  const po = normPO(r.po);
  return `${gtin}|${po}`;
}

async function resolveAndRedirect() {
  const params = new URLSearchParams(window.location.search);

  // If someone visits Auto.html with no params, show a friendly message
  if ([...params.keys()].length === 0) {
    setStatus("No QR parameters detected. Scan a QR code that points to Auto.html?01=...&400=...");
    return;
  }

  const gtin = normGTIN(params.get("01"));
  const po = normPO(params.get("400"));

  // optional fields (not required for routing)
  const coo = params.get("422") || "";
  const qty = params.get("30") || "";
  const style = params.get("240") || "";

  if (!gtin || gtin.length !== 14 || !po) {
    showError(
      "Missing or invalid required parameters. Required: ?01=<GTIN14>&400=<PO>",
      { received: { "01": params.get("01"), "400": params.get("400"), "422": coo, "30": qty, "240": style } }
    );
    return;
  }

  const key = `${gtin}|${po}`;
  setStatus(`Looking up key: ${key}`);

  const table = await loadProductsTable();
  const rec = table.find(r => recordKey(r) === key);

  if (!rec) {
    showError(`No match found for key: ${key}`, {
      key,
      hint: "Verify this exact key exists under data/products.json → items[].key"
    });
    return;
  }

  // Redirect to record.page with ?id=record.id (matches your product-page.js approach)
  const page = rec.page || "K87.html";
  const id = rec.id || "";

  setStatus(`Match found. Redirecting to ${page}?id=${id}…`);
  window.location.replace(`${page}?id=${encodeURIComponent(id)}`);
}

window.addEventListener("DOMContentLoaded", () => {
  resolveAndRedirect().catch(err => showError(err.message || "Unexpected resolver error."));
});
``
// Auto.html: resolves a product based on GS1 AI query params and redirects.
// Required for routing (based on your current "key"): 01 (GTIN) + 400 (PO)

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
function showError(msg, debugObj) {
  const e = document.getElementById("autoError");
  if (e) {
    e.textContent = msg;
    e.classList.remove("hidden");
  } else {
    console.error(msg);
  }

  const d = document.getElementById("debug");
  if (d && debugObj) {
    d.textContent = JSON.stringify(debugObj, null, 2);
    d.classList.remove("hidden");
  }
}

async function loadProductsTable() {
  // prefer data/products.json, fall back to products.json
  const tryUrls = ["data/products.json", "products.json"];
  let lastErr;

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;

      const data = await res.json();

      // ✅ supports BOTH formats:
      // 1) [{...}, {...}]
      // 2) { "items": [{...}, {...}] }
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.items)) return data.items;

      return [];
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Could not load products table JSON.");
}

function recordKey(r) {
  // your table uses a prebuilt key
  if (r.key) return String(r.key).trim();

