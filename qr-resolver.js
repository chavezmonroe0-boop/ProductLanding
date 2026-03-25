// qr-resolver.js matching rule
  if (!gtin || gtin.length !== 14 || !po) {
    // Optional: show error on index page if you have an element for it
    console.warn("Missing/invalid 01 or 400 in URL.");
    return;
  }

  const key = `${gtin}|${po}`;
  const table = await loadProducts();
  const rec = table.find(r => recordKey(r) === key);

  if (!rec) {
    console.warn(`No match found for key ${key}`);
    return;
  }

  // Redirect to the real product page. product-page.js will populate using ?id=
  const page = rec.page || "K87.html";
  const id = rec.id || "";
  window.location.replace(`${page}?id=${encodeURIComponent(id)}`);
}

// Run ASAP on load
window.addEventListener("DOMContentLoaded", () => {
  resolveFromQuery().catch(err => console.error(err));
});
``
// If URL contains GS1 AI query params, resolve to product page and redirect.

function normGTIN(v) {
  return String(v || "").replace(/\D/g, "").padStart(14, "0");
}
function normPO(v) {
  return String(v || "").trim().toUpperCase();
}

async function loadProducts() {
  const tryUrls = ["data/products.json", "products.json"];
  for (const url of tryUrls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  }
  throw new Error("Could not load products table JSON.");
}

function recordKey(r) {
  if (r.key) return String(r.key).trim();
  const gtin = normGTIN(r.gtin);
  const po = normPO(r.po);
  return `${gtin}|${po}`;
}

async function resolveFromQuery() {
  const params = new URLSearchParams(window.location.search);

  // If no relevant params, do nothing (normal index.html scanner flow)
  if (!params.has("01") && !params.has("400")) return;

  const gtin = normGTIN(params.get("01"));
  const po = normPO(params.get("400"));

