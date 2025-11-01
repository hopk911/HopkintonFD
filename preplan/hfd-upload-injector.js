// hfd-upload-injector.js
// Robust, standalone injector that adds per-section Upload buttons and
// ensures photo links are merged into the save payload.
//
// Include this file AFTER your existing popup-edit.js in index.html.
//
// <script src="popup-edit.js"></script>
// <script src="hfd-upload-injector.js"></script>

(function(){
  if (window.__HFD_UPLOAD_INJECTOR__) return;
  window.__HFD_UPLOAD_INJECTOR__ = true;

  // ===== CONFIG: Your Drive folders by sheet header (NO trailing colon) =====
  const PHOTO_UPLOAD_FOLDERS = {
    'Photo:':                    '1AZWEVmdqmuUZceORmi24ULowcuPURGvWwIB4rJKklGkaIx8M_5jl789mHLLwQoCvtLOWrQHj',
    'Roof Access Photo:':               '1tB3H1OAgBW5cmMugNFKbJPpK80FaDa7ZQ36xCSamawFFefRMsZ1cLlPRSmnll6BSLu62c5S0',
    'Alarm Photo':              '1UWb5MlIFy6QqgKn5ST3F5XW9hgl_MtzE4aJzomb7l0iS3c9jbA_fg4_kq7KZ_Pt7GrLLnp3c',
    'Elevator Shutoff Photo:':   '1H_VrGy1fkWPK38BJSCgjqNrP3W3G0jcLLLTDfGpJno2KihA3Lzb8G6fXqjfgwvcAmK8gLoM-',
    'Gas Shutoff Photo:':        '1bgG9RNthY7FsAhGAddu3OKCRL5NU4-HS2iS_n6YOPoX-X4Pdr-J9RFYQWAiCPbFgvsBuyQMG',
    'Electrical Shutoff Photo:': '1dcc6X2iAoykCd5zLztJsW6PmYUn18W6Pu6g83ATyWD7ej7oSTg-Wi2-HJEluwwEqaitz8pSg',
    'Water Shutoff Photo:':      '1CyzbXB5R3JnMgbqumS0VsAo0FwlHrRdEnUbIj7_Je_4ROkVsJiGu8WhtagzZHXulW8QQ1pci',
    'Sprinkler Shutoff Photo:':  '1E54lFORNMMzNDzx0S2Y-4CdCCCWtFb_DIZlh31c5D0DeKWITKsjvkx37zVt-Ta09aWIVAMq0',
    'Fire Pump Photo:':          '1LZldDUuXr1qv3LwNqwiDKb9dv55H5PVWi7gCnXUxRRp6T8QStSTA8xO_bZbIc72rTRd8Pi8V',
    'Tanks Photo:':              '1VdqT_6_7uUYtSUwyc0ruXV2NrM6IYivI5Jf9LoL5vX1IlCZPUXxEGVrHtJwWlT4ZDBqdyGLV',
    'Combustibles Photo:':       '1Pf6Vk6MwYZnS5UE3hRfCQsZijNHaf6DfZorFxKWusxKHE39zhX248XUqepQXHnRoYKusYDP-',
    'Hazmat Photo:':             '1ms9ufkhmAcs9Dfh7uoaUo74Adkox-ZNesVTLMbwS8Wku-K2hyUOueHy7vvgG_I-7mSP-lNNx'
  };

  const modal = document.getElementById('recordModal');

  function appendPreviews(header, links){
    try{
      const secId = sectionForField(header);
      const secEl = document.getElementById('section-' + secId);
      if (!secEl) return;
      let grid = secEl.querySelector('.thumb-grid');
      if (!grid){
        grid = document.createElement('div');
        grid.className = 'thumb-grid';
        secEl.appendChild(grid);
      }
      links.forEach(u=>{
        let html = '';
        try{
          if (typeof window.buildImgWithFallback === 'function'){
            html = window.buildImgWithFallback(u, '', 300);
          } else {
            // Drive thumb as simple fallback
            const id = (String(u).match(/[?&]id=([\w-]{10,})/)||String(u).match(/\/d\/([\w-]{10,})/))?.[1] || '';
            const url = id ? ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w300') : String(u);
            html = '<img src="'+url+'" class="thumb" loading="lazy" alt="photo">';
          }
        }catch(e){ html=''; }
        if (html){
          const tmp = document.createElement('div'); tmp.innerHTML = html;
          const img = tmp.firstChild;
          grid.appendChild(img);
          try{ if (window.loadThumbsWithin) window.loadThumbsWithin(grid); }catch(e){}
        }
      });
    }catch(e){}
  }


function sectionForField(label){
  // Heuristics mapping headers -> section ids used in your UI
  const L = String(label||'').toLowerCase();

  // NEW: route any elevator-related header to the Elevators section
  if (/(^|\b)(elevators?|elevator (bank|key|room)|lift|elev\b)/.test(L)) return 'elevators';

  if (/^(alarm|pull|fdc|standpipe|riser|sprinkler|fire pump)/.test(L)) return 'fire';
  if (/(water|hydrant|cistern|sprinkler)/.test(L)) return 'water';
  if (/(electric|electrical|panel|breaker|generator)/.test(L)) return 'electric';
  if (/(gas|propane)/.test(L)) return 'gas';
  if (/(hazmat|chemical|combustible|flammable|tank)/.test(L)) return 'hazmat';
  return 'other';
}

  // Merge photo fields into save payload
  function mergePhotoFieldsIntoPayload(payload) {
    try {
      const rec = (window && window._currentRecord) ? window._currentRecord : {};
      if (!rec) return payload;
      Object.keys(PHOTO_UPLOAD_FOLDERS).forEach(header => {
        const val = (rec[header] || '').trim();
        if (!val) return;
        payload[header] = val;
        if (!header.endsWith(':')) payload[header + ':'] = val;
      });
    } catch (e) { console.warn('mergePhotoFieldsIntoPayload skipped:', e); }
    return payload;
  }

  // Patch collectFromPopup / saveEdits defensively
  (function patchSavers(){
    try {
      const oldCollect = window.collectFromPopup;
      if (typeof oldCollect === 'function') {
        window.collectFromPopup = function(){
          const payload = oldCollect.apply(this, arguments);
          return mergePhotoFieldsIntoPayload(payload);
        };
      }
    } catch (e) {}
    try {
      const oldSave = window.saveEdits;
      if (typeof oldSave === 'function') {
        window.saveEdits = async function(){
          // Ensure _currentRecord already contains latest photo links; oldSave will use collectFromPopup
          return await oldSave.apply(this, arguments);
        };
      }
    } catch (e) {}
  })();

  async function uploadOneFileToDrive(file, folderId){
    if (!window.WEBAPP_URL) throw new Error('WEBAPP_URL is not set');
    // Try multipart first
    try{
      const fd = new FormData();
      fd.append('fn', 'upload');
      fd.append('folderId', folderId);
      fd.append('name', file.name);
      fd.append('file', file, file.name);
      const res = await fetch(window.WEBAPP_URL, { method: 'POST', body: fd, credentials: 'omit' });
      const json = await res.json();
      if (res.ok && json && json.ok) return json;
      if (json && /No file field found/i.test(String(json.error||''))) throw new Error('fallback-b64');
      throw new Error(json && json.error || ('HTTP ' + res.status));
    }catch(err){
      if (String(err.message) !== 'fallback-b64') throw err;
      // Fallback: base64
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error('reader'));
        fr.onload = () => resolve(fr.result);
        fr.readAsDataURL(file);
      });
      const fd2 = new FormData();
      fd2.append('fn','uploadB64');
      fd2.append('folderId', folderId);
      fd2.append('name', file.name);
      fd2.append('data', dataUrl);
      const res2 = await fetch(window.WEBAPP_URL, { method: 'POST', body: fd2, credentials: 'omit' });
      const json2 = await res2.json();
      if (!res2.ok || !json2.ok) throw new Error(json2.error || ('HTTP ' + res2.status));
      return json2;
    }
  }

  function ensureSectionHeaderControls(sectionEl){
    if (!sectionEl) return null;
    let bar = sectionEl.querySelector('.per-section-uploads');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'per-section-uploads';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px;';
    const h3 = sectionEl.querySelector('h3');
    if (h3 && h3.nextSibling) sectionEl.insertBefore(bar, h3.nextSibling);
    else sectionEl.prepend(bar);
    return bar;
  }

  function mountButtons(){
    if (!modal || !modal.classList.contains('editing')) return;
    const rec = (window && window._currentRecord) ? window._currentRecord : {};
    Object.keys(PHOTO_UPLOAD_FOLDERS).forEach(header => {
      const secId = sectionForField(header);
      const secEl = document.getElementById('section-' + secId);
      if (!secEl) return;
      const bar = ensureSectionHeaderControls(secEl);
      if (!bar) return;
      if (bar.querySelector('[data-hfd-upload=\"' + header + '\"]')) return;

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.setAttribute('data-hfd-upload', header);
      btn.textContent = 'Upload: ' + header;

      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.multiple = true;
      inp.style.display = 'none';

      const wrap = document.createElement('span');
      wrap.style.cssText = 'display:inline-flex;gap:6px;align-items:center;';
      wrap.appendChild(btn); wrap.appendChild(inp);
      bar.appendChild(wrap);

      btn.addEventListener('click', ()=> inp.click());
      inp.addEventListener('change', async ()=>{
        if (!inp.files || !inp.files.length) return;
        const folderId = PHOTO_UPLOAD_FOLDERS[header] || '';
        if (!folderId){ alert('No folder ID set for \"' + header + '\"'); inp.value=''; return; }
        const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Uploading…';
        const links = [];
        try{
          for (const f of inp.files){
            const { link } = await uploadOneFileToDrive(f, folderId);
            links.push(link);
          }
        }catch(e){
          console.error(e); alert('Upload failed: ' + e.message);
        }finally{
          btn.disabled = false; btn.textContent = prev; inp.value='';
        }
        if (!links.length) return;
        // Update in-memory record for save
        try{
          const base = (rec && rec[header]) ? String(rec[header]).trim() : '';
          const csv = [base, links.join(', ')].filter(Boolean).join(', ');
          if (window._currentRecord) window._currentRecord[header] = csv;
        }catch(e){}
      });
    });
  }

  // Re-mount buttons whenever the modal switches to edit mode
  if (modal){
    const mo = new MutationObserver(()=>{
      if (modal.classList.contains('editing')) mountButtons();
    });
    mo.observe(modal, { attributes:true, attributeFilter:['class'] });
  }
  // Also poll for robustness (some flows delay section rendering)
  setInterval(()=>{
    if (modal && modal.open && modal.classList.contains('editing')) mountButtons();
  }, 800);
})();
