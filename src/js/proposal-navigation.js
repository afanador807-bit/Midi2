/* Navegación de la propuesta: independiente de los módulos de datos y gráficos. */
(() => {
  'use strict';

  function showView(id) {
    if (typeof id !== 'string' || !id) return false;
    const target = document.getElementById(id);
    if (!target?.classList.contains('proposal-view')) return false;

    document.querySelectorAll('.proposal-view').forEach(view => {
      view.classList.toggle('is-active', view === target);
    });

    const menuButtons = document.querySelectorAll('#proposal-sidebar .nav-item[data-proposal-view]');
    let selectedButton = null;
    menuButtons.forEach(button => {
      const active = button.dataset.proposalView === id;
      button.classList.toggle('is-active', active);
      if (active) selectedButton = button;
    });
    selectedButton?.closest('.proposal-menu-group')?.setAttribute('open', '');

    document.dispatchEvent(new CustomEvent('cora:proposal-view-change', { detail: { id } }));
    return true;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-proposal-view], [data-proposal-nav]');
    if (!button) return;
    const shell = document.getElementById('proposal-main');
    const sidebar = document.getElementById('proposal-sidebar');
    if (!shell?.contains(button) && !sidebar?.contains(button)) return;

    const id = button.dataset.proposalView || button.dataset.proposalNav;
    if (showView(id)) event.preventDefault();
  }, true);

  document.addEventListener('cora:proposal-view-request', event => {
    showView(event.detail?.id);
  });
})();
