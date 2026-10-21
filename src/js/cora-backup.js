/* CORA · respaldo de datos del navegador.
   Exporta en un archivo JSON todas las claves que CORA guarda en localStorage
   (plan vigente, propuesta, evidencia y criterios) y permite restaurarlas. */
(function () {
  'use strict';
  const PREFIXES = ['motor-ra-fisioterapia', 'cora-fisioterapia-'];
  const FORMAT = 'cora-respaldo';
  const VERSION = 1;

  const ownKey = (key) => PREFIXES.some((prefix) => key.startsWith(prefix));

  function storageKeys() {
    const keys = [];
    try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (ownKey(key)) keys.push(key); } } catch (error) { /* almacenamiento bloqueado */ }
    return keys.sort();
  }

  function setStatus(root, message, kind) {
    const status = root.querySelector('[data-backup-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind || '';
  }

  function exportBackup(root) {
    const keys = storageKeys();
    if (!keys.length) { setStatus(root, 'No hay datos guardados en este navegador para respaldar.', 'warning'); return; }
    const data = {};
    keys.forEach((key) => { data[key] = localStorage.getItem(key); });
    const payload = { formato: FORMAT, version: VERSION, exportado: new Date().toISOString(), claves: keys.length, datos: data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date();
    const stamp = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    link.download = 'CORA-respaldo-' + stamp + '.json';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(root, 'Respaldo descargado: ' + keys.length + (keys.length === 1 ? ' conjunto de datos.' : ' conjuntos de datos.'), 'ok');
  }

  function importBackup(root, file) {
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try { payload = JSON.parse(reader.result); } catch (error) { setStatus(root, 'El archivo no es un JSON válido.', 'error'); return; }
      if (!payload || payload.formato !== FORMAT || typeof payload.datos !== 'object') { setStatus(root, 'El archivo no es un respaldo de CORA.', 'error'); return; }
      const entries = Object.entries(payload.datos).filter(([key, value]) => ownKey(key) && typeof value === 'string');
      if (!entries.length) { setStatus(root, 'El respaldo no contiene datos de CORA.', 'error'); return; }
      const when = payload.exportado ? new Date(payload.exportado).toLocaleString('es-CO') : 'fecha desconocida';
      if (!confirm('Se reemplazarán los datos de CORA guardados en este navegador por el respaldo del ' + when + '. ¿Continuar?')) return;
      try {
        storageKeys().forEach((key) => localStorage.removeItem(key));
        entries.forEach(([key, value]) => localStorage.setItem(key, value));
      } catch (error) { setStatus(root, 'No fue posible guardar el respaldo en este navegador.', 'error'); return; }
      setStatus(root, 'Respaldo restaurado. Recargando…', 'ok');
      setTimeout(() => location.reload(), 500);
    };
    reader.readAsText(file);
  }

  const template =
    '<div class="cora-backup__copy"><h3>Respaldo de datos</h3>' +
    '<p class="muted">Guarda en un archivo todas las notas, evidencias y criterios de este navegador, o restáuralos.</p></div>' +
    '<div class="actions"><button type="button" class="button secondary" data-backup-export>Descargar respaldo</button>' +
    '<label class="button ghost cora-backup__import">Restaurar respaldo<input type="file" accept="application/json,.json" data-backup-import></label></div>' +
    '<p class="cora-backup__status" data-backup-status role="status" aria-live="polite"></p>';

  ['cargas', 'proposal-cargas'].forEach((id) => {
    const section = document.getElementById(id);
    if (!section) return;
    const panel = document.createElement('div');
    panel.className = 'panel cora-backup';
    panel.innerHTML = template;
    section.appendChild(panel);
    panel.querySelector('[data-backup-export]').addEventListener('click', () => exportBackup(panel));
    const input = panel.querySelector('[data-backup-import]');
    input.addEventListener('change', () => { if (input.files[0]) importBackup(panel, input.files[0]); input.value = ''; });
  });
})();
