/* Módulo independiente para la propuesta de Fisioterapia V20. */
(() => {
  const data = window.CORA_FISIO_V20;
  if (!data) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const courseKey = (v) => normalize(v).replace(/\s*\((?:t|tp|p)\)(?:\s*\+\s*\(1 hora t\))?\s*$/i, '').replace(/\s+/g, ' ').trim();
  const courses = data.subjects;
  const raList = data.ra;
  const lifeCycle = data.lifeCycle || { stages: [], bySubject: {} };
  const lifeStageById = new Map(lifeCycle.stages.map(stage => [stage.id, stage]));
  const courseById = new Map(courses.map(x => [x.id, x]));
  const courseByName = new Map();
  for (const course of courses) {
    courseByName.set(courseKey(course.name), course);
    courseByName.set(normalize(course.name), course);
  }
  const aliases = new Map([
    ['formacion ciudadana', 'formacion ciudadana (fish)'],
    ['psicologia de la salud y el movimiento humano:', 'psicologia de la salud y el movimiento humano'],
    ['psicologia de la salud y el movimiento humano (t):', 'psicologia de la salud y el movimiento humano'],
    ['con-tacto relacional y etica cordial', 'etica de la alteridad'],
    ['practica i (publica)', 'practica i (salud publica)'],
    ['practica iii (af + d)', 'practica iii (actividad fisica y deporte)'],
    ['practica iii af+d', 'practica iii (actividad fisica y deporte)'],
    ['practica iv (consul ext)', 'practica iv (consulta externa)'],
    ['investigacion formativa / trabajo de grado i', 'investigacion formativa / trabajo de grado i / semillero'],
    ['investigacion / trabajo de grado ii / diplomado', 'investigacion / trabajo de grado ii / diplomado / semillero'],
    ['investigacion formativa / trabajo de grado i (t) / semillero', 'investigacion formativa / trabajo de grado i / semillero'],
    ['investigacion / trabajo de grado ii / diplomado (t) / semillero', 'investigacion / trabajo de grado ii / diplomado / semillero'],
    ['practica integrada de profundizacion y desempeno profesional (p) + (8cp/2ct)', 'practica integrada de profundizacion y desempeno profesional'],
  ]);
  const storageKey = 'cora-fisioterapia-propuesta-v20-v1';
  const demoSource = 'Muestra demostrativa CORA · datos simulados';
  const demoVersion = 5;
  const demoPeriods = Array.from({length:6},(_,i)=>[`${2021+i}-1`,`${2021+i}-2`]).flat();
  const freshState = () => ({ rows: [], uploads: [], demoDismissed: false, demoVersion });
  let state;
  try { state = JSON.parse(localStorage.getItem(storageKey)) || freshState(); } catch { state = freshState(); }
  let validRowsCache=null, resultsCache=null, studentTrajectoryCache=null;
  const rowStatusCache=new WeakMap(), courseLookupCache=new Map();
  function invalidateDerivedData(){validRowsCache=null;resultsCache=null;studentTrajectoryCache=null;}
  state.rows=(Array.isArray(state.rows)?state.rows:[]).map(row=>{const course=courseFor(row.asignatura);return course?{...row,asignatura:course.name}:row;});
  state.uploads=Array.isArray(state.uploads)?state.uploads:[];
  function buildDemoRows(){
    const offsets=[-.7,-.5,-.4,-.3,-.2,-.1,0,0,.1,.2,.3,.4,.5,.6,.7], rows=[];
    demoPeriods.forEach((period,periodIndex)=>courses.forEach((course,courseIndex)=>{
      const semester=Number(course.semester),isFlexible=!Number.isFinite(semester);
      // Cada cohorte avanza un semestre por periodo; así puede seguirse la misma
      // identidad sintética a través del programa, sin poner todas las asignaturas
      // de todos los semestres en el mismo periodo académico.
      const stage=isFlexible?4+(courseIndex%4):semester;
      const cohortIndex=periodIndex-(stage-1);
      if(cohortIndex<0)return;
      const cohortPeriod=demoPeriods[cohortIndex];
      for(let i=0;i<30;i++){
        // La muestra representa una trayectoria ascendente entre cohortes. Las
        // cohortes recientes permiten ver RA sobre 4,4 sin alterar su ponderación.
        const base=3.55+periodIndex*.10+stage*.04+(courseIndex%4)*.025;
        const variation=offsets[(i*7+courseIndex*3+periodIndex)%offsets.length];
        const score=Math.max(2,Math.min(5,Math.round((base+variation)*10)/10));
        rows.push({asignatura:course.name,estudiante:`SIM-${cohortPeriod}-${String(i+1).padStart(2,'0')}`,nota:score.toFixed(1),actividad:'Nota consolidada',periodo:period,tipoNota:'asignatura',isDemonstration:true});
      }
    }));
    return rows;
  }
  function addDemoSample(){
    if(state.rows.some(row=>row.isDemonstration))return false;
    const rows=buildDemoRows();state.rows.push(...rows);
    const countsByPeriod=new Map();for(const row of rows)countsByPeriod.set(row.periodo,(countsByPeriod.get(row.periodo)||0)+1);
    for(const [period,total] of countsByPeriod)state.uploads.push({file:demoSource,period,tipoNota:'asignatura',total,valid:total,omitted:0,demo:true});
    state.demoDismissed=false;state.demoVersion=demoVersion;
    document.dispatchEvent(new CustomEvent('cora:demo-sample-loaded'));
    return true;
  }
  function removeDemoSample(){
    const before=state.rows.length;state.rows=state.rows.filter(row=>!row.isDemonstration);state.uploads=state.uploads.filter(upload=>!upload.demo);state.demoDismissed=true;return before-state.rows.length;
  }
  const hasDemo=state.rows.some(row=>row.isDemonstration);
  if(hasDemo&&state.demoVersion!==demoVersion){state.rows=state.rows.filter(row=>!row.isDemonstration);state.uploads=state.uploads.filter(upload=>!upload.demo);if(!state.demoDismissed)addDemoSample();else state.demoVersion=demoVersion;try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
  if(!state.rows.length&&!state.uploads.length&&!state.demoDismissed){addDemoSample();try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
  let chosenRAs = new Set(raList.map(x => x.id));
  let chosenPeriodRAs = new Set(raList.map(x => x.id));
  let chosenSemesters = new Set(Array.from({length:data.metadata.semesterCount},(_,i)=>String(i+1)));
  let graph3D = null;
  let focusedCourse = '';
  let focusedRA = '';
  let graphMode = '3d';
  let laminaZoom = 1;
  let mindMapZoom = 1;
  let laminaPanX = 0;
  let laminaPanY = 0;
  let laminaDrag = null;

  function save() { invalidateDerivedData(); localStorage.setItem(storageKey, JSON.stringify(state)); renderAll(); window.CORA_V20_EVIDENCE?.refresh(); }
  function semesterOrder(v) { return String(v).toLowerCase()==='flexible'?99:Number(v)||100; }
  function semesterSort(a,b) { return semesterOrder(a)-semesterOrder(b); }
  function semesterLabel(v) { return String(v).toLowerCase()==='flexible'?'Flexible':'Semestre '+v; }
  function courseFor(name) {
    if(name&&typeof name==='object'&&name.courseId)return courseById.get(name.courseId)||null;
    const raw=String(name??'');
    if(courseLookupCache.has(raw))return courseLookupCache.get(raw);
    const exact = normalize(name);
    const base = aliases.get(courseKey(name)) || courseKey(name);
    const course=courseByName.get(exact) || courseByName.get(base) || null;
    courseLookupCache.set(raw,course);
    return course;
  }
  function levelFactor(level) { return data.levelFactors[level] || 0; }
  function levelName(level) { return ({ INTRODUCE:'Introduce', REFUERZA:'Refuerza', DOMINA:'Domina' })[level] || 'Sin aporte'; }
  function dimensionColor(dimension) { const value=normalize(dimension); if(value.includes('cientifico'))return '#55c9ed'; if(value.includes('formacion especifica'))return '#7bd99b'; if(value.includes('problematica social'))return '#ffc66d'; if(value.includes('investigacion'))return '#c4a2ff'; if(value.includes('cultural'))return '#ff91a7'; return '#88a9bf'; }
  function status(row) {
    const cached=rowStatusCache.get(row);if(cached)return cached;
    const noteText = String(row.nota ?? '').trim().replace(',', '.');
    const note = Number(noteText);
    let result='VÁLIDA';
    if (!row.estudiante || !row.asignatura || !noteText || !Number.isFinite(note) || note < 0 || note > 5) result='ERROR DE DATOS';
    else if (!courseFor(row.asignatura)) result='ASIGNATURA NO RECONOCIDA';
    rowStatusCache.set(row,result);return result;
  }
  function periodSort(p) { const m = String(p).match(/(\d{4})\D*(\d)/); return m ? Number(m[1]) * 10 + Number(m[2]) : Number.MAX_SAFE_INTEGER; }
  function validRows() { return validRowsCache||(validRowsCache=state.rows.filter(r => status(r) === 'VÁLIDA')); }
  function recordContributions(row) {
    const course = courseFor(row.asignatura);
    if (!course) return [];
    const score = Number(String(row.nota).replace(',', '.'));
    return raList.flatMap(ra => {
      const level = course[ra.id.toLowerCase()];
      return level ? [{ ra:ra.id, level, score:score * levelFactor(level), factor:levelFactor(level) }] : [];
    });
  }
  function results() {
    if(resultsCache)return resultsCache;
    const raw = new Map(), studentCourse = new Map();
    for (const row of validRows()) {
      const course = courseFor(row.asignatura);
      for (const contribution of recordContributions(row)) {
        const period = row.periodo || 'Sin periodo', semester = course.semester;
        const key = [period, semester, contribution.ra].join('|');
        const cell = raw.get(key) || { period, semester, ra:contribution.ra, sum:0, factors:0, count:0 };
        cell.sum += contribution.score; cell.factors += contribution.factor; cell.count++;
        raw.set(key, cell);
        const skey = [period, semester, course.id, contribution.ra, row.estudiante].join('|');
        const studentCell = studentCourse.get(skey) || { period, semester, course, ra:contribution.ra, student:row.estudiante, sum:0, count:0, factor:contribution.factor };
        studentCell.sum += contribution.score; studentCell.count++;
        studentCourse.set(skey, studentCell);
      }
    }
    const means = new Map();
    for (const cell of studentCourse.values()) {
      const key = [cell.period, cell.semester, cell.course.id, cell.ra].join('|');
      const item = means.get(key) || { period:cell.period, semester:cell.semester, course:cell.course, ra:cell.ra, factor:cell.factor, scores:[] };
      item.scores.push(cell.sum / cell.count); means.set(key,item);
    }
    const courseMeansByGroup = new Map();
    for(const c of means.values()){
      const row={...c,score:c.scores.reduce((a,b)=>a+b,0)/c.scores.length};
      if(row.course.credits<=0)continue;
      const key=[row.period,row.semester,row.ra].join('|'),bucket=courseMeansByGroup.get(key)||[];
      bucket.push(row);courseMeansByGroup.set(key,bucket);
    }
    resultsCache=[...raw.values()].map(item => {
      const rows = courseMeansByGroup.get([item.period,item.semester,item.ra].join('|'))||[];
      const credits = rows.reduce((s,c)=>s+c.course.credits,0), factorCredits = rows.reduce((s,c)=>s+c.course.credits*c.factor,0);
      return { ...item, direct:item.sum/item.count, credit:credits?rows.reduce((s,c)=>s+c.score*c.course.credits,0)/credits:null, comparable:factorCredits?rows.reduce((s,c)=>s+c.score*c.course.credits,0)/factorCredits:null, averageFactor:item.factors/item.count };
    }).sort((a,b)=>periodSort(a.period)-periodSort(b.period)||semesterSort(a.semester,b.semester)||a.ra.localeCompare(b.ra));
    return resultsCache;
  }
  function escapeCsvCell(v) { return '"'+String(v??'').replace(/"/g,'""')+'"'; }
  function download(name, text, type) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  function parseCsv(text) {
    text=String(text).replace(/^\uFEFF/,'');
    const first = String(text).split(/\r?\n/,1)[0] || '';
    let quoted=false, commas=0, semis=0;
    for (let i=0;i<first.length;i++) { if(first[i]==='"'&&first[i+1]==='"'){i++;continue;} if(first[i]==='"'){quoted=!quoted;continue;} if(!quoted){if(first[i]===',')commas++;if(first[i]===';')semis++;} }
    const delimiter=semis>commas?';':','; const lines=[]; let row=[],field='',inQuotes=false;
    for(let i=0;i<text.length;i++) { const ch=text[i]; if(ch==='"'&&inQuotes&&text[i+1]==='"'){field+='"';i++;} else if(ch==='"'){inQuotes=!inQuotes;} else if(ch===delimiter&&!inQuotes){row.push(field);field='';} else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))lines.push(row);row=[];field='';} else field+=ch; }
    if(field||row.length){row.push(field);lines.push(row);} if(!lines.length)return [];
    const headers=lines.shift().map((h)=>normalize(h).replace(/[ _-]+/g,''));
    const index=(...names)=>headers.findIndex(h=>names.includes(h));
    const ix={asignatura:index('asignatura','curso','materia'),estudiante:index('estudiante','alumno','nombre'),nota:index('nota','calificacion','calificación'),actividad:index('actividad','evaluacion','evaluación'),instrumento:index('instrumento'),codigo:index('codigoactividad','codigo','codigoactividad')};
    if(ix.asignatura<0||ix.estudiante<0||ix.nota<0)throw new Error('El CSV debe incluir las columnas asignatura, estudiante y nota. Descargue la plantilla CORA si necesita un ejemplo.');
    return lines.map((cells,i)=>({line:i+2,asignatura:(cells[ix.asignatura]||'').trim(),estudiante:(cells[ix.estudiante]||'').trim(),nota:(cells[ix.nota]||'').trim(),actividad:ix.actividad<0?'':(cells[ix.actividad]||'').trim(),instrumento:ix.instrumento<0?'':(cells[ix.instrumento]||'').trim(),codigoActividad:ix.codigo<0?'':(cells[ix.codigo]||'').trim()}));
  }
  function switchView(id) {
    document.dispatchEvent(new CustomEvent('cora:proposal-view-request',{detail:{id}}));
  }
  document.addEventListener('cora:proposal-view-change',event=>{
    const id=event.detail?.id;
    if(id==='proposal-interconexion') requestAnimationFrame(()=>{resizeGraph();if(graphMode==='3d')render3D();});
    if(id==='proposal-resultados') renderResults();
  });
  function raCard(ra) {
    const comp=data.competencies.find(item=>item.ra===ra.id), ind=data.indicators.find(item=>item.ra===ra.id);
    return '<article class="proposal-ra-card"><div class="proposal-ra-card__top"><span>'+esc(ra.id)+'</span><strong>'+esc(ra.name)+'</strong></div><p>'+esc(ra.description)+'</p><details><summary>Competencia · '+esc(comp?.name||'')+'</summary><p>'+esc(comp?.description||'')+'</p></details><details><summary>'+esc(ind?.name||'Indicador')+'</summary><p>'+esc(ind?.description||'')+'</p></details><small>Contribuye al perfil de egreso integral</small></article>';
  }
  function renderDashboard() {
    const credits=courses.reduce((sum,c)=>sum+c.credits,0), hours=data.curriculumMetrics?.hours||courses.reduce((sum,c)=>sum+c.hoursTotal,0);
    $('#proposal-metrics').innerHTML=[[String(courses.length),'Asignaturas'],[String(credits),'Créditos'],[String(data.metadata.semesterCount),'Semestres'],[String(raList.length),'Resultados de aprendizaje']].map(x=>'<article class="metric"><span>'+esc(x[1])+'</span><strong>'+esc(x[0])+'</strong></article>').join('');
    $('#proposal-ra-cards').innerHTML=raList.map(ra=>raCard(ra)).join('');
    $('#proposal-profile-text').innerHTML=data.profileStatement.map(x=>'<p>'+esc(x)+'</p>').join('');
    $('#proposal-quality-summary').innerHTML='<p><strong>'+credits+' créditos · '+Number(hours).toLocaleString('es-CO')+' horas totales · '+(data.programa?.cupo_por_cohorte||40)+' estudiantes por cohorte.</strong></p><p>El plan reúne '+courses.length+' asignaturas en '+data.metadata.semesterCount+' semestres, '+data.dimensions.length+' dimensiones y '+data.chains.length+' cadenas cognitivas.</p>';
    const demoCount=state.rows.filter(row=>row.isDemonstration).length;$('#proposal-demo-global-notice').hidden=!demoCount;
  }
  function renderCurriculumPages() {
    const dimensions=data.dimensions||[];
    $('#proposal-architecture-metrics').innerHTML=[[String(courses.length),'Asignaturas'],[String(data.curriculumMetrics.totalCredits),'Créditos'],[data.curriculumMetrics.hoursPerCredit+' h','Por crédito'],[String(data.programa.cupo_por_cohorte),'Cupo por cohorte']].map(x=>'<article class="metric"><span>'+esc(x[1])+'</span><strong>'+esc(x[0])+'</strong></article>').join('');
    $('#proposal-dimension-cards').innerHTML=dimensions.map((item,i)=>'<article class="proposal-dimension-card"><span class="proposal-dimension-card__index">0'+(i+1)+'</span><h4>'+esc(item.name)+'</h4><strong>'+item.credits+' créditos</strong><small>'+item.courses+' asignaturas</small><div class="proposal-dimension-card__bar"><i style="width:'+Math.max(3,100*item.credits/data.curriculumMetrics.totalCredits)+'%"></i></div></article>').join('');
    const semesters=[];
    for(let sem=1;sem<=data.metadata.semesterCount;sem++){const items=courses.filter(c=>c.semester===sem),credits=items.reduce((sum,c)=>sum+c.credits,0);semesters.push('<article class="proposal-semester-card"><div><span>0'+sem+'</span><strong>Semestre '+sem+'</strong><small>'+credits+' créditos · '+items.length+' asignaturas</small></div><ul>'+items.map(c=>'<li><span>'+esc(c.name)+'</span><small>'+c.credits+' cr. · '+esc(c.chains.map(id=>data.chains.find(ch=>ch.id===id)?.name||id).join(' · ')||c.dimension)+'</small></li>').join('')+'</ul></article>');}
    const flexible=courses.filter(c=>c.semester==='Flexible');
    semesters.push('<article class="proposal-semester-card proposal-semester-card--flex"><div><span>F</span><strong>Componente flexible</strong><small>'+flexible.reduce((sum,c)=>sum+c.credits,0)+' créditos · '+flexible.length+' asignaturas</small></div><ul>'+flexible.map(c=>'<li><span>'+esc(c.name)+'</span><small>'+c.credits+' cr. · '+esc(c.dimension)+'</small></li>').join('')+'</ul></article>');
    $('#proposal-semester-timeline').innerHTML=semesters.join('');
    $('#proposal-semester-quality').innerHTML='<table><thead><tr><th>Semestre</th><th>Asignaturas</th><th>Créditos</th><th>Horas directas</th><th>Horas independientes</th><th>Horas totales</th><th>Observación</th></tr></thead><tbody>'+data.semesterQuality.map(item=>'<tr><th>Semestre '+item.semester+'</th><td>'+item.courses+'</td><td>'+item.credits+'</td><td>'+Number(item.hoursDirected).toLocaleString('es-CO')+'</td><td>'+Number(item.hoursIndependent).toLocaleString('es-CO')+'</td><td>'+Number(item.hoursTotal).toLocaleString('es-CO')+'</td><td>'+esc(item.status==='INFORMATIVO'?'Dato informativo':item.status)+'</td></tr>').join('')+'<tr><th>Componente flexible</th><td>'+flexible.length+'</td><td>'+flexible.reduce((sum,c)=>sum+c.credits,0)+'</td><td>'+flexible.reduce((sum,c)=>sum+c.hoursDirected,0)+'</td><td>'+flexible.reduce((sum,c)=>sum+c.hoursIndependent,0)+'</td><td>'+flexible.reduce((sum,c)=>sum+c.hoursTotal,0)+'</td><td>Oferta flexible</td></tr></tbody></table>';
    $('#proposal-equivalence-table').innerHTML=data.equivalences.map(x=>'<tr><td>'+esc(x.semester)+'</td><td>'+esc(x.current)+'</td><td>'+esc(x.currentCredits)+'</td><td>'+esc(x.proposed)+'</td><td>'+esc(x.proposedCredits)+'</td><td>'+esc(x.note)+'</td></tr>').join('');
    $('#proposal-transition-head').innerHTML='<tr><th>Periodo</th>'+data.transition.semesters.map(x=>'<th>Sem. '+esc(x)+'</th>').join('')+'</tr>';
    $('#proposal-transition-table').innerHTML=data.transition.periods.map(row=>'<tr><th>'+esc(row.period)+'</th>'+row.values.map(v=>'<td class="'+(v.toLowerCase()==='propuesto'?'is-proposed':'')+'">'+esc(v==='\\\\-'?'—':v)+'</td>').join('')+'</tr>').join('');
  }
  function renderUpload() {
    const diagnoses=state.rows.map(status), valid=diagnoses.filter(x=>x==='VÁLIDA').length, invalid=diagnoses.length-valid;
    const demoCount=state.rows.filter(row=>row.isDemonstration).length,realCount=state.rows.length-demoCount;
    $('#proposal-demo-status').textContent=demoCount?`${demoCount.toLocaleString('es-CO')} filas sintéticas para 30 estudiantes por asignatura y cohorte, distribuidas entre 2021-1 y 2026-2. Los identificadores de cohorte se mantienen para explorar su avance entre semestres.${realCount?` Hay además ${realCount.toLocaleString('es-CO')} filas reales; ambos conjuntos se combinan en los resultados.`:' Puedes quitar la muestra sin borrar futuras cargas reales.'}`:realCount?'La muestra no está cargada. Si la añades, sus datos se combinarán con las notas actuales.':'No hay muestra simulada cargada.';
    $('#proposal-load-demo').hidden=!!demoCount;$('#proposal-remove-demo').hidden=!demoCount;
    $('#proposal-upload-summary').textContent=state.rows.length?`${valid} registros válidos · ${invalid} excluidos de ${state.rows.length}. Los datos pertenecen a Fisioterapia · propuesta de modificación curricular.`:'Aún no se ha cargado información para la propuesta.';
    $('#proposal-upload-log').innerHTML=state.uploads.length?state.uploads.slice().reverse().map(x=>`<tr><td>${esc(x.period)}</td><td>${esc(x.demo?'Muestra demostrativa (simulada)':x.file)}</td><td>${x.tipoNota==='asignatura'?'Notas por asignatura':'Notas por actividad'}</td><td>${x.total}</td><td>${x.valid}</td><td>${x.omitted}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">Sin cargas registradas.</td></tr>';
    $('#proposal-row-quality').textContent=`${valid} válidos · ${diagnoses.filter(x=>x==='ERROR DE DATOS').length} con datos incompletos o nota inválida · ${diagnoses.filter(x=>x==='ASIGNATURA NO RECONOCIDA').length} con asignatura no reconocida.`;
    $('#proposal-records').innerHTML=state.rows.length?state.rows.slice(-250).reverse().map(r=>{const course=courseFor(r.asignatura);return `<tr><td>${esc(r.periodo)}</td><td>${esc(r.estudiante)}</td><td>${esc(r.asignatura)}</td><td>${course?course.semester:'—'}</td><td>${esc(r.actividad||'—')}${r.instrumento?`<small class="proposal-cell-sub">${esc(r.instrumento)}</small>`:''}</td><td>${esc(r.nota)}</td><td>${esc(status(r))}</td></tr>`;}).join(''):'<tr><td colspan="7" class="muted">No hay registros.</td></tr>';
  }
  function studentTrajectory(student='',period='') {
    if(!student&&!period&&studentTrajectoryCache)return studentTrajectoryCache;
    const sums=new Map();
    for(const record of validRows()){
      if(student&&record.estudiante!==student)continue;
      const recordPeriod=record.periodo||'Sin periodo';if(period&&recordPeriod!==period)continue;
      const course=courseFor(record.asignatura),score=Number(String(record.nota).replace(',','.'));
      for(const ra of raList){const level=course?.[ra.id.toLowerCase()];if(!level)continue;const key=[course.semester,ra.id].join('|'),item=sums.get(key)||{semester:course.semester,ra:ra.id,sum:0,count:0};item.sum+=score*levelFactor(level);item.count++;sums.set(key,item);}
    }
    const result=[...sums.values()].map(x=>({...x,period:'Trayectoria',direct:x.sum/x.count}));
    if(!student&&!period)studentTrajectoryCache=result;
    return result;
  }
  function renderRAChecks(targetId, selected, onChange) {
    const el=$(targetId); el.innerHTML=raList.map(ra=>`<label class="ra-chart-toggle"><input type="checkbox" value="${ra.id}" ${selected.has(ra.id)?'checked':''}><span>${ra.id}</span></label>`).join('');
    el.onchange=(e)=>{if(e.target.type!=='checkbox')return;if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);onChange();};
  }
  function drawBars(targetId, rows, semesters, ras, metric, includeEmptySemesters=false) {
    const target=$(targetId); const dataRows=rows.filter(r=>ras.has(r.ra)&&semesters.has(String(r.semester)));
    const labels=(includeEmptySemesters?[...semesters]:[...new Set(dataRows.map(x=>String(x.semester)))]).sort(semesterSort), useRas=raList.filter(x=>ras.has(x.id));
    if(!labels.length||(!dataRows.length&&!includeEmptySemesters)){target.innerHTML='<span class="muted">No hay resultados válidos para los filtros seleccionados.</span>';return;}
    const width=Math.max(780,labels.length*115+90), height=380, left=58, right=20, top=24, bottom=78, ph=height-top-bottom, pw=width-left-right;
    const y=v=>top+(5-Math.max(0,Math.min(5,v)))*ph/5, col=ra=>({RA1:'#1d5fa8',RA2:'#0e9a97',RA3:'#d08a2e',RA4:'#6e5cc4',RA5:'#c8507a',RA6:'#5e8f3a'})[ra]||'#516778';
    let svg=`<svg class="v20-bar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Resultados ponderados por semestre para la propuesta de modificación curricular"><title>Resultados ponderados por semestre · escala 0 a 5</title>`;
    for(let v=0;v<=5;v++)svg+=`<line class="gridline" x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text class="axis-label" x="${left-10}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
    const slot=pw/labels.length, barW=Math.min(34,slot/(useRas.length+1));
    labels.forEach((sem,i)=>{
      const semesterText=sem==='Flexible'?'Flexible':`Semestre ${sem}`;
      svg+=`<text class="axis-label" x="${left+slot*(i+.5)}" y="${height-34}" text-anchor="middle">${semesterText}</text>`;
      let hasValue=false;
      useRas.forEach((ra,j)=>{const item=dataRows.find(r=>String(r.semester)===sem&&r.ra===ra.id),x=left+slot*i+(slot-useRas.length*barW)/2+j*barW;if(!item){if(includeEmptySemesters)svg+=`<text class="missing-ra-label" x="${x+barW/2}" y="${height-13}" text-anchor="middle" fill="${col(ra.id)}"><title>${esc(ra.id)} · ${semesterText}: sin datos de mapeo/evidencia</title>·</text>`;return;}const value=metric==='criterial'?item.direct:item[metric];if(value==null)return;hasValue=true;const metricLabel=metric==='criterial'?'Nota criterial (escala original)':metric==='direct'?'Aporte ponderado':metric==='credit'?'Aporte ponderado por créditos':'Progresión comparable por créditos';const yy=y(value), bh=top+ph-yy;svg+=`<rect x="${x+3}" y="${yy}" width="${barW-6}" height="${Math.max(1,bh)}" rx="4" fill="${col(ra.id)}"><title>${esc(ra.id)} · ${semesterText} · ${esc(metricLabel)}: ${value.toFixed(2)} / 5 · ${item.count} evidencias</title></rect><text class="axis-label" x="${x+barW/2}" y="${Math.max(top+11,yy-5)}" text-anchor="middle">${value.toFixed(1)}</text>`;});
      if(includeEmptySemesters&&!hasValue)svg+=`<text class="axis-label" x="${left+slot*(i+.5)}" y="${height-2}" text-anchor="middle">Sin datos</text>`;
    });
    svg+='</svg><div class="proposal-chart-legend">'+useRas.map(ra=>`<span><i style="background:${col(ra.id)}"></i>${ra.id}</span>`).join('')+'</div>';target.innerHTML=svg;
  }
  function renderResults() {
    const valid=validRows(),rows=results(), periods=[...new Set(rows.map(x=>x.period))].sort((a,b)=>periodSort(a)-periodSort(b)||a.localeCompare(b));
    const populate=(selector,selected)=>{const el=$(selector),prev=el.value;el.innerHTML=periods.length?periods.map(p=>`<option>${esc(p)}</option>`).join(''):'<option value="">Sin datos</option>';const preferred=selected||prev||periods[periods.length-1];el.value=periods.includes(preferred)?preferred:(periods[periods.length-1]||'');};
    populate('#proposal-chart-period'); populate('#proposal-table-period');
    const demoCount=state.rows.filter(row=>row.isDemonstration).length;
    $('#proposal-results-quality').innerHTML=rows.length
      ? `Cálculo realizado con ${valid.length.toLocaleString('es-CO')} registros válidos; se omitieron ${state.rows.length-valid.length} filas inválidas o sin asignatura reconocida.${demoCount?` Incluye ${demoCount.toLocaleString('es-CO')} registros demostrativos simulados.`:''}`
      : `No hay resultados de aprendizaje visibles para los registros guardados. ${state.rows.length?'Revisa que las asignaturas y notas sean válidas.':'La muestra de ejemplo puede haberse quitado en este navegador.'} <button class="button secondary" id="proposal-results-load-demo" type="button">Cargar ejemplo de resultados</button>`;
    const allSem=new Set(Array.from({length:data.metadata.semesterCount},(_,i)=>String(i+1)));
    $('#proposal-semester-options').innerHTML=[...allSem].sort(semesterSort).map(s=>`<label class="semester-option"><input type="checkbox" value="${s}" ${chosenSemesters.has(s)?'checked':''}>Semestre ${s}</label>`).join('');
    $('#proposal-semester-options').onchange=e=>{if(e.target.type!=='checkbox')return;if(e.target.checked)chosenSemesters.add(e.target.value);else chosenSemesters.delete(e.target.value);drawProposalChart();};
    renderRAChecks('#proposal-ra-options',chosenRAs,drawProposalChart);
    renderRAChecks('#proposal-period-ra-options',chosenPeriodRAs,drawProposalTableChart);
    const buildCreditTable=()=>{
      $('#proposal-credit-head').innerHTML='<tr><th>Semestre</th>'+raList.map(ra=>`<th>${ra.id} · Introduce</th><th>${ra.id} · Refuerza</th><th>${ra.id} · Domina</th><th>Total</th>`).join('')+'</tr>';
      $('#proposal-credit-table').innerHTML=Array.from({length:9},(_,i)=>i+1).map(s=>{let cells='';for(const ra of raList){const totals=['INTRODUCE','REFUERZA','DOMINA'].map(level=>courses.filter(c=>c.semester===s&&c[ra.id.toLowerCase()]===level).reduce((sum,c)=>sum+c.credits,0));cells+=totals.map(n=>`<td>${n}</td>`).join('')+`<td><strong>${totals.reduce((a,b)=>a+b,0)}</strong></td>`;}return `<tr><th>Semestre ${s}</th>${cells}</tr>`;}).join('');
      const flexible=courses.filter(c=>String(c.semester).toLowerCase()==='flexible');
      if(flexible.length){let cells='';for(const ra of raList){const totals=['INTRODUCE','REFUERZA','DOMINA'].map(level=>flexible.filter(c=>c[ra.id.toLowerCase()]===level).reduce((sum,c)=>sum+c.credits,0));cells+=totals.map(n=>'<td>'+n+'</td>').join('')+'<td><strong>'+totals.reduce((a,b)=>a+b,0)+'</strong></td>'; }$('#proposal-credit-table').insertAdjacentHTML('beforeend','<tr><th>Componente flexible</th>'+cells+'</tr>');}
    }; buildCreditTable();
    $('#proposal-results-table').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.period)}</td><td>Semestre ${r.semester}</td><td>${r.ra}</td><td>${r.direct.toFixed(2)} / 5</td><td>${r.credit===null?'—':r.credit.toFixed(2)+' / 5'}</td><td>${r.comparable===null?'—':r.comparable.toFixed(2)+' / 5'}</td><td>${r.count}</td><td>${r.averageFactor.toFixed(2)}</td></tr>`).join(''):'<tr><td colspan="8" class="muted">No hay resultados válidos.</td></tr>';
    const students=[...new Set(valid.map(x=>x.estudiante))].sort((a,b)=>a.localeCompare(b,'es'));
    const studentSel=$('#proposal-student'), before=studentSel.value;studentSel.innerHTML='<option value="">Todos</option>'+students.map(s=>`<option>${esc(s)}</option>`).join('');studentSel.value=students.includes(before)?before:'';
    const studentPeriod=$('#proposal-student-period'),oldPeriod=studentPeriod.value;studentPeriod.innerHTML='<option value="">Todos los periodos</option>'+periods.map(p=>`<option>${esc(p)}</option>`).join('');studentPeriod.value=periods.includes(oldPeriod)?oldPeriod:'';
    drawProposalChart();drawProposalTableChart();drawStudentChart();
  }
  const proposalSemesters=new Set(courses.map(c=>String(c.semester)));
  function drawProposalChart(){const metric=$('#proposal-chart-metric').value,period=$('#proposal-chart-period').value;if(metric==='criterial'){const rows=window.CORA_V20_EVIDENCE?.getCriterialRows(period)||[];drawBars('#proposal-chart',rows,chosenSemesters,chosenRAs,'criterial',true);return;}const rows=results().filter(r=>r.period===period);drawBars('#proposal-chart',rows,chosenSemesters,chosenRAs,metric,true);}
  function drawProposalTableChart(){const metric=$('#proposal-table-metric').value,period=$('#proposal-table-period').value;if(metric==='criterial'){const rows=window.CORA_V20_EVIDENCE?.getCriterialRows(period)||[];drawBars('#proposal-period-chart',rows,proposalSemesters,chosenPeriodRAs,'criterial',true);return;}const rows=results().filter(r=>r.period===period);drawBars('#proposal-period-chart',rows,proposalSemesters,chosenPeriodRAs,metric,true);}
  function drawStudentChart(){const student=$('#proposal-student').value,period=$('#proposal-student-period').value,rows=studentTrajectory(student,period);drawBars('#proposal-student-chart',rows,new Set(rows.map(x=>String(x.semester))),new Set(raList.map(r=>r.id)),'direct');}
  function renderCourses() {
    const search=normalize($('#proposal-course-search').value);
    $('#proposal-course-head').innerHTML='<tr><th>Sem.</th><th>Dimensión curricular</th><th>Asignatura</th><th>Créditos</th><th>Naturaleza</th><th>Horas directas</th><th>Horas independientes</th><th>Cadena cognitiva</th><th>Prerrequisitos</th><th>Tipo</th><th>Cupo</th>'+raList.map(x=>'<th>'+x.id+' · nivel y aporte</th>').join('')+'</tr>';
    const filtered=courses.filter(c=>!search||normalize(c.name).includes(search)||normalize(c.dimension).includes(search)||normalize(c.chains.join(' ')).includes(search)||normalize((c.prerequisites||[]).join(' ')).includes(search));
    $('#proposal-course-table').innerHTML=filtered.map(c=>{const levels=raList.map(ra=>{const level=c[ra.id.toLowerCase()],reason=c[ra.id.toLowerCase()+'Rationale'];return '<td>'+(level?'<span class="badge proposal-level proposal-level--'+level.toLowerCase()+'">'+levelName(level)+'</span>'+(reason?'<details><summary>Aporte</summary><small>'+esc(reason)+'</small></details>':''):'Sin aporte')+'</td>';}).join('');return '<tr><td>'+esc(semesterLabel(c.semester))+'</td><td>'+esc(c.dimension)+'</td><td><button class="proposal-course-link" data-v20-focus="'+c.id+'">'+esc(c.name)+'</button></td><td>'+c.credits+'</td><td>'+esc(c.nature||'')+'</td><td>'+c.hoursDirected+'</td><td>'+c.hoursIndependent+'</td><td>'+esc(c.chains.map(id=>data.chains.find(x=>x.id===id)?.name||id).join(' · ')||'—')+'</td><td>'+esc((c.prerequisites||[]).join(' · ')||'—')+'</td><td>'+(c.elective?'Electiva':'Obligatoria')+'</td><td>'+esc(c.maxStudents||'—')+'</td>'+levels+'</tr>';}).join('')||'<tr><td colspan="17">Sin asignaturas coincidentes.</td></tr>';
    $('#proposal-alignment-cards').innerHTML=raList.map(ra=>raCard(ra)).join('');
  }
  function chainPaths(chain){return chain.paths?.length?chain.paths:[chain.courseIds];}
  function renderChains(){
    $('#proposal-chains').innerHTML=data.chains.map(chain=>{const paths=chainPaths(chain).map(ids=>ids.map(id=>courseById.get(id)).filter(Boolean)),items=[...new Map(paths.flat().map(c=>[c.id,c])).values()],credits=chain.credits??items.reduce((sum,c)=>sum+c.credits,0);const tracks=paths.map((path,pathIndex)=>{const groups=[];for(const c of path){let g=groups.at(-1);if(!g||String(g.semester)!==String(c.semester)){g={semester:c.semester,courses:[]};groups.push(g);}g.courses.push(c);}return '<section class="proposal-chain__track"><p class="proposal-chain__track-label">'+(paths.length>1?'Trayecto '+(pathIndex+1)+' · ':'')+'Progresión por semestre · asignaturas de una misma etapa en paralelo</p><div class="proposal-chain__sequence proposal-chain__sequence--stages">'+groups.map((group,index)=>(index?'<b aria-hidden="true">→</b>':'')+'<section class="proposal-chain-stage"><small>'+esc(semesterLabel(group.semester))+'</small>'+group.courses.map(c=>'<button class="proposal-chain-course" data-v20-focus="'+c.id+'"><strong>'+esc(c.name)+'</strong><span>'+c.credits+' créditos · '+esc(c.dimension)+'</span></button>').join('')+'</section>').join('')+'</div></section>';}).join('');return '<article class="proposal-chain panel"><div class="proposal-chain__heading"><div><p class="eyebrow">'+esc(chain.id)+' · '+esc(chain.ras.join(' · '))+'</p><h3>'+esc(chain.name)+'</h3><p>'+esc(chain.purpose)+'</p></div><span class="badge">'+items.length+' asignaturas · '+credits+' créditos</span></div><div class="proposal-chain__tracks">'+tracks+'</div></article>';}).join('');
  }
  function networkData() {
    const framework=data.framework;
    const nodes=courses.map(c=>({id:c.id,name:c.name,kind:'asignatura',semester:c.semester,credits:c.credits,group:c.dimension,dimension:c.dimension,nature:c.nature}));
    nodes.push(...raList.map(r=>({id:r.id,name:r.id,kind:'ra',description:r.description})));
    nodes.push(...data.profile.map(x=>({id:x.id,name:'Perfil de egreso integral',kind:'perfil',description:x.description})));
    nodes.push({...framework.central,kind:'nucleo'});
    for(const pillar of framework.pillars){nodes.push({id:pillar.id,name:pillar.name,kind:'fundamento',description:pillar.description});pillar.concepts.forEach((concept,i)=>nodes.push({id:pillar.id+':'+i,name:concept,kind:'concepto',description:concept,pillar:pillar.id}));}
    const links=[];
    for(const c of courses){
      for(const ra of raList){const level=c[ra.id.toLowerCase()];if(level)links.push({source:c.id,target:ra.id,kind:'aporte',level:level,factor:levelFactor(level)});}
      links.push({source:c.id,target:'PERFIL',kind:'perfil-asignatura'});
    }
    // Las cadenas cognitivas definen conexiones dirigidas entre asignaturas consecutivas.
    for(const chain of data.chains)for(const path of chainPaths(chain))for(let i=1;i<path.length;i++){
      const source=path[i-1],target=path[i];
      if(courseById.has(source)&&courseById.has(target))links.push({source:source,target:target,kind:'cadena',chain:chain.id,chainName:chain.name});
    }
    for(const ra of raList)links.push({source:'MOVIMIENTO',target:ra.id,kind:'fundamento-curricular'});
    for(const pillar of framework.pillars){links.push({source:'MOVIMIENTO',target:pillar.id,kind:'fundamento'});pillar.concepts.forEach((x,i)=>links.push({source:pillar.id,target:pillar.id+':'+i,kind:'concepto'}));}
    const angle=(count,i,offset)=>offset+2*Math.PI*i/Math.max(1,count),dimensions=new Map();
    for(const c of courses){if(!dimensions.has(c.dimension))dimensions.set(c.dimension,[]);dimensions.get(c.dimension).push(c);}
    [...dimensions.entries()].sort(([a],[b])=>a.localeCompare(b,'es')).forEach(([dimension,items],dimensionIndex,all)=>{
      items.sort((a,b)=>a.name.localeCompare(b.name,'es'));
      const center=angle(all.length,dimensionIndex,-Math.PI/2);
      items.forEach((c,i)=>{const t=(i+.5)/items.length,a=center+(i-(items.length-1)/2)*.1,r=250+t*150;c.fx=Math.cos(a)*r;c.fy=-145-t*260;c.fz=Math.sin(a)*r;});
    });
    const ras=nodes.filter(n=>n.kind==='ra');
    ras.forEach((n,i)=>{
      const a=angle(ras.length,i,-Math.PI/2)+i*.16,r=105+i*22;n.fx=Math.cos(a)*r;n.fy=500-i*20;n.fz=Math.sin(a)*r;
    });
    const profile=nodes.find(n=>n.kind==='perfil');if(profile){profile.fx=0;profile.fy=-700;profile.fz=0;}
    const core=nodes.find(n=>n.kind==='nucleo');if(core){core.fx=0;core.fy=800;core.fz=0;}
    framework.pillars.forEach((pillar,i)=>{
      const a=angle(framework.pillars.length,i,-Math.PI/2),n=nodes.find(x=>x.id===pillar.id),concepts=nodes.filter(x=>x.pillar===pillar.id);
      const px=Math.cos(a)*175,pz=Math.sin(a)*175;
      if(n){n.fx=px;n.fy=780;n.fz=pz;}
      concepts.forEach((x,j)=>{const spread=(j-(concepts.length-1)/2)*.13,ca=a+spread,r=275;x.fx=Math.cos(ca)*r;x.fy=780+(j%2?18:-18);x.fz=Math.sin(ca)*r;});
    });
    return {nodes:nodes,links:links};
  }
  function setFocusedCourse(id) {
    focusedCourse=courseById.has(id)?id:'';focusedRA='';$('#proposal-network-subject').value=focusedCourse;
    const course=courseById.get(focusedCourse);
    if(course){
      const cycle=lifeCycle.bySubject[course.id]||{stageIds:[],focusStageIds:[],relation:''};
      const items=raList.flatMap(ra=>{const level=course[ra.id.toLowerCase()];if(!level)return[];return[{ra:ra,level:level,comp:data.competencies.find(c=>c.ra===ra.id),indicator:data.indicators.find(k=>k.ra===ra.id)}];});
      const chains=data.chains.filter(c=>chainPaths(c).some(path=>path.includes(course.id))),related=new Map();
      for(const chain of chains)for(const path of chainPaths(chain)){const i=path.indexOf(course.id);if(i<0)continue;[path[i-1],path[i+1]].filter(Boolean).forEach(other=>{if(courseById.has(other))related.set(other,courseById.get(other));});}
      const stages=cycle.stageIds.map(id=>lifeStageById.get(id)).filter(Boolean);
      $('#proposal-network-inspector-title').textContent=course.name;
      $('#proposal-network-relation-count').textContent=items.length+' RA · '+chains.length+' cadenas · '+stages.length+' momentos';
      $('#proposal-network-summary').innerHTML='<span class="network-summary__focus">'+esc(course.name)+'</span><span>'+esc(semesterLabel(course.semester))+' · '+course.credits+' créditos · '+esc(course.dimension)+'</span><span>'+items.length+' RA con aporte · '+chains.length+' cadenas · selecciona otra esfera para continuar navegando</span>';
      const cards=items.map(x=>'<article class="proposal-ra-card"><div class="proposal-ra-card__top"><span>'+x.ra.id+' · '+levelName(x.level)+'</span><strong>'+esc(x.comp?.name||x.ra.name)+'</strong></div><p>'+esc(x.ra.description)+'</p><details><summary>Competencia · '+esc(x.comp?.name||'')+'</summary><p>'+esc(x.comp?.description||'')+'</p></details><details><summary>'+esc(x.indicator?.name||'Indicador')+'</summary><p>'+esc(x.indicator?.description||'')+'</p></details><small>Contribuye al perfil de egreso integral</small></article>').join('');
      $('#proposal-network-detail').innerHTML='<h3>'+esc(course.name)+' <span class="badge">'+esc(semesterLabel(course.semester))+' · '+course.credits+' créditos</span></h3><p>'+esc(course.dimension)+' · '+esc(course.nature||'')+'</p><section class="proposal-cycle-detail"><h4>Momentos del ciclo vital</h4><p class="muted">'+esc(cycle.relation||'La matriz entregada no define una asociación específica para esta asignatura.')+'</p><div class="proposal-cycle-tags">'+(stages.map(x=>'<span class="proposal-cycle-tag'+(cycle.focusStageIds.includes(x.id)?' is-focus':'')+'" title="'+esc(x.description)+'">'+x.number+'. '+esc(x.name)+(cycle.focusStageIds.includes(x.id)?'<b> · Mayor desarrollo</b>':'')+'</span>').join('')||'<span class="muted">Sin relación asignada en la matriz.</span>')+'</div></section><section><h4>Asignaturas conectadas por cadenas</h4><div class="proposal-related">'+([...related.values()].map(x=>'<button class="button secondary" data-v20-focus="'+x.id+'">'+esc(semesterLabel(x.semester))+' · '+esc(x.name)+'</button>').join('')||'<span class="muted">Sin asignaturas vecinas en las cadenas.</span>')+'</div><p class="eyebrow">'+esc(chains.map(x=>x.id+' · '+x.name).join(' | ')||'Sin cadena asignada')+'</p></section><section><h4>Resultados, competencias e indicadores asociados</h4><div class="proposal-ra-cards">'+cards+'</div></section>';
    }else{
      $('#proposal-network-inspector-title').textContent='Arquitectura curricular de Fisioterapia';
      $('#proposal-network-relation-count').textContent=courses.length+' asignaturas · '+raList.length+' RA';
      $('#proposal-network-summary').innerHTML='<span class="network-summary__focus">Movimiento corporal humano</span><span>'+courses.length+' asignaturas · '+data.curriculumMetrics.totalCredits+' créditos · '+data.metadata.semesterCount+' semestres</span><span>'+raList.length+' RA · cadenas cognitivas · perfil de egreso</span>';
      $('#proposal-network-detail').innerHTML='<p class="muted">Selecciona una asignatura o un RA para ver su ficha.</p>';
    }
    render3D();render2D();
  }
  function setFocusedRA(id) {
    const ra=raList.find(item=>item.id===id);if(!ra)return;
    focusedCourse='';focusedRA=id;$('#proposal-network-subject').value='';
    const linked=courses.filter(course=>course[ra.id.toLowerCase()]);
    $('#proposal-network-inspector-title').textContent=ra.id+' · asignaturas que aportan';
    $('#proposal-network-relation-count').textContent=linked.length+' asignaturas conectadas';
    $('#proposal-network-summary').innerHTML='<span class="network-summary__focus">'+esc(ra.id)+'</span><span>'+linked.length+' asignaturas conectadas en el plan propuesto</span><span>Haz clic en una esfera del gráfico para abrirla y continuar navegando</span>';
    $('#proposal-network-detail').innerHTML='<h3>'+esc(ra.id)+' · '+esc(ra.name)+'</h3><p>'+esc(ra.description)+'</p><section><h4>Asignaturas conectadas a '+esc(ra.id)+'</h4><div class="proposal-related">'+(linked.map(course=>'<button class="button secondary" data-v20-focus="'+course.id+'">'+esc(semesterLabel(course.semester))+' · '+esc(course.name)+' · '+esc(levelName(course[ra.id.toLowerCase()]))+'</button>').join('')||'<span class="muted">No hay asignaturas mapeadas a este RA.</span>')+'</div></section>';
    render3D();render2D();
  }
  function activeNetwork() {
    const full=networkData();
    if(focusedRA){const linked=courses.filter(course=>course[focusedRA.toLowerCase()]),include=new Set([focusedRA,'PERFIL','MOVIMIENTO',...linked.map(course=>course.id)]),ids=new Set(include);return {nodes:full.nodes.filter(n=>include.has(n.id)),links:full.links.filter(l=>ids.has(l.source)&&ids.has(l.target))};}
    if(!focusedCourse){const nodes=full.nodes.filter(n=>n.kind!=='ciclo'),ids=new Set(nodes.map(n=>n.id));return {nodes:nodes,links:full.links.filter(l=>ids.has(l.source)&&ids.has(l.target))};}
    const include=new Set([focusedCourse]);
    const chainLinks=full.links.filter(l=>l.kind==='cadena'&&(l.source===focusedCourse||l.target===focusedCourse));
    for(const link of chainLinks){include.add(link.source);include.add(link.target);}
    for(const id of [...include])if(courseById.has(id)){include.add('PERFIL');for(const ra of raList)if(courseById.get(id)[ra.id.toLowerCase()])include.add(ra.id);}
    const nodes=full.nodes.filter(n=>include.has(n.id)),ids=new Set(nodes.map(n=>n.id));
    return {nodes:nodes,links:full.links.filter(l=>ids.has(l.source)&&ids.has(l.target)&&(l.kind!=='cadena'||chainLinks.includes(l)))};
  }
  const graphView={yaw:-0.34,pitch:0.18,zoom:1.12,panX:0,panY:0,drag:null,hovered:'',projected:[],target:{x:0,y:0,z:0},lastFrame:0};
  function proposalGraphColor(node){return node.kind==='asignatura'?dimensionColor(node.dimension):'#dce8f0';}
  function layoutGraphNodes(nodes){
    const count=Math.max(1,nodes.length);
    nodes.forEach((node,index)=>{
      if([node.fx,node.fy,node.fz].every(Number.isFinite))return;
      const y=1-(index+.5)/count*2,radial=Math.sqrt(Math.max(0,1-y*y)),angle=index*2.3999632297;
      node.fx=Math.cos(angle)*radial*245;node.fy=y*245;node.fz=Math.sin(angle)*radial*245;
    });
  }
  function projectGraphNodes(){
    if(!graph3D)return [];
    const canvas=graph3D.canvas,w=graph3D.width,h=graph3D.height;
    const pts=graph3D.data.nodes,spanX=Math.max(600,...pts.map(n=>Math.abs((n.fx||0)-graphView.target.x)*2)),spanY=Math.max(600,...pts.map(n=>Math.abs((n.fy||0)-graphView.target.y)*2)),fit=Math.min(w/(spanX*1.24),h/(spanY*1.24)),scale=fit*graphView.zoom,cy=Math.cos(graphView.yaw),sy=Math.sin(graphView.yaw),cp=Math.cos(graphView.pitch),sp=Math.sin(graphView.pitch),focal=1350;
    return graph3D.data.nodes.map(node=>{
      const x=(node.fx||0)-graphView.target.x,z=(node.fz||0)-graphView.target.z,y=(node.fy||0)-graphView.target.y;
      const rx=x*cy-z*sy,rz=x*sy+z*cy,ry=y*cp-rz*sp,depth=y*sp+rz*cp,perspective=focal/Math.max(320,focal-depth);
      return {...node,screenX:w/2+(rx*scale+graphView.panX)*perspective,screenY:h/2+(ry*scale+graphView.panY)*perspective,depth,scale:perspective,baseScale:scale};
    });
  }
  function graphNodeRadius(node){return ({asignatura:8.5,ra:9.2,competencia:9,indicador:8,perfil:10,ciclo:8.5,semestre:7,nucleo:16,fundamento:10,concepto:6})[node.kind]||7;}
  function pathPolygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  function drawGraphShape(ctx,node,r){
    const x=node.screenX,y=node.screenY,color=proposalGraphColor(node),dark='#294557',highlight='#ffffff';
    ctx.save();ctx.translate(x,y);const visualScale=Math.max(.58,node.scale*Math.sqrt(graphView.zoom));ctx.scale(visualScale,visualScale);
    if(node.kind==='asignatura'||node.kind==='nucleo'){
      const size=node.kind==='nucleo'?r*1.35:r,gradient=ctx.createRadialGradient(-size*.35,-size*.4,1,0,0,size*1.25);
      gradient.addColorStop(0,node.kind==='nucleo'?'#f3ffff':color);gradient.addColorStop(.42,color);gradient.addColorStop(1,'#15334a');
      ctx.beginPath();ctx.arc(0,0,size,0,Math.PI*2);ctx.fillStyle=gradient;ctx.shadowColor=node.kind==='nucleo'?'#70d8dc88':'#01060c99';ctx.shadowBlur=node.kind==='nucleo'?18:9;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#ffffff80';ctx.lineWidth=1.1;ctx.stroke();
      ctx.beginPath();ctx.ellipse(-size*.22,-size*.48,size*.29,size*.12,-.55,0,Math.PI*2);ctx.fillStyle=highlight+'99';ctx.fill();
      if(node.kind==='nucleo'){ctx.beginPath();ctx.arc(0,0,size*1.55,0,Math.PI*2);ctx.strokeStyle='#70d8dc55';ctx.lineWidth=1;ctx.stroke();}
    }else if(node.kind==='ra'){
      const s=r*.78;pathPolygon(ctx,[[-s,-s],[0,-s*1.55],[s,-s],[0,-s*.48]],'#f4fbff',dark);pathPolygon(ctx,[[-s,-s],[0,-s*.48],[0,s*1.22],[-s,s*.56]],'#b8cfdd','#6e899b');pathPolygon(ctx,[[0,-s*.48],[s,-s],[s,s*.56],[0,s*1.22]],'#d5e3eb','#6e899b');
    }else if(node.kind==='competencia'){
      const s=r*1.1;pathPolygon(ctx,[[0,-s],[s*.96,s*.75],[-s*.96,s*.75]],'#dce8f0','#7995a7');ctx.beginPath();ctx.moveTo(-s*.96,s*.75);ctx.lineTo(0,s*.42);ctx.lineTo(s*.96,s*.75);ctx.strokeStyle='#ffffffaa';ctx.stroke();
    }else if(node.kind==='indicador'){
      const s=r;pathPolygon(ctx,[[0,-s],[s*.8,0],[0,s],[-s*.8,0]],'#e9f3f7','#8098a6');ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s);ctx.moveTo(-s*.8,0);ctx.lineTo(s*.8,0);ctx.strokeStyle='#ffffffa8';ctx.stroke();
    }else if(node.kind==='perfil'){
      const pts=Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return[Math.cos(a)*r,Math.sin(a)*r];});pathPolygon(ctx,pts,'#dce8f0','#7892a1');ctx.beginPath();ctx.moveTo(-r*.72,-r*.43);ctx.lineTo(0,0);ctx.lineTo(r*.72,-r*.43);ctx.strokeStyle='#ffffffaa';ctx.stroke();
    }else if(node.kind==='semestre'){
      ctx.beginPath();ctx.ellipse(0,0,r*1.12,r*.56,-.3,0,Math.PI*2);ctx.strokeStyle='#dce8f0';ctx.lineWidth=2.2;ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.23,0,Math.PI*2);ctx.fillStyle='#9eb4c2';ctx.fill();
    }else if(node.kind==='ciclo'){
      const pts=Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return[Math.cos(a)*r,Math.sin(a)*r];});pathPolygon(ctx,pts,'#dce8f0','#8197a5');
    }else if(node.kind==='fundamento'){
      const s=r;pathPolygon(ctx,[[0,-s],[s*.85,s*.67],[-s*.85,s*.67]],'#dce8f0','#8197a5');ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(0,s*.28);ctx.lineTo(-s*.85,s*.67);ctx.moveTo(0,s*.28);ctx.lineTo(s*.85,s*.67);ctx.strokeStyle='#ffffffb0';ctx.stroke();
    }else{
      const pts=Array.from({length:4},(_,i)=>{const a=-Math.PI/2+i*Math.PI/2;return[Math.cos(a)*r,Math.sin(a)*r];});pathPolygon(ctx,pts,'#dce8f0','#8197a5');
    }
    ctx.restore();
  }
  function drawGraphFrame(time=0){
    if(!graph3D||!graph3D.ctx)return;
    const {ctx,width:w,height:h}=graph3D;if(!w||!h)return;
    ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#0f2d57');bg.addColorStop(1,'#071733');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const stars=36;ctx.fillStyle='#dbe8f01a';for(let i=0;i<stars;i++){const x=(i*197+43)%w,y=(i*113+29)%h;ctx.fillRect(x,y,1.2,1.2);}
    const projected=projectGraphNodes(),byId=new Map(projected.map(n=>[n.id,n]));graphView.projected=projected;
    const links=graph3D.data.links.map(link=>({link,a:byId.get(typeof link.source==='object'?link.source.id:link.source),b:byId.get(typeof link.target==='object'?link.target.id:link.target)})).filter(x=>x.a&&x.b).sort((x,y)=>(x.a.depth+x.b.depth)-(y.a.depth+y.b.depth));
    for(const {link,a,b} of links){ctx.beginPath();ctx.moveTo(a.screenX,a.screenY);ctx.lineTo(b.screenX,b.screenY);ctx.strokeStyle=link.kind==='cadena'?'#56d7d0c9':link.kind==='aporte'?'#b9e4f2e6':link.kind==='fundamento-curricular'?'#64c8c2bd':link.kind==='perfil-asignatura'?'#d7a8d344':'#90a4b355';ctx.lineWidth=link.kind==='cadena'?2.15:link.kind==='aporte'?1.65:link.kind==='fundamento-curricular'?1.45:link.kind==='perfil-asignatura'?0.9:0.95;ctx.stroke();if(link.kind==='cadena'){const dx=b.screenX-a.screenX,dy=b.screenY-a.screenY,len=Math.hypot(dx,dy)||1,arrowT=.78,px=a.screenX+dx*arrowT,py=a.screenY+dy*arrowT,ux=dx/len,uy=dy/len,size=4.5;ctx.beginPath();ctx.moveTo(px+ux*size,py+uy*size);ctx.lineTo(px-ux*size*.7-uy*size*.65,py-uy*size*.7+ux*size*.65);ctx.lineTo(px-ux*size*.7+uy*size*.65,py-uy*size*.7-ux*size*.65);ctx.closePath();ctx.fillStyle='#8be0d8';ctx.fill();const beadT=(time*.00022+(String(link.chain||'').length*.13))%1;ctx.beginPath();ctx.arc(a.screenX+dx*beadT,a.screenY+dy*beadT,2.2,0,Math.PI*2);ctx.fillStyle='#8be0d8';ctx.fill();}}
    projected.sort((a,b)=>a.depth-b.depth);
    for(const node of projected){const r=graphNodeRadius(node),hover=node.id===graphView.hovered,focus=node.id===focusedCourse||node.id===focusedRA;drawGraphShape(ctx,node,r+(hover||focus?2:0));if(hover){
        const words=String(node.name||node.id).split(/\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>34&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);if(lines.length>3){lines.length=3;lines[2]=lines[2].slice(0,31)+'…';}
        const fontSize=12;ctx.font='600 '+fontSize+'px Inter, system-ui, sans-serif';const tw=Math.max(...lines.map(text=>ctx.measureText(text).width))+14,boxH=lines.length*16+8;let boxY=node.screenY+r+13;if(boxY+boxH>h-4)boxY=node.screenY-r-boxH-10;
        ctx.fillStyle='#071725e8';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(node.screenX-tw/2,boxY,tw,boxH,5);else ctx.rect(node.screenX-tw/2,boxY,tw,boxH);ctx.fill();ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';lines.forEach((text,i)=>ctx.fillText(text,node.screenX,boxY+8+i*16));
      }}
    if(graphView.drag){ctx.fillStyle='#dce8f0a8';ctx.font='11px Inter,system-ui,sans-serif';ctx.textAlign='left';ctx.fillText(graphView.drag.mode==='rotate'?'Girando la red':'Desplazando la red',16,22);}
  }
  function render3D(){
    const host=$('#proposal-network-3d');if(!host||graphMode!=='3d')return;
    if(!graph3D){host.innerHTML='<canvas class="proposal-neural-canvas" aria-label="Visualización tridimensional interactiva de la red curricular"></canvas>';const canvas=$('.proposal-neural-canvas',host),ctx=canvas.getContext?.('2d');graph3D={host,canvas,ctx,width:0,height:0,data:{nodes:[],links:[]},frame:0};
      if(!ctx){host.innerHTML='<div class="network-3d-fallback"><strong>No se pudo iniciar el lienzo de la red.</strong><p>Actualiza la página o abre CORA en una versión reciente de Safari, Chrome o Firefox.</p></div>';graph3D=null;return;}
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
      canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);graphView.drag={x:e.clientX,y:e.clientY,yaw:graphView.yaw,pitch:graphView.pitch,panX:graphView.panX,panY:graphView.panY,mode:e.button===2?'pan':e.shiftKey?'pan':'rotate',moved:false};});
      canvas.addEventListener('pointermove',e=>{if(graphView.drag){const dx=e.clientX-graphView.drag.x,dy=e.clientY-graphView.drag.y;graphView.drag.moved||=Math.abs(dx)+Math.abs(dy)>4;if(graphView.drag.mode==='pan'){graphView.panX=graphView.drag.panX+dx;graphView.panY=graphView.drag.panY+dy;}else{graphView.yaw=graphView.drag.yaw+dx*.006;graphView.pitch=Math.max(-1.25,Math.min(1.25,graphView.drag.pitch+dy*.005));}}else{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;graphView.hovered=[...graphView.projected].reverse().find(n=>Math.hypot(n.screenX-x,n.screenY-y)<graphNodeRadius(n)*Math.max(.8,n.scale)+6)?.id||'';canvas.style.cursor=graphView.hovered?'pointer':'grab';if(graphView.hovered){const n=graphView.projected.find(x=>x.id===graphView.hovered);canvas.title=n.name+(n.description?' · '+n.description:'')+(n.credits?' · '+n.credits+' créditos':'');}else canvas.title='Arrastra para girar · clic derecho para desplazar · rueda para acercar';}});
      canvas.addEventListener('pointerleave',()=>{graphView.hovered='';if(!graphView.drag)canvas.style.cursor='grab';});
      canvas.addEventListener('pointerup',e=>{const drag=graphView.drag;graphView.drag=null;if(!drag||drag.moved)return;const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,node=[...graphView.projected].reverse().find(n=>Math.hypot(n.screenX-x,n.screenY-y)<graphNodeRadius(n)*Math.max(.8,n.scale)+7);if(node?.kind==='asignatura')setFocusedCourse(node.id);else if(node?.kind==='ra')setFocusedRA(node.id);});
      canvas.addEventListener('pointercancel',()=>{graphView.drag=null;});
      canvas.addEventListener('wheel',e=>{e.preventDefault();graphView.zoom=Math.max(.5,Math.min(4.2,graphView.zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
      canvas.addEventListener('dblclick',()=>{graphView.yaw=-.34;graphView.pitch=.18;graphView.zoom=1.12;graphView.panX=0;graphView.panY=0;});
    }
    const graph=activeNetwork();layoutGraphNodes(graph.nodes);graph3D.data=graph;
    graphView.target={x:0,y:0,z:0};
    resizeGraph();drawGraphFrame(performance.now());if(!graph3D.frame){const animate=time=>{if(!graph3D||graphMode!=='3d'||$('#proposal-main').hidden||!$('#proposal-interconexion').classList.contains('is-active')){if(graph3D)graph3D.frame=0;return;}drawGraphFrame(time);graph3D.frame=requestAnimationFrame(animate);};graph3D.frame=requestAnimationFrame(animate);}
  }
  function resizeGraph(){if(!graph3D?.ctx)return;const rect=graph3D.host.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);if(!rect.width||!rect.height)return;const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(graph3D.canvas.width!==w||graph3D.canvas.height!==h){graph3D.canvas.width=w;graph3D.canvas.height=h;graph3D.canvas.style.width=rect.width+'px';graph3D.canvas.style.height=rect.height+'px';graph3D.ctx.setTransform(dpr,0,0,dpr,0,0);graph3D.width=rect.width;graph3D.height=rect.height;drawGraphFrame(performance.now());}}
  function render2D() {
    const host=$('#proposal-network-2d');if(!host||graphMode!=='2d')return;
    const selected=courseById.get(focusedCourse);
    if(!selected){host.innerHTML='<div class="proposal-lamina-empty"><strong>Selecciona una asignatura</strong><span>Su lámina curricular V21 aparecerá aquí.</span></div>';return;}
    const laminaPath=window.CORA_FISIO_V21_LAMINAS?.[selected.id];
    if(!laminaPath){host.innerHTML='<div class="proposal-lamina-empty"><strong>No hay una lámina asociada</strong><span>'+esc(selected.name)+'</span></div>';return;}
    const description='Infografía curricular de '+selected.name+' · '+semesterLabel(selected.semester)+' · '+selected.credits+' créditos';
    host.innerHTML='<figure class="proposal-lamina"><button class="proposal-lamina-open" type="button" aria-label="Ampliar la lámina curricular de '+esc(selected.name)+'"><img class="proposal-lamina-image" src="'+esc(laminaPath)+'" alt="'+esc(description)+'"><span class="proposal-lamina-expand-hint">Clic para ampliar</span></button><figcaption>'+esc(description)+' · Lámina de la propuesta V21</figcaption></figure>';
    const openButton=$('.proposal-lamina-open',host),image=$('.proposal-lamina-image',host);
    image.addEventListener('error',()=>{host.innerHTML='<div class="proposal-lamina-empty"><strong>No se pudo cargar la lámina</strong><span>'+esc(selected.name)+' · verifica que la carpeta assets/laminas-v21 esté incluida al publicar.</span></div>';});
    openButton.addEventListener('click',()=>{
      laminaZoom=1;laminaPanX=0;laminaPanY=0;laminaModalImage.src=laminaPath;laminaModalImage.alt=description;laminaModalImage.style.transform='';laminaModalImage.classList.remove('is-zoomed','is-dragging');
      if(typeof laminaModal.showModal==='function')laminaModal.showModal();else laminaModal.setAttribute('open','');
    });
  }
  function renderNetworkControls(){
    const select=$('#proposal-network-subject'),previous=select.value;select.innerHTML='<option value="">Red completa</option>'+courses.map(c=>`<option value="${c.id}">Semestre ${c.semester} · ${esc(c.name)}</option>`).join('');select.value=courseById.has(previous)?previous:'';
  }
  function renderAll(){renderDashboard();renderCurriculumPages();renderUpload();renderResults();renderCourses();renderChains();renderNetworkControls();}

  document.addEventListener('cora:program-change',event=>{
    if(event.detail?.program==='v20'){renderAll();switchView('proposal-inicio');requestAnimationFrame(()=>resizeGraph());}
    else if(graph3D?.frame){cancelAnimationFrame(graph3D.frame);graph3D.frame=0;}
  });
  $('#proposal-period').addEventListener('change',e=>$('#proposal-custom-period-wrap').hidden=e.target.value!=='otro');
  function proposalGradeMode(){return $('input[name="proposal-grade-entry-mode"]:checked')?.value||'actividad';}
  function updateProposalGradeMode(){const subject=proposalGradeMode()==='asignatura';$('#proposal-grade-entry-help').textContent=subject?'Cada fila es una nota consolidada de una asignatura; el programa la pondera según el aporte de esa asignatura a cada RA.':'Cada fila conserva el nombre de la actividad y su instrumento como trazabilidad; se mantiene el cálculo actual según la asignatura y sus RA.';$('#proposal-grade-file-hint').textContent=subject?'Use las columnas asignatura, estudiante y nota; actividad e instrumento no son necesarios.':'Puede cargar cada periodo por separado y agregarlo a los datos existentes.';}
  $$('input[name="proposal-grade-entry-mode"]').forEach(input=>input.addEventListener('change',updateProposalGradeMode));
  $('#proposal-file-input').addEventListener('change',async e=>{
    const files=[...e.target.files];if(!files.length)return;
    const choice=$('#proposal-period').value,period=choice==='otro'?$('#proposal-custom-period').value.trim():choice;
    if(!period){alert('Seleccione o escriba el periodo académico antes de cargar.');e.target.value='';return;}
    try{
      const incoming=[],tipoNota=proposalGradeMode();
      for(const file of files){const parsed=parseCsv(await file.text());const rows=parsed.map(r=>({...r,tipoNota,actividad:tipoNota==='asignatura'?'Nota por asignatura':r.actividad,periodo:period,sourceFile:file.name}));const val=rows.filter(r=>status(r)==='VÁLIDA').length;incoming.push({file:file.name,period,tipoNota,total:rows.length,valid:val,omitted:rows.length-val,rows});}
      state.rows=[...(Array.isArray(state.rows)?state.rows:[]),...incoming.flatMap(x=>x.rows)];
      state.uploads=[...(Array.isArray(state.uploads)?state.uploads:[]),...incoming.map(({rows,...x})=>x)];
      save();e.target.value='';switchView('proposal-cargas');
    } catch(err){alert(err.message);}
  });
  $('#proposal-template').addEventListener('click',()=>{
    const subject=proposalGradeMode()==='asignatura',rows=subject?[['asignatura','estudiante','nota'],[courses[0].name,'Nombre Apellido','4.2'],[courses[1].name,'Nombre Apellido','3.8']]:[['asignatura','estudiante','actividad','codigo_actividad','instrumento','nota'],[courses[0].name,'Nombre Apellido','Taller de valoración','','Rúbrica del curso','4.2'],[courses[1].name,'Nombre Apellido','Examen parcial','','Examen escrito','3.8']];
    const csv=rows.map(r=>r.map(escapeCsvCell).join(';')).join('\r\n');download(subject?'plantilla_notas_por_asignatura_fisioterapia_propuesta.csv':'plantilla_notas_por_actividad_fisioterapia_propuesta.csv','\uFEFF'+csv,'text/csv;charset=utf-8');
  });
  function loadDemoFromButton(){
    const realCount=state.rows.filter(row=>!row.isDemonstration).length;
    if(realCount&&!confirm('La muestra simulada se agregará a las '+realCount+' filas ya cargadas y ambas se combinarán en los cálculos. Puedes quitar solo la muestra después. ¿Continuar?'))return;
    if(addDemoSample()){save();switchView('proposal-resultados');}
  }
  $('#proposal-load-demo').addEventListener('click',loadDemoFromButton);
  document.addEventListener('click',event=>{if(event.target.closest('#proposal-results-load-demo'))loadDemoFromButton();});
  $('#proposal-remove-demo').addEventListener('click',()=>{const count=state.rows.filter(row=>row.isDemonstration).length;if(!count)return;if(confirm('¿Quitar las '+count+' filas demostrativas? Las notas cargadas desde tus archivos se conservarán.')){removeDemoSample();save();}});
  $('#proposal-clear').addEventListener('click',()=>{if(confirm('¿Eliminar del navegador todas las notas y periodos de la propuesta, incluida la muestra simulada?')){state=freshState();state.demoDismissed=true;save();}});
  $('#proposal-chart-period').addEventListener('change',drawProposalChart);$('#proposal-table-period').addEventListener('change',drawProposalTableChart);
  $('#proposal-chart-metric').addEventListener('change',drawProposalChart);$('#proposal-table-metric').addEventListener('change',drawProposalTableChart);
  $('#proposal-student').addEventListener('change',drawStudentChart);$('#proposal-student-period').addEventListener('change',drawStudentChart);
  $('#proposal-export-csv').addEventListener('click',()=>{const header=['Periodo','Semestre','RA','Aporte ponderado','Aporte por créditos','Comparable por créditos','Evidencias válidas','Factor promedio'];const csv=[header,...results().map(r=>[r.period,r.semester,r.ra,r.direct.toFixed(2),r.credit?.toFixed(2)??'',r.comparable?.toFixed(2)??'',r.count,r.averageFactor.toFixed(2)])].map(row=>row.map(escapeCsvCell).join(';')).join('\r\n');download('CORA-fisioterapia-propuesta-resultados.csv','\uFEFF'+csv,'text/csv;charset=utf-8');});
  $('#proposal-course-search').addEventListener('input',renderCourses);
  $('#proposal-network-subject').addEventListener('change',e=>setFocusedCourse(e.target.value));
  $('#proposal-network-reset').addEventListener('click',()=>setFocusedCourse(''));
  const laminaModal=$('#proposal-lamina-modal');
  const laminaModalImage=$('#proposal-lamina-modal-image');
  const updateLaminaTransform=()=>{
    laminaModalImage.style.transform=`translate(${laminaPanX}px, ${laminaPanY}px) scale(${laminaZoom})`;
    laminaModalImage.classList.toggle('is-zoomed',laminaZoom>1.01);
  };
  laminaModal.addEventListener('wheel',e=>{
    if(!$('.proposal-lamina-modal__frame',laminaModal).contains(e.target))return;
    e.preventDefault();e.stopPropagation();
    const nextZoom=Math.max(1,Math.min(5,laminaZoom*Math.exp(-e.deltaY*.0015)));
    const factor=nextZoom/laminaZoom,rect=laminaModalImage.getBoundingClientRect();
    if(nextZoom===1){laminaPanX=0;laminaPanY=0;}
    else{laminaPanX+=(1-factor)*(e.clientX-(rect.left+rect.width/2));laminaPanY+=(1-factor)*(e.clientY-(rect.top+rect.height/2));}
    laminaZoom=nextZoom;updateLaminaTransform();
  },{passive:false});
  laminaModalImage.addEventListener('pointerdown',e=>{
    if(laminaZoom<=1.01||(e.button!==0&&e.pointerType!=='touch'))return;
    e.preventDefault();laminaDrag={x:e.clientX,y:e.clientY,panX:laminaPanX,panY:laminaPanY};
    laminaModalImage.classList.add('is-dragging');laminaModalImage.setPointerCapture?.(e.pointerId);
  });
  laminaModalImage.addEventListener('pointermove',e=>{
    if(!laminaDrag)return;
    laminaPanX=laminaDrag.panX+e.clientX-laminaDrag.x;laminaPanY=laminaDrag.panY+e.clientY-laminaDrag.y;updateLaminaTransform();
  });
  ['pointerup','pointercancel'].forEach(type=>laminaModalImage.addEventListener(type,()=>{laminaDrag=null;laminaModalImage.classList.remove('is-dragging');}));
  laminaModal.addEventListener('close',()=>{laminaZoom=1;laminaPanX=0;laminaPanY=0;laminaDrag=null;laminaModalImage.style.transform='';laminaModalImage.classList.remove('is-zoomed','is-dragging');});
  $('#proposal-lamina-close').addEventListener('click',()=>laminaModal.close());
  laminaModal.addEventListener('click',e=>{if(e.target===laminaModal)laminaModal.close();});
  $$('[data-v20-network-view]').forEach(btn=>btn.addEventListener('click',()=>{graphMode=btn.dataset.v20NetworkView;$$('[data-v20-network-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));const stage=$('.proposal-network-stage');stage.dataset.v20View=graphMode;stage.dataset.view=graphMode;$('#proposal-network-3d').hidden=graphMode!=='3d';$('#proposal-network-2d').hidden=graphMode!=='2d';if(graphMode==='3d')render3D();else render2D();}));
  document.addEventListener('click',e=>{const focus=e.target.closest('[data-v20-focus]');if(focus){$('#program-selector').value='v20';$('#sidebar').classList.add('proposal-mode');$('#vigente-sidebar').hidden=true;$('#main').hidden=true;$('#proposal-sidebar').hidden=false;$('#proposal-main').hidden=false;switchView('proposal-interconexion');setFocusedCourse(focus.dataset.v20Focus);return;}const chip=e.target.closest('[data-chain-focus]');if(chip){const chain=data.chains.find(x=>x.id===chip.dataset.chainFocus),id=chain?.courseIds[0];if(id)setFocusedCourse(id);}});
  if('ResizeObserver'in window){const proposalGraphObserver=new ResizeObserver(resizeGraph);proposalGraphObserver.observe($('#proposal-network-3d'));}
  window.addEventListener('resize',resizeGraph,{passive:true});
  updateProposalGradeMode();renderAll();
})();
