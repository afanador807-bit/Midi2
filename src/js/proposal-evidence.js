/* Medición criterial y triangulación aisladas para la propuesta de modificación curricular. */
(() => {
  const data = window.CORA_FISIO_V20, core = window.CORA_CriterialCore;
  if (!data || !core || !document.querySelector('#proposal-criterial')) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const hnorm = value => core.normalize(value).replace(/[^a-z0-9]/g, '');
  const KEY = 'cora-fisioterapia-propuesta-v20-evidencia-v1';
  const SABER_POSITIVE_SCORE=150,SABER_NATIONAL_PERCENTILE=48;
  const kpiProfiles = data.indicators.map(indicator=>({indicator:indicator.id,ra:indicator.ra}));
  const defaultConfig = () => ({
    bands: [{id:'BAJO',label:'Bajo',min:0,max:2.99},{id:'MEDIO',label:'Medio',min:3,max:3.99},{id:'ALTO',label:'Alto',min:4,max:4.49},{id:'SUPERIOR',label:'Superior',min:4.5,max:5}],
    thresholds: { INTRODUCE:3, REFUERZA:3.5, DOMINA:4 },
    minimumN:5, margin:10, divergenceTolerance:15,
    kpis: Object.fromEntries(kpiProfiles.map((profile,index)=>[profile.indicator,{ra:profile.ra,minimumBand:index===0?'ALTO':'MEDIO',target:80,scope:'domina'}])),
    raTargets: Object.fromEntries(data.ra.map(ra=>[ra.id,80])),
    modules: [
      {module:'Lectura crítica',ras:['RA2']},
      {module:'Razonamiento cuantitativo',ras:['RA2']},
      {module:'Competencias ciudadanas',ras:['RA3','RA4']},
      {module:'Comunicación escrita',ras:['RA5']},
      {module:'Inglés',ras:['RA5']}
    ],
    items: Object.fromEntries(data.ra.map(ra=>[ra.id,[
      `Me siento capaz de ${ra.description.charAt(0).toLowerCase()+ra.description.slice(1)}`,
      `Puedo demostrar de manera autónoma este resultado: ${ra.description}`
    ]]))
  });
  const defaultState = () => ({ curricularVersion:data.metadata.version, approved:false, config:defaultConfig(), sources:{ saberPro:[], perception:[], stakeholders:[] }, imports:{ saberPro:[], perception:[], stakeholders:[] }, demoEvidenceDismissed:false });
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
  let state = core.migrateState(saved, defaultState());
  if (state.curricularVersion !== data.metadata.version) { try { const old=localStorage.getItem(KEY); if(old)localStorage.setItem(KEY+'-respaldo-anterior',old); } catch {} state = defaultState(); }
  if (core.validateConfig(state.config)) state.approved = false;
  let selectedRAs = new Set(data.ra.map(ra=>ra.id));
  const evidenceSourceOptions=[['saber','Saber Pro'],['perception','Autopercepción'],['egresado','Egresados'],['empleador','Empleadores']];
  const selectedEvidenceSources=new Set(evidenceSourceOptions.map(([key])=>key));
  let selectedEvidencePeriods=null;
  const selectedEvidenceRAs=new Set(data.ra.map(ra=>ra.id));

  function persist() { localStorage.setItem(KEY,JSON.stringify(state)); renderAll(); }
  function csvEscape(value) { return '"'+String(value??'').replace(/"/g,'""')+'"'; }
  function download(name,content,type) { const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200); }
  let noteRowsSnapshot=null,noteRowsCache=[],criterionRowsCache=new Map(),criterionRowsCacheSource=null,criterionRowsCacheConfig='';
  function noteRows() {
    const snapshot=localStorage.getItem('cora-fisioterapia-propuesta-v20-v1')||'';
    if(snapshot===noteRowsSnapshot)return noteRowsCache;
    noteRowsSnapshot=snapshot;
    try { noteRowsCache=JSON.parse(snapshot)?.rows||[]; } catch { noteRowsCache=[]; }
    criterionRowsCache=new Map();
    return noteRowsCache;
  }
  function makeComplementaryDemo() {
    const periods=['2025-1','2025-2','2026-1','2026-2'];
    const saberPro=[],perception=[],stakeholders=[];
    let saberLine=2,perceptionLine=2,stakeholderLine=2;
    const studentsByPeriod=new Map(periods.map(period=>[period,[]]));
    for(const row of noteRows())if(row.isDemonstration&&studentsByPeriod.has(row.periodo)){
      const list=studentsByPeriod.get(row.periodo);if(list.length<30&&!list.includes(row.estudiante))list.push(row.estudiante);
    }
    for(let periodIndex=0;periodIndex<periods.length;periodIndex++){
      const period=periods[periodIndex];
      const directStudents=studentsByPeriod.get(period);
      const students=directStudents.length?directStudents:Array.from({length:30},(_,i)=>`SIM-${period}-${String(i+1).padStart(2,'0')}`);
      const semesterFor=student=>{
        const match=String(student).match(/^SIM-(\d{4})-(\d)-/);
        if(!match)return '7';
        const start=(Number(match[1])-2021)*2+(Number(match[2])-1),current=(Number(period.slice(0,4))-2021)*2+(Number(period.slice(-1))-1);
        return String(Math.max(1,Math.min(9,current-start+1)));
      };
      for(let studentIndex=0;studentIndex<students.length;studentIndex++){
        const student=students[studentIndex];
        for(let moduleIndex=0;moduleIndex<state.config.modules.length;moduleIndex++){
          const module=state.config.modules[moduleIndex];
          if(!module.ras.length)continue;
          const moduleRaIndex=Math.max(0,data.ra.findIndex(ra=>module.ras.includes(ra.id))),successCount=Math.round(students.length*(.38+((moduleRaIndex*7+periodIndex*5+moduleIndex*3)%48)/100)),success=studentIndex<successCount;
          const raw=studentIndex*19+periodIndex*37+moduleIndex*23,score=success?SABER_POSITIVE_SCORE+1+(raw%80):90+(raw%(SABER_POSITIVE_SCORE-89)),percentile=success?SABER_NATIONAL_PERCENTILE+((studentIndex*7+moduleIndex*11+periodIndex*5)%40):8+((studentIndex*7+moduleIndex*11+periodIndex*5)%40);
          saberPro.push({_line:saberLine++,_file:'Muestra simulada · Saber Pro',_isDemo:true,codigo_estudiante:student,periodo_aplicacion:period,modulo:module.module,puntaje:String(score),nivel_desempeno:'',percentil:String(percentile),media_grupo_referencia:'',_status:'VÁLIDA'});
        }
        for(let raIndex=0;raIndex<data.ra.length;raIndex++){
          const ra=data.ra[raIndex],items=state.config.items[ra.id]||[];
          items.forEach((item,itemIndex)=>{
            const positiveCount=Math.round(students.length*(.54+((raIndex*3+periodIndex*5+itemIndex*2)%27)/100)),fiveCount=Math.round(students.length*.8)-positiveCount,rotation=(raIndex*7+periodIndex*11+itemIndex*13)%students.length,rank=(studentIndex+rotation)%students.length,response=rank>=positiveCount?3:rank<fiveCount?5:4;
            perception.push({_line:perceptionLine++,_file:'Muestra simulada · Autopercepción',_isDemo:true,codigo_estudiante:student,periodo:period,semestre:semesterFor(student),ra:ra.id,item,respuesta:String(response),_status:'VÁLIDA'});
          });
        }
      }
      for(let respondent=0;respondent<30;respondent++)for(const ra of data.ra)for(const type of ['egresado','empleador']){
        const raIndex=data.ra.indexOf(ra),positiveCount=type==='egresado'?20+((raIndex*3+periodIndex*4)%11):17+((raIndex*5+periodIndex*3)%14),fiveCount=(type==='egresado'?39:33)-positiveCount,rotation=(raIndex*7+periodIndex*11+(type==='empleador'?13:0))%30,rank=(respondent+rotation)%30,response=rank>=positiveCount?3:rank<fiveCount?5:4;
        stakeholders.push({_line:stakeholderLine++,_file:'Muestra simulada · Egresados y empleadores',_isDemo:true,tipo_informante:type,periodo:period,anio_egreso:String(2020+periodIndex),ra:ra.id,item:'Valoración demostrativa del resultado de aprendizaje',respuesta:String(response),_status:'VÁLIDA'});
      }
    }
    return {saberPro,perception,stakeholders};
  }
  function ensureComplementaryDemo() {
    if(state.demoEvidenceDismissed||!noteRows().some(row=>row.isDemonstration))return false;
    const demoVersion=4;
    if(state.demoEvidenceVersion===demoVersion)return false;
    const demo=makeComplementaryDemo(),changed=[];
    for(const source of ['saberPro','perception','stakeholders']){
      const current=state.sources[source]||[],hasDemo=current.some(row=>row._isDemo);
      if(!current.length||hasDemo){
        state.sources[source]=[...current.filter(row=>!row._isDemo),...demo[source]];
        state.imports[source]=(state.imports[source]||[]).filter(item=>!item.demo);
        state.imports[source].push({file:`Muestra simulada · ${source}`,total:demo[source].length,valid:demo[source].length,demo:true});
        changed.push(source);
      }
    }
    state.demoEvidenceVersion=demoVersion;
    if(!changed.length){localStorage.setItem(KEY,JSON.stringify(state));return false;}
    localStorage.setItem(KEY,JSON.stringify(state));
    return true;
  }
  function criterionRows(options={}) {
    const rows=noteRows(),configKey=JSON.stringify(state.config),optionKey=JSON.stringify(options);
    if(criterionRowsCacheSource!==rows||criterionRowsCacheConfig!==configKey){criterionRowsCache=new Map();criterionRowsCacheSource=rows;criterionRowsCacheConfig=configKey;}
    if(criterionRowsCache.has(optionKey))return criterionRowsCache.get(optionKey);
    const computed=core.computeCriterial({rows,subjects:data.subjects,raList:data.ra,config:state.config,...options});
    criterionRowsCache.set(optionKey,computed);
    return computed;
  }
  function compareFilters(row) { return (!$('#v20-criteria-period').value||row.period===$('#v20-criteria-period').value)&&(!$('#v20-criteria-semester').value||String(row.semester)===$('#v20-criteria-semester').value)&&selectedRAs.has(row.ra); }
  function rankBand(band) { return core.BAND_ORDER.indexOf(band); }
  function pct(n,d) { return d?100*n/d:null; }
  function fmt(value,digits=2) { return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits); }
  function activeSettingsNotice() {
    const message=state.approved?'Configuración marcada como aprobada por el comité curricular.':'Valor provisional sujeto a aprobación del comité curricular.';
    ['#v20-config-status','#v20-government-status','#v20-evidence-config-status'].forEach(selector=>{const target=$(selector);if(target)target.textContent=message;});
  }
  function renderConfig() {
    const cfg=state.config;
    $('#v20-config-fields').innerHTML=`
      <fieldset class="v20-config-set"><legend>Bandas de desempeño · escala institucional 0 a 5</legend><div class="table-wrap"><table><thead><tr><th>Banda</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>${cfg.bands.map((band,index)=>`<tr><th>${esc(band.label)}</th><td><input type="number" min="0" max="5" step="0.01" data-band="${index}" data-bound="min" value="${esc(band.min)}" aria-label="Límite inferior de ${esc(band.label)}"></td><td><input type="number" min="0" max="5" step="0.01" data-band="${index}" data-bound="max" value="${esc(band.max)}" aria-label="Límite superior de ${esc(band.label)}"></td></tr>`).join('')}</tbody></table></div></fieldset>
      <fieldset class="v20-config-set"><legend>Umbral de nivel esperado según aporte</legend><div class="v20-config-grid">${[['INTRODUCE','Introduce'],['REFUERZA','Refuerza'],['DOMINA','Domina']].map(([key,label])=>`<label>${label}<input type="number" min="0" max="5" step="0.01" data-threshold="${key}" value="${esc(cfg.thresholds[key])}"></label>`).join('')}</div></fieldset>
      <fieldset class="v20-config-set"><legend>Indicadores de logro · relación RA–KPI del perfil</legend><div class="v20-kpi-config">${kpiProfiles.map(profile=>{const indicator=data.indicators.find(x=>x.id===profile.indicator),kpi=cfg.kpis[profile.indicator];return `<article class="v20-kpi-config__item"><strong>${esc(profile.indicator)} → ${esc(profile.ra)} · ${esc(indicator?.description||'Indicador')}</strong><label>Banda mínima<select data-kpi="${profile.indicator}" data-field="minimumBand">${cfg.bands.map(b=>`<option value="${b.id}"${kpi.minimumBand===b.id?' selected':''}>${esc(b.label)} o superior</option>`).join('')}</select></label><label>Meta (%)<input type="number" min="0" max="100" step="1" data-kpi="${profile.indicator}" data-field="target" value="${esc(kpi.target)}"></label><label>Alcance<select data-kpi="${profile.indicator}" data-field="scope"><option value="all"${kpi.scope==='all'?' selected':''}>Todas las asignaturas con aporte al RA</option><option value="domina"${kpi.scope==='domina'?' selected':''}>Solo asignaturas en nivel Domina</option><option value="practica"${kpi.scope==='practica'?' selected':''}>Solo asignaturas de naturaleza práctica</option></select></label></article>`;}).join('')}</div></fieldset>
      <fieldset class="v20-config-set"><legend>Estabilidad y comparación</legend><div class="v20-config-grid"><label>Tamaño mínimo de muestra<input type="number" min="1" step="1" data-global="minimumN" value="${esc(cfg.minimumN)}"></label><label>Margen del semáforo (puntos porcentuales)<input type="number" min="0" max="100" step="1" data-global="margin" value="${esc(cfg.margin)}"></label><label>Tolerancia de convergencia (puntos porcentuales)<input type="number" min="0" max="100" step="1" data-global="divergenceTolerance" value="${esc(cfg.divergenceTolerance)}"></label></div></fieldset>
      <fieldset class="v20-config-set"><legend>Metas de triangulación por RA</legend><div class="v20-config-grid">${data.ra.map(ra=>`<label>${esc(ra.id)} · meta (%)<input type="number" min="0" max="100" step="1" data-ra-target="${ra.id}" value="${esc(cfg.raTargets[ra.id]??80)}"></label>`).join('')}</div></fieldset>`;
    $('#v20-config-approved').checked=Boolean(state.approved);activeSettingsNotice();
  }

  function collectConfig() {
    const cfg=structuredClone(state.config);
    document.querySelectorAll('#v20-config-fields [data-band]').forEach(input=>{cfg.bands[Number(input.dataset.band)][input.dataset.bound]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-threshold]').forEach(input=>{cfg.thresholds[input.dataset.threshold]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-kpi]').forEach(input=>{const item=cfg.kpis[input.dataset.kpi];item[input.dataset.field]=input.dataset.field==='target'?Number(input.value):input.value;});
    document.querySelectorAll('#v20-config-fields [data-global]').forEach(input=>{cfg[input.dataset.global]=Number(input.value);});
    document.querySelectorAll('#v20-config-fields [data-ra-target]').forEach(input=>{cfg.raTargets[input.dataset.raTarget]=Number(input.value);});
    return cfg;
  }

  function renderFilters(rows) {
    const period=$('#v20-criteria-period'),oldPeriod=period.value,periods=[...new Set(rows.map(r=>r.period))].sort();
    period.innerHTML='<option value="">Todos</option>'+periods.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');period.value=periods.includes(oldPeriod)?oldPeriod:'';
    const semester=$('#v20-criteria-semester'),oldSemester=semester.value,semesters=[...new Set(rows.map(r=>String(r.semester)))].sort((a,b)=>Number(a)-Number(b));
    semester.innerHTML='<option value="">Todos</option>'+semesters.map(x=>`<option value="${esc(x)}">Semestre ${esc(x)}</option>`).join('');semester.value=semesters.includes(oldSemester)?oldSemester:'';
    $('#v20-criteria-ra-filter').innerHTML=data.ra.map(ra=>`<label class="ra-chart-toggle"><input type="checkbox" value="${ra.id}"${selectedRAs.has(ra.id)?' checked':''}>${esc(ra.id)}</label>`).join('');
  }

  function baseGroups(rows) {
    const groups=new Map();
    for(const row of rows){const key=[row.period,row.semester,row.ra].join('|'),item=groups.get(key)||{period:row.period,semester:row.semester,ra:row.ra,rows:[]};item.rows.push(row);groups.set(key,item);}
    return [...groups.values()].map(group=>{
      const values=group.rows.map(x=>x.score),stats=core.stats(values),totalEvidence=group.rows.reduce((sum,x)=>sum+x.evidenceCount,0),threshold=group.rows.reduce((sum,x)=>sum+x.threshold,0)/group.rows.length,byBand=Object.fromEntries(core.BAND_ORDER.map(b=>[b,group.rows.filter(x=>x.band===b).length]));
      return {...group,stats,evidenceCount:totalEvidence,threshold,successCount:group.rows.filter(x=>x.achieves).length,successPct:pct(group.rows.filter(x=>x.achieves).length,group.rows.length),byBand};
    }).sort((a,b)=>a.period.localeCompare(b.period)||Number(a.semester)-Number(b.semester)||a.ra.localeCompare(b.ra));
  }

  function renderKpiCards() {
    const cards=[];
    for(const profile of kpiProfiles){
      const kpi=data.indicators.find(x=>x.id===profile.indicator),cfg=state.config.kpis[profile.indicator];
      if(!selectedRAs.has(profile.ra))continue;
      const rows=criterionRows({period:$('#v20-criteria-period').value,semester:$('#v20-criteria-semester').value,ra:profile.ra,scope:cfg.scope});
      const grouped=new Map();for(const row of rows){const key=[row.period,row.semester].join('|'),item=grouped.get(key)||{period:row.period,semester:row.semester,rows:[]};item.rows.push(row);grouped.set(key,item);}
      for(const group of grouped.values()){
        const count=group.rows.filter(row=>rankBand(row.band)>=rankBand(cfg.minimumBand)).length,percent=pct(count,group.rows.length),evidence=group.rows.reduce((sum,row)=>sum+row.evidenceCount,0),gap=percent==null?null:cfg.target-percent;
        const signal=gap==null?'sin-datos':gap<=0?'verde':gap<=state.config.margin?'amarillo':'rojo';
        const traces=group.rows.flatMap(row=>row.records.map(ref=>({row:ref.row,line:ref.row.line??ref.index+1,score:ref.row.nota,course:ref.row.asignatura,student:ref.row.estudiante})));
        cards.push(`<article class="v20-kpi-card v20-kpi-card--${signal}"><p class="eyebrow">${esc(profile.indicator)} · ${esc(profile.ra)} · ${esc(group.period)} · Semestre ${esc(group.semester)}</p><h4>${esc(kpi?.description||kpi?.name||profile.indicator)}</h4><div class="v20-kpi-card__metric"><strong>${percent==null?'—':percent.toFixed(1)+'%'}</strong><span>Meta ${fmt(cfg.target,0)}% · mínimo ${esc(cfg.minimumBand.toLowerCase())} o superior</span></div><p>${count} de ${group.rows.length} estudiantes · ${evidence} evidencias válidas · alcance: ${cfg.scope==='domina'?'asignaturas Domina':cfg.scope==='practica'?'naturaleza práctica':'todas las asignaturas con aporte'}</p>${group.rows.length<state.config.minimumN?'<p class="v20-unstable">Estimación inestable: n inferior al mínimo configurado.</p>':''}<div class="v20-signal" aria-label="Semáforo ${signal}"><i></i>${signal==='verde'?'Meta alcanzada':signal==='amarillo'?'Dentro del margen configurado':signal==='rojo'?'Por debajo de la meta':'Sin datos suficientes'}</div><details><summary>Ver trazabilidad de ${traces.length} registros</summary><div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Asignatura</th><th>Nota</th><th>Periodo</th><th>Fila</th></tr></thead><tbody>${traces.map(t=>`<tr><td>${esc(t.student)}</td><td>${esc(t.course)}</td><td>${esc(t.score)}</td><td>${esc(t.row.periodo||group.period)}</td><td>${esc(t.line)}</td></tr>`).join('')||'<tr><td colspan="5">Sin registros de trazabilidad.</td></tr>'}</tbody></table></div></details></article>`);
      }
    }
    $('#v20-kpi-cards').innerHTML=cards.join('')||'<p class="muted">No hay grupos criteriales para los filtros elegidos.</p>';
  }

  function filteredAllRows() { return criterionRows().filter(compareFilters); }
  function renderDistribution(groups) {
    const target=$('#v20-band-distribution');if(!groups.length){target.innerHTML='<p class="muted">No hay estudiantes en los cortes seleccionados.</p>';return;}
    const width=Math.max(760,groups.length*155+100),height=300,left=58,right=24,top=24,bottom=82,plotW=width-left-right,plotH=height-top-bottom,colors={BAJO:'#c8553d',MEDIO:'#d9a43a',ALTO:'#2e9e83',SUPERIOR:'#1d5fa8'};
    let svg=`<svg class="v20-svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribución porcentual de estudiantes por banda criterial"><title>Distribución por bandas de desempeño, n indicado sobre cada barra</title>`;
    for(const v of [0,25,50,75,100]){const y=top+plotH*(1-v/100);svg+=`<line class="gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="axis-label" x="${left-8}" y="${y+4}" text-anchor="end">${v}%</text>`;}
    const slot=plotW/groups.length,barW=Math.min(54,slot*.44);
    groups.forEach((group,index)=>{const x=left+slot*(index+.5)-barW/2;let y=top+plotH;for(const band of core.BAND_ORDER){const count=group.byBand[band],h=group.rows.length?plotH*count/group.rows.length:0;y-=h;if(h>0)svg+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${colors[band]}"><title>${esc(band)}: ${count} de ${group.rows.length} (${(100*count/group.rows.length).toFixed(1)}%)</title></rect>`;}const label=`${group.period} · S${group.semester} · ${group.ra}`;svg+=`<text class="axis-label" x="${x+barW/2}" y="${top-6}" text-anchor="middle">n=${group.rows.length}</text><text class="axis-label x-label" x="${x+barW/2}" y="${height-50}" text-anchor="middle">${esc(group.period)}</text><text class="axis-label x-label" x="${x+barW/2}" y="${height-34}" text-anchor="middle">S${esc(group.semester)} · ${esc(group.ra)}</text>`;});
    svg+='</svg><div class="v20-chart-legend">'+core.BAND_ORDER.map(b=>`<span><i style="background:${colors[b]}"></i>${b[0]+b.slice(1).toLowerCase()}</span>`).join('')+'</div>';target.innerHTML=svg;
  }

  function renderBoxplot(groups) {
    const target=$('#v20-boxplot');if(!groups.length){target.innerHTML='<p class="muted">No hay datos suficientes para construir los diagramas de caja.</p>';return;}
    const width=Math.max(760,groups.length*145+100),height=350,left=58,right=24,top=28,bottom=78,plotW=width-left-right,plotH=height-top-bottom,y=v=>top+plotH*(1-Math.max(0,Math.min(5,v))/5),colors={RA1:'#1d5fa8',RA2:'#0e9a97',RA3:'#d08a2e',RA4:'#6e5cc4',RA5:'#c8507a',RA6:'#5e8f3a'};
    let svg=`<svg class="v20-svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diagramas de caja de notas criteriales por semestre y RA"><title>Cajas con mínimo, cuartil uno, mediana, cuartil tres y máximo; umbral esperado con línea discontinua</title>`;
    for(let v=0;v<=5;v++){svg+=`<line class="gridline" x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}"/><text class="axis-label" x="${left-8}" y="${y(v)+4}" text-anchor="end">${v}</text>`;}
    const slot=plotW/groups.length,boxW=Math.min(32,slot*.36);
    groups.forEach((group,index)=>{const cx=left+slot*(index+.5),q1=core.quantile(group.rows.map(r=>r.score),.25),med=core.quantile(group.rows.map(r=>r.score),.5),q3=core.quantile(group.rows.map(r=>r.score),.75),min=Math.min(...group.rows.map(r=>r.score)),max=Math.max(...group.rows.map(r=>r.score)),col=colors[group.ra]||'#526779';svg+=`<line x1="${cx}" y1="${y(min)}" x2="${cx}" y2="${y(max)}" stroke="${col}"/><line x1="${cx-boxW/3}" y1="${y(min)}" x2="${cx+boxW/3}" y2="${y(min)}" stroke="${col}"/><line x1="${cx-boxW/3}" y1="${y(max)}" x2="${cx+boxW/3}" y2="${y(max)}" stroke="${col}"/><rect x="${cx-boxW/2}" y="${y(q3)}" width="${boxW}" height="${Math.max(1,y(q1)-y(q3))}" fill="${col}" fill-opacity=".28" stroke="${col}"><title>${esc(group.ra)} · ${esc(group.period)} · S${group.semester}: mín ${fmt(min)}, Q1 ${fmt(q1)}, mediana ${fmt(med)}, Q3 ${fmt(q3)}, máx ${fmt(max)}</title></rect><line x1="${cx-boxW/2}" y1="${y(med)}" x2="${cx+boxW/2}" y2="${y(med)}" stroke="${col}" stroke-width="2"/><line x1="${cx-26}" y1="${y(group.threshold)}" x2="${cx+26}" y2="${y(group.threshold)}" stroke="#252a37" stroke-width="2" stroke-dasharray="4 3"><title>Umbral esperado ${fmt(group.threshold)}</title></line><text class="axis-label" x="${cx}" y="${height-48}" text-anchor="middle">${esc(group.period)}</text><text class="axis-label" x="${cx}" y="${height-31}" text-anchor="middle">S${group.semester} · ${esc(group.ra)}</text>`;});
    svg+='</svg><p class="muted">Línea discontinua: umbral esperado promedio ponderado por créditos. Colores: RA1–RA6.</p>';target.innerHTML=svg;
  }

  function renderAudit(groups) {
    $('#v20-criteria-audit').innerHTML=groups.length?groups.map(g=>{const bands=core.BAND_ORDER.map(b=>`${b[0]+b.slice(1).toLowerCase()}: ${fmt(pct(g.byBand[b],g.rows.length),1)}%`).join(' · ');return `<tr><td>${esc(g.period)}</td><td>${esc(g.semester)}</td><td>${esc(g.ra)}</td><td>${g.rows.length}</td><td>${g.evidenceCount}</td><td>${fmt(g.stats.mean)}</td><td>${fmt(g.stats.sd)}</td><td>${fmt(g.stats.median)}</td><td>${fmt(g.stats.q3-g.stats.q1)}</td><td>${fmt(g.threshold)}</td><td>${fmt(g.successPct,1)}%${g.rows.length<state.config.minimumN?'<small class="v20-unstable"> · estimación inestable</small>':''}</td><td>${bands}</td></tr>`;}).join(''):'<tr><td colspan="12" class="muted">No hay registros válidos para auditar.</td></tr>';
  }

  function renderStudentCriteria() {
    const table=$('#v20-student-criterial');if(!table)return;
    const selectedStudent=$('#proposal-student')?.value||'',selectedPeriod=$('#proposal-student-period')?.value||'';
    const rows=criterionRows().filter(row=>(!selectedStudent||row.student===selectedStudent)&&(!selectedPeriod||row.period===selectedPeriod)).sort((a,b)=>a.period.localeCompare(b.period)||Number(a.semester)-Number(b.semester)||a.ra.localeCompare(b.ra));
    table.innerHTML=rows.length?rows.map(row=>`<tr><td>${esc(row.period)}</td><td>${esc(row.semester)}</td><td>${esc(row.ra)}</td><td>${fmt(row.score)}</td><td>${fmt(row.threshold)}</td><td><span class="badge v20-band v20-band--${row.band.toLowerCase()}">${esc(row.band)}</span></td><td>${row.achieves?'Logra':'Aún no logra'}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">Seleccione un estudiante o cargue registros válidos para calcular su trayectoria criterial.</td></tr>';
  }

  function renderCriteria() {
    const all=criterionRows();renderFilters(all);
    const rows=all.filter(compareFilters),groups=baseGroups(rows);
    renderKpiCards();renderDistribution(groups);renderBoxplot(groups);renderAudit(groups);renderStudentCriteria();
  }

  function parseCsv(text) {
    const source=String(text).replace(/^\uFEFF/,'');let delimiter=',',quoted=false,counts={',':0,';':0,'\t':0},first=source.split(/\r?\n/,1)[0]||'';
    for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"'){i++;continue;}quoted=!quoted;}else if(!quoted&&Object.hasOwn(counts,first[i]))counts[first[i]]++;}
    delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];const table=[];let row=[],field='',inQuotes=false;
    for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'&&inQuotes&&source[i+1]==='"'){field+='"';i++;}else if(ch==='"')inQuotes=!inQuotes;else if(ch===delimiter&&!inQuotes){row.push(field);field='';}else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(cell=>cell.trim()))table.push(row);row=[];field='';}else field+=ch;}
    if(field||row.length){row.push(field);table.push(row);}return table.length?{headers:table[0].map(hnorm),rows:table.slice(1)}:{headers:[],rows:[]};
  }
  function headerIndex(headers,...keys){return headers.findIndex(h=>keys.includes(h));}
  function cell(row,index){return index<0?'':String(row[index]??'').trim();}
  function qualityRows(source) {
    const dataRows=state.sources[source],valid=dataRows.filter(x=>x._status==='VÁLIDA').length,unclassified=source==='saberPro'?dataRows.filter(x=>x._status==='VÁLIDA'&&!classifySaber(x)).length:0;
    const privacy=dataRows.some(x=>x._privacyWarning);
    const warn=privacy?(source==='stakeholders'?' El archivo contiene identificadores personales; elimínalos. Esta fuente no debe incluir identificadores (Ley 1581 de 2012).':' El encabezado contiene campo de nombre: reemplázalo por código de estudiante según la Ley 1581 de 2012.') :'';
    const noClass=unclassified?` ${unclassified} filas válidas no tienen un puntaje numérico utilizable y se excluyen del análisis.`:'';
    const target=$(`#v20-${source==='saberPro'?'saber':source==='perception'?'perception':'stakeholders'}-quality`);
    const demoCount=dataRows.filter(row=>row._isDemo).length;
    target.textContent=`${valid} válidas · ${dataRows.length-valid} excluidas de ${dataRows.length}.${demoCount?` Incluye ${demoCount} filas sintéticas de ejemplo.`:''}${noClass}${warn}`;
    target.classList.toggle('notice--warning',Boolean(warn||unclassified));
    const shortName=source==='saberPro'?'saber':source==='perception'?'perception':'stakeholders';
    const host=$(`#v20-${shortName}-rows`),summary=$(`#v20-${shortName}-rows-summary`);
    if(summary)summary.textContent=`Ver filas individuales · ${dataRows.length} en total (máximo 12 en la tabla)`;
    host.innerHTML=dataRows.length?`<table><thead><tr><th>Fila</th><th>Periodo</th><th>RA / módulo</th><th>Valor</th><th>Estado</th></tr></thead><tbody>${dataRows.slice(-12).reverse().map(row=>`<tr><td>${row._line}</td><td>${esc(row.periodo||row.periodo_aplicacion||'')}</td><td>${esc(row.ra||row.modulo||'')}</td><td>${esc(row.nota??row.puntaje??row.respuesta??'')}</td><td>${esc(row._status)}${row._status==='VÁLIDA'&&source==='saberPro'&&!classifySaber(row)?' · Sin clasificación':''}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Aún no hay filas cargadas para esta fuente.</p>';
  }

  function classifySaber(row) {
    const score=Number(row.puntaje);
    if(row.puntaje===''||!Number.isFinite(score))return null;
    return {score,positive:score>SABER_POSITIVE_SCORE};
  }

  function sourceParser(source,text,fileName) {
    const parsed=parseCsv(text),h=parsed.headers,records=parsed.rows;
    const nameWarning=h.some(x=>source==='stakeholders'?/^(nombre|nombres|name|studentname|nombrecompleto|codigoestudiante|identificacion|documento|correo|email|telefono)$/.test(x):/^(nombre|nombres|name|studentname|nombrecompleto)$/.test(x));
    if(!records.length)throw Error('El archivo no contiene filas de datos.');
    const pick=(...names)=>headerIndex(h,...names);
    return records.map((cells,index)=>{
      const base={_line:index+2,_file:fileName,_privacyWarning:nameWarning};let error='';
      if(source==='saberPro'){
        const row={...base,codigo_estudiante:cell(cells,pick('codigoestudiante','codigo','codigodeestudiante')),periodo_aplicacion:cell(cells,pick('periodoaplicacion','periodo','periodoacademico')),modulo:cell(cells,pick('modulo')),puntaje:cell(cells,pick('puntaje','score')),nivel_desempeno:cell(cells,pick('niveldedesempeno','nivel')),percentil:cell(cells,pick('percentil')),media_grupo_referencia:cell(cells,pick('mediagruporeferencia','mediagrupo'))};
        const score=Number(row.puntaje);
        if(!row.codigo_estudiante||!row.periodo_aplicacion||!row.modulo||row.puntaje===''||!Number.isFinite(score)||score<0||score>300)error='Código, periodo, módulo y puntaje (0–300) son obligatorios';
        if(!error&&row.percentil!==''&&(!Number.isFinite(Number(row.percentil))||Number(row.percentil)<0||Number(row.percentil)>100))error='Percentil debe estar entre 0 y 100';
        if(!error&&row.media_grupo_referencia!==''&&(!Number.isFinite(Number(row.media_grupo_referencia))||Number(row.media_grupo_referencia)<0||Number(row.media_grupo_referencia)>300))error='La media de referencia debe estar entre 0 y 300';
        row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
      }
      if(source==='perception'){
        const row={...base,codigo_estudiante:cell(cells,pick('codigoestudiante','codigo','codigodeestudiante')),periodo:cell(cells,pick('periodo','periodoacademico')),semestre:cell(cells,pick('semestre','sem')),ra:cell(cells,pick('ra','resultadoaprendizaje')).toUpperCase(),item:cell(cells,pick('item','pregunta')),respuesta:cell(cells,pick('respuesta','valor'))};
        const value=Number(row.respuesta);if(!row.codigo_estudiante||!row.periodo||!row.semestre||!data.ra.some(x=>x.id===row.ra)||!row.item||!Number.isInteger(value)||value<1||value>5)error='Código, periodo, semestre, RA, ítem y respuesta 1–5 son obligatorios';row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
      }
      const rawType=core.normalize(cell(cells,pick('tipoinformante','informante','tipo'))),type=rawType.includes('egres')?'egresado':rawType.includes('emple')?'empleador':'';
      const row={...base,tipo_informante:type,periodo:cell(cells,pick('periodo','periodoacademico')),anio_egreso:cell(cells,pick('anioegreso','anoegreso')),ra:cell(cells,pick('ra','resultadoaprendizaje')).toUpperCase(),item:cell(cells,pick('item','pregunta')),respuesta:cell(cells,pick('respuesta','valor'))};
      const value=Number(row.respuesta);if(!type||!row.periodo||!data.ra.some(x=>x.id===row.ra)||!row.item||!Number.isInteger(value)||value<1||value>5)error='Tipo de informante, periodo, RA, ítem y respuesta 1–5 son obligatorios';row._status=error?`ERROR: ${error}`:'VÁLIDA';return row;
    });
  }

  async function loadSource(source,file) {
    try { const rows=sourceParser(source,await file.text(),file.name);state.sources[source]=[...state.sources[source],...rows];state.imports[source].push({file:file.name,total:rows.length,valid:rows.filter(x=>x._status==='VÁLIDA').length});persist(); }
    catch(error){alert(error.message);}
  }

  function renderItemsEditor() {
    $('#v20-items-editor').innerHTML=data.ra.map(ra=>`<fieldset class="v20-item-editor"><legend>${esc(ra.id)} · ${esc(ra.name)}</legend>${(state.config.items[ra.id]||[]).map((item,index)=>`<label>Ítem ${index+1}<textarea data-item-ra="${ra.id}" data-item-index="${index}" rows="3">${esc(item)}</textarea></label>`).join('')}</fieldset>`).join('');
  }

  function renderModuleMappings() {
    const host=$('#v20-module-mappings');host.innerHTML=`<table><thead><tr><th>Módulo Saber Pro</th><th>RA asociados</th><th></th></tr></thead><tbody>${state.config.modules.map((module,index)=>`<tr><td><input type="text" data-module-index="${index}" data-module-field="module" value="${esc(module.module)}" aria-label="Nombre del módulo"></td><td><div class="v20-module-ra">${data.ra.map(ra=>`<label><input type="checkbox" data-module-index="${index}" data-module-ra="${ra.id}"${module.ras.includes(ra.id)?' checked':''}>${ra.id}</label>`).join('')}</div></td><td><button class="button ghost" type="button" data-module-remove="${index}" aria-label="Eliminar módulo">×</button></td></tr>`).join('')}</tbody></table>`;
  }

  function sourceTemplates(source) {
    if(source==='saberPro')return [['codigo_estudiante','periodo_aplicacion','modulo','puntaje','percentil','media_grupo_referencia'],['EST-001','2025-1','Lectura crítica','180','55','']];
    if(source==='perception'){
      const rows=[['codigo_estudiante','periodo','semestre','ra','item','respuesta']];
      data.ra.forEach(ra=>(state.config.items[ra.id]||[]).forEach(item=>rows.push(['EST-001','2025-1','1',ra.id,item,'4'])));return rows;
    }
    return [['tipo_informante','periodo','anio_egreso','ra','item','respuesta'],['egresado','2025-1','2023','RA1','Valoro la pertinencia de la formación recibida para este resultado','4'],['empleador','2025-1','','RA1','El profesional demuestra este resultado en su desempeño','5']];
  }

  function directByPeriod() { return core.computeCriterial({rows:noteRows(),subjects:data.subjects,raList:data.ra,config:state.config,groupBySemester:false}); }
  function saberParticipantRows() {
    const groups=new Map();
    for(const row of state.sources.saberPro){if(row._status!=='VÁLIDA')continue;const classification=classifySaber(row);if(!classification)continue;const module=state.config.modules.find(m=>hnorm(m.module)===hnorm(row.modulo));if(!module)continue;
      for(const ra of module.ras){const key=[row.codigo_estudiante,row.periodo_aplicacion,ra].join('|'),group=groups.get(key)||{student:row.codigo_estudiante,period:row.periodo_aplicacion,ra,scores:[],percentiles:[]};group.scores.push(classification.score);const percentile=Number(row.percentil);if(row.percentil!==''&&Number.isFinite(percentile))group.percentiles.push(percentile);groups.set(key,group);}}
    return [...groups.values()].map(g=>({...g,meanScore:g.scores.reduce((a,b)=>a+b,0)/g.scores.length,meanPercentile:g.percentiles.length?g.percentiles.reduce((a,b)=>a+b,0)/g.percentiles.length:null,success:g.scores.reduce((a,b)=>a+b,0)/g.scores.length>SABER_POSITIVE_SCORE}));
  }
  function perceptionParticipantRows(includeSemester=false) {
    const groups=new Map();for(const row of state.sources.perception){if(row._status!=='VÁLIDA')continue;const key=[row.codigo_estudiante,row.periodo,includeSemester?row.semestre:'',row.ra].join('|'),group=groups.get(key)||{student:row.codigo_estudiante,period:row.periodo,semester:includeSemester?row.semestre:'Todos',ra:row.ra,responses:[]};group.responses.push(Number(row.respuesta));groups.set(key,group);}
    return [...groups.values()].map(g=>({...g,mean:g.responses.reduce((a,b)=>a+b,0)/g.responses.length,success:g.responses.reduce((a,b)=>a+b,0)/g.responses.length>=4}));
  }
  function stakeholdersGroups() {
    const groups=new Map();for(const row of state.sources.stakeholders){if(row._status!=='VÁLIDA')continue;const key=[row.periodo,row.ra,row.tipo_informante].join('|'),group=groups.get(key)||{period:row.periodo,ra:row.ra,type:row.tipo_informante,responses:[]};group.responses.push(Number(row.respuesta));groups.set(key,group);}
    return [...groups.values()].map(g=>({...g,mean:g.responses.reduce((a,b)=>a+b,0)/g.responses.length,n:g.responses.length,success:g.responses.filter(x=>x>=4).length}));
  }
  function summaryParticipants(rows) {
    if(!rows.length)return null;const successful=rows.filter(r=>r.success).length;return {n:rows.length,success:successful,pct:pct(successful,rows.length)};
  }
  function sourceSummaries() {
    const saber=saberParticipantRows(),perception=perceptionParticipantRows(),stakeholders=stakeholdersGroups(),out=new Map();
    const ensure=(period,ra)=>{const key=[period,ra].join('|'),item=out.get(key)||{period,ra,sources:{}};out.set(key,item);return item;};
    for(const ra of data.ra)for(const period of new Set([...saber.map(x=>x.period),...perception.map(x=>x.period),...stakeholders.map(x=>x.period)]))ensure(period,ra.id);
    for(const ra of data.ra){
      const periods=new Set([...saber.filter(x=>x.ra===ra.id).map(x=>x.period),...perception.filter(x=>x.ra===ra.id).map(x=>x.period),...stakeholders.filter(x=>x.ra===ra.id).map(x=>x.period)]);
      for(const period of periods){const item=ensure(period,ra.id),s=summaryParticipants(saber.filter(x=>x.ra===ra.id&&x.period===period)),p=summaryParticipants(perception.filter(x=>x.ra===ra.id&&x.period===period));
        if(s){const entries=saber.filter(x=>x.ra===ra.id&&x.period===period),meanScore=entries.reduce((sum,x)=>sum+x.meanScore,0)/entries.length,percentiles=entries.map(x=>x.meanPercentile).filter(Number.isFinite),meanPercentile=percentiles.length?percentiles.reduce((sum,x)=>sum+x,0)/percentiles.length:null;item.sources.saber={...s,name:'Saber Pro',meanScore,meanPercentile,nationalPercentile:SABER_NATIONAL_PERCENTILE};}if(p)item.sources.perception={...p,name:'Autopercepción'};
        for(const type of ['egresado','empleador']){const group=stakeholders.find(x=>x.ra===ra.id&&x.period===period&&x.type===type);if(group){const n=group.n,itemValue={n,success:group.success,pct:pct(group.success,n),name:type==='egresado'?'Egresados':'Empleadores'};if(n>=state.config.minimumN)item.sources[type]=itemValue;else item.sources[type]={...itemValue,pct:null,insufficient:true};}}
      }
    }
    return [...out.values()].map(item=>{
      const goal=Number(state.config.raTargets[item.ra]??80),available=Object.values(item.sources).filter(x=>x.pct!=null&&x.n>=state.config.minimumN),values=available.map(x=>x.pct),spread=values.length?Math.max(...values)-Math.min(...values):null;
      let classification='Evidencia insuficiente',detail='Se requieren al menos dos fuentes con n suficiente.';
      if(available.length>=2){if(spread<=state.config.divergenceTolerance){classification='Convergente';detail=`Diferencia máxima entre fuentes: ${spread.toFixed(1)} puntos porcentuales.`;}else{classification='Divergente';const high=available.reduce((a,b)=>a.pct>b.pct?a:b),low=available.reduce((a,b)=>a.pct<b.pct?a:b);detail=`${low.name} está ${Math.abs(high.pct-low.pct).toFixed(1)} puntos porcentuales por debajo de ${high.name}.`;}}
      item.goal=goal;item.classification=classification;item.detail=detail;return item;
    }).sort((a,b)=>a.period.localeCompare(b.period)||a.ra.localeCompare(b.ra));
  }

  function semaforo(metric,goal) { if(metric==null)return 'Sin dato';const diff=goal-metric;return diff<=0?'Alcanza la meta':diff<=state.config.margin?'Cerca de la meta':'Bajo la meta'; }
  function renderSourceMetrics() {
    const saber=saberParticipantRows(),perception=perceptionParticipantRows(true),stakeholders=stakeholdersGroups();
    const rows=[];
    for(const ra of data.ra){const groups=new Map();for(const item of perception.filter(x=>x.ra===ra.id)){const key=[item.period,item.semester,item.ra].join('|'),g=groups.get(key)||{period:item.period,semester:item.semester,ra:item.ra,values:[]};g.values.push(item);groups.set(key,g);}for(const g of groups.values()){const values=g.values.map(x=>x.mean),summary=core.stats(values),agree=pct(g.values.filter(x=>x.success).length,g.values.length);rows.push(`<tr><td>Autopercepción</td><td>${esc(g.period)}</td><td>${esc(g.semester)}</td><td>${g.ra}</td><td>—</td><td>—</td><td>${fmt(summary.mean)}</td><td>${fmt(summary.sd)}</td><td>${fmt(agree,1)}%</td><td>${g.values.length}</td></tr>`);}}
    for(const group of stakeholders){const agree=pct(group.success,group.n),show=group.n>=state.config.minimumN;rows.push(`<tr><td>${group.type==='egresado'?'Egresados':'Empleadores'}</td><td>${esc(group.period)}</td><td>—</td><td>${group.ra}</td><td>—</td><td>—</td><td>${show?fmt(group.mean):'—'}</td><td>—</td><td>${show?fmt(agree,1)+'%':'n insuficiente'}</td><td>${group.n}</td></tr>`);}
    for(const group of [...new Set(saber.map(x=>`${x.period}|${x.ra}`))]){const [period,ra]=group.split('|'),items=saber.filter(x=>x.period===period&&x.ra===ra),mean=items.reduce((sum,x)=>sum+x.meanScore,0)/items.length,percentiles=items.map(x=>x.meanPercentile).filter(Number.isFinite),meanPercentile=percentiles.length?percentiles.reduce((sum,x)=>sum+x,0)/percentiles.length:null,agree=pct(items.filter(x=>x.success).length,items.length);rows.push(`<tr><td>Saber Pro</td><td>${esc(period)}</td><td>—</td><td>${ra}</td><td>${fmt(mean,1)}</td><td>${fmt(meanPercentile,1)}</td><td>—</td><td>—</td><td>${fmt(agree,1)}%</td><td>${items.length}</td></tr>`);}
    $('#v20-indirect-metrics').innerHTML=`<table><thead><tr><th>Fuente</th><th>Periodo</th><th>Semestre</th><th>RA</th><th>Puntaje medio Saber Pro (0–300)</th><th>Percentil medio Saber Pro</th><th>Media Likert</th><th>Desv. estándar Likert</th><th>% criterio positivo / acuerdo</th><th>n</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="10" class="muted">Cargue al menos una fuente para ver sus métricas.</td></tr>'}</tbody></table>`;
  }

  function renderMultiSelect(hostId,items,selected,keyOf,labelOf,onChange) {
    const host=$(`#${hostId}`);if(!host)return;
    host.innerHTML=`<div class="v20-multiselect__choices">${items.map(item=>{const key=keyOf(item);return `<label><input type="checkbox" value="${esc(key)}"${selected.has(key)?' checked':''}><span>${esc(labelOf(item))}</span></label>`;}).join('')}</div><button type="button" data-select-all>Seleccionar todos</button>`;
    host.onchange=event=>{const input=event.target;if(input.type!=='checkbox')return;const key=input.value;if(input.checked)selected.add(key);else if(selected.size>1)selected.delete(key);else{input.checked=true;return;}onChange();};
    host.querySelector('[data-select-all]').addEventListener('click',()=>{items.forEach(item=>selected.add(keyOf(item)));onChange();});
  }

  function renderTriangulation() {
    const rows=sourceSummaries(),periods=[...new Set(rows.map(x=>x.period))].sort();
    if(selectedEvidencePeriods===null)selectedEvidencePeriods=new Set(periods);
    else {selectedEvidencePeriods=new Set([...selectedEvidencePeriods].filter(period=>periods.includes(period)));periods.forEach(period=>{if(!selectedEvidencePeriods.size)selectedEvidencePeriods.add(period);});}
    renderMultiSelect('v20-triangulation-sources',evidenceSourceOptions,selectedEvidenceSources,item=>item[0],item=>item[1],renderTriangulation);
    renderMultiSelect('v20-triangulation-periods',periods,selectedEvidencePeriods,item=>item,item=>item,renderTriangulation);
    renderMultiSelect('v20-triangulation-ras',data.ra,selectedEvidenceRAs,item=>item.id,item=>item.id,renderTriangulation);
    const filtered=rows.filter(x=>selectedEvidencePeriods.has(x.period)&&selectedEvidenceRAs.has(x.ra));
    const sourceCell=(item,key)=>{const source=item.sources[key];if(!source)return '—';const goal=item.goal;if(source.pct==null)return `<span class="v20-unstable">n=${source.n} · estimación no reportada</span>`;const percentileDelta=source.meanPercentile==null?'':` · ${source.meanPercentile>=SABER_NATIONAL_PERCENTILE?'+':''}${fmt(source.meanPercentile-SABER_NATIONAL_PERCENTILE,1)} puntos frente a P${SABER_NATIONAL_PERCENTILE}`,saberDetail=key==='saber'?` · media ${fmt(source.meanScore,1)} puntos · percentil medio ${fmt(source.meanPercentile,1)} (referencia P${SABER_NATIONAL_PERCENTILE}${percentileDelta})`:'';return `<strong>${source.pct.toFixed(1)}%</strong> · n=${source.n}<small>${semaforo(source.pct,goal)}${saberDetail}${source.n<state.config.minimumN?' · estimación inestable':''}</small>`;};
    $('#v20-triangulation-table').innerHTML=filtered.length?filtered.map(item=>`<tr><td>${esc(item.period)}</td><td>${item.ra}</td><td>${sourceCell(item,'saber')}</td><td>${sourceCell(item,'perception')}</td><td>${sourceCell(item,'egresado')}</td><td>${sourceCell(item,'empleador')}</td><td><strong>${esc(item.classification)}</strong><small>${esc(item.detail)}</small></td></tr>`).join(''):'<tr><td colspan="7" class="muted">Cargue datos de al menos dos fuentes o cambie los filtros.</td></tr>';
    renderTriangulationChart(filtered,selectedEvidenceSources);
  }

  function renderTriangulationChart(rows,selectedSources) {
    const target=$('#v20-triangulation-chart'),legend=$('#v20-triangulation-legend'),labels=evidenceSourceOptions.filter(([key])=>selectedSources.has(key)).map(([key])=>key),colors={direct:'#1d5fa8',saber:'#d08a2e',perception:'#2e9e83',egresado:'#6e5cc4',empleador:'#c8507a'},names=Object.fromEntries(evidenceSourceOptions),visibleRows=rows.filter(item=>labels.some(key=>item.sources[key]?.pct!=null));
    legend.innerHTML=labels.map(key=>`<span><i style="background:${colors[key]}"></i>${names[key]}</span>`).join('')+'<span class="v20-legend-meta"><i></i>Línea punteada: meta del RA</span>';
    if(!visibleRows.length){target.innerHTML='<p class="muted">No hay resultados para la combinación seleccionada. Marca otra fuente, periodo o RA.</p>';return;}
    const width=1000,left=210,right=70,top=42,rowH=Math.max(70,labels.length*18+18),height=top+visibleRows.length*rowH+26,plotW=width-left-right,x=v=>left+plotW*v/100;
    let svg=`<svg class="v20-svg-chart v20-triangulation-svg v20-grouped-bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barras horizontales agrupadas: porcentaje alcanzado por fuente, periodo y resultado de aprendizaje"><title>Porcentaje alcanzado por fuente, comparado con la meta de cada RA</title>`;
    for(const v of [0,20,40,60,80,100])svg+=`<line class="gridline" x1="${x(v)}" y1="${top-12}" x2="${x(v)}" y2="${height-16}"/><text class="axis-label" x="${x(v)}" y="${top-20}" text-anchor="middle">${v}%</text>`;
    visibleRows.forEach((item,i)=>{const groupTop=top+i*rowH,targetX=x(item.goal);svg+=`<text class="axis-label v20-bar-group-label" x="${left-14}" y="${groupTop+rowH/2+4}" text-anchor="end">${esc(item.period)} · ${item.ra}</text><line x1="${targetX}" y1="${groupTop+4}" x2="${targetX}" y2="${groupTop+rowH-4}" stroke="#263b4a" stroke-width="2" stroke-dasharray="4 4"><title>Meta ${item.goal}% para ${item.ra}</title></line>`;labels.forEach((key,j)=>{const source=item.sources[key];if(!source||source.pct==null)return;const yy=groupTop+8+j*18,barWidth=plotW*source.pct/100,rawDetails=key==='saber'?` · Media ${fmt(source.meanScore,1)} puntos; percentil medio ${fmt(source.meanPercentile,1)}; referencia nacional P48`:'';svg+=`<rect class="v20-evidence-bar" x="${left}" y="${yy}" width="${barWidth}" height="11" rx="5" fill="${colors[key]}"><title>${esc(names[key])}: ${source.pct.toFixed(1)}% ${key==='saber'?'con puntaje >150':'cumple el criterio'} · n=${source.n}${rawDetails}</title></rect><text class="axis-label" x="${Math.min(x(source.pct)+7,width-8)}" y="${yy+9}" text-anchor="start">${source.pct.toFixed(1)}%</text>`;});if(i<visibleRows.length-1)svg+=`<line x1="${left-4}" y1="${groupTop+rowH-1}" x2="${width-right+8}" y2="${groupTop+rowH-1}" stroke="#dce4e9"/>`;});
    svg+='</svg>';target.innerHTML=svg;
  }

  function renderAll() {
    renderConfig();renderItemsEditor();renderModuleMappings();
    for(const source of ['saberPro','perception','stakeholders'])qualityRows(source);
    renderCriteria();renderSourceMetrics();renderTriangulation();
  }

  function exportCriteriaCsv() {
    const rows=baseGroups(criterionRows()),header=['Periodo','Semestre','RA','n estudiantes','n evidencias','Media','Desviacion estandar','Mediana','Q1','Q3','Rango intercuartilico','Umbral esperado','Porcentaje nivel esperado','Bajo %','Medio %','Alto %','Superior %'];
    const body=rows.map(g=>[g.period,g.semester,g.ra,g.rows.length,g.evidenceCount,g.stats.mean,g.stats.sd,g.stats.median,g.stats.q1,g.stats.q3,g.stats.q3-g.stats.q1,g.threshold,g.successPct,...core.BAND_ORDER.map(b=>pct(g.byBand[b],g.rows.length))]);
    download('CORA-propuesta-tabla-criterial.csv','\uFEFF'+[header,...body].map(row=>row.map(csvEscape).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function exportTriangulationCsv() {
    const rows=sourceSummaries(),header=['Periodo','RA','Fuente','Porcentaje positivo / logro','n','Puntaje medio Saber Pro (0–300)','Percentil medio Saber Pro','Referencia nacional percentil','Meta RA','Semaforo','Clasificacion triangulacion'];
    const body=rows.flatMap(item=>Object.entries(item.sources).map(([source,value])=>[item.period,item.ra,source,value.pct,value.n,source==='saber'?value.meanScore:'',source==='saber'?value.meanPercentile:'',source==='saber'?SABER_NATIONAL_PERCENTILE:'',item.goal,semaforo(value.pct,item.goal),item.classification]));
    download('CORA-propuesta-matriz-triangulacion.csv','\uFEFF'+[header,...body].map(row=>row.map(csvEscape).join(';')).join('\r\n'),'text/csv;charset=utf-8');
  }
  function reportHtml() {
    const groups=baseGroups(criterionRows()),tri=sourceSummaries(),provisional=state.approved?'Aprobada localmente por comité':'VALOR PROVISIONAL SUJETO A APROBACIÓN DEL COMITÉ CURRICULAR';
    const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    const kpiConfigTable=table(['KPI','RA','Banda mínima','Meta','Alcance'],kpiProfiles.map(p=>{const c=state.config.kpis[p.indicator],k=data.indicators.find(x=>x.id===p.indicator);return `<tr><td>${p.indicator} · ${esc(k?.description)}</td><td>${p.ra}</td><td>${esc(c.minimumBand)}</td><td>${c.target}%</td><td>${esc(c.scope)}</td></tr>`;}));
    const kpiRows=[];
    for(const profile of kpiProfiles){
      const config=state.config.kpis[profile.indicator],indicator=data.indicators.find(x=>x.id===profile.indicator);
      const values=criterionRows({ra:profile.ra,scope:config.scope});
      const grouped=new Map();
      for(const row of values){const key=[row.period,row.semester].join('|'),group=grouped.get(key)||{period:row.period,semester:row.semester,rows:[]};group.rows.push(row);grouped.set(key,group);}
      if(!grouped.size)kpiRows.push(`<tr><td>${esc(profile.indicator)} · ${esc(indicator?.description)}</td><td>${profile.ra}</td><td>—</td><td>—</td><td>${config.target}%</td><td>0</td><td>Sin datos</td></tr>`);
      for(const group of grouped.values()){
        const reached=group.rows.filter(row=>rankBand(row.band)>=rankBand(config.minimumBand)).length,percent=pct(reached,group.rows.length),signal=percent==null?'Sin datos':percent>=config.target?'Alcanza la meta':percent>=config.target-state.config.margin?'Cerca de la meta':'Bajo la meta';
        kpiRows.push(`<tr><td>${esc(profile.indicator)} · ${esc(indicator?.description)}</td><td>${profile.ra}</td><td>${esc(group.period)} · semestre ${esc(group.semester)}</td><td>${percent==null?'—':fmt(percent,1)+'%'}</td><td>${config.target}%</td><td>${group.rows.length}</td><td>${group.rows.length<state.config.minimumN?'Estimación inestable · ':''}${signal}</td></tr>`);
      }
    }
    const kpiResultsTable=table(['KPI','RA','Periodo · semestre','Resultado','Meta','n','Estado'],kpiRows);
    const distTable=table(['Periodo','Semestre','RA','n','Media','DE','Mediana','Umbral','Logro'],groups.map(g=>`<tr><td>${esc(g.period)}</td><td>${g.semester}</td><td>${g.ra}</td><td>${g.rows.length}</td><td>${fmt(g.stats.mean)}</td><td>${fmt(g.stats.sd)}</td><td>${fmt(g.stats.median)}</td><td>${fmt(g.threshold)}</td><td>${fmt(g.successPct,1)}%</td></tr>`));
    const triTable=table(['Periodo','RA','Saber Pro: % con puntaje >150','Puntaje medio Saber Pro','Percentil medio (ref. P48)','Autopercepción','Egresados','Empleadores','Clasificación'],tri.map(x=>`<tr><td>${esc(x.period)}</td><td>${x.ra}</td><td>${x.sources.saber?.pct==null?'—':fmt(x.sources.saber.pct,1)+'% (n='+x.sources.saber.n+')'}</td><td>${fmt(x.sources.saber?.meanScore,1)}</td><td>${fmt(x.sources.saber?.meanPercentile,1)}</td>${['perception','egresado','empleador'].map(k=>`<td>${x.sources[k]?.pct==null?'—':fmt(x.sources[k].pct,1)+'% (n='+x.sources[k].n+')'}</td>`).join('')}<td>${esc(x.classification)} · ${esc(x.detail)}</td></tr>`));
    const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CORA · Propuesta de modificación curricular · Informe de logro criterial y triangulación</title><style>body{font:14px/1.55 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:1200px;margin:32px auto;padding:0 18px;color:#0e1a2b}h1,h2{color:#0f2d57}table{width:100%;border-collapse:collapse;margin:14px 0 26px}th,td{border:1px solid #d7dfe5;padding:7px;text-align:left;vertical-align:top}th{background:#edf3f6}.alert{padding:12px;background:#fff4da;border-left:4px solid #bc8a2e}.muted{color:#5f6d77}</style><h1>CORA · Fisioterapia · Propuesta de modificación curricular</h1><p>Informe de logro criterial y triangulación · ${new Date().toLocaleDateString('es-CO')}</p><p class="alert"><strong>Estado de configuración:</strong> ${esc(provisional)}. Umbrales: ${esc(JSON.stringify(state.config.thresholds))}. Tamaño mínimo: ${state.config.minimumN}. Margen semáforo: ${state.config.margin} p.p. Tolerancia convergencia: ${state.config.divergenceTolerance} p.p.</p><h2>Metodología criterial</h2><p>Media de evidencias válidas por estudiante y asignatura en nota original 0–5. Luego promedio por estudiante × RA × semestre × periodo, ponderado por créditos; umbral ponderado con los umbrales del nivel de aporte. Hay logro si nota criterial ≥ umbral. Bandas se asignan con la nota redondeada a dos decimales. Los KPI filtran su alcance antes de calcular la nota criterial y reportan el porcentaje en la banda mínima o superior.</p><h2>Resultados de KPI</h2>${kpiResultsTable}<h2>Configuración KPI</h2>${kpiConfigTable}<h2>Distribuciones y tabla criterial</h2>${distTable}<h2>Matriz de fuentes complementarias</h2>${triTable}<p class="muted">Los valores provisionales requieren validación curricular. Fuentes con muestra insuficiente se indican o no se reportan según el tipo de fuente.</p></html>`;
    download('CORA-propuesta-informe-criterial-triangulacion.html',html,'text/html;charset=utf-8');
  }

  function resetExample() {
    if(!confirm('Este ejemplo reemplazará las notas y fuentes de evidencia de la propuesta de modificación curricular en este navegador. ¿Continuar?'))return;
    const students=Array.from({length:20},(_,i)=>`EST-${String(i+1).padStart(3,'0')}`),periods=['2025-1','2025-2'];
    const chosen=new Map(data.ra.map(ra=>[ra.id,data.subjects.find(c=>c[ra.id.toLowerCase()]==='DOMINA')||data.subjects.find(c=>c[ra.id.toLowerCase()])]));
    const gradeRows=[];let line=2;
    for(const period of periods)for(let i=0;i<students.length;i++){
      const used=new Set();for(const course of chosen.values())if(course&&!used.has(course.id)){used.add(course.id);gradeRows.push({line:line++,asignatura:course.name,estudiante:students[i],nota:(4.1+(i%4)*.2).toFixed(1),actividad:'Evidencia ilustrativa',instrumento:'Rúbrica de ejemplo',codigoActividad:'',tipoNota:'asignatura',periodo:period,sourceFile:'Muestra simulada · notas directas',isDemonstration:true});}
    }
    localStorage.setItem('cora-fisioterapia-propuesta-v20-v1',JSON.stringify({rows:gradeRows,uploads:[{file:'ejemplo-criterial-v20.csv',period:'2025-1 / 2025-2',tipoNota:'asignatura',total:gradeRows.length,valid:gradeRows.length,omitted:0}]}));
    const demo=makeComplementaryDemo(),{saberPro,perception,stakeholders}=demo;
    state.sources={saberPro,perception,stakeholders};state.imports={saberPro:[{file:'Muestra simulada · Saber Pro',total:saberPro.length,valid:saberPro.length,demo:true}],perception:[{file:'Muestra simulada · Autopercepción',total:perception.length,valid:perception.length,demo:true}],stakeholders:[{file:'Muestra simulada · Egresados y empleadores',total:stakeholders.length,valid:stakeholders.length,demo:true}]};state.demoEvidenceDismissed=false;state.demoEvidenceVersion=3;persist();
    window.setTimeout(()=>window.location.reload(),100);
  }

  $('#v20-config-form').addEventListener('submit',event=>{event.preventDefault();const next=collectConfig(),error=core.validateConfig(next);if(error){$('#v20-config-error').textContent=error;$('#v20-config-error').hidden=false;return;}state.config=next;state.approved=$('#v20-config-approved').checked;$('#v20-config-error').hidden=true;persist();});
  $('#v20-config-approved').addEventListener('change',event=>{const next=collectConfig(),error=core.validateConfig(next);if(error){event.target.checked=false;state.approved=false;$('#v20-config-error').textContent=error;$('#v20-config-error').hidden=false;activeSettingsNotice();return;}state.config=next;state.approved=event.target.checked;$('#v20-config-error').hidden=true;persist();});
  $('#v20-config-fields').addEventListener('input',()=>{state.approved=false;$('#v20-config-approved').checked=false;activeSettingsNotice();});
  $('#v20-config-export').addEventListener('click',()=>download('CORA-propuesta-configuracion-criterial.json',JSON.stringify({curricularVersion:data.metadata.version,approved:state.approved,config:state.config},null,2),'application/json'));
  $('#v20-config-import').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),config=parsed.config||parsed,next=core.migrateState({config},defaultState()).config,error=core.validateConfig(next);if(error)throw Error(error);state.config=next;state.approved=false;persist();}catch(error){alert(`No se pudo importar la configuración: ${error.message}`);}event.target.value='';});
  $('#v20-config-reset').addEventListener('click',()=>{if(!confirm('¿Restablecer únicamente los criterios V20 a sus valores provisionales?'))return;state.config=defaultConfig();state.approved=false;persist();});
  $('#v20-module-mappings').addEventListener('change',event=>{
    const index=Number(event.target.dataset.moduleIndex);if(!Number.isInteger(index)||!state.config.modules[index])return;
    if(event.target.dataset.moduleRa){const ra=event.target.dataset.moduleRa,set=new Set(state.config.modules[index].ras);event.target.checked?set.add(ra):set.delete(ra);state.config.modules[index].ras=[...set];}
    else if(event.target.dataset.moduleField)state.config.modules[index][event.target.dataset.moduleField]=event.target.value;
    state.approved=false;persist();
  });
  $('#v20-add-module').addEventListener('click',()=>{state.config.modules.push({module:'',ras:[]});state.approved=false;persist();});
  $('#v20-module-mappings').addEventListener('click',event=>{const button=event.target.closest('[data-module-remove]');if(!button)return;state.config.modules.splice(Number(button.dataset.moduleRemove),1);state.approved=false;persist();});
  $('#v20-items-editor').addEventListener('change',event=>{const ra=event.target.dataset.itemRa,index=Number(event.target.dataset.itemIndex);if(!ra||!Number.isInteger(index))return;state.config.items[ra][index]=event.target.value;state.approved=false;persist();});
  for(const [source,id] of [['saberPro','v20-saber-file'],['perception','v20-perception-file'],['stakeholders','v20-stakeholders-file']])$(`#${id}`).addEventListener('change',async event=>{const file=event.target.files?.[0];if(file)await loadSource(source,file);event.target.value='';});
  document.querySelectorAll('[data-v20-template]').forEach(button=>button.addEventListener('click',()=>{const source=button.dataset.v20Template,rows=sourceTemplates(source),content=rows.map(row=>row.map(csvEscape).join(';')).join('\r\n');download(`plantilla_${source==='saberPro'?'saber_pro':source==='perception'?'autopercepcion_estudiantil':'egresados_empleadores'}_V20.csv`,'\uFEFF'+content,'text/csv;charset=utf-8');}));
  document.querySelectorAll('[data-v20-clear-source]').forEach(button=>button.addEventListener('click',()=>{const source=button.dataset.v20ClearSource;if(!confirm('¿Limpiar solo esta fuente de evidencia de la propuesta de modificación curricular?'))return;state.sources[source]=[];state.imports[source]=[];state.demoEvidenceDismissed=true;persist();}));
  $('#v20-criteria-period').addEventListener('change',renderCriteria);$('#v20-criteria-semester').addEventListener('change',renderCriteria);
  $('#v20-criteria-ra-filter').addEventListener('change',event=>{if(event.target.type!=='checkbox')return;event.target.checked?selectedRAs.add(event.target.value):selectedRAs.delete(event.target.value);renderCriteria();});
  $('#proposal-student')?.addEventListener('change',renderStudentCriteria);$('#proposal-student-period')?.addEventListener('change',renderStudentCriteria);
  $('#proposal-chart-metric')?.addEventListener('change',()=>window.CORA_FISIO_V20_REFRESH?.());$('#proposal-table-metric')?.addEventListener('change',()=>window.CORA_FISIO_V20_REFRESH?.());
  document.querySelectorAll('.proposal-sidebar [data-proposal-view]').forEach(button=>button.addEventListener('click',()=>setTimeout(renderAll,0)));
  $('#v20-criterial-csv').addEventListener('click',exportCriteriaCsv);$('#v20-triangulation-csv')?.addEventListener('click',exportTriangulationCsv);$('#v20-criterial-report').addEventListener('click',reportHtml);$('#v20-triangulation-example').addEventListener('click',resetExample);

  document.addEventListener('cora:demo-sample-loaded',()=>window.setTimeout(()=>{if(ensureComplementaryDemo())renderAll();},0));
  ensureComplementaryDemo();
  window.CORA_V20_EVIDENCE={refresh:renderAll,getCriterialRows(period=''){return criterionRows({period}).map(row=>({...row,direct:row.score,credit:null,comparable:null,count:row.evidenceCount,averageFactor:1}));},getStudentRows:criterionRows,exportTriangulationCsv};
  window.CORA_FISIO_V20_REFRESH=renderAll;
  renderAll();
})();
