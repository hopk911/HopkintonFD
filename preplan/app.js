// app.js — photos once, water keywords adjusted, colored UI hooks compatible, improved modal UX

// ---- Global config ----
var SHEET_URL = window.GOOGLE_SHEET_JSON_URL;
var PARCEL_URL = window.PARCEL_FEATURE_LAYER_URL || "";

// ---- DOM helpers ----
function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function niceKey(k){ return String(k).replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
function addRow(container, k, v){
  const row = el('div','row');
  row.append(el('div','k', niceKey(k)));
  row.append(el('div','v', String(v)));
  container.append(row);
}

// ---- Flexible field getters ----
function firstNonEmpty(row, candidates, contains=false){
  for(const key of candidates){ if(row[key] && String(row[key]).trim()!=='') return String(row[key]).trim(); }
  if(contains){
    for(const k in row){
      if(k && k.toLowerCase().includes(contains) && String(row[k]).trim()!=='') return String(row[k]).trim();
    }
  }
  return '';
}
function getAddress(row){
  return firstNonEmpty(row, ['Street Address','Site Address','Address','Address 1','Addr','Location Address','Street'], 'address');
}
function getCity(row){
  return firstNonEmpty(row, ['City','Town','Municipality'], 'city');
}

// ---- Category routing ----
const CATEGORY_MAP = [
  {cat:'fire', keys:['alarm','fire pump','sprinkler','standpipe','fdc']},
  {cat:'ems', keys:['defibrillator','aed','medical','med']},
  // Water (removed 'shutoff' and 'main shutoff' per request)
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

// ---- Image helpers (Drive-resilient, one thumbnail per photo) ----
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
    `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  ];
}
function normalizeImageCandidates(u) {
  // Return only the original URL; fallbacks are attempted internally so we render one thumb.
  if (!u) return [];
  return [String(u).trim()];
}
function splitMaybeList(v){
  if (typeof v !== 'string') return [v];
  const parts = v.split(/[\n;]|,(?=\s*https?:)/g);
  if (parts.length === 1) return v.split(/\s*,\s*/g);
  return parts.map(s => s.trim()).filter(Boolean);
}
function cleanCaption(c){
  return String(c || '')
    .replace(/\bphoto\b\s*:?/i, '')
    .trim();
}
function addThumb(container, src, caption){
  if (!container) return;
  const items = splitMaybeList(src).flatMap(normalizeImageCandidates).filter(Boolean);

  items.forEach(rawUrl => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    const img = new Image();
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    const nice = cleanCaption(caption);
    img.alt = nice || 'Image';

    const chain = [rawUrl];
    const id = driveIdsFromUrl(rawUrl);
    if (id) {
      driveCandidates(id).forEach(u => { if (!chain.includes(u)) chain.push(u); });
    }

    let idx = 0;
    function tryNext(){
      if (idx >= chain.length) { wrap.classList.add('broken'); img.remove(); return; }
      img.src = chain[idx++];
    }
    img.onerror = tryNext;
    tryNext();

    wrap.append(img);
    container.append(wrap);

    wrap.addEventListener('click', () => {
      if (img && img.complete && img.naturalWidth > 0) {
        openModal(img.src, nice);
      } else {
        window.open(chain[0], '_blank', 'noopener');
      }
    });
  });
}

// ---- Modal viewer ----
const modal = document.getElementById('img-modal');
const modalImg = document.getElementById('modal-img');
const modalCap = document.getElementById('modal-caption');
const modalClose = document.getElementById('modal-close');
const modalInner = document.querySelector('#img-modal .modal-inner');

function openModal(src, caption){
  if(!modal) return;
  modalImg.src = src; 
  modalCap.textContent = cleanCaption(caption);
  if(!modal.open) modal.showModal();
}
if(modalClose) modalClose.addEventListener('click',()=>modal.close());

// Close when clicking outside the card
if (modal) {
  modal.addEventListener('click', (e) => {
    if (!modalInner) return;
    const r = modalInner.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) modal.close();
  });
}

// ---- Map (Leaflet + Esri) ----
let map = L.map('map',{zoomControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
let parcelLayer = null;
function fitTo(lat,lng){
  if (Number.isFinite(lat) && Number.isFinite(lng)) map.setView([lat,lng],17);
  else map.setView([42.2289,-71.5185],13);
}
function highlightParcelSmart(parcelId, lat, lng){
  if(!PARCEL_URL || !L.esri) return;
  try{
    if(parcelLayer){ map.removeLayer(parcelLayer); parcelLayer = null; }
    const q = L.esri.query({ url: PARCEL_URL }).returnGeometry(true);
    if(parcelId){
      const where = `MAP_PAR_ID='${parcelId}' OR LOC_ID='${parcelId}'`;
      q.where(where).run((err, fc) => {
        if(!err && fc && fc.features && fc.features.length){
          parcelLayer = L.geoJSON(fc).addTo(map);
          const b = parcelLayer.getBounds(); if(b.isValid()) map.fitBounds(b,{padding:[12,12]});
        }
      });
    }
  }catch(e){ console.warn('Parcel layer not available:', e); }
}

// ---- Search + select ----
let ALL_ROWS = []; let CURRENT_INDEX = -1;
function normalizeAddress(s){ return String(s||'').toLowerCase().trim(); }
function buildSearchIndex(rows){
  return rows.map((r,i)=>{
    const addr=getAddress(r), city=getCity(r);
    const name=firstNonEmpty(r,['Business Name','Site Name','Location Name']);
    const parcel=firstNonEmpty(r,['LOC_ID','Map/Parcel','MAP_PARCEL','Parcel']);
    const label = addr ? [addr,city].filter(Boolean).join(', ') : (name || parcel || '(untitled)');
    return { i, label, hay:[addr,city,name,parcel].join(' ').toLowerCase() };
  });
}
function renderSearchResults(items){
  const box=document.getElementById('search-results'); if(!box) return;
  box.innerHTML=''; if(!items.length){ box.style.display='none'; return; }
  items.slice(0,25).forEach(it=>{
    const div=el('div','search-item',it.label);
    div.addEventListener('click',()=>{ loadRow(it.i); box.style.display='none'; });
    box.append(div);
  });
  box.style.display='block';
}
function attachSearch(rows){
  const form=document.getElementById('search-form');
  const input=document.getElementById('search-input');
  const results=document.getElementById('search-results');
  if(!form||!input||!results) return;
  const idx=buildSearchIndex(rows);
  input.addEventListener('input',()=>{
    const q=normalizeAddress(input.value);
    if(!q){ results.style.display='none'; return; }
    renderSearchResults(idx.filter(it => it.hay.includes(q)));
  });
  form.addEventListener('submit',(e)=>{
    e.preventDefault();
    const q=normalizeAddress(input.value);
    const m=idx.filter(it=>it.hay.includes(q));
    if(m.length) loadRow(m[0].i);
  });
}
function buildAddressSelect(rows){
  const sel=document.getElementById('address-select'); if(!sel) return;
  sel.innerHTML=''; sel.append(new Option('Choose a site…',''));
  rows.forEach((r,i)=>{
    const addr=getAddress(r), city=getCity(r);
    const parcel=firstNonEmpty(r,['LOC_ID','Map/Parcel','MAP_PARCEL','Parcel']);
    const label = addr ? [addr,city].filter(Boolean).join(', ') : (parcel || '(untitled)');
    sel.append(new Option(label,String(i)));
  });
  sel.addEventListener('change',()=>{ const i=parseInt(sel.value); if(Number.isInteger(i)) loadRow(i); });
}

// ---- Load + render ----
function clearContainers(){
  ['contact-kv','contact-photos','fire-body','fire-photos','ems-body','ems-photos','water-body','water-photos','gas-body','gas-photos','electric-body','electric-photos','hazmat-body','hazmat-photos','construction-body','construction-photos','elevator-body','elevator-photos']
    .forEach(id => { const n=document.getElementById(id); if(n) n.innerHTML=''; });
}
function looksLikeImage(val){ return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(String(val)); }

function loadRow(i){
  CURRENT_INDEX = i; const r = ALL_ROWS[i]; if(!r) return;

  document.getElementById('page-title').textContent =
    firstNonEmpty(r, ['Business Name','Site Name','Location Name','Address','Street Address'], 'address') || 'Pre-Plan';

  clearContainers();

  // Ensure contact containers exist
  const contactBody=document.getElementById('contact-body');
  let contactKV=document.getElementById('contact-kv');
  let contactPhotos=document.getElementById('contact-photos');
  if(!contactKV){ contactKV=el('div','kv'); contactKV.id='contact-kv'; contactBody.prepend(contactKV); }
  if(!contactPhotos){ contactPhotos=el('div','thumbs'); contactPhotos.id='contact-photos'; contactBody.append(contactPhotos); }

  // Curated + extra contact fields (de-duped)
  const curatedKeys=['Business Name','Site Address','Street Address','Address','City','State','Zip','Primary Contact','Primary Phone','Primary Number','Contact Number','Contact Phone','Knox Box Location','Closest Hydrant'];
  const seen=new Set();
  curatedKeys.forEach(k=>{ if(r[k]){ addRow(contactKV,k,r[k]); seen.add(k.toLowerCase()); } });
  const skipAlways = new Set(['latitude','lat','longitude','lng','long','loc_id','map/parcel','map_parcel','map_par_id','parcel']);
  Object.keys(r).forEach(key=>{
    const val=r[key]; if(val==null||String(val).trim()==='') return;
    const lower=key.toLowerCase();
    if(seen.has(lower) || skipAlways.has(lower)) return;
    const cat=whichCategory(key);
    if(cat==='contact' && !looksLikeImage(val) && !lower.includes('photo')){
      addRow(contactKV,key,val); seen.add(lower);
    }
  });

  // Route others to tiles + photos
  const photoTargets={
    contact:document.getElementById('contact-photos'),
    fire:document.getElementById('fire-photos'),
    ems:document.getElementById('ems-photos'),
    water:document.getElementById('water-photos'),
    gas:document.getElementById('gas-photos'),
    electric:document.getElementById('electric-photos'),
    hazmat:document.getElementById('hazmat-photos'),
    construction:document.getElementById('construction-photos'),
    elevator:document.getElementById('elevator-photos'),
  };
  const bodyTargets={
    fire:document.getElementById('fire-body'),
    ems:document.getElementById('ems-body'),
    water:document.getElementById('water-body'),
    gas:document.getElementById('gas-body'),
    electric:document.getElementById('electric-body'),
    hazmat:document.getElementById('hazmat-body'),
    construction:document.getElementById('construction-body'),
    elevator:document.getElementById('elevator-body'),
  };
  Object.keys(r).forEach(key=>{
    const val=r[key]; if(val==null||String(val).trim()==='') return;
    const lower=key.toLowerCase(); if(seen.has(lower)) return;
    if(lower.includes('photo') || looksLikeImage(val)){
      const cat=whichCategory(key)||'contact';
      addThumb(photoTargets[cat]||photoTargets.contact, val, key);
      return;
    }
    const cat=whichCategory(key);
    if(cat && cat!=='contact' && bodyTargets[cat]) addRow(bodyTargets[cat], key, val);
  });

  const lat=parseFloat(r['Latitude']||r['Lat']);
  const lng=parseFloat(r['Longitude']||r['Lng']);
  fitTo(lat,lng);
  const parcel=r['LOC_ID']||r['Map/Parcel']||r['MAP_PARCEL']||r['Parcel'];
  highlightParcelSmart(parcel,lat,lng);
}

// ---- Initialize (robust) ----
(async function initAll(){
  if(!SHEET_URL){ console.error('SHEET_URL missing'); return; }
  try{
    const res = await fetch(SHEET_URL, {mode:'cors', cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text(); let json;
    try { json = JSON.parse(text); } catch(e){ console.error('Response not JSON:', text); throw e; }
    const rows = Array.isArray(json) ? json :
                 (json && Array.isArray(json.data)) ? json.data :
                 (json && Array.isArray(json.records)) ? json.records :
                 (json && json.result && Array.isArray(json.result)) ? json.result : [];
    if(!rows.length) throw new Error('No data in sheet response');
    ALL_ROWS = rows;
    attachSearch(rows);
    buildAddressSelect(rows);
  }catch(err){
    console.error('Failed to load sheet data:', err);
    const box=document.getElementById('search-results');
    if(box){ box.innerHTML = `<div class="search-item">Data load failed: ${String(err.message||err)}</div>`; box.style.display='block'; }
  }
})();