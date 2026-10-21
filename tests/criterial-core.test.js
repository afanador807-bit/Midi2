/* Pruebas de los cálculos criteriales de CORA.
   Se ejecutan sobre la fuente (src/js) y sobre la versión publicada y minificada
   (assets), para confirmar que la compilación no cambia ningún resultado.
   Uso: npm test */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BANDS = [
  { id: 'BAJO', min: 0, max: 2.99 },
  { id: 'MEDIO', min: 3, max: 3.49 },
  { id: 'ALTO', min: 3.5, max: 3.99 },
  { id: 'SUPERIOR', min: 4, max: 5 },
];
const CONFIG = {
  bands: BANDS,
  thresholds: { INTRODUCE: 3, REFUERZA: 3.5, DOMINA: 4 },
  minimumN: 5,
  margin: 10,
  divergenceTolerance: 15,
  kpis: { KPI1: { target: 80, minimumBand: 'ALTO', scope: 'domina' } },
  raTargets: { RA1: 80 },
};
const SUBJECTS = [
  { id: 'c1', name: 'Morfofisiología I', semester: 1, credits: 3, nature: 'Teórico-práctica', ra1: 'INTRODUCE' },
  { id: 'c2', name: 'Prescripción del ejercicio I', semester: 1, credits: 2, nature: 'Práctica', ra1: 'DOMINA' },
  { id: 'c3', name: 'Bioética', semester: 2, credits: 2, nature: 'Teórica', ra2: 'REFUERZA' },
];
const RA_LIST = [{ id: 'RA1' }, { id: 'RA2' }];
const near = (actual, expected, digits = 6) => assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≉ ${expected}`);

for (const [label, file] of [['fuente', 'src/js/criterial-core.js'], ['publicado', 'assets/criterial-core.js']]) {
  const core = require(path.join(ROOT, file));

  test(`${label} · ejemplo del README: nota criterial 3,84 y umbral 3,40`, () => {
    const rows = [
      { estudiante: 'E1', asignatura: 'Morfofisiología I', nota: '4,0', periodo: '2026-1' },
      { estudiante: 'E1', asignatura: 'Prescripción del ejercicio I', nota: '3.6', periodo: '2026-1' },
    ];
    const [group] = core.computeCriterial({ rows, subjects: SUBJECTS, raList: RA_LIST, config: CONFIG });
    near(group.score, 3.84);
    near(group.threshold, 3.4);
    assert.equal(group.achieves, true);
    assert.equal(group.band, 'ALTO');
    assert.equal(group.credits, 5);
    assert.equal(group.evidenceCount, 2);
  });

  test(`${label} · promedia varias evidencias de la misma asignatura antes de ponderar`, () => {
    const rows = [
      { estudiante: 'E2', asignatura: 'Morfofisiología I', nota: 2, periodo: 'P' },
      { estudiante: 'E2', asignatura: 'Morfofisiología I', nota: 4, periodo: 'P' },
    ];
    const [group] = core.computeCriterial({ rows, subjects: SUBJECTS, raList: RA_LIST, config: CONFIG });
    near(group.score, 3);
    assert.equal(group.achieves, true);
    assert.equal(group.band, 'MEDIO');
  });

  test(`${label} · excluye filas inválidas o con asignatura desconocida`, () => {
    const rows = [
      { estudiante: '', asignatura: 'Morfofisiología I', nota: 4 },
      { estudiante: 'E3', asignatura: 'Asignatura inexistente', nota: 4 },
      { estudiante: 'E3', asignatura: 'Morfofisiología I', nota: 6 },
      { estudiante: 'E3', asignatura: 'Morfofisiología I', nota: 'x' },
    ];
    assert.deepEqual(core.computeCriterial({ rows, subjects: SUBJECTS, raList: RA_LIST, config: CONFIG }), []);
  });

  test(`${label} · filtros de periodo, RA y alcance Domina`, () => {
    const rows = [
      { estudiante: 'E4', asignatura: 'Morfofisiología I', nota: 4.5, periodo: '2025-2' },
      { estudiante: 'E4', asignatura: 'Prescripción del ejercicio I', nota: 3, periodo: '2026-1' },
      { estudiante: 'E4', asignatura: 'Bioética', nota: 3.2, periodo: '2026-1' },
    ];
    const args = { rows, subjects: SUBJECTS, raList: RA_LIST, config: CONFIG };
    assert.equal(core.computeCriterial({ ...args, period: '2026-1' }).length, 2);
    assert.deepEqual(core.computeCriterial({ ...args, ra: 'RA2' }).map((g) => g.ra), ['RA2']);
    const domina = core.computeCriterial({ ...args, scope: 'domina' });
    assert.deepEqual(domina.map((g) => g.courses.map((c) => c.course.id)), [['c2']]);
  });

  test(`${label} · reconoce el nombre de la asignatura sin tildes ni sufijos`, () => {
    assert.equal(core.subjectKey('MORFOFISIOLOGIA  I  T'), core.subjectKey('Morfofisiología I'));
  });

  test(`${label} · bandas: clasificación y validación`, () => {
    assert.equal(core.bandFor(2.994, BANDS), 'BAJO');
    assert.equal(core.bandFor(3.499, BANDS), 'ALTO');
    assert.equal(core.bandFor(5, BANDS), 'SUPERIOR');
    assert.equal(core.bandFor('n/a', BANDS), '');
    assert.equal(core.validateBands(BANDS), '');
    assert.match(core.validateBands(BANDS.slice(0, 3)), /cuatro bandas/);
    assert.match(core.validateBands([{ ...BANDS[0], max: 3.2 }, ...BANDS.slice(1)]), /contiguas/);
  });

  test(`${label} · validación de la configuración`, () => {
    assert.equal(core.validateConfig(CONFIG), '');
    assert.match(core.validateConfig({ ...CONFIG, thresholds: { INTRODUCE: 4, REFUERZA: 3.5, DOMINA: 4 } }), /Introduce ≤ Refuerza ≤ Domina/);
    assert.match(core.validateConfig({ ...CONFIG, minimumN: 0 }), /tamaño mínimo/);
    assert.match(core.validateConfig({ ...CONFIG, kpis: { KPI1: { target: 120, minimumBand: 'ALTO', scope: 'all' } } }), /metas porcentuales/);
  });

  test(`${label} · cuantiles con interpolación lineal y estadísticos`, () => {
    near(core.quantile([1, 2, 3, 4], 0.25), 1.75);
    near(core.quantile([1, 2, 3, 4], 0.5), 2.5);
    assert.equal(core.quantile([], 0.5), null);
    const s = core.stats([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.equal(s.n, 8);
    near(s.mean, 5);
    near(s.sd, 2.138089935, 8);
    assert.equal(s.min, 2);
    assert.equal(s.max, 9);
  });

  test(`${label} · kappa de Cohen`, () => {
    const pairs = [
      ...Array(20).fill({ left: true, right: true }),
      ...Array(5).fill({ left: true, right: false }),
      ...Array(10).fill({ left: false, right: true }),
      ...Array(15).fill({ left: false, right: false }),
    ];
    const k = core.cohenKappa(pairs);
    assert.equal(k.n, 50);
    near(k.agreement, 70);
    near(k.kappa, 0.4);
    assert.equal(core.cohenKappa([]).kappa, null);
    assert.equal(core.cohenKappa([{ left: true, right: true }]).kappa, 1);
  });

  test(`${label} · migración de estado conserva lo guardado y completa lo nuevo`, () => {
    const defaults = { config: { ...CONFIG, items: { RA1: ['a'] }, modules: ['m'] }, sources: { saberPro: [] }, imports: {} };
    const migrated = core.migrateState({ config: { thresholds: { DOMINA: 4.2 }, kpis: { KPI1: { target: 70 } } }, sources: { perception: [1] } }, defaults);
    assert.equal(migrated.config.thresholds.DOMINA, 4.2);
    assert.equal(migrated.config.thresholds.INTRODUCE, 3);
    assert.equal(migrated.config.kpis.KPI1.target, 70);
    assert.equal(migrated.config.kpis.KPI1.minimumBand, 'ALTO');
    assert.deepEqual(migrated.sources, { saberPro: [], perception: [1] });
    assert.deepEqual(migrated.config.modules, ['m']);
  });
}

test('datos de la propuesta: 50 asignaturas, 162 créditos, 9 semestres, 6 RA, 5 dimensiones y 5 cadenas', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/proposal-curriculum.js'), 'utf8'), context);
  const data = context.window.CORA_FISIO_V20;
  assert.equal(data.subjects.length, 50);
  assert.equal(data.subjects.reduce((sum, s) => sum + Number(s.credits || 0), 0), 162);
  assert.equal(data.metadata.semesterCount, 9);
  assert.equal(data.ra.length, 6);
  assert.equal(data.dimensions.length, 5);
  assert.equal(data.chains.length, 5);
  assert.deepEqual({ ...data.levelFactors }, { INTRODUCE: 0.33, REFUERZA: 0.66, DOMINA: 1 });
  assert.deepEqual([...data.dimensions].map((d) => d.credits).sort((a, b) => a - b), [12, 13, 18, 23, 96]);
});
