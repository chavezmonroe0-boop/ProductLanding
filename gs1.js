// Minimal GS1 parser for common AIs used in apparel
const GS = String.fromCharCode(29);
const AI_TABLE = [
  { id: '01', fixed: 14, key: 'gtin' },
  { id: '17', fixed: 6,  key: 'expiry' },
  { id: '10', fixed: null, max: 20, key: 'lot' },
  { id: '21', fixed: null, max: 20, key: 'serial' },
  { id: '240', fixed: null, max: 30, key: 'style' },
  { id: '241', fixed: null, max: 30 },
  { id: '400', fixed: null, max: 30, key: 'po' },
  { id: '422', fixed: 3,  key: 'coo' }
];
const AI_BY_ID = Object.fromEntries(AI_TABLE.map(a => [a.id, a]));
function parseGS1(input){ if(!input) return {}; const s = input.replace(/\u001d/g, GS); let i=0; const out={}; const len=s.length; while(i<len){ let ai=null; for(const w of [4,3,2]){ const cand=s.substr(i,w); if(AI_BY_ID[cand]){ ai=cand; i+=w; break; } } if(!ai){ i+=1; continue; } const def=AI_BY_ID[ai]; if(def.fixed!=null){ const value=s.substr(i, def.fixed); i+=def.fixed; set(out,def,value); } else { const nextGS=s.indexOf(GS,i); let raw=(nextGS===-1? s.substring(i) : s.substring(i,nextGS)); if(def.max && raw.length>def.max) raw=raw.substring(0,def.max); i += raw.length + (nextGS===-1?0:1); set(out,def,raw); } } if(out.gtin) out.gtin = out.gtin.padStart(14,'0'); if(out.expiry && /^\d{6}$/.test(out.expiry)){ const yy=out.expiry.slice(0,2), mm=out.expiry.slice(2,4), dd=out.expiry.slice(4,6); out.expiry = `20${yy}-${mm}-${dd}`; } return out; }
function set(out,def,val){ const key=def.key||def.id; out[key]=val; }
window.parseGS1 = parseGS1;

// === ISO 3166-1 numeric -> alpha-2 map for GS1 AI (422) Country of Origin ===
const countryAlpha2ByNumeric = {
  "004": "AF","008": "AL","012": "DZ","016": "AS","031": "AZ","036": "AU","040": "AT","051": "AM",
  "056": "BE","076": "BR","100": "BG","124": "CA","156": "CN","170": "CO","191": "HR","196": "CY",
  "203": "CZ","208": "DK","233": "EE","246": "FI","250": "FR","268": "GE","276": "DE","344": "HK",
  "348": "HU","356": "IN","360": "ID","364": "IR","368": "IQ","376": "IL","380": "IT","392": "JP",
  "400": "JO","410": "KR","417": "KG","422": "LB","434": "LY","458": "MY","470": "MT","484": "MX",
  "498": "MD","504": "MA","528": "NL","554": "NZ","566": "NG","579": "NO","586": "PK","604": "PE",
  "608": "PH","616": "PL","620": "PT","634": "QA","643": "RU","682": "SA","702": "SG","703": "SK",
  "704": "VN","710": "ZA","724": "ES","752": "SE","756": "CH","764": "TH","784": "AE","792": "TR",
  "796": "TC","804": "UA","826": "GB","840": "US","858": "UY","860": "UZ","882": "WS","894": "ZM"
};
