(function(){
  async function loadHeaderInto(placeholder){
    try {
      const res = await fetch('/partials/header.html', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load header.html');
      const html = await res.text();
      placeholder.innerHTML = html;

      const header = placeholder.querySelector('.site-header');
      bindHamburger(header);
    } catch (e) {
      console.error('[include-header] ', e);
    }
  }

  function bindHamburger(header){
    if (!header || header.dataset.hamburgerBound === '1') return;
    header.dataset.hamburgerBound = '1';

    const btn  = header.querySelector('.nav__toggle');
    const menu = header.querySelector('#primary-nav');
    if (!btn || !menu) return;

    function open(){ header.classList.add('menu-open'); btn.setAttribute('aria-expanded','true'); }
    function close(){ header.classList.remove('menu-open'); btn.setAttribute('aria-expanded','false'); }
    function toggle(){ header.classList.toggle('menu-open'); btn.setAttribute('aria-expanded', header.classList.contains('menu-open') ? 'true' : 'false'); }

    btn.addEventListener('click', toggle);
    menu.addEventListener('click', function(e){ if (e.target.tagName === 'A') close(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function(){ if (matchMedia('(min-width:900px)').matches) close(); });
    document.addEventListener('click', function(e){
      if (!header.contains(e.target) && header.classList.contains('menu-open')) close();
    });
  }

  // Auto-run on DOM ready
  function init(){
    document.querySelectorAll('#header-placeholder').forEach(loadHeaderInto);
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose hooks (optional)
  window.__bindHamburger = bindHamburger;
  window.__loadHeaderInto = loadHeaderInto;
})();