// gs1.js — robust parser
// Supports:
// 1) HRI element strings: (01)000... (400).... (422).... etc.
// 2) Raw GS1 scan data with ASCII 29 (GS) separators and optional AIM prefix (e.g., ]d2)

(() => {
  const GS = String.fromCharCode(29);

  const AI_TABLE = [
    { id: "01", fixed: 14, key: "gtin" },
    { id: "17", fixed: 6,  key: "expiry" },
    { id: "10", fixed: null, max: 20, key: "lot" },
    { id: "21", fixed: null, max: 20, key: "serial" },
    { id: "240", fixed: null, max: 30, key: "style" },
    { id: "241", fixed: null, max: 30 },            // stored as "241"
    { id: "400", fixed: null, max: 30, key: "po" }, // PO number
    { id: "422", fixed: 3,  key: "cooNumeric" },    // COO numeric
    { id: "30",  fixed: null, max: 8,  key: "qty" } // Variable count of items (up to 8 digits)
  ];

  const AI_BY_ID = Object.fromEntries(AI_TABLE.map(a => [a.id, a]));

  // ISO numeric -> alpha2 map (keep yours if you want; trimmed here)
  const countryAlpha2ByNumeric = {
    "586": "PK", "840": "US", "156": "CN", "484": "MX", "704": "VN", "356": "IN"
    // You can paste your full map here if desired
  };

  function normalizeGTIN(v) {
    return String(v || "").replace(/\D/g, "").padStart(14, "0");
  }

  function set(out, def, val) {
    const key = def.key || def.id;
    out[key] = val;
    out[def.id] = val;
  }

  // ---------- HRI parsing: (01)...(400)... ----------
  function parseHRI(input) {
    // Remove whitespace, keep parentheses
    const s = String(input || "").replace(/\s+/g, "");
    const out = {};
    let i = 0;

    while (i < s.length) {
      if (s[i] !== "(") { i++; continue; }

      const close = s.indexOf(")", i);
      if (close === -1) break;

      const ai = s.slice(i + 1, close);
      if (!AI_BY_ID[ai]) { i = close + 1; continue; }

      // Value runs until next '(' or end
      const nextOpen = s.indexOf("(", close + 1);
      const rawVal = (nextOpen === -1) ? s.slice(close + 1) : s.slice(close + 1, nextOpen);

      const def = AI_BY_ID[ai];

      if (def.fixed != null) {
        // Fixed-length AIs: take exact length from the field value
        const val = rawVal.slice(0, def.fixed);
        if (ai === "422") {
          const padded = String(val).padStart(3, "0");
          out["422"] = padded;
          out.cooNumeric = padded;
          const alpha2 = countryAlpha2ByNumeric[padded] || "";
          out.cooAlpha2 = alpha2;
          out.coo = alpha2 ? `${alpha2} (${padded})` : padded;
        } else {
          set(out, def, val);
        }
      } else {
        // Variable-length AIs: entire rawVal, capped to max
        let val = rawVal;
        if (def.max && val.length > def.max) val = val.slice(0, def.max);
        if (ai === "400") val = val.trim(); // PO cleanup
        set(out, def, val);
      }

      i = (nextOpen === -1) ? s.length : nextOpen;
    }

    if (out.gtin) out.gtin = normalizeGTIN(out.gtin);

    // Convert expiry (YYMMDD -> YYYY-MM-DD)
    if (out.expiry && /^\d{6}$/.test(out.expiry)) {
      const yy = out.expiry.slice(0, 2);
      const mm = out.expiry.slice(2, 4);
      const dd = out.expiry.slice(4, 6);
      out["17"] = `${yy}${mm}${dd}`;
      out.expiry = `20${yy}-${mm}-${dd}`;
    }

    return out;
  }

  // ---------- Raw GS1 parsing (ASCII 29 separators) ----------
  function parseRawGS1(input) {
    let s = String(input || "");

    // Strip AIM prefix e.g. ]d2
    if (s.length >= 3 && s[0] === "]") s = s.slice(3);

    // Normalize actual GS and escaped forms
    s = s.replace(/\\u001d/g, GS).replace(/\u001d/g, GS);

    const out = {};
    let i = 0;

    while (i < s.length) {
      // skip GS
      while (s[i] === GS) i++;

      // identify AI (4/3/2)
      let ai = null;
      for (const w of [4, 3, 2]) {
        const cand = s.substr(i, w);
        if (AI_BY_ID[cand]) { ai = cand; i += w; break; }
      }
      if (!ai) { i++; continue; }

      const def = AI_BY_ID[ai];

      if (def.fixed != null) {
        const val = s.substr(i, def.fixed);
        i += def.fixed;

        if (ai === "422") {
          const padded = String(val).padStart(3, "0");
          out["422"] = padded;
          out.cooNumeric = padded;
          const alpha2 = countryAlpha2ByNumeric[padded] || "";
          out.cooAlpha2 = alpha2;
          out.coo = alpha2 ? `${alpha2} (${padded})` : padded;
        } else {
          set(out, def, val);
        }
      } else {
        const nextGS = s.indexOf(GS, i);
        let val = (nextGS === -1) ? s.slice(i) : s.slice(i, nextGS);
        if (def.max && val.length > def.max) val = val.slice(0, def.max);
        if (ai === "400") val = val.trim();
        i = (nextGS === -1) ? s.length : nextGS + 1;
        set(out, def, val);
      }
    }

    if (out.gtin) out.gtin = normalizeGTIN(out.gtin);
    return out;
  }

  function parseGS1(input) {
    if (!input) return {};
    const s = String(input);
    // If it contains parentheses, treat as HRI
    if (s.includes("(") && s.includes(")")) return parseHRI(s);
    return parseRawGS1(s);
  }

  window.parseGS1 = parseGS1;
})();
``
