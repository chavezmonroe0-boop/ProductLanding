// App logic for modal + scanning loop + HID support
const modal = document.getElementById('scannerModal');
const openLink = document.getElementById('scan-link');
const closeBtn = document.getElementById('closeModal');

function openModal() { modal.setAttribute('aria-hidden', 'false'); enumerateCameras(); }
function closeModal() { modal.setAttribute('aria-hidden', 'true'); stopCamera(); }
openLink.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
closeBtn.addEventListener('click', () => closeModal());

// Tabs
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tabpane');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab).classList.add('active');
}));

// Camera scanning
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const cameraSelect = document.getElementById('cameraSelect');
const fileInput = document.getElementById('fileInput');
const resultTable = document.getElementById('resultTable');
const decodedRaw = document.getElementById('decodedRaw');
const productCard = document.getElementById('productCard');
const productImage = document.getElementById('productImage');
const productTitle = document.getElementById('productTitle');
const productMeta = document.getElementById('productMeta');

let stream = null; let scanning = false; let rafId = null; let catalog = { items: [] };

async function loadCatalog() { try { const r = await fetch('catalog.json'); if (r.ok) catalog = await r.json(); } catch(e) {} }
//async function enumerateCameras() { try { const devices = await navigator.mediaDevices.enumerateDevices(); const vids = devices.filter(d=>d.kind==='videoinput'); cameraSelect.innerHTML=''; for (const d of vids) { const o=document.createElement('option'); o.value=d.deviceId; o.textContent=d.label || `Camera ${cameraSelect.length+1}`; cameraSelect.appendChild(o);} } catch(e){} }

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { alert('Camera API not available in this browser.'); return; }

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadCatalog();
  await enumerateCameras();
});
  
 // try {
   // stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: cameraSelect.value?{exact:cameraSelect.value}:undefined, facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }, audio:false });
    //video.srcObject = stream; await video.play(); scanning = true; scanLoop();
 // } catch(err) { alert('Unable to start camera: ' + err.message); }
}
function stopCamera() { scanning=false; if (rafId) cancelAnimationFrame(rafId); if (stream) { stream.getTracks().forEach(t=>t.stop()); stream=null; } }
startBtn.addEventListener('click', startCamera); stopBtn.addEventListener('click', stopCamera);

fileInput.addEventListener('change', async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const ab=await f.arrayBuffer(); try { await ensureZXingReady(); const results = await ZXingWASM.readBarcodes(new Uint8Array(ab), { tryHarder:true, formats:['DataMatrix','QRCode','PDF417'] }); handleResults(results); } catch(err){ decodedRaw.textContent='No barcode found in image.'; }});

async function ensureZXingReady(){ if (ZXingWASM.ready) await ZXingWASM.ready; }
async function scanLoop(){ if(!scanning) return; const vw=video.videoWidth||1280, vh=video.videoHeight||720; const tw=640, th=Math.round((vh/vw)*tw); canvas.width=tw; canvas.height=th; ctx.drawImage(video,0,0,tw,th); const img=ctx.getImageData(0,0,tw,th); try { await ensureZXingReady(); const results=await ZXingWASM.readBarcodes(img,{tryHarder:true, formats:['DataMatrix']}); if(results && results.length){ handleResults(results); scanning=false; setTimeout(()=>{ scanning=true; scanLoop(); }, 1200); return; } } catch(e){} rafId=requestAnimationFrame(scanLoop); }

function handleResults(results){ const best=results[0]; const text=best?.text||''; decodedRaw.textContent = text.replace(/\x1d/g,'<GS>').replace(/\u001d/g,'<GS>'); const parsed = parseGS1(text); renderTableGeneric(parsed, text, resultTable); tryShowProductGeneric(parsed, productCard, productImage, productTitle, productMeta); }

function renderTableGeneric(parsed, raw, tableEl){ const rows=[]; const add=(k,v)=>{ if(v!==undefined && v!=='') rows.push(`<tr><td>${k}</td><td>${v}</td></tr>`); }; add('GTIN', parsed.gtin||parsed['01']); add('Country of Origin (COO)', parsed.coo||parsed['422']); add('Purchase Order #', parsed.po||parsed['400']); add('Garment Style', parsed.style||parsed['240']||parsed['241']); add('Batch/Lot', parsed.lot||parsed['10']); add('Serial', parsed.serial||parsed['21']); add('Expiry', parsed.expiry||parsed['17']); add('Raw (escaped GS=\u001D)', raw.replace(/\u001d/g,'<GS>')); tableEl.innerHTML = rows.join(''); }

function tryShowProductGeneric(parsed, cardEl, imgEl, titleEl, metaEl){ const key=(parsed.gtin||'').padStart(14,'0'); const style=parsed.style||parsed['240']||parsed['241']; let item=null; if(key) item=catalog.items.find(i=>(i.gtin||'').padStart(14,'0')===key)||null; if(!item && style) item=catalog.items.find(i=>(i.style||'').toLowerCase()===String(style).toLowerCase())||null; if(item && item.image){ imgEl.src=item.image; titleEl.textContent=item.title||item.style||item.gtin||'Garment'; metaEl.textContent=[item.color,item.size,item.gtin].filter(Boolean).join(' · '); cardEl.classList.remove('hidden'); } else { cardEl.classList.add('hidden'); } }

// HID mode
const hidInput = document.getElementById('hidInput');
const hidParseBtn = document.getElementById('hidParseBtn');
const hidClearBtn = document.getElementById('hidClearBtn');
const decodedRawHID = document.getElementById('decodedRawHID');
const resultTableHID = document.getElementById('resultTableHID');
const productCardHID = document.getElementById('productCardHID');
const productImageHID = document.getElementById('productImageHID');
const productTitleHID = document.getElementById('productTitleHID');
const productMetaHID = document.getElementById('productMetaHID');

hidInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); parseHID(hidInput.value); }});
hidParseBtn?.addEventListener('click', ()=>parseHID(hidInput.value));
hidClearBtn?.addEventListener('click', ()=>{ hidInput.value=''; decodedRawHID.textContent=''; resultTableHID.innerHTML=''; productCardHID.classList.add('hidden'); });

function parseHID(raw){ const normalized = raw.replace(/<GS>/g, String.fromCharCode(29)); const parsed = parseGS1(normalized); decodedRawHID.textContent = normalized.replace(/\u001d/g,'<GS>'); renderTableGeneric(parsed, normalized, resultTableHID); tryShowProductGeneric(parsed, productCardHID, productImageHID, productTitleHID, productMetaHID); }

window.addEventListener('DOMContentLoaded', async ()=>{ await loadCatalog(); try{ await navigator.mediaDevices.getUserMedia({video:true}); }catch(e){} await enumerateCameras(); });
