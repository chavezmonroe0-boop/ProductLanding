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
