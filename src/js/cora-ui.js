/* CORA · capa de interacción visual.
   Solo presentación: buscador rápido de vistas (Ctrl/⌘ K), cifras animadas,
   barra de progreso de lectura y botón para volver arriba. Navega pulsando los
   mismos botones del menú, así que no altera la lógica de la aplicación. */
(function () {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  /* ---------- Barra de progreso y volver arriba ---------- */
  const progress = document.createElement('div');
  progress.className = 'cora-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  const dock = document.createElement('div');
  dock.className = 'cora-dock';
  dock.innerHTML =
    '<button type="button" class="cora-dock__btn cora-dock__search" aria-label="Buscar una vista">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<span>Ir a…</span><kbd>' + (isMac ? '⌘' : 'Ctrl') + ' K</kbd></button>' +
    '<button type="button" class="cora-dock__btn cora-dock__theme" aria-label="Cambiar entre modo claro y oscuro">' +
    '<svg class="cora-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
    '<svg class="cora-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>' +
    '<button type="button" class="cora-dock__btn cora-dock__top" aria-label="Volver arriba">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>';
  document.body.appendChild(dock);
  /* ---------- Tema claro / oscuro ---------- */
  const root = document.documentElement;
  const themeBtn = dock.querySelector('.cora-dock__theme');
  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    themeBtn.title = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0A1220' : '#0F2D57';
    if (persist) { try { localStorage.setItem('cora-tema', theme); } catch (error) { /* sin almacenamiento */ } }
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  themeBtn.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.addEventListener?.('change', (event) => {
    let saved = null; try { saved = localStorage.getItem('cora-tema'); } catch (error) { /* sin almacenamiento */ }
    if (!saved) applyTheme(event.matches ? 'dark' : 'light', false);
  });

  const topBtn = dock.querySelector('.cora-dock__top');
  topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const ratio = max > 0 ? Math.min(1, scrollY / max) : 0;
      progress.style.transform = 'scaleX(' + ratio + ')';
      dock.classList.toggle('is-scrolled', scrollY > 480);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- Buscador rápido de vistas ---------- */
  const palette = document.createElement('div');
  palette.className = 'cora-palette';
  palette.hidden = true;
  palette.innerHTML =
    '<div class="cora-palette__backdrop" data-close></div>' +
    '<div class="cora-palette__panel" role="dialog" aria-modal="true" aria-label="Ir a una vista">' +
    '<div class="cora-palette__search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<input type="text" placeholder="Buscar vista…" aria-label="Buscar vista" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>' +
    '<ul class="cora-palette__list" role="listbox"></ul></div>';
  document.body.appendChild(palette);
  const input = palette.querySelector('input');
  const list = palette.querySelector('.cora-palette__list');
  let items = [];
  let active = 0;
  let lastFocus = null;

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function collect() {
    const proposal = document.getElementById('proposal-sidebar');
    const useProposal = proposal && !proposal.hidden;
    const root = useProposal ? proposal : document.getElementById('vigente-sidebar');
    if (!root) return [];
    const out = [];
    let group = '';
    root.querySelectorAll('.nav-group, summary, .nav-item').forEach((el) => {
      if (!el.classList.contains('nav-item')) { group = el.textContent.trim(); return; }
      const num = el.querySelector('span');
      out.push({
        el,
        num: num ? num.textContent.trim() : '',
        label: el.textContent.replace(num ? num.textContent : '', '').trim(),
        group,
        current: el.classList.contains('is-active'),
      });
    });
    return out;
  }

  function render() {
    const q = norm(input.value.trim());
    const shown = items.filter((it) => !q || norm(it.label + ' ' + it.group + ' ' + it.num).includes(q));
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'cora-palette__empty';
      li.textContent = 'Sin coincidencias';
      list.appendChild(li);
    }
    shown.forEach((it, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = 'cora-palette__item' + (i === active ? ' is-active' : '') + (it.current ? ' is-current' : '');
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = '<span class="cora-palette__num"></span><span class="cora-palette__label"></span><span class="cora-palette__group"></span>';
      li.children[0].textContent = it.num;
      li.children[1].textContent = it.label;
      li.children[2].textContent = it.current ? 'Vista actual' : it.group;
      li.addEventListener('mousemove', () => { if (active !== i) { active = i; render(); } });
      li.addEventListener('click', () => go(it));
      list.appendChild(li);
    });
    list._shown = shown;
    const cur = list.querySelector('.is-active');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    items = collect();
    lastFocus = document.activeElement;
    input.value = '';
    active = Math.max(0, items.findIndex((it) => it.current));
    palette.hidden = false;
    document.documentElement.classList.add('cora-palette-open');
    render();
    requestAnimationFrame(() => input.focus());
  }
  function close() {
    palette.hidden = true;
    document.documentElement.classList.remove('cora-palette-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function go(it) {
    close();
    const details = it.el.closest('details');
    if (details && !details.open) details.open = true;
    it.el.click();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  input.addEventListener('input', () => { active = 0; render(); });
  palette.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
  palette.addEventListener('keydown', (e) => {
    const shown = list._shown || [];
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); render(); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); go(shown[active]); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      palette.hidden ? open() : close();
    }
  });
  dock.querySelector('.cora-dock__search').addEventListener('click', open);

  /* ---------- Cifras animadas en las tarjetas de métricas ---------- */
  if (!reduceMotion) {
    const running = new WeakMap();
    const pattern = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(\D*)$/;

    function animate(el) {
      const target = el.textContent.trim();
      const m = target.match(pattern);
      if (!m || running.get(el) === target) return;
      const value = Number(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : ''));
      if (!value) return;
      const decimals = m[3] ? m[3].length : 0;
      const fmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: m[2].includes('.') });
      const start = performance.now();
      const duration = 700;
      let written = null;
      running.set(el, target);
      function frame(now) {
        if (written !== null && el.textContent !== written) { running.delete(el); return; }
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        written = t < 1 ? m[1] + fmt.format(value * eased) + m[4] : target;
        el.textContent = written;
        if (t < 1) requestAnimationFrame(frame);
        else running.delete(el);
      }
      requestAnimationFrame(frame);
    }

    const scan = (root) => root.querySelectorAll && root.querySelectorAll('.metric b').forEach(animate);
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('.metric b')) animate(n);
          else scan(n);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
