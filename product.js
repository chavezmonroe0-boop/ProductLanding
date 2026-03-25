function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// URLSearchParams is the standard way to read query parameters in the browser. [5](https://stackoverflow.com/questions/67220726/id-like-to-append-a-query-string-to-my-github-page-url-so-that-it-searches-my-s)[6](https://bobbyhadz.com/blog/redirect-to-another-page-with-parameters-using-javascript)
async function loadTable() {
  const res = await fetch("data/products.json");
  if (!res.ok) throw new Error("Could not load products table");
  return res.json();
}

function showError(msg) {
  const el = document.getElementById("pError");
  el.textContent = msg;
  el.classList.remove("hidden");
}

(async function init() {
  try {
    const id = getParam("id");
    if (!id) return showError("Missing product id in URL.");

    const table = await loadTable();
    const record = table.find(x => x.id === id);

    if (!record) return showError("Product not found in table.");

    document.getElementById("pTitle").textContent = record.title ?? "";
    document.getElementById("pMeta").textContent = record.meta ?? "";

    const img = document.getElementById("pImage");
    img.src = record.image ?? "";
    img.alt = record.title ?? "Product";

    document.getElementById("pMaterials").textContent = record.fields?.materials ?? "";
    document.getElementById("pCare").textContent = record.fields?.care ?? "";
    document.getElementById("pWarranty").textContent = record.fields?.warranty ?? "";
  } catch (e) {
    showError(e.message || "Unexpected error.");
  }
})();
``
