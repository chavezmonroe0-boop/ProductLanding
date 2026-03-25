// qr-resolver.js
// Resolves GS1 QR parameters → looks up product → redirects

console.log("✅ qr-resolver.js loaded");

function normGTIN(v) {
  return String(v || "").replace(/\D/g, "").padStart(14, "0");
}

function normPO(v) {
  return String(v || "").trim();
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function showError(msg, debugObj) {
  const errEl = document.getElementById("autoError");
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }

  const dbgEl = document.getElementById("debug");
  if (dbgEl && debugObj) {
    dbgEl.textContent = JSON.stringify(debugObj, null, 2);
    dbgEl.classList.remove("hidden");
  }

  console.error(msg, debugObj || "");
}

async function loadProducts() {
  const urls = [
    "data/products.json",
    "products.json"
  ];

  for (const url of urls) {
    console.log("📦 Attempting fetch:", url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn("⚠️ Fetch failed:", url, res.status);
        continue;
      }

      const json = await res.json();

      if (Array.isArray(json)) return json;
      if (Array.isArray(json.items)) return json.items;

      console.warn("⚠️ JSON loaded but no items array:", json);
    } catch (err) {
      console.warn("⚠️ Fetch error:", url, err);
    }
  }

  throw new Error("Unable to load product table (products.json)");
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    setStatus("Reading QR data…");

    const params = new URLSearchParams(window.location.search);

    if ([...params.keys()].length === 0) {
      setStatus("No QR parameters detected.");
      return;
    }

    const gtin = normGTIN(params.get("01"));
    const po   = normPO(params.get("400"));

    if (!gtin || !po) {
      showError("Missing required GS1 parameters (01 = GTIN, 400 = PO).", {
        params: Object.fromEntries(params)
      });
      return;
    }

    const lookupKey = `${gtin}|${po}`;
    console.log("🔍 Lookup key:", lookupKey);

    setStatus("Loading product table…");
    const table = await loadProducts();

    console.log("📚 Loaded product keys:", table.map(r => r.key));

    const record = table.find(r =>
      r.key && String(r.key).trim() === lookupKey
    );

    if (!record) {
      showError("Product table loaded, but no matching key found.", {
        searchedFor: lookupKey,
        availableKeys: table.map(r => r.key)
      });
      return;
    }

    const target = `${record.page}?id=${encodeURIComponent(record.id)}`;
    console.log("✅ Redirecting to:", target);

    setStatus("Product found. Redirecting…");
    window.location.replace(target);

  } catch (err) {
    showError("Unexpected resolver error.", err.message || err);
  }
});
``
