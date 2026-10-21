/* Cálculos puros para la medición criterial V20. Compartido con las pruebas Node. */
((root) => {
  const BAND_ORDER = ['BAJO', 'MEDIO', 'ALTO', 'SUPERIOR'];
  const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  const subjectKey = value => normalize(value).replace(/\s+p\s+1 hora t$/i,'').replace(/\s+\b(?:t|tp|p)\b\s*$/i, '').trim();

  function validateBands(bands) {
    if (!Array.isArray(bands) || bands.length !== 4) return 'Se requieren cuatro bandas: Bajo, Medio, Alto y Superior.';
    let expected = 0;
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i], min = Number(band.min), max = Number(band.max);
      if (String(band.id).toUpperCase() !== BAND_ORDER[i]) return 'Las bandas deben conservar el orden Bajo, Medio, Alto y Superior.';
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 5 || min > max) return 'Cada banda debe ser válida dentro de la escala de 0 a 5.';
      if (Math.round(min * 100) !== Math.round(expected * 100)) return 'Las bandas deben ser contiguas, sin solaparse y cubrir toda la escala.';
      expected = Math.round((max + 0.01) * 100) / 100;
    }
    if (Math.round(Number(bands[0].min) * 100) !== 0 || Math.round(Number(bands[3].max) * 100) !== 500) return 'Las bandas deben cubrir desde 0,00 hasta 5,00.';
    return '';
  }

  function validateConfig(config) {
    const bandsError = validateBands(config.bands);
    if (bandsError) return bandsError;
    const values = ['INTRODUCE', 'REFUERZA', 'DOMINA'].map(key => Number(config.thresholds?.[key]));
    if (values.some(n => !Number.isFinite(n) || n < 0 || n > 5) || !(values[0] <= values[1] && values[1] <= values[2])) return 'Los umbrales deben estar entre 0 y 5 y cumplir Introduce ≤ Refuerza ≤ Domina.';
    if (!Number.isInteger(Number(config.minimumN)) || Number(config.minimumN) < 1) return 'El tamaño mínimo de muestra debe ser un entero mayor que cero.';
    if (!Number.isFinite(Number(config.margin)) || Number(config.margin) < 0 || Number(config.margin) > 100) return 'El margen del semáforo debe estar entre 0 y 100 puntos porcentuales.';
    if (!Number.isFinite(Number(config.divergenceTolerance)) || Number(config.divergenceTolerance) < 0 || Number(config.divergenceTolerance) > 100) return 'La tolerancia de convergencia debe estar entre 0 y 100 puntos porcentuales.';
    for (const kpi of Object.values(config.kpis || {})) {
      if (!Number.isFinite(Number(kpi.target)) || Number(kpi.target) < 0 || Number(kpi.target) > 100) return 'Las metas porcentuales deben estar entre 0 y 100.';
      if (!['BAJO', 'MEDIO', 'ALTO', 'SUPERIOR'].includes(kpi.minimumBand)) return 'Seleccione una banda mínima válida para cada KPI.';
      if (!['all', 'domina', 'practica'].includes(kpi.scope)) return 'Seleccione un alcance válido para cada KPI.';
    }
    if (Object.values(config.raTargets || {}).some(value => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) return 'Las metas de triangulación por RA deben estar entre 0 y 100.';
    return '';
  }

  function bandFor(score, bands) {
    if (!Number.isFinite(Number(score))) return '';
    const value = Math.round(Number(score) * 100) / 100;
    const match = bands.find(b => value >= Number(b.min) && value <= Number(b.max));
    return match ? String(match.id).toUpperCase() : '';
  }

  function quantile(values, probability) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * probability, lower = Math.floor(position), fraction = position - lower;
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
  }

  function stats(values) {
    const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!nums.length) return { n: 0, mean: null, sd: null, median: null, q1: null, q3: null, min: null, max: null };
    const mean = nums.reduce((sum, n) => sum + n, 0) / nums.length;
    const sd = nums.length > 1 ? Math.sqrt(nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (nums.length - 1)) : 0;
    return { n: nums.length, mean, sd, median: quantile(nums, .5), q1: quantile(nums, .25), q3: quantile(nums, .75), min: nums[0], max: nums.at(-1) };
  }

  function computeCriterial({ rows, subjects, raList, config, period = '', semester = '', ra = '', scope = 'all', groupBySemester = true }) {
    const byName = new Map(subjects.map(c => [subjectKey(c.name), c]));
    const courseCells = new Map();
    const isValid = row => {
      const note = Number(String(row.nota ?? '').trim().replace(',', '.'));
      return Boolean(String(row.estudiante ?? '').trim() && String(row.asignatura ?? '').trim() && Number.isFinite(note) && note >= 0 && note <= 5 && byName.has(subjectKey(row.asignatura)));
    };
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!isValid(row)) continue;
      const course = byName.get(subjectKey(row.asignatura)), rowPeriod = String(row.periodo || 'Sin periodo');
      const rowSemester = String(course.semester), student = String(row.estudiante).trim(), note = Number(String(row.nota).replace(',', '.'));
      if ((period && rowPeriod !== period) || (semester && rowSemester !== String(semester))) continue;
      for (const item of raList) {
        const level = course[item.id.toLowerCase()];
        if (!level || (ra && item.id !== ra)) continue;
        if (scope === 'domina' && level !== 'DOMINA') continue;
        if (scope === 'practica' && course.nature !== 'Práctica') continue;
        const semKey = groupBySemester ? rowSemester : 'Todos';
        const key = [student, rowPeriod, semKey, course.id, item.id].join('|');
        const cell = courseCells.get(key) || { student, period: rowPeriod, semester: semKey, course, ra: item.id, level, scores: [], records: [] };
        cell.scores.push(note); cell.records.push({ row, index }); courseCells.set(key, cell);
      }
    }
    const studentGroups = new Map();
    for (const cell of courseCells.values()) {
      const key = [cell.student, cell.period, cell.semester, cell.ra].join('|');
      const group = studentGroups.get(key) || { student: cell.student, period: cell.period, semester: cell.semester, ra: cell.ra, courses: [] };
      group.courses.push({ ...cell, score: cell.scores.reduce((a, b) => a + b, 0) / cell.scores.length, credits: Number(cell.course.credits) || 0 });
      studentGroups.set(key, group);
    }
    const thresholdByLevel = config.thresholds || {};
    return [...studentGroups.values()].map(group => {
      const included = group.courses.filter(c => c.credits > 0);
      const credits = included.reduce((sum, c) => sum + c.credits, 0);
      if (!credits) return null;
      const score = included.reduce((sum, c) => sum + c.score * c.credits, 0) / credits;
      const threshold = included.reduce((sum, c) => sum + Number(thresholdByLevel[c.level] ?? 0) * c.credits, 0) / credits;
      const records = included.flatMap(c => c.records);
      return { ...group, score, threshold, achieves: score >= threshold, band: bandFor(score, config.bands), evidenceCount: records.length, credits, courses: included, records };
    }).filter(Boolean);
  }

  function cohenKappa(pairs) {
    const n = pairs.length;
    if (!n) return { n: 0, agreement: null, kappa: null };
    let a = 0, b = 0, c = 0, d = 0;
    for (const pair of pairs) {
      if (pair.left && pair.right) a++;
      else if (pair.left && !pair.right) b++;
      else if (!pair.left && pair.right) c++;
      else d++;
    }
    const po = (a + d) / n, leftYes = (a + b) / n, rightYes = (a + c) / n;
    const pe = leftYes * rightYes + (1 - leftYes) * (1 - rightYes);
    return { n, a, b, c, d, agreement: po * 100, kappa: pe === 1 ? (po === 1 ? 1 : 0) : (po - pe) / (1 - pe) };
  }

  function migrateState(previous, defaults) {
    const saved = previous && typeof previous === 'object' ? previous : {};
    const base=structuredClone(defaults),config={...base.config,...(saved.config||{})};
    for(const key of ['thresholds','raTargets','items'])config[key]={...(base.config[key]||{}),...((saved.config||{})[key]||{})};
    config.kpis={...(base.config.kpis||{})};
    for(const [id,value] of Object.entries(saved.config?.kpis||{}))config.kpis[id]={...(config.kpis[id]||{}),...value};
    config.modules=Array.isArray(saved.config?.modules)?saved.config.modules:base.config.modules;
    config.bands=Array.isArray(saved.config?.bands)?saved.config.bands:base.config.bands;
    return { ...base, ...saved, config, sources: { ...base.sources, ...(saved.sources || {}) }, imports:{...base.imports,...(saved.imports||{})} };
  }

  root.CORA_CriterialCore = { BAND_ORDER, normalize, subjectKey, validateBands, validateConfig, bandFor, quantile, stats, computeCriterial, cohenKappa, migrateState };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CORA_CriterialCore;
})(globalThis);
