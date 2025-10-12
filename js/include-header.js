(function(){
  async function fetchWithFallbacks(urls){
    for (const u of urls){
      try {
        const res = await fetch(u, {cache:'no-cache'});
        if (res.ok) return res.text();
      } catch(_) {}
    }
    throw new Error('Failed to load header from: ' + urls.join(', '));
  }

  function resolveHeaderSrc(placeholder){
    const attr = placeholder.getAttribute('data-src');
    if (attr && attr.trim()) return [attr.trim()];
    // Try common locations relative to the page
    return ['header.html', '../header.html', '/header.html', '/partials/header.html'];
  }

  function bindHamburger(header){
    if (!header || header.dataset.hamburgerBound === '1') return;
    header.dataset.hamburgerBound = '1';

    const btn  = header.querySelector('.nav__toggle');
    const menu = header.querySelector('#primary-nav');
    if (!btn || !menu) return;

    function close(){ header.classList.remove('menu-open'); btn.setAttribute('aria-expanded','false'); }
    function toggle(){
      const open = header.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', toggle);
    menu.addEventListener('click', e => { if (e.target.tagName === 'A') close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', () => { if (matchMedia('(min-width:900px)').matches) close(); });
    document.addEventListener('click', e => { if (!header.contains(e.target)) close(); });
  }

  async function loadHeaderInto(placeholder){
    try {
      const candidates = resolveHeaderSrc(placeholder);
      const html = await fetchWithFallbacks(candidates);
      placeholder.innerHTML = html;
      bindHamburger(placeholder.querySelector('.site-header'));
    } catch (e){
      console.error('[include-header] Error:', e);
    }
  }

  function init(){
    document.querySelectorAll('#header-placeholder').forEach(loadHeaderInto);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose (optional)
  window.__includeHeader = { loadHeaderInto, bindHamburger };
})();