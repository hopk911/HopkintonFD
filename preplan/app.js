// ==============================
// app.js  (JSONP GET + opaque POST)
// ==============================

// ---- Global config ----
var SHEET_URL  = window.GOOGLE_SHEET_JSON_URL || window.WEBAPP_URL || '';
var PARCEL_URL = window.PARCEL_FEATURE_LAYER_URL || '';
const WEBAPP_URL = window.WEBAPP_URL || '';
const EDIT_SECRET = window.EDIT_SECRET || '';

// ---- Local SAMPLE_DATA fallback (offline/testing) ----
const SAMPLE_DATA = [
  {"Business Name":"Sample Plaza","Street Address":"73 Main Street","City":"Hopkinton","Latitude":"42.2292","Longitude":"-71.5187","Knox Box Location":"Alpha Side – center of building","Primary Contact":"Fire Chief Jones","Primary Phone":"5085551212","Closest Hydrant":"Corner of Main & Park","Electric Panel Location":"Rear hallway by loading dock","Gas Meter Location":"Bravo side exterior","Water Shutoff":"Basement mechanical room","FDC":"Delta side, two 2.5\" inlets","Alarm Panel":"Lobby next to office","Photo 1":"https://picsum.photos/seed/preplan1/800/500"},
  {"Business Name":"Ace Manufacturing","Street Address":"276 West Main Street","City":"Hopkinton","Latitude":"42.2301","Longitude":"-71.5169","Primary Contact":"Site Manager","Primary Phone":"6175551212","Gas Meter":"Charlie side cage","Sprinkler Riser":"Mechanical mezzanine","Generator":"Pad outside Bravo","Photo 1":"https://picsum.photos/seed/preplan2/800/500"}
];

// ---- JSONP loader (bypasses CORS for GET) ----
function loadJSONP(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('Missing URL'));
    const cb = `__jsonp_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window[cb] = (payload) => {
      try { resolve(payload); }
      finally { delete window[cb]; script.remove(); }
    };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    script.onerror = () => { delete window[cb]; reject(new Error('JSONP load failed')); };
    document.head.appendChild(script);
  });
}

// ---- DOM helpers ----
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function niceKey(k){ return String(k).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function addRow(container, k, v){ const row=el('div','row'); row.append(el('div','k',niceKey(k))); row.append(el('div','v',String(v))); container.append(row); }

// --- Robust header lookup helpers ---
function normKey(k){ return String(k||'').replace(/\s+/g,' ').trim().toLowerCase(); }
function getByHeaders(row, headers){
  if (!row) return '';
  const lut = {}; try{ Object.keys(row).forEach(k=>{ lut[normKey(k)] = k; }); }catch{}
  for(const h of headers){ const nk=normKey(h); if(lut[nk] && row[lut[nk]]!=null && String(row[lut[nk]]).trim()!=='') return String(row[lut[nk]]).trim(); }
  return '';
}
function firstNonEmpty(row, candidates, contains=false){
  for(const key of candidates){ if(row[key] && String(row[key]).trim()!=='') return String(row[key]).trim(); }
  if(contains){ for(const k in row){ if(k && k.toLowerCase().includes(contains) && String(row[k]).trim()!=='') return String(row[k]).trim(); } }
  return '';
}
function getAddress(row){ return firstNonEmpty(row, ['Street Address','Site Address','Address','Address 1','Addr','Location Address','Street'], 'address'); }
function getCity(row){ return firstNonEmpty(row, ['City','Town','Municipality'], 'city'); }

// ---- Category routing ----
const CATEGORY_MAP = [
  {cat:'fire', keys:['alarm','fire pump','sprinkler','standpipe','fdc']},
  {cat:'ems', keys:['defibrillator','aed','medical','med']},
  {cat:'water', keys:['water','hydrant']},
  {cat:'gas', keys:['gas','propane','lng','cng','meter']},
  {cat:'electric', keys:['electric','electrical','panel','disconnect','generator']},
  {cat:'hazmat', keys:['hazmat','haz-mat','hazard','tank','combustible','flammable','oxidizer','corrosive']},
  {cat:'construction', keys:['construction','building','roof','wall','stairs','materials']},
  {cat:'elevator', keys:['elevator','lift','machine room','shutoff']},
  {cat:'contact', keys:['knox','contact','phone','owner','manager','address','site']}
];
function whichCategory(key){
  const k = String(key).toLowerCase();
  if (k.includes('combustible') || k.includes('tank')) return 'hazmat';
  if (k.includes('alarm') || k.includes('fire pump') || k.includes('sprinkler')) return 'fire';
  if (k.includes('knox')) return 'contact';
  for(const m of CATEGORY_MAP) if(m.keys.some(w => k.includes(w))) return m.cat;
  if (k.includes('photo')) return 'contact';
  return null;
}

// --- helpers to guarantee General Information + contact-body exist ---
function ensureGeneralInfo(){
  var gi = document.getElementById('general-info');
  if (!gi){
    gi = document.createElement('section');
    gi.id = 'general-info';
    gi.className = 'tile';
    gi.innerHTML = '<div class="tile-head"><h2 class="tile-title">General Information</h2></div><div class="tile-body" id="contact-body"></div>';
    var panel = document.getElementById('results-panel');
    if (panel && panel.parentNode){ panel.parentNode.insertBefore(gi, panel.nextSibling); }
    else { document.body.appendChild(gi); }
  }
  gi.classList.remove('hidden');
  return gi;
}
function getContactBody(){
  var gi = ensureGeneralInfo();
  let contactBody = gi.querySelector('#contact-body');
  if (!contactBody){
    contactBody = document.createElement('div');
    contactBody.id = 'contact-body';
    contactBody.className = 'tile-body';
    gi.appendChild(contactBody);
  }
  if (!contactBody.prepend){
    contactBody.prepend = function(node){ if(this.firstChild){ this.insertBefore(node, this.firstChild); } else { this.appendChild(node); } };
  }
  return contactBody;
}

// ---- Image helpers (Drive-resilient) ----
function driveIdsFromUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('drive.google.com')) return null;
    const m = url.match(/\/file\/d\/([^/]+)\//);
    if (m && m[1]) return m[1];
    const id = u.searchParams.get('id');
    return id || null;
  } catch { return null; }
}
function driveCandidates(id) {
  return [
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://drive.google.com/uc?export=download&id=${id}`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
  ];
}
function splitMaybeList(v){ if (typeof v !== 'string') return [v]; const parts = v.split(/[\n;]|,(?=\s*https?:)/g); if (parts.length === 1) return v.split(/\s*,\s*/g); return parts.map(s => s.trim()).filter(Boolean); }
function cleanCaption(c){ return String(c || '').replace(/\bphoto\b\s*:?/i, '').trim(); }
function addThumb(container, src, caption){
  if (!container) return;
  const items = splitMaybeList(src).map(s=>String(s).trim()).filter(Boolean);
  items.forEach(rawUrl => {
    const wrap = document.createElement('div'); wrap.className='thumb';
    const img = new Image(); img.loading='lazy'; img.referrerPolicy='no-referrer';
    const nice = cleanCaption(caption); img.alt = nice || 'Image';
    const chain = [rawUrl];
    const id = driveIdsFromUrl(rawUrl); if (id) driveCandidates(id).forEach(u => { if (!chain.includes(u)) chain.push(u); });
    let idx = 0; function tryNext(){ if (idx >= chain.length){ wrap.classList.add('broken'); img.remove(); return; } img.src = chain[idx++]; }
    img.onerror = tryNext; tryNext();
    wrap.append(img); container.append(wrap);
    wrap.addEventListener('click', () => { if (img && img.complete && img.naturalWidth > 0) openModal(img.src, nice); else window.open(chain[0], '_blank', 'noopener'); });
  });
}

// ---- Modal viewer ----
const modal = document.getElementById('img-modal');
const modalImg = document.getElementById('modal-img');
const modalCap = document.getElementById('modal-caption');
const modalClose = document.getElementById('modal-close');
const modalInner = document.querySelector('#img-modal .modal-inner');
function openModal(src, caption){ if(!modal) return; modalImg.src=src; modalCap.textContent=cleanCaption(caption); if(!modal.open) modal.showModal(); }
if(modalClose) modalClose.addEventListener('click',()=>modal.close());
if (modal) modal.addEventListener('click', (e) => {
  if (!modalInner) return;
  const r = modalInner.getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (outside) modal.close();
});

// ---- Map (Leaflet + Esri) ----
let map = L.map('map',{zoomControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
let parcelLayer = null;
function fitTo(lat,lng){
  if (Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat,lng],17);
  else map.setView([42.2289,-71.5185],13);
}
function highlightParcelSmart(parcelId){
  if(!PARCEL_URL || !L.esri) return;
  try{
    if(parcelLayer){ map.removeLayer(parcelLayer); parcelLayer=null; }
    if(!parcelId) return;
    const q = L.esri.query({ url: PARCEL_URL }).returnGeometry(true);
    q.where(`MAP_PAR_ID='${parcelId}' OR LOC_ID='${parcelId}'`).run((err, fc) => {
      if(!err && fc && fc.features && fc.features.length){
        parcelLayer = L.geoJSON(fc).addTo(map);
        const b = parcelLayer.getBounds(); if(b.isValid()) map.fitBounds(b,{padding:[12,12]});
      }
    });
  }catch(e){ console.warn('Parcel layer not available:', e); }
}

// ---- Search table ----
let ALL_ROWS = []; let CURRENT_INDEX = -1;
let IDX = []; let FILTERED = []; let PAGE = 1;
const PAGE_SIZE = 5;

function normalizeAddress(s){ return String(s||'').toLowerCase().trim(); }
function makeIndex(rows){
  IDX = rows.map((r,i)=>{
    const addr=getAddress(r); const city=getCity(r);
    const name=firstNonEmpty(r,['Business Name','Site Name','Location Name']);
    const parcel=firstNonEmpty(r,['LOC_ID','Map/Parcel','MAP_PARCEL','Parcel']);
    const label = addr ? (city ? addr+', '+city : addr) : (name || parcel || '(untitled)');
    return { i, label, addr:addr||'', city:city||'', name:name||'', parcel:parcel||'', hay:[addr,city,name,parcel].join(' ').toLowerCase() };
  });
  IDX.sort((a,b)=>a.label.localeCompare(b.label));
  FILTERED = IDX.slice();
}
function ensureResultsUI(){
  const sel = document.getElementById('address-select'); if (sel) sel.style.display='none';
  const old = document.getElementById('search-results'); if (old) old.style.display='none';
  if (document.getElementById('results-panel')) return;
  const header = document.querySelector('.page-header') || document.querySelector('header');
  const panel = el('div','results-panel'); panel.id='results-panel';
  panel.innerHTML = `
    <div class="results-head">
      <div class="results-meta"><span id="results-count"></span></div>
      <div class="results-pager">
        <button id="res-prev" type="button" aria-label="Previous">◀</button>
        <span id="res-page">1</span>
        <button id="res-next" type="button" aria-label="Next">▶</button>
      </div>
    </div>
    <div class="results-wrap">
      <table id="results-table"><thead>
        <tr><th>Address</th><th>City</th><th>Name</th><th>Parcel</th><th>Actions</th></tr>
      </thead><tbody></tbody></table>
    </div>`;
  (header && header.after) ? header.after(panel) : document.body.prepend(panel);

  if (!document.getElementById('results-table-css')) {
    const css=document.createElement('style'); css.id='results-table-css';
    css.textContent = `
      .results-panel{margin:8px 0 14px; background:var(--panel); border:1px solid var(--ring); border-radius:12px; overflow:hidden;}
      .results-head{display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid var(--ring);}
      .results-meta{font-size:12px; color:var(--muted);}
      .results-pager{display:flex; gap:8px; align-items:center;}
      .results-pager button{background:#0f172a; color:#fff; border:1px solid var(--ring); border-radius:8px; padding:6px 10px; cursor:pointer;}
      .results-wrap{overflow:auto; max-height:44vh;}
      #results-table{width:100%; border-collapse:collapse; font-size:14px;}
      #results-table th,#results-table td{padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.06); text-align:left;}
      #results-table tbody tr{cursor:pointer;} #results-table tbody tr:hover{background:#111827;}
      #results-table td:last-child{width:1%; white-space:nowrap;}
      .open-btn{background:#111827; color:#fff; border:1px solid var(--ring); border-radius:8px; padding:6px 10px; cursor:pointer;}
      @media (max-width:720px){ #results-table th:nth-child(3), #results-table td:nth-child(3){display:none;} }
    `;
    document.head.appendChild(css);
  }
  document.getElementById('res-prev').addEventListener('click', ()=>{ if(PAGE>1){ PAGE--; renderResults(); } });
  document.getElementById('res-next').addEventListener('click', ()=>{
    const max = Math.max(1, Math.ceil(FILTERED.length / PAGE_SIZE));
    if(PAGE < max){ PAGE++; renderResults(); }
  });
}
function renderResults(){
  ensureResultsUI(); hideIntro(); updateNavOffset();
  const tb=document.querySelector('#results-table tbody'); const count=document.getElementById('results-count'); const pageLbl=document.getElementById('res-page');
  if(!tb) return;
  const max = Math.max(1, Math.ceil(FILTERED.length / PAGE_SIZE)); if(PAGE>max) PAGE=max;
  const start=(PAGE-1)*PAGE_SIZE; const end=Math.min(start+PAGE_SIZE, FILTERED.length);
  let html=''; for(let k=start;k<end;k++){ const it=FILTERED[k];
    html += `<tr data-i="${it.i}">
      <td>${it.addr || it.label}</td>
      <td>${it.city || ''}</td>
      <td>${it.name || ''}</td>
      <td>${it.parcel || ''}</td>
      <td><button class="open-btn" data-i="${it.i}">Open</button> <button class="btn-edit" data-i="${it.i}" data-id="${(ALL_ROWS[it.i]&&(ALL_ROWS[it.i].id||ALL_ROWS[it.i]['id']))||''}">Edit</button></td>
    </tr>`;
  }
  tb.innerHTML = html;
  count.textContent = `${FILTERED.length} site${FILTERED.length===1?'':'s'}`;
  pageLbl.textContent = `${PAGE}/${max}`;
  tb.querySelectorAll('tr').forEach(tr => tr.addEventListener('click', ()=>{ const i=parseInt(tr.getAttribute('data-i'),10); if(Number.isInteger(i)) selectRow(i); }));
  tb.querySelectorAll('.open-btn').forEach(btn => btn.addEventListener('click', (e)=>{ e.stopPropagation(); const i=parseInt(btn.getAttribute('data-i'),10); if(Number.isInteger(i)) selectRow(i); }));
}
function selectRow(i){
  ensureGeneralInfo(); getContactBody();
  loadRow(i); showIntro(); showTiles();
  const contact = document.getElementById('contact-card'); if (contact) contact.scrollIntoView({behavior:'smooth', block:'start'});
}
function updateNavOffset(){ try{ const panel=document.getElementById('results-panel'); const nav=document.querySelector('.side-nav'); if(!panel||!nav) return; const rect=panel.getBoundingClientRect(); const top=Math.max(0, Math.round(rect.top + window.scrollY - 8)); document.documentElement.style.setProperty('--nav-top', top + 'px'); }catch(e){} }
window.addEventListener('resize', updateNavOffset);

// ---- Show/Hide intro & tiles ----
function hideIntro(){ const intro=document.querySelector('.intro'); if(intro) intro.style.display='none'; }
function showIntro(){ const intro=document.querySelector('.intro'); if(intro){ intro.style.display='grid'; intro.removeAttribute('hidden'); } const mapWrap=document.getElementById('map-wrapper'); if(mapWrap){ mapWrap.removeAttribute('hidden'); } }
function hideTiles(){ const t=document.querySelector('.tiles'); if(t) t.style.display='none'; }
function showTiles(){ const t=document.querySelector('.tiles'); if(t) t.style.display='grid'; }

// ---- Load + render row ----
function clearContainers(){
  const nm=document.getElementById('contact-name'); if(nm) nm.textContent='';
  ['contact-kv','contact-photos','fire-body','fire-photos','ems-body','ems-photos','water-body','water-photos','gas-body','gas-photos','electric-body','electric-photos','hazmat-body','hazmat-photos','construction-body','construction-photos','elevator-body','elevator-photos']
    .forEach(id => { const n=document.getElementById(id); if(n) n.innerHTML=''; });
}
function loadRow(i){
  function looksLikeImage(val){ return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(String(val)); }
  CURRENT_INDEX = i; const r = ALL_ROWS[i]; if(!r) return;
  ensureGeneralInfo(); const contactBody = getContactBody();
  document.getElementById('page-title').textContent = firstNonEmpty(r,['Business Name','Site Name','Location Name','Address','Street Address'],'address') || 'Pre-Plan';
  clearContainers();
  // ensure containers
  let contactKV=document.getElementById('contact-kv'); let contactPhotos=document.getElementById('contact-photos');
  if(!contactKV){ contactKV=el('div','kv'); contactKV.id='contact-kv'; contactBody.prepend(contactKV); }
  if(!contactPhotos){ contactPhotos=el('div','thumbs'); contactPhotos.id='contact-photos'; contactBody.append(contactPhotos); }

  const curatedKeys=['Business Name','Site Address','Street Address','Address','City','State','Zip','Primary Contact','Primary Phone','Primary Number','Contact Number','Contact Phone','Knox Box Location','Closest Hydrant'];
  const seen=new Set(); curatedKeys.forEach(k=>{ if(r[k]){ addRow(contactKV,k,r[k]); seen.add(k.toLowerCase()); } });
  const skipAlways=new Set(['latitude','lat','longitude','lng','long','loc_id','map/parcel','map_parcel','map_par_id','parcel']);
  Object.keys(r).forEach(key=>{
    const val=r[key]; if(val==null||String(val).trim()==='') return;
    const lower=key.toLowerCase(); if(seen.has(lower) || skipAlways.has(lower)) return;
    const cat=whichCategory(key);
    if(cat==='contact' && !looksLikeImage(val) && !lower.includes('photo')){ addRow(contactKV,key,val); seen.add(lower); }
  });

  const photoTargets={ contact:document.getElementById('contact-photos'), fire:document.getElementById('fire-photos'), ems:document.getElementById('ems-photos'), water:document.getElementById('water-photos'), gas:document.getElementById('gas-photos'), electric:document.getElementById('electric-photos'), hazmat:document.getElementById('hazmat-photos'), construction:document.getElementById('construction-photos'), elevator:document.getElementById('elevator-photos') };
  const bodyTargets={ fire:document.getElementById('fire-body'), ems:document.getElementById('ems-body'), water:document.getElementById('water-body'), gas:document.getElementById('gas-body'), electric:document.getElementById('electric-body'), hazmat:document.getElementById('hazmat-body'), construction:document.getElementById('construction-body'), elevator:document.getElementById('elevator-body') };
  Object.keys(r).forEach(key=>{
    const val=r[key]; if(val==null||String(val).trim()==='') return;
    const lower=key.toLowerCase(); if(seen.has(lower)) return;
    if(lower.includes('photo') || looksLikeImage(val)){ const cat=whichCategory(key)||'contact'; addThumb(photoTargets[cat]||photoTargets.contact, val, key); return; }
    const cat=whichCategory(key); if(cat && cat!=='contact' && bodyTargets[cat]) addRow(bodyTargets[cat], key, val);
  });

  const lat=parseFloat(r['Latitude']||r['Lat']); const lng=parseFloat(r['Longitude']||r['Lng']); fitTo(lat,lng);
  const parcel=r['LOC_ID']||r['Map/Parcel']||r['MAP_PARCEL']||r['Parcel']; highlightParcelSmart(parcel);
}

// ---- Data load (JSONP) ----
async function loadAllRows() {
  if (!SHEET_URL) throw new Error('SHEET_URL missing');
  const { data } = await loadJSONP(SHEET_URL);
  if (!data || !Array.isArray(data) || !data.length) throw new Error('No data in sheet response');
  return data;
}

// ---- Init ----
(async function initAll(){
  hideTiles();
  ensureResultsUI();

  // use cache immediately if present
  try {
    const cached = JSON.parse(localStorage.getItem('preplan_cache_v1')||'null');
    if (cached && Array.isArray(cached.rows) && cached.rows.length){
      ALL_ROWS = cached.rows; makeIndex(ALL_ROWS); renderResults();
    }
  } catch {}

  try {
    const rows = await loadAllRows();
    ALL_ROWS = rows; makeIndex(ALL_ROWS); renderResults();
    try{ localStorage.setItem('preplan_cache_v1', JSON.stringify({rows: ALL_ROWS, ts: Date.now()})); }catch{}
  } catch(err) {
    console.error('Failed to load sheet data:', err);
    if (!ALL_ROWS || !ALL_ROWS.length) {
      ALL_ROWS = SAMPLE_DATA.slice(); makeIndex(ALL_ROWS); renderResults();
    }
  }
})();

// ---- Edit Modal ----
function openEditModal(row){
  const dlg=document.getElementById('edit-modal'); if(!dlg) return;
  document.getElementById('edit-id').value = row?.id || row?.['id'] || '';
  document.getElementById('edit-business').value = (row && (row['Business Name'] || row.Name)) || '';
  document.getElementById('edit-address').value = (row && (row['Site Address'] || row.Address)) || '';
  document.getElementById('edit-phone').value = row?.Phone || '';
  document.getElementById('edit-notes').value = row?.Notes || '';
  dlg.showModal();
}
window.openEditModal = openEditModal;

(function setupEditModal(){
  const dlg = document.getElementById('edit-modal');
  if(!dlg) return;
  const closeBtn = document.getElementById('edit-close');
  const cancelBtn = document.getElementById('edit-cancel');
  [closeBtn, cancelBtn].forEach(b=> b && b.addEventListener('click', ()=> dlg.close()));

  const form = document.getElementById('edit-form');
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if (!WEBAPP_URL || !EDIT_SECRET) { alert('Edit endpoint not configured'); return; }
    const fd = new FormData(form); const data = {}; fd.forEach((v,k)=> data[k]=v);
    const isUpdate = !!(data.id && String(data.id).trim());
    const payload = { secret: EDIT_SECRET, action: isUpdate ? 'update' : 'append', data };

    try {
      // Opaque POST (no-cors + simple content type). We cannot read response; assume success.
      await fetch(WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      // Refresh data via JSONP to reflect changes
      const fresh = await loadAllRows();
      ALL_ROWS = fresh; makeIndex(ALL_ROWS); renderResults();
      try{ localStorage.setItem('preplan_cache_v1', JSON.stringify({rows: ALL_ROWS, ts: Date.now()})); }catch{}
      dlg.close();
    } catch(err){
      alert('Save failed: ' + String(err.message || err));
    }
  });
})();

// ---- Delegated handler for Edit buttons inside results table ----
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.btn-edit'); if(!btn) return;
  e.stopPropagation();
  const i = parseInt(btn.getAttribute('data-i'),10);
  const row = (ALL_ROWS && Number.isInteger(i)) ? ALL_ROWS[i] : null;
  window.openEditModal && window.openEditModal(row || {});
});
