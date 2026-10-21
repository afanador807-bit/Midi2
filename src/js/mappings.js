/* Acceso compatible a la matriz unificada, definida en activity-mappings.js. */
window.MOTOR_RA_MATRIZ = Object.fromEntries(
  window.MOTOR_RA_MAPEO.subjects.map(asignatura => [asignatura.name, asignatura])
);
