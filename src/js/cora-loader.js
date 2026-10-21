/* CORA · carga diferida de la propuesta curricular.
   Los módulos de la propuesta solo se descargan la primera vez que se elige ese
   programa. Al terminar se repite el aviso de cambio de programa para que la
   propuesta se inicialice igual que si hubiera estado cargada desde el inicio. */
(function () {
  'use strict';
  const VERSION = '__CORA_VERSION__';
  const BUNDLE = [
    'assets/proposal-curriculum.js',
    'assets/proposal-life-cycle.js',
    'assets/criterial-core.js',
    'assets/laminas-v21/manifest.js',
    'assets/proposal-app.js',
    'assets/proposal-evidence.js',
  ];
  let loading = null;

  function load() {
    if (loading) return loading;
    document.documentElement.classList.add('cora-loading-proposal');
    loading = new Promise((resolve, reject) => {
      let last = null;
      BUNDLE.forEach((src) => {
        const script = document.createElement('script');
        script.src = src + '?v=' + VERSION;
        script.async = false; // conserva el orden de ejecución
        script.onerror = () => reject(new Error('No se pudo cargar ' + src));
        document.body.appendChild(script);
        last = script;
      });
      last.onload = () => resolve();
    }).finally(() => document.documentElement.classList.remove('cora-loading-proposal'));
    return loading;
  }

  function onProgramChange(event) {
    if (event.detail?.program !== 'v20' || window.CORA_V20_EVIDENCE) return;
    load().then(() => {
      document.removeEventListener('cora:program-change', onProgramChange);
      if (document.querySelector('#program-selector')?.value === 'v20') {
        document.dispatchEvent(new CustomEvent('cora:program-change', { detail: { program: 'v20' } }));
      }
    }).catch((error) => {
      console.error(error);
      loading = null;
      const notice = document.querySelector('#proposal-demo-global-notice');
      if (notice) { notice.hidden = false; notice.textContent = 'No se pudo cargar la propuesta curricular. Recargue la página.'; }
    });
  }
  document.addEventListener('cora:program-change', onProgramChange);
  window.CORA_LOAD_PROPOSAL = load;
})();
