/* Selector de programa independiente de los módulos de cálculo. */
(() => {
  const selector = document.querySelector('#program-selector');
  if (!selector) return;

  selector.addEventListener('change', () => {
    const proposal = selector.value === 'v20';
    const sidebar = document.querySelector('#sidebar');
    const vigenteMenu = document.querySelector('#vigente-sidebar');
    const proposalMenu = document.querySelector('#proposal-sidebar');
    const vigenteMain = document.querySelector('#main');
    const proposalMain = document.querySelector('#proposal-main');
    const skipLink = document.querySelector('.skip-link');

    sidebar?.classList.toggle('proposal-mode', proposal);
    if (vigenteMenu) vigenteMenu.hidden = proposal;
    if (vigenteMain) vigenteMain.hidden = proposal;
    if (proposalMenu) proposalMenu.hidden = !proposal;
    if (proposalMain) proposalMain.hidden = !proposal;
    if (skipLink) skipLink.href = proposal ? '#proposal-main' : '#main';

    document.dispatchEvent(new CustomEvent('cora:program-change', {
      detail: { program: proposal ? 'v20' : 'vigente' }
    }));
  });
})();
