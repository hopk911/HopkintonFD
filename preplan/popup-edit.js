// popup-edit.js — robust Edit/Done toggle + JSONP save (CORS-free)
(function () {
  'use strict';

  // ---- DOM hooks (match index.html) ----
  const modal   = document.getElementById('recordModal');
  const content = document.getElementById('modalContent');
  const btn     = document.getElementById('btnModalEdit');

  if (!modal || !content || !btn) {
    console.warn('[popup-edit] Required elements not found. Aborting.');
    alert('Edit UI not initialized: required elements missing.');
    return;
  }

  const WEBAPP_URL  = (window && window.WEBAPP_URL)  || '';
  const EDIT_SECRET = (window && window.EDIT_SECRET) || '';

  // Fields that must not be editable
  const LOCKED_KEYS = ['stable id'];
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const isLocked = label => LOCKED_KEYS.includes(norm(label));

  // Visual hint styles (once)
  (function injectStyleOnce(){
    if (document.getElementById('popup-edit-style')) return;
    const st = document.createElement('style');
    st.id = 'popup-edit-style';
    st.textContent = `
      .kv .v[contenteditable="true"]{outline:2px dashed #888;padding:2px;border-radius:6px}
      .modal-head #btnModalEdit.toggled{background:#111;color:#fff}
      .kv.locked .v{pointer-events:none;opacity:.8}
      .kv.locked .k::after{content:" (locked)";font-weight:400;opacity:.7}
    `;
    document.head.appendChild(st);
  })();

  let editing = false;

  function setEditable(on){
    editing = !!on;
    modal.classList.toggle('editing', editing);
    btn.classList.toggle('toggled', editing);
    btn.textContent = editing ? 'Done' : 'Edit';

    const rows = content.querySelectorAll('.kv');
    rows.forEach(row => {
      const kEl = row.querySelector('.k');
      const vEl = row.querySelector('.v');
      if (!kEl || !vEl) return;
      const locked = isLocked(kEl.innerText);
      row.classList.toggle('locked', locked);
      if (editing && !locked){
        vEl.setAttribute('contenteditable','true');
        if (!vEl.hasAttribute('data-original')) vEl.setAttribute('data-original', vEl.innerText);
      } else {
        vEl.removeAttribute('contenteditable');
      }
    });
  }

  function collectFromPopup(){
    const data = {};
    const rows = content.querySelectorAll('.kv');
    rows.forEach(row => {
      const k = (row.querySelector('.k')?.innerText || '').trim();
      const v = (row.querySelector('.v')?.innerText || '').trim();
      if (k) data[k] = v;
    });
    return data;
  }

  function getCurrentRecord(){
    // Prefer record exposed by the bundle when modal opens
    // (openModal in the bundle sets window._currentRecord when we patched it)
    const rec = (window._currentRecord && typeof window._currentRecord === 'object') ? window._currentRecord : null;
    if (rec) return rec;

    // Fallback: parse from the current popup
    const parsed = collectFromPopup();
    if (Object.keys(parsed).length) {
      console.warn('[popup-edit] window._currentRecord not set by bundle; using parsed modal data.');
      return parsed;
    }
    return {};
  }

  // ---- JSONP helper (CORS-free) ----
  function saveViaJSONP(url, payload){
    return new Promise((resolve, reject) => {
      const cbName = '__popupEditCB_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');

      const cleanup = () => { try { delete window[cbName]; s.remove(); } catch(e){} };

      window[cbName] = (data) => {
        cleanup();
        if (data && data.ok === false) reject(new Error(data.error || 'save error'));
        else resolve(data || { ok: true });
      };

      s.onerror = () => { cleanup(); reject(new TypeError('JSONP load failed')); };

      const qs = [
        'fn=save',
        'callback=' + encodeURIComponent(cbName),
        'payload='  + encodeURIComponent(JSON.stringify(payload))
      ];
      if (EDIT_SECRET) qs.push('secret=' + encodeURIComponent(EDIT_SECRET));
      s.src = url + '?' + qs.join('&');

      document.head.appendChild(s);
    });
  }

  async function saveEdits(){
    if (!WEBAPP_URL){
      alert('Save is not configured: WEBAPP_URL is empty.');
      return;
    }

    const original = getCurrentRecord();
    const edited   = collectFromPopup();

    // Merge and protect Stable ID (whatever the exact header casing is)
    let payload = Object.assign({}, original, edited);
    (function keepStableID(){
      const sKey = Object.keys(original||{}).find(k => norm(k) === 'stable id')
                  || Object.keys(edited||{}).find(k => norm(k) === 'stable id');
      if (sKey && original[sKey]) payload[sKey] = original[sKey];
    })();

    // UI feedback
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Saving…';

    try {
      const data = await saveViaJSONP(WEBAPP_URL, payload);
      console.log('[popup-edit] JSONP response:', data);
      try{ if(window && window._currentRecord) window._currentRecord.__saved = true; }catch(e){}

      setEditable(false);
      setTimeout(() => location.reload(), 250);
    } catch (e) {
      console.error('[popup-edit] save failed', e);
      alert('Save failed. See console for details.');
      btn.textContent = label;
    } finally {
      btn.disabled = false;
    }
  }

  // ---- Bind the Edit/Done button ----
  btn.addEventListener('click', () => {
    if (!editing) setEditable(true);
    else saveEdits();
  });
  try{ if (window && window._isNewDraft) setEditable(true); }catch(e){}

  // If modal content re-renders while editing, exit edit mode to avoid stale state
  const observer = new MutationObserver(() => { if (editing) setEditable(false); });
  observer.observe(content, { childList: true });
})();
