/* =========================================================================
   AstroHealth · User interface
   Views: Dashboard, Body, Log, Trends, Routine and Guide.
   Dialogs: welcome, settings, report to Earth, tap-to-measure pulse,
   confirmation and data export.
   Every UI string is written as tx('English', 'Español'); the EN/ES switch
   in the top bar changes the language (see js/i18n.js for the content).
   SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
   tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;
  const tx = V.tx;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const ic = (n, c) => V.icon(n, c);
  const pill = (lv, text) => `<span class="pill lvl-${lv}">${esc(text || V.LEVEL_TEXT[lv])}</span>`;
  const tight = (unit) => (V.tightUnit(unit) ? 'tight' : '');

  const MOOD_EMOJI = { 1: '😣', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
  const moodLabel = (v) => tx(['', 'Very bad', 'Bad', 'Okay', 'Good', 'Excellent'], ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'])[v];
  const stressLabel = (v) => tx(['', 'Very low', 'Low', 'Moderate', 'High', 'Extreme'], ['', 'Muy bajo', 'Bajo', 'Moderado', 'Alto', 'Extremo'])[v];
  const bpName = () => tx('Blood pressure', 'Presión arterial');
  const VIEWS = ['dashboard', 'body', 'log', 'trends', 'routine', 'control', 'guide'];
  const BP_RANGE = '90–119 / 60–79 mmHg';

  let state = V.loadState();
  let A = null;              // current assessment (cache)
  let view = 'dashboard';
  let trendSel = 'hr';
  let trendRange = 14;
  let chart = null;
  let region = 'heart';
  let snoozeUntil = 0;
  let lastResult = null;     // last saved log (to show its assessment)
  let breathTimer = null;
  let modalClose = null;
  let lastFocus = null;
  let txTimers = [];
  let reportCache = '';

  /* ================================================================== Core */
  function refresh() {
    A = V.assess(state);
    A.routine = V.routine(state, A.days);
    A.progress = V.progress(state, A.days, A.ctx);
  }

  function commit(opts = {}) {
    const before = A ? A.progress : null;
    V.saveState(state);
    refresh();
    if (!opts.quiet && before) {
      const gained = A.progress.xp - before.xp;
      if (gained > 0) toast(`+${gained} XP`, 'xp', 'zap');
      if (A.progress.level > before.level) toast(tx(`Level up! You reached level ${A.progress.level}: ${A.progress.rank}`, `¡Subiste a nivel ${A.progress.level}: ${A.progress.rank}!`), 'badge', 'rocket');
      V.BADGES.forEach((b) => {
        if (A.progress.earned.has(b.id) && !before.earned.has(b.id)) toast(`${tx('Badge unlocked', 'Insignia desbloqueada')}: ${b.name}`, 'badge', 'star');
      });
    }
    renderAll();
  }

  function renderAll() {
    renderHeader();
    renderSidebarXP();
    renderReminder();
    renderView();
  }

  function renderView() {
    stopBreath(false);
    if (chart && view !== 'trends') { chart.destroy(); chart = null; }
    if (holo && view !== 'body') holo.pause();
    ({ dashboard: renderDashboard, body: renderBody, log: renderLog, trends: renderTrends, routine: renderRoutine, control: renderControl, guide: renderGuide })[view]();
  }

  function setView(v, opts = {}) {
    if (!VIEWS.includes(v)) v = 'dashboard';
    if (v !== 'log') lastResult = null;
    view = v;
    VIEWS.forEach((id) => { $('#view-' + id).hidden = id !== v; });
    $$('#nav [data-view]').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderView();
    if (!opts.keepScroll) window.scrollTo({ top: 0 });
    try { if (location.hash !== '#' + v) location.replace('#' + v); } catch (e) { /* no history available */ }
  }

  /* ============================================================== Language */
  // Static texts in index.html carry their Spanish version in data-es / data-es-label
  function applyStatic() {
    $$('[data-es]').forEach((el) => {
      if (el.dataset.en == null) el.dataset.en = el.textContent;
      el.textContent = tx(el.dataset.en, el.dataset.es);
    });
    $$('[data-es-label]').forEach((el) => {
      if (el.dataset.enLabel == null) el.dataset.enLabel = el.getAttribute('aria-label') || '';
      const v = tx(el.dataset.enLabel, el.dataset.esLabel);
      el.setAttribute('aria-label', v);
      if (el.hasAttribute('title')) el.setAttribute('title', v);
    });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === V.lang)));
  }

  function switchLang(lang) {
    if (lang === V.lang) return;
    closeModal(true);
    V.setLang(lang);
    V.relocalizeDemo(state);
    V.saveState(state);
    refresh();
    applyStatic();
    renderAll();
    toast(tx('Language: English', 'Idioma: español'), 'info', 'globe');
  }

  /* ================================================================ Header */
  const clockText = () => { const d = new Date(); return `${V.pad2(d.getHours())}:${V.pad2(d.getMinutes())}`; };

  function renderHeader() {
    const p = state.profile || {};
    const env = A.ctx.env;
    const md = V.missionDay(state);
    $('#mission-info').innerHTML = `
      <div class="mi-who">${ic('user')}<div><strong>${esc(p.name || tx('Astronaut', 'Astronauta'))}</strong><span>${esc(p.mission || tx('Unnamed mission', 'Misión sin nombre'))}${p.demo ? ' · demo' : ''}</span></div></div>
      <div class="mi-chip">${ic('orbit')}<div><span>${tx('Environment', 'Entorno')}</span><strong>${esc(env.short)}</strong></div></div>
      <div class="mi-chip">${ic('rocket')}<div><span>${tx('Mission day', 'Día de misión')}</span><strong>${md || '—'}</strong></div></div>
      <div class="mi-chip">${ic('signal')}<div><span>${tx('Earth delay', 'Retardo con Tierra')}</span><strong>${esc(env.delayLabel)}</strong></div></div>
      <div class="mi-chip mi-clock">${ic('clock')}<div><span>${tx('Onboard time', 'Hora a bordo')}</span><strong id="clock">${clockText()}</strong></div></div>`;
  }

  function renderSidebarXP() {
    const pr = A.progress;
    $('#xp-mini').innerHTML = `
      <div class="xp-mini-top"><span>${tx('Level', 'Nivel')} ${pr.level} · ${esc(pr.rank)}</span><span>${pr.xp} XP</span></div>
      <div class="bar"><span style="width:${(pr.into / pr.need) * 100}%"></span></div>
      ${pr.streak ? `<div class="xp-mini-streak">${ic('flame')} ${tx(`${pr.streak}-day streak`, `Racha de ${pr.streak} día${pr.streak > 1 ? 's' : ''}`)}</div>` : ''}`;
  }

  function renderReminder() {
    const el = $('#reminder');
    const over = A.routine.tasks.filter((t) => t.overdue);
    if (!state.profile || !over.length || Date.now() < snoozeUntil) { el.hidden = true; el.innerHTML = ''; return; }
    const t = over[0];
    const isBreath = t.special === 'breath';
    el.hidden = false;
    el.innerHTML = `
      <span class="reminder-ic">${ic('clock')}</span>
      <div class="reminder-text"><strong>${tx(`Due since ${t.time}`, `Pendiente desde las ${t.time}`)}: ${esc(t.name)}</strong>
        <span>${over.length > 1 ? tx(`You have ${over.length} pending tasks in today's routine.`, `Tienes ${over.length} tareas pendientes en tu rutina de hoy.`) : esc(t.detail)}</span></div>
      <button type="button" class="btn btn-sm btn-primary" data-action="${isBreath ? 'goto-breath' : 'goto-log'}" data-task="${t.id}">${isBreath ? tx('Do it now', 'Hacer ahora') : tx('Log now', 'Registrar ahora')}</button>
      <button type="button" class="btn btn-sm btn-ghost" data-action="snooze">${tx('Later', 'Más tarde')}</button>`;
  }

  /* ============================================================= Dashboard */
  function scoreRing(score, level) {
    const r = 52, c = 2 * Math.PI * r, f = score == null ? 0 : score / 100;
    const label = score == null ? tx('no data', 'sin datos') : tx(`${score} out of 100`, `${score} de 100`);
    return `<svg class="ring lvl-${level}" viewBox="0 0 120 120" role="img" aria-label="${tx('Health score', 'Índice de salud')}: ${label}">
      <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
      <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="60" class="ring-num" text-anchor="middle" dominant-baseline="central">${score == null ? '—' : score}</text>
      <text x="60" y="88" class="ring-sub" text-anchor="middle">${tx('out of 100', 'de 100')}</text>
    </svg>`;
  }

  function alertItem(a) {
    return `<li class="alert lvl-${a.level}">
      <span class="alert-icon">${ic(a.level === 'info' ? 'info' : 'alert')}</span>
      <div class="alert-body">
        <div class="alert-title"><strong>${esc(a.title)}</strong>${pill(a.level)}</div>
        <p>${esc(a.text)}</p>
        ${a.actions && a.actions.length ? `<ul class="actions">${a.actions.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="alert-btns">
          ${a.level === 'crit' ? `<button type="button" class="btn btn-sm btn-crit" data-action="report">${ic('send')} ${tx('Report to Earth', 'Reportar a Tierra')}</button>` : ''}
          ${a.indicator ? `<button type="button" class="btn btn-sm btn-ghost" data-trend="${a.indicator}">${ic('chart')} ${tx('View trend', 'Ver tendencia')}</button>` : ''}
          ${a.cta === 'log' ? `<button type="button" class="btn btn-sm btn-primary" data-action="goto-log">${ic('plus')} ${tx('Log now', 'Registrar ahora')}</button>` : ''}
        </div>
      </div>
    </li>`;
  }

  function indCard(id) {
    const ctx = A.ctx;
    const isBP = id === 'bp';
    const it = A.items[id];
    const ind = isBP ? null : V.INDICATORS[id];
    const name = isBP ? bpName() : ind.name;
    const unit = isBP ? 'mmHg' : ind.unit;
    const value = isBP
      ? (it.value ? `${V.fmtVal('sys', it.value[0])}/${V.fmtVal('dia', it.value[1])}` : '—')
      : (it.value != null ? V.fmtVal(id, it.value) : '—');
    const range = isBP ? '90–119 / 60–79' : V.rangeText(id, ctx);
    const sid = isBP ? 'sys' : id;
    const sv = V.lastNDays(7).map((k) => V.dayValue(A.days, k, sid));
    const sl = sv.map((v) => (v == null ? null : V.statusOf(sid, v, ctx).level));
    const stale = it.value != null && !it.fresh;
    const meta = it.ts ? `${stale ? tx('Outdated · ', 'Dato antiguo · ') : ''}${V.timeAgo(it.ts)}` : tx('No logs', 'Sin registros');
    return `<button type="button" class="card ind-card lvl-${it.level}" data-trend="${id}" aria-label="${esc(name)}: ${value} ${esc(unit)}, ${V.LEVEL_TEXT[it.level]}. ${tx('View trend', 'Ver tendencia')}">
      <div class="ind-top"><span class="ind-icon">${ic(isBP ? 'gauge' : ind.icon)}</span><span class="ind-name">${esc(name)}</span>${pill(it.level)}</div>
      <div class="ind-value">${value}<small class="${tight(unit)}">${esc(unit)}</small></div>
      <div class="ind-foot"><span class="ind-meta">${meta}<br>Normal: ${esc(range)}</span>${V.sparkline(sv, sl)}</div>
    </button>`;
  }

  function renderDashboard() {
    const a = A, r = a.routine, pr = a.progress;
    const alerts = a.alerts;
    const shown = alerts.slice(0, 6);
    const cd = a.cumDose, bl = a.boneLoss, env = a.ctx.env;
    const hasData = state.records.length > 0;
    const natYears = cd.total / 2.4;
    const yrs = V.fmtNum(natYears, natYears < 10 ? 1 : 0);
    const cdPct = V.pct(V.fmtNum(cd.pct, 1));
    const rate = V.pct(V.fmtNum(env.boneRate, 1));
    const intro = state.ui && state.ui.intro && state.profile && state.profile.demo;
    $('#view-dashboard').innerHTML = `
      ${intro ? `<div class="card intro">
        <div class="intro-logo">${V.logo(52)}</div>
        <div class="intro-text"><h2>${tx('Welcome to AstroHealth', 'Bienvenido a AstroHealth')}</h2><p>${tx(
          'You are viewing a <strong>demo mission</strong>: 30 days of simulated data from a transit to Mars. Explore the dashboard, tap the body map or log your own measurements.',
          'Estás viendo una <strong>misión de demostración</strong>: 30 días de datos simulados de un tránsito a Marte. Explora el panel, toca el mapa del cuerpo o registra tus propias mediciones.')}</p></div>
        <div class="intro-actions">
          <button type="button" class="btn btn-primary" data-action="setup">${ic('sliders')} ${tx('Set up my own mission', 'Configurar mi propia misión')}</button>
          <button type="button" class="btn btn-ghost" data-action="intro-dismiss">${tx('Got it', 'Entendido')}</button>
        </div>
      </div>` : ''}
      <div class="page-head">
        <div><h1>${tx('Health dashboard', 'Panel de salud')}</h1><p class="muted">${tx('A quick assessment of your condition based on your latest logs.', 'Evaluación rápida de tu estado con los últimos datos registrados.')}</p></div>
        <button type="button" class="btn btn-primary" data-action="goto-log">${ic('plus')} ${tx('Log measurements', 'Registrar mediciones')}</button>
      </div>

      <div class="grid dash-top">
        <div class="card score-card lvl-${a.scoreLevel}">
          <h2 class="card-title">${tx('AstroHealth score', 'Índice AstroHealth')}</h2>
          ${scoreRing(a.score, a.scoreLevel)}
          <div class="score-label">${pill(a.scoreLevel, a.scoreLabel)}</div>
          <ul class="counts">
            <li class="lvl-ok"><strong>${a.counts.ok}</strong><span>${V.LEVEL_TEXT.ok}</span></li>
            <li class="lvl-watch"><strong>${a.counts.watch}</strong><span>${V.LEVEL_TEXT.watch}</span></li>
            <li class="lvl-crit"><strong>${a.counts.crit}</strong><span>${V.LEVEL_TEXT.crit}</span></li>
          </ul>
          <p class="muted small center">${a.lastTs ? `${tx('Last log', 'Último registro')} ${V.timeAgo(a.lastTs)}` : tx('No logs yet', 'Sin registros todavía')}</p>
        </div>

        <div class="card alerts-card">
          <div class="card-head"><h2 class="card-title">${tx('Alerts and recommended actions', 'Alertas y acciones recomendadas')}</h2><span class="muted small">${alerts.length ? tx(`${alerts.length} active`, `${alerts.length} activa${alerts.length > 1 ? 's' : ''}`) : ''}</span></div>
          ${alerts.length
            ? `<ul class="alerts">${shown.map(alertItem).join('')}</ul>${alerts.length > shown.length ? `<p class="muted small">${tx(`Plus ${alerts.length - shown.length} more: see them in the report to Earth.`, `Y ${alerts.length - shown.length} más: consúltalas en el reporte a Tierra.`)}</p>` : ''}`
            : `<div class="empty">${ic('check')}<p>${tx('<strong>No alerts.</strong> All your recent indicators are within range. Keep it up!', '<strong>Sin alertas.</strong> Todos tus indicadores recientes están en rango. ¡Sigue así!')}</p></div>`}
        </div>

        <div class="card routine-mini">
          <div class="card-head"><h2 class="card-title">${tx("Today's routine", 'Rutina de hoy')}</h2><button type="button" class="link" data-view-link="routine">${tx('View all', 'Ver todo')}</button></div>
          <div class="progress-row"><div class="bar big"><span style="width:${(r.doneCount / r.total) * 100}%"></span></div><strong>${r.doneCount}/${r.total}</strong></div>
          <ul class="task-mini">${r.tasks.map((t) => `
            <li class="${t.done ? 'done' : t.overdue ? 'overdue' : ''}">
              <span class="tm-check">${t.done ? ic('check') : ''}</span><span class="tm-time">${t.time}</span><span class="tm-name">${esc(t.name)}</span>
            </li>`).join('')}</ul>
          <div class="xp-line">${ic('star')} ${tx('Level', 'Nivel')} ${pr.level} · ${esc(pr.rank)} <span class="muted">· ${pr.xp} XP</span></div>
        </div>
      </div>

      <div class="section-head"><h2>${tx('Indicators', 'Indicadores')}</h2><span class="muted small">${tx('Tap a card to see its trend', 'Toca una tarjeta para ver su tendencia')}</span></div>
      <div class="grid cards">${V.CARD_ORDER.map(indCard).join('')}</div>

      <div class="section-head"><h2>${tx('Mission exposure and environment', 'Exposición y entorno de misión')}</h2></div>
      <div class="grid dash-bottom">
        <div class="card expo lvl-${hasData ? cd.level : 'none'}">
          <div class="expo-head">${ic('radiation')}<h3>${tx('Cumulative radiation', 'Radiación acumulada')}</h3>${pill(hasData ? cd.level : 'none')}</div>
          <div class="expo-value">${V.fmtNum(cd.total, 1)}<small>mSv</small></div>
          <div class="bar"><span style="width:${Math.min(100, cd.pct)}%"></span></div>
          <p class="small muted">${tx(
            `${cdPct} of NASA's career limit (600 mSv), equivalent to about ${yrs} years of natural background radiation on Earth.`,
            `${cdPct} del límite de carrera de NASA (600 mSv), equivalente a ~${yrs} años de radiación natural en la Tierra.`)}${cd.estDays ? tx(
            ` Includes ${cd.estDays} day(s) estimated with the environment's typical dose.`,
            ` Incluye ${cd.estDays} día(s) estimado(s) con la dosis típica del entorno.`) : ''}</p>
        </div>
        <div class="card expo lvl-${hasData ? bl.level : 'none'}">
          <div class="expo-head">${ic('body')}<h3>${tx('Estimated bone loss', 'Pérdida ósea estimada')}</h3>${pill(hasData ? bl.level : 'none')}</div>
          <div class="expo-value">${V.fmtNum(bl.pct, 1)}<small class="${tight('%')}">%</small></div>
          <div class="bar"><span style="width:${Math.min(100, (bl.pct / 5) * 100)}%"></span></div>
          <p class="small muted">${tx(
            `Simplified model: in ${env.gravity === 0 ? 'microgravity' : 'reduced gravity'} bones lose about ${rate} per month without countermeasures, and exercise cuts that by up to 60%.`,
            `Modelo simplificado: en ${env.gravity === 0 ? 'microgravedad' : 'baja gravedad'} se pierde ~${rate} al mes sin contramedidas y el ejercicio lo reduce hasta un 60 %.`)}${bl.compliance != null ? ` ${tx('Exercise compliance', 'Cumplimiento de ejercicio')}: ${V.pct(Math.round(bl.compliance * 100))}.` : ''}</p>
        </div>
        <div class="card expo env-card">
          <div class="expo-head">${ic('orbit')}<h3>${esc(env.name)}</h3></div>
          <dl class="env-dl">
            <div><dt>${tx('Gravity', 'Gravedad')}</dt><dd>${esc(env.gravityLabel)}</dd></div>
            <div><dt>${tx('Typical radiation', 'Radiación típica')}</dt><dd>${V.fmtNum(env.radBaseline, 2)} mSv/${tx('day', 'día')}</dd></div>
            <div><dt>${tx('Earth delay', 'Retardo con Tierra')}</dt><dd>${esc(env.delayLabel)}</dd></div>
            <div><dt>${tx('Exercise goal', 'Meta de ejercicio')}</dt><dd>${env.exerciseTarget} min/${tx('day', 'día')}</dd></div>
          </dl>
          <p class="small muted">${esc(env.note)}</p>
        </div>
      </div>`;
  }

  /* ============================================================== Body map */
  // 3D hologram of the body (js/holo.js). It is created once and re-attached on each render,
  // so the camera keeps its position and zoom when the view refreshes.
  let holo = null;

  function mountHolo() {
    const stage = $('#holo-stage');
    if (!stage || !V.createHolo) return;
    if (!holo) holo = V.createHolo();
    holo.mount(stage, {
      selected: region,
      regions: Object.values(V.REGIONS).map((r) => {
        const lv = A.regions[r.id].level;
        return { id: r.id, name: r.name, level: lv, levelText: V.LEVEL_TEXT[lv] };
      }),
      texts: {
        title: tx('Bio-scan · 3D', 'Bioescaneo · 3D'),
        canvas: tx('3D hologram of the human body. Choose a region to zoom in on it.', 'Holograma 3D del cuerpo humano. Elige una región para acercarte a ella.'),
        hint: tx('Drag to rotate · choose a point to zoom in', 'Arrastra para girar · elige un punto para acercar'),
        reset: tx('Full body', 'Cuerpo completo'),
        left: tx('Rotate left', 'Girar a la izquierda'),
        right: tx('Rotate right', 'Girar a la derecha')
      }
    });
  }

  function regionPanel(id) {
    const reg = V.REGIONS[id], st = A.regions[id];
    const has = state.records.length > 0;
    const rows = [];
    reg.indicators.forEach((iid) => {
      const it = A.items[iid], ind = V.INDICATORS[iid];
      rows.push(`<li><span class="rp-name">${ic(ind.icon)}${esc(ind.name)}</span><span class="rp-val">${it.value != null ? esc(V.fmtFull(iid, it.value)) : '—'}</span>${pill(it.level)}</li>`);
    });
    (reg.derived || []).forEach((dk) => {
      if (dk === 'boneLoss') rows.push(`<li><span class="rp-name">${ic('body')}${tx('Estimated bone loss', 'Pérdida ósea estimada')}</span><span class="rp-val">${V.pct(V.fmtNum(A.boneLoss.pct, 1))}</span>${pill(has ? A.boneLoss.level : 'none')}</li>`);
      if (dk === 'cumDose') rows.push(`<li><span class="rp-name">${ic('radiation')}${tx('Cumulative mission dose', 'Dosis acumulada de misión')}</span><span class="rp-val">${V.fmtNum(A.cumDose.total, 1)} mSv</span>${pill(has ? A.cumDose.level : 'none')}</li>`);
    });
    st.symptoms.forEach((sid) => {
      const s = V.SYMPTOMS[sid];
      rows.push(`<li><span class="rp-name">${ic('alert')}${esc(s.name)}</span><span class="rp-val">${tx('last 24 h', 'últimas 24 h')}</span>${pill(s.level)}</li>`);
    });
    const actions = [];
    reg.indicators.forEach((iid) => { const it = A.items[iid]; if (V.LEVEL_RANK[it.level] >= 2) actions.push(...V.actionsFor(iid, it)); });
    st.symptoms.forEach((sid) => actions.push(V.SYMPTOMS[sid].advice));
    if (id === 'bones' && has && A.boneLoss.level !== 'ok') actions.push(tx('Prioritize loaded resistance exercise and review your calcium and vitamin D intake.', 'Prioriza el ejercicio de resistencia con carga y revisa tu ingesta de calcio y vitamina D.'));
    if (id === 'skin' && has && A.cumDose.level !== 'ok') actions.push(tx('Prioritize time in the most shielded areas of the habitat.', 'Prioriza el tiempo en las zonas más blindadas del hábitat.'));
    const uniq = [...new Set(actions)].slice(0, 5);
    const trendId = reg.indicators[0] === 'sys' ? 'bp' : reg.indicators[0];
    const empty = st.level === 'none' ? tx('Log measurements to assess this region.', 'Registra mediciones para evaluar esta región.') : tx('All good. Keep up your measurement routine.', 'Todo en orden. Mantén tu rutina de mediciones.');
    return `
      <div class="rp-head"><h2>${esc(reg.name)}</h2>${pill(st.level)}</div>
      <section><h3>${tx('Function', 'Función')}</h3><p>${esc(reg.func)}</p></section>
      <section><h3>${tx('What space does to it', 'Qué le hace el espacio')}</h3><p>${esc(reg.space)}</p></section>
      <section><h3>${tx('Your data', 'Tus datos')}</h3>${rows.length ? `<ul class="rp-rows">${rows.join('')}</ul>` : `<p class="muted">${tx('This region is assessed through the symptoms you report (for example, blurred vision or headache).', 'Esta región se evalúa con los síntomas que reportes (por ejemplo, visión borrosa o dolor de cabeza).')}</p>`}</section>
      <section><h3>${tx('What to do', 'Qué hacer')}</h3>${uniq.length ? `<ul class="actions">${uniq.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`}</section>
      <section><h3>${tx('Related spaceflight hazards', 'Peligros del vuelo espacial relacionados')}</h3><div class="hz-chips">${reg.hazards.map((h) => `<span class="hz-chip"><b>${h}</b>${esc(V.HAZARDS[h].name)}</span>`).join('')}</div></section>
      <div class="btn-row">
        <button type="button" class="btn" data-action="goto-log" data-region-log="${id}">${ic('plus')} ${tx('Log data', 'Registrar datos')}</button>
        ${trendId ? `<button type="button" class="btn btn-ghost" data-trend="${trendId}">${ic('chart')} ${tx('View trend', 'Ver tendencia')}</button>` : ''}
      </div>`;
  }

  function renderBody() {
    const regs = Object.values(V.REGIONS);
    $('#view-body').innerHTML = `
      <div class="page-head"><div><h1>${tx('Body map', 'Mapa del cuerpo')}</h1><p class="muted">${tx('Tap a point to see what that region does, how space affects it and how you are doing.', 'Toca un punto para ver la función de esa región, cómo la afecta el espacio y tu estado actual.')}</p></div></div>
      <div class="body-layout">
        <div class="card body-card">
          <div class="holo-stage" id="holo-stage" role="group" aria-label="${tx('Human figure with interactive regions', 'Figura humana con regiones interactivas')}"></div>
          <ul class="legend"><li class="lvl-ok">${V.LEVEL_TEXT.ok}</li><li class="lvl-watch">${V.LEVEL_TEXT.watch}</li><li class="lvl-crit">${V.LEVEL_TEXT.crit}</li><li class="lvl-none">${V.LEVEL_TEXT.none}</li></ul>
        </div>
        <div class="card region-panel" id="region-panel" aria-live="polite">${regionPanel(region)}</div>
      </div>
      <div class="region-chips">${regs.map((r) => `
        <button type="button" class="region-chip lvl-${A.regions[r.id].level} ${r.id === region ? 'selected' : ''}" data-region="${r.id}" aria-pressed="${r.id === region}">
          <span class="dot"></span>${esc(r.name)}${state.events.visited.includes(r.id) ? '' : `<span class="new" title="${tx('Not explored yet', 'Sin explorar')}">${tx('new', 'nuevo')}</span>`}
        </button>`).join('')}</div>`;
    mountHolo();
  }

  function selectRegion(el, keyboard) {
    const id = el.dataset.region;
    if (!V.REGIONS[id]) return;
    const kind = el.classList.contains('holo-hs') ? '.holo-hs' : '.region-chip';
    region = id;
    if (!state.events.visited.includes(id)) { state.events.visited.push(id); commit(); }
    else renderBody();
    if (holo) holo.focus(id); // zoom in on the chosen region
    if (keyboard) { const f = $(`${kind}[data-region="${id}"]`); if (f) f.focus({ preventScroll: true }); }
    if (window.matchMedia('(max-width: 900px)').matches) {
      // On phones, bring the hologram into view so the zoom can be seen; the panel follows below it
      const card = $('.body-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* =================================================================== Log */
  const helpBtn = (id) => `<button type="button" class="help-btn" data-help="${id}" aria-expanded="false" aria-controls="help-${id}" title="${tx('How to measure', 'Cómo medir')}">${ic('help')}<span class="sr-only">${tx('How to measure', 'Cómo medir')}</span></button>`;
  const helpBox = (id) => {
    const ind = V.INDICATORS[id];
    return `<div class="help" id="help-${id}" hidden><p><strong>${tx('How to measure', 'Cómo medir')}:</strong> ${esc(ind.how)}</p><p><strong>${tx('Why it matters in space', '¿Por qué importa en el espacio?')}:</strong> ${esc(ind.why)}</p></div>`;
  };

  function numField(id, extra = '') {
    const ind = V.INDICATORS[id];
    return `<div class="field" data-field="${id}">
      <div class="field-head"><label for="f-${id}">${ic(ind.icon)}<span>${esc(ind.name)}</span></label>${helpBtn(id)}</div>
      <div class="input-row">
        <div class="input-wrap"><input id="f-${id}" name="${id}" type="number" inputmode="decimal" step="${ind.step}" min="${ind.min}" max="${ind.max}" placeholder="—" autocomplete="off"><span class="unit">${esc(ind.unit)}</span></div>
        ${extra}
      </div>
      <div class="field-foot"><span class="hint">Normal: ${esc(V.rangeText(id, A.ctx))}</span><span class="live" data-live="${id}"></span></div>
      ${helpBox(id)}
    </div>`;
  }

  function bpField() {
    return `<div class="field field-wide" data-field="sys">
      <div class="field-head"><label for="f-sys">${ic('gauge')}<span>${bpName()}</span></label>${helpBtn('sys')}</div>
      <div class="input-row bp-row">
        <div class="input-wrap"><input id="f-sys" name="sys" type="number" inputmode="numeric" step="1" min="50" max="260" placeholder="${tx('Systolic', 'Sistólica')}" aria-label="${esc(V.INDICATORS.sys.name)}" autocomplete="off"><span class="unit">mmHg</span></div>
        <span class="slash" aria-hidden="true">/</span>
        <div class="input-wrap"><input id="f-dia" name="dia" type="number" inputmode="numeric" step="1" min="30" max="160" placeholder="${tx('Diastolic', 'Diastólica')}" aria-label="${esc(V.INDICATORS.dia.name)}" autocomplete="off"><span class="unit">mmHg</span></div>
      </div>
      <div class="field-foot"><span class="hint">Normal: ${BP_RANGE}</span><span class="live" data-live="sys"></span><span class="live" data-live="dia"></span></div>
      ${helpBox('sys')}
    </div>`;
  }

  function pickerField(id) {
    const ind = V.INDICATORS[id];
    const opts = [1, 2, 3, 4, 5].map((v) => (id === 'mood'
      ? `<button type="button" role="radio" aria-checked="false" data-pick="${id}" data-val="${v}"><span class="emo" aria-hidden="true">${MOOD_EMOJI[v]}</span><small>${moodLabel(v)}</small></button>`
      : `<button type="button" role="radio" aria-checked="false" data-pick="${id}" data-val="${v}"><span class="num">${v}</span><small>${stressLabel(v)}</small></button>`)).join('');
    return `<div class="field field-wide" data-field="${id}">
      <div class="field-head"><span class="label" id="lbl-${id}">${ic(ind.icon)}<span>${esc(ind.name)}</span></span>${helpBtn(id)}</div>
      <div class="picker picker-${id}" role="radiogroup" aria-labelledby="lbl-${id}">${opts}</div>
      <input type="hidden" name="${id}" id="f-${id}">
      <div class="field-foot"><span class="hint">Normal: ${esc(V.rangeText(id, A.ctx))}</span><span class="live" data-live="${id}"></span></div>
      ${helpBox(id)}
    </div>`;
  }

  function resultPanel(rec) {
    const ctx = A.ctx;
    const entries = Object.entries(rec.values);
    const rows = entries.map(([id, v]) => {
      const ind = V.INDICATORS[id];
      const st = ind.status(v, ctx);
      const acts = V.actionsFor(id, st);
      return `<li class="res-row lvl-${st.level}">
        <div class="res-main"><span class="res-name">${ic(ind.icon)}${esc(ind.name)}</span><strong>${esc(V.fmtFull(id, v))}</strong>${pill(st.level)}</div>
        ${st.level !== 'ok' && acts.length ? `<ul class="actions">${acts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      </li>`;
    });
    const sym = rec.symptoms.map((sid) => {
      const s = V.SYMPTOMS[sid];
      return `<li class="res-row lvl-${s.level}"><div class="res-main"><span class="res-name">${ic('alert')}${esc(s.name)}</span><strong>${tx('Symptom', 'Síntoma')}</strong>${pill(s.level)}</div><ul class="actions"><li>${esc(s.advice)}</li></ul></li>`;
    });
    const levels = entries.map(([id, v]) => V.INDICATORS[id].status(v, ctx).level).concat(rec.symptoms.map((s) => V.SYMPTOMS[s].level));
    const worst = levels.length ? V.worst(...levels) : 'ok';
    const headline = {
      ok: tx('Everything is within range. Good work!', 'Todo en rango. ¡Buen trabajo!'),
      watch: tx('Some values need watching: review the suggested actions.', 'Algunos valores requieren vigilancia: revisa las acciones sugeridas.'),
      crit: tx('Some values are critical: act now, alert the Crew Medical Officer and send a report to the flight surgeon.', 'Hay valores críticos: actúa ahora, avisa al oficial médico de la tripulación y envía un reporte al cirujano de vuelo.')
    }[worst];
    return `<div class="card result lvl-${worst}" id="result" tabindex="-1">
      <div class="result-head">
        <span class="result-ic">${ic(worst === 'ok' ? 'check' : 'alert')}</span>
        <div><h2>${tx('Log assessment', 'Evaluación del registro')}</h2><p>${headline}</p></div>
        <button type="button" class="icon-btn" data-action="close-result" aria-label="${tx('Close assessment', 'Cerrar evaluación')}">${ic('x')}</button>
      </div>
      ${rows.length || sym.length ? `<ul class="res-rows">${rows.join('')}${sym.join('')}</ul>` : `<p class="muted">${tx('Note saved.', 'Nota guardada.')}</p>`}
      <div class="btn-row">
        ${worst === 'crit' ? `<button type="button" class="btn btn-crit" data-action="report">${ic('send')} ${tx('Report to Earth', 'Reportar a Tierra')}</button>` : ''}
        <button type="button" class="btn" data-view-link="dashboard">${ic('grid')} ${tx('View dashboard', 'Ver panel')}</button>
        <button type="button" class="btn btn-ghost" data-view-link="body">${ic('body')} ${tx('View body map', 'Ver mapa del cuerpo')}</button>
      </div>
    </div>`;
  }

  function renderLog() {
    const now = new Date();
    $('#view-log').innerHTML = `
      <div class="page-head"><div><h1>${tx('Log measurements', 'Registrar mediciones')}</h1><p class="muted">${tx(
        `Fill in only what you measured. Each value is assessed instantly. Tap ${ic('help', 'inline')} to learn how to measure it.`,
        `Completa solo lo que hayas medido. Cada valor se evalúa al instante. Toca ${ic('help', 'inline')} para ver cómo medirlo.`)}</p></div></div>
      ${lastResult ? resultPanel(lastResult) : ''}
      <form id="log-form" class="log-form" novalidate>
        <div class="card form-meta">
          <label for="f-ts">${ic('clock')}<span>${tx('Measurement date and time', 'Fecha y hora de la medición')}</span></label>
          <input type="datetime-local" id="f-ts" value="${V.toLocalInput(now)}" max="${V.toLocalInput(now)}">
          <button type="button" class="btn btn-ghost btn-sm" data-action="ts-now">${tx('Now', 'Ahora')}</button>
        </div>

        <fieldset class="card group" id="grp-vitals">
          <legend>${ic('heart')}${tx('Vital signs', 'Signos vitales')}</legend>
          <div class="fields">
            ${numField('hr', `<button type="button" class="btn btn-sm" data-action="tap">${ic('hand')} ${tx('Tap to measure', 'Medir con toques')}</button>`)}
            ${bpField()}
            ${numField('temp')}
            ${numField('spo2')}
            ${numField('glucose')}
          </div>
        </fieldset>

        <fieldset class="card group" id="grp-wellbeing">
          <legend>${ic('smile')}${tx('Well-being', 'Bienestar')}</legend>
          <div class="fields">
            ${numField('sleep')}
            ${pickerField('mood')}
            ${pickerField('stress')}
          </div>
        </fieldset>

        <fieldset class="card group" id="grp-env">
          <legend>${ic('orbit')}${tx('Activity and environment', 'Actividad y entorno')}</legend>
          <div class="fields">
            ${numField('exercise')}
            ${numField('water')}
            ${numField('radiation')}
            ${numField('mass')}
          </div>
          <p class="small muted">${tx(
            'Exercise, water and radiation are <strong>daily totals</strong>: if you log them again, the latest value counts.',
            'Ejercicio, agua y radiación son <strong>totales del día</strong>: si los registras de nuevo, cuenta el último valor.')}</p>
        </fieldset>

        <fieldset class="card group" id="grp-symptoms">
          <legend>${ic('alert')}${tx('Symptoms', 'Síntomas')}</legend>
          <p class="small muted">${tx('Check anything you noticed in the last few hours.', 'Marca lo que hayas notado en las últimas horas.')}</p>
          <div class="chips">${Object.values(V.SYMPTOMS).map((s) => `<label class="chip-check lvl-${s.level}"><input type="checkbox" name="symptoms" value="${s.id}"><span>${esc(s.name)}</span></label>`).join('')}</div>
          <label class="note-label" for="f-note">${tx('Notes for yourself or the flight surgeon', 'Notas para ti o para el cirujano de vuelo')}</label>
          <textarea id="f-note" rows="3" maxlength="500" placeholder="${tx('e.g. headache after the exercise session…', 'Ej.: dolor de cabeza después de la sesión de ejercicio…')}"></textarea>
        </fieldset>

        <div class="form-actions">
          <p class="form-error" id="form-error" role="alert"></p>
          <button type="reset" class="btn btn-ghost">${tx('Clear', 'Limpiar')}</button>
          <button type="submit" class="btn btn-primary btn-lg">${ic('check')} ${tx('Save and assess', 'Guardar y evaluar')}</button>
        </div>
      </form>`;
  }

  function updateLive(id) {
    const input = $('#f-' + id);
    const out = $(`[data-live="${id}"]`);
    if (!input || !out) return;
    const ind = V.INDICATORS[id];
    const raw = String(input.value).trim();
    let lv = '';
    if (input.validity && input.validity.badInput) {
      out.textContent = tx('Invalid value', 'Valor no válido'); out.className = 'live invalid'; lv = 'invalid';
    } else if (raw === '') {
      out.innerHTML = ''; out.className = 'live';
    } else {
      const v = parseFloat(raw.replace(',', '.'));
      if (isNaN(v) || v < ind.min || v > ind.max) {
        out.textContent = `${tx('Out of range', 'Fuera de rango')} (${ind.min}–${ind.max})`; out.className = 'live invalid'; lv = 'invalid';
      } else {
        const st = ind.status(v, A.ctx);
        lv = st.level;
        const prefix = id === 'sys' || id === 'dia' ? `${ind.short} · ` : '';
        out.innerHTML = pill(st.level, prefix + V.LEVEL_TEXT[st.level]);
        out.className = 'live';
      }
    }
    out.dataset.level = lv;
    const field = input.closest('.field');
    if (!field) return;
    const levels = $$('.live', field).map((s) => s.dataset.level).filter(Boolean);
    field.classList.remove('lvl-ok', 'lvl-watch', 'lvl-crit', 'is-invalid');
    if (levels.includes('invalid')) field.classList.add('is-invalid');
    else if (levels.length) field.classList.add('lvl-' + V.worst(...levels));
  }

  function pick(btn) {
    const id = btn.dataset.pick;
    const input = $('#f-' + id);
    const same = input.value === btn.dataset.val;
    input.value = same ? '' : btn.dataset.val;
    $$(`[data-pick="${id}"]`).forEach((b) => b.setAttribute('aria-checked', String(!same && b === btn)));
    updateLive(id);
  }

  function toggleHelp(btn) {
    const box = $('#help-' + btn.dataset.help);
    if (!box) return;
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  function submitLog(form) {
    const err = $('#form-error');
    err.textContent = '';
    const fail = (msg, el) => {
      err.textContent = msg;
      if (el) { el.focus(); el.closest('.field') && el.closest('.field').classList.add('is-invalid'); }
    };
    const values = {};
    for (const id of Object.keys(V.INDICATORS)) {
      const input = $('#f-' + id);
      if (!input) continue;
      const ind = V.INDICATORS[id];
      if (input.validity && input.validity.badInput) return fail(tx(`Check the value for ${ind.name.toLowerCase()}.`, `Revisa el valor de «${ind.name}».`), input);
      const raw = String(input.value).trim();
      if (raw === '') continue;
      const v = parseFloat(raw.replace(',', '.'));
      if (isNaN(v) || v < ind.min || v > ind.max) return fail(tx(`${ind.name}: enter a value between ${ind.min} and ${ind.max} ${ind.unit}.`, `${ind.name}: introduce un valor entre ${ind.min} y ${ind.max} ${ind.unit}.`), input);
      values[id] = Number(v.toFixed(2));
    }
    if ((values.sys == null) !== (values.dia == null)) return fail(tx('Log systolic and diastolic pressure together.', 'Registra la presión sistólica y la diastólica juntas.'), $(values.sys == null ? '#f-sys' : '#f-dia'));
    if (values.sys != null && values.sys <= values.dia) return fail(tx('Systolic pressure must be higher than diastolic pressure.', 'La presión sistólica debe ser mayor que la diastólica.'), $('#f-sys'));
    const symptoms = $$('input[name="symptoms"]:checked', form).map((c) => c.value);
    const note = $('#f-note').value.trim();
    if (!Object.keys(values).length && !symptoms.length && !note) return fail(tx('Enter at least one measurement, symptom or note.', 'Introduce al menos una medición, un síntoma o una nota.'));
    const tsVal = $('#f-ts').value;
    let ts = tsVal ? new Date(tsVal) : new Date();
    if (isNaN(ts)) ts = new Date();
    if (ts.getTime() > Date.now() + 60000) return fail(tx('The measurement time cannot be in the future.', 'La fecha de la medición no puede estar en el futuro.'), $('#f-ts'));

    const rec = { id: V.newId(), ts: ts.toISOString(), values, symptoms, note };
    state.records.push(rec);
    V.sortRecords(state.records);
    lastResult = rec;
    commit();
    const res = $('#result');
    if (res) { res.scrollIntoView({ behavior: 'smooth', block: 'start' }); res.focus({ preventScroll: true }); }
  }

  function resetLogForm() {
    setTimeout(() => {
      ['mood', 'stress'].forEach((id) => { const h = $('#f-' + id); if (h) h.value = ''; });
      $$('[data-pick]').forEach((b) => b.setAttribute('aria-checked', 'false'));
      $$('#log-form .live').forEach((s) => { s.innerHTML = ''; s.className = 'live'; s.dataset.level = ''; });
      $$('#log-form .field').forEach((f) => f.classList.remove('lvl-ok', 'lvl-watch', 'lvl-crit', 'is-invalid'));
      const ts = $('#f-ts'); if (ts) ts.value = V.toLocalInput(new Date());
      const e = $('#form-error'); if (e) e.textContent = '';
    }, 0);
  }

  function goLog(taskId, regionId) {
    closeModal(true);
    setView('log');
    let target = null;
    if (taskId) { const t = V.ROUTINE.find((x) => x.id === taskId); if (t && t.needs) target = t.needs[0]; }
    if (regionId && V.REGIONS[regionId]) target = V.REGIONS[regionId].indicators[0] || 'symptoms';
    if (target) setTimeout(() => focusField(target), 80);
  }

  function focusField(id) {
    const el = id === 'symptoms' ? $('#grp-symptoms') : $('#f-' + id);
    if (!el) return;
    const box = el.closest('.field') || el;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.classList.add('flash');
    setTimeout(() => box.classList.remove('flash'), 1800);
    if (el.tagName === 'INPUT' && el.type !== 'hidden') el.focus({ preventScroll: true });
    else { const b = box.querySelector('button[data-pick], input'); if (b) b.focus({ preventScroll: true }); }
  }

  /* --------------------------------------------------- Tap-to-measure pulse */
  function openTap() {
    let taps = [], bpm = null;
    const unit = V.INDICATORS.hr.unit;
    const m = openModal(`
      <div class="modal-head"><h2>${ic('heart')} ${tx('Tap to measure your pulse', 'Medir pulso con toques')}</h2><button type="button" class="icon-btn" data-close-btn aria-label="${tx('Close', 'Cerrar')}">${ic('x')}</button></div>
      <p class="muted">${tx(
        'Place two fingers on your wrist or neck. Tap the circle (or press the space bar) on <strong>every beat</strong> for about 15 seconds.',
        'Coloca dos dedos en tu muñeca o en el cuello. Toca el círculo (o pulsa la barra espaciadora) con <strong>cada latido</strong> durante unos 15 segundos.')}</p>
      <button type="button" class="tap-pad" id="tap-pad" aria-describedby="tap-hint"><span class="tap-bpm" id="tap-bpm">—</span><span class="tap-unit">${unit}</span><span class="tap-hint" id="tap-hint">${tx('Tap on every beat', 'Toca con cada latido')}</span></button>
      <div class="tap-meta"><span id="tap-count">0 ${tx('beats', 'latidos')}</span><span id="tap-time">0 s</span></div>
      <div class="btn-row end"><button type="button" class="btn btn-ghost" id="tap-reset">${tx('Start over', 'Reiniciar')}</button><button type="button" class="btn btn-primary" id="tap-use" disabled>${ic('check')} ${tx('Use this value', 'Usar este valor')}</button></div>`,
      { label: tx('Tap to measure your pulse', 'Medir pulso con toques'), onClose: () => document.removeEventListener('keydown', onKey) });
    const pad = $('#tap-pad', m), use = $('#tap-use', m);
    const update = () => {
      const n = taps.length;
      $('#tap-bpm', m).textContent = bpm || (n ? '…' : '—');
      $('#tap-count', m).textContent = tx(`${n} beat${n === 1 ? '' : 's'}`, `${n} latido${n === 1 ? '' : 's'}`);
      $('#tap-time', m).textContent = n > 1 ? `${Math.round((taps[n - 1] - taps[0]) / 1000)} s` : '0 s';
      $('#tap-hint', m).textContent = n === 0 ? tx('Tap on every beat', 'Toca con cada latido')
        : n < 8 ? tx(`Keep going… (${8 - n} more)`, `Sigue… (${8 - n} más)`)
          : tx('Done: you can use this value', 'Listo: puedes usar el valor');
      use.disabled = !(bpm && n >= 8);
    };
    const tap = () => {
      const t = performance.now();
      if (taps.length && t - taps[taps.length - 1] > 2500) { taps = []; bpm = null; }
      taps.push(t);
      pad.classList.remove('beat'); void pad.offsetWidth; pad.classList.add('beat');
      if (taps.length >= 5) {
        const iv = [];
        for (let i = Math.max(1, taps.length - 12); i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
        iv.sort((a, b) => a - b);
        const val = Math.round(60000 / iv[Math.floor(iv.length / 2)]);
        bpm = val >= 25 && val <= 230 ? val : null;
      }
      update();
    };
    function onKey(e) {
      if ($('#modal-root').hidden) return;
      if ((e.key === ' ' || e.key === 'Enter') && (e.target === pad || e.target === document.body)) { e.preventDefault(); tap(); }
      else if (e.key === ' ' && e.target !== use && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); tap(); }
    }
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    document.addEventListener('keydown', onKey);
    $('#tap-reset', m).addEventListener('click', () => { taps = []; bpm = null; update(); pad.focus(); });
    use.addEventListener('click', () => {
      const input = $('#f-hr');
      if (input && bpm) { input.value = bpm; updateLive('hr'); }
      closeModal();
      toast(`${tx('Pulse measured', 'Pulso medido')}: ${bpm} ${unit}`, 'info', 'heart');
    });
    pad.focus();
  }

  /* ================================================================ Trends */
  function chartHint(id, ctx) {
    const base = ctx.profile.baselineMass;
    return ({
      hr: [45, 110], bp: [60, 140], glucose: [60, 130], temp: [35.8, 38], spo2: [92, 100], sleep: [4, 10],
      mood: [1, 5], stress: [1, 5], radiation: [0, Math.max(3, ctx.env.radBaseline * 2)],
      exercise: [0, ctx.env.exerciseTarget + 30], water: [1, 3], mass: base ? [base * 0.94, base * 1.02] : null
    })[id];
  }

  function trendData(id) {
    const ctx = A.ctx;
    const keys = V.lastNDays(trendRange);
    const labels = keys.map(V.fmtShort);
    const fullLabels = keys.map(V.fmtLong);
    const accent = css('--accent'), accent2 = css('--accent-2');
    const levelsOf = (sid, vals) => vals.map((v) => (v == null ? null : V.statusOf(sid, v, ctx).level));
    if (id === 'bp') {
      const sys = keys.map((k) => V.dayValue(A.days, k, 'sys'));
      const dia = keys.map((k) => V.dayValue(A.days, k, 'dia'));
      return {
        labels, fullLabels, unit: 'mmHg', decimals: 0, hint: chartHint('bp', ctx),
        series: [
          { name: tx('Systolic', 'Sistólica'), color: accent, values: sys, levels: levelsOf('sys', sys) },
          { name: tx('Diastolic', 'Diastólica'), color: accent2, values: dia, levels: levelsOf('dia', dia) }
        ],
        refLines: [{ y: 130 }, { y: 85 }]
      };
    }
    const ind = V.INDICATORS[id];
    const vals = keys.map((k) => V.dayValue(A.days, k, id));
    return {
      labels, fullLabels, unit: ind.unit,
      decimals: id === 'mood' || id === 'stress' ? 1 : ind.decimals,
      hint: chartHint(id, ctx), clamp: [ind.min, ind.max],
      series: [{ name: ind.short, color: accent, values: vals, levels: levelsOf(id, vals) }],
      bandFn: (v) => V.statusOf(id, v, ctx).level
    };
  }

  function trendStats(sid) {
    const keys = V.lastNDays(trendRange);
    const pts = keys.map((k, i) => [i, V.dayValue(A.days, k, sid)]).filter((p) => p[1] != null);
    if (!pts.length) return null;
    const ys = pts.map((p) => p[1]);
    const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
    let slope = 0;
    if (pts.length >= 3) {
      const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      let num = 0, den = 0;
      pts.forEach(([x, y]) => { num += (x - mx) * (y - avg); den += (x - mx) * (x - mx); });
      slope = den ? num / den : 0;
    }
    const change = slope * (keys.length - 1);
    const thresh = Math.max(Math.abs(avg) * 0.03, V.INDICATORS[sid].step * 2);
    const dir = pts.length < 3 ? 'none' : change > thresh ? 'up' : change < -thresh ? 'down' : 'flat';
    return { avg, min: Math.min(...ys), max: Math.max(...ys), last: ys[ys.length - 1], dir, change };
  }

  function recRow(r) {
    const id = trendSel;
    const ctx = A.ctx;
    let val, lv;
    if (id === 'bp') {
      val = `${V.fmtVal('sys', r.values.sys)}/${r.values.dia != null ? V.fmtVal('dia', r.values.dia) : '—'} mmHg`;
      lv = V.worst(V.statusOf('sys', r.values.sys, ctx).level, r.values.dia != null ? V.statusOf('dia', r.values.dia, ctx).level : 'none');
    } else {
      val = V.fmtFull(id, r.values[id]);
      lv = V.statusOf(id, r.values[id], ctx).level;
    }
    const others = Object.keys(r.values).length - (id === 'bp' ? 2 : 1);
    const more = others > 0 ? tx(` · +${others} more value${others > 1 ? 's' : ''}`, ` · +${others} valor${others > 1 ? 'es' : ''} más`) : '';
    const when = V.fmtDateTime(r.ts);
    return `<li>
      <div class="rec-main"><strong>${esc(val)}</strong>${pill(lv)}<span class="muted small">${when}${more}${r.note ? tx(' · with note', ' · con nota') : ''}</span></div>
      <button type="button" class="icon-btn sm" data-action="del-record" data-id="${esc(r.id)}" aria-label="${tx(`Delete the log from ${when}`, `Eliminar el registro del ${when}`)}" title="${tx('Delete log', 'Eliminar registro')}">${ic('trash')}</button>
    </li>`;
  }

  function renderTrends() {
    if (chart) { chart.destroy(); chart = null; }
    const id = trendSel;
    const isBP = id === 'bp';
    const info = isBP ? V.INDICATORS.sys : V.INDICATORS[id];
    const name = isBP ? bpName() : info.name;
    const unit = isBP ? 'mmHg' : info.unit;
    const dec = isBP ? 0 : (id === 'mood' || id === 'stress' ? 1 : info.decimals);
    const stats = isBP ? [trendStats('sys'), trendStats('dia')] : [trendStats(id)];
    const ok = stats.every(Boolean);
    const f = (k) => (ok ? stats.map((s) => V.fmtNum(s[k], dec)).join('/') : '—');
    const s0 = stats[0];
    const dirTxt = !s0 ? tx('No data', 'Sin datos') : tx(
      { up: 'Rising', down: 'Falling', flat: 'Stable', none: 'Not enough data' },
      { up: 'Subiendo', down: 'Bajando', flat: 'Estable', none: 'Pocos datos' })[s0.dir];
    const dirIcon = !s0 ? 'flat' : s0.dir === 'up' ? 'up' : s0.dir === 'down' ? 'down' : 'flat';
    const changeTxt = s0 && s0.dir !== 'none' ? `${s0.change > 0 ? '+' : ''}${V.withUnit(V.fmtNum(s0.change, Math.max(dec, 1)), unit)}` : '';
    const recs = state.records.filter((r) => (isBP ? r.values.sys != null : r.values[id] != null)).slice(-8).reverse();
    $('#view-trends').innerHTML = `
      <div class="page-head"><div><h1>${tx('Trends', 'Tendencias')}</h1><p class="muted">${tx('How your indicators change over time. The colored bands show the normal, watch and critical zones.', 'Cómo cambian tus indicadores con el tiempo. Las bandas de color muestran las zonas normal, de vigilancia y crítica.')}</p></div></div>
      <div class="chips-scroll" role="tablist" aria-label="${tx('Indicator', 'Indicador')}">${V.TREND_ORDER.map((t) => {
        const nm = t === 'bp' ? tx('BP', 'Presión') : V.INDICATORS[t].short;
        return `<button type="button" role="tab" aria-selected="${t === id}" class="chip ${t === id ? 'active' : ''}" data-trend-sel="${t}"><span class="dot lvl-${A.items[t].level}"></span>${esc(nm)}</button>`;
      }).join('')}</div>

      <div class="card chart-card">
        <div class="chart-head">
          <div><h2>${ic(info.icon)} ${esc(name)}</h2><span class="muted small">${tx('Daily value', 'Valor diario')} · normal: ${esc(isBP ? BP_RANGE : V.rangeText(id, A.ctx))}</span></div>
          <div class="seg" role="group" aria-label="${tx('Period', 'Periodo')}">${[7, 14, 30].map((n) => `<button type="button" class="${n === trendRange ? 'active' : ''}" data-range="${n}" aria-pressed="${n === trendRange}">${n} ${tx('days', 'días')}</button>`).join('')}</div>
        </div>
        <div class="chart-wrap"><canvas id="chart" role="img" aria-label="${esc(tx(`Chart of ${name.toLowerCase()} over the last ${trendRange} days`, `Gráfica de ${name.toLowerCase()} en los últimos ${trendRange} días`))}"></canvas><div class="chart-tip" id="chart-tip" hidden></div></div>
        ${isBP
          ? `<div class="chart-legend"><span><i style="background:var(--accent)"></i>${tx('Systolic', 'Sistólica')}</span><span><i style="background:var(--accent-2)"></i>${tx('Diastolic', 'Diastólica')}</span><span><i class="dash"></i>${tx('Watch thresholds 130 / 85', 'Límites de vigilancia 130 / 85')}</span></div>`
          : `<div class="chart-legend"><span><i class="band lvl-ok"></i>${V.LEVEL_TEXT.ok}</span><span><i class="band lvl-watch"></i>${V.LEVEL_TEXT.watch}</span><span><i class="band lvl-crit"></i>${V.LEVEL_TEXT.crit}</span></div>`}
        <div class="stats">
          <div><span>${tx('Latest', 'Último')}</span><strong>${f('last')}<small class="${tight(unit)}">${esc(unit)}</small></strong></div>
          <div><span>${tx('Average', 'Promedio')}</span><strong>${f('avg')}</strong></div>
          <div><span>${tx('Minimum', 'Mínimo')}</span><strong>${f('min')}</strong></div>
          <div><span>${tx('Maximum', 'Máximo')}</span><strong>${f('max')}</strong></div>
          <div><span>${tx('Trend', 'Tendencia')}${isBP ? tx(' (systolic)', ' (sistólica)') : ''}</span><strong class="trend-dir">${ic(dirIcon)}${dirTxt}${changeTxt ? `<small>${changeTxt}</small>` : ''}</strong></div>
        </div>
      </div>

      <div class="grid two">
        <div class="card"><h2 class="card-title">${ic(info.icon)} ${tx('About this indicator', 'Sobre este indicador')}</h2>
          <p><strong>${tx('Why it matters in space', '¿Por qué importa en el espacio?')}:</strong> ${esc(info.why)}</p>
          <p><strong>${tx('How to measure', 'Cómo medir')}:</strong> ${esc(info.how)}</p>
        </div>
        <div class="card"><h2 class="card-title">${ic('clock')} ${tx('Recent logs', 'Registros recientes')}</h2>
          ${recs.length ? `<ul class="rec-list">${recs.map(recRow).join('')}</ul>` : `<p class="muted">${tx('No logs for this indicator yet.', 'Aún no hay registros de este indicador.')}</p>`}
        </div>
      </div>`;
    chart = new V.LineChart($('#chart'), $('#chart-tip'));
    chart.set(trendData(id));
  }

  function delRecord(id) {
    const r = state.records.find((x) => x.id === id);
    if (!r) return;
    const n = Object.keys(r.values).length;
    const when = V.fmtDateTime(r.ts);
    confirmDialog({
      title: tx('Delete log', 'Eliminar registro'),
      text: tx(
        `The log from ${when} and its ${n} value${n === 1 ? '' : 's'}${r.symptoms.length ? ' and symptoms' : ''} will be deleted. This cannot be undone.`,
        `Se borrará el registro del ${when} con sus ${n} valor(es)${r.symptoms.length ? ' y síntomas' : ''}. No se puede deshacer.`),
      yes: tx('Delete log', 'Eliminar registro')
    }, () => {
      state.records = state.records.filter((x) => x.id !== id);
      commit({ quiet: true });
      toast(tx('Log deleted', 'Registro eliminado'), 'info', 'trash');
    });
  }

  /* ================================================ Routine and achievements */
  function taskRow(t) {
    const st = t.done ? 'done' : t.overdue ? 'overdue' : t.partial ? 'partial' : 'pending';
    const label = tx(
      { done: 'Done', overdue: 'Overdue', partial: 'Incomplete', pending: 'Scheduled' },
      { done: 'Hecho', overdue: 'Pendiente', partial: 'Incompleto', pending: 'Programado' })[st];
    const isBreath = t.special === 'breath';
    const detail = t.id === 'exercise' ? `${tx('Goal', 'Meta')}: ${A.ctx.env.exerciseTarget} min` : t.detail;
    return `<li class="task ${st}">
      <span class="task-check">${t.done ? ic('check') : ''}</span>
      <div class="task-main"><strong>${esc(t.name)}</strong><span class="small muted">${t.time} · ${esc(detail)}</span></div>
      <span class="task-state">${label}</span>
      ${t.done ? '' : `<button type="button" class="btn btn-sm ${t.overdue ? 'btn-primary' : 'btn-ghost'}" data-action="${isBreath ? 'goto-breath' : 'goto-log'}" data-task="${t.id}">${isBreath ? tx('Start', 'Hacer') : tx('Log', 'Registrar')}</button>`}
    </li>`;
  }

  function weeklyRow(t) {
    return `<li class="task ${t.done ? 'done' : 'pending'}">
      <span class="task-check">${t.done ? ic('check') : ''}</span>
      <div class="task-main"><strong>${esc(t.name)}</strong><span class="small muted">${t.lastTs ? `${tx('Last', 'Último')}: ${V.timeAgo(t.lastTs)}` : tx('Not logged yet', 'Sin registro')} · ${esc(t.detail)}</span></div>
      <span class="task-state">${t.done ? tx('Up to date', 'Al día') : tx('Due', 'Pendiente')}</span>
      ${t.done ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-action="goto-log" data-task-weekly="${t.needs[0]}">${tx('Log', 'Registrar')}</button>`}
    </li>`;
  }

  function renderRoutine() {
    const r = A.routine, pr = A.progress;
    $('#view-routine').innerHTML = `
      <div class="page-head"><div><h1>${tx('Routine and achievements', 'Rutina y logros')}</h1><p class="muted">${tx('Your daily health routine. Every measurement earns experience points (XP) and unlocks badges.', 'Tu rutina diaria de salud. Cada medición suma experiencia (XP) y desbloquea insignias.')}</p></div></div>
      <div class="grid routine-top">
        <div class="card level-card">
          <div class="level-row">
            <div class="level-badge" aria-hidden="true">${pr.level}</div>
            <div class="level-info"><span class="muted small">${tx('Level', 'Nivel')} ${pr.level}</span><h2>${esc(pr.rank)}</h2>
              <div class="bar big"><span style="width:${(pr.into / pr.need) * 100}%"></span></div>
              <span class="small muted">${tx(`${pr.into} / ${pr.need} XP to the next level · ${pr.xp} XP total`, `${pr.into} / ${pr.need} XP para el siguiente nivel · ${pr.xp} XP en total`)}</span>
            </div>
          </div>
          <ul class="level-stats">
            <li>${ic('flame')}<strong>${pr.streak}</strong><span>${tx('day streak', 'días de racha')}</span></li>
            <li>${ic('star')}<strong>${pr.earned.size}/${V.BADGES.length}</strong><span>${tx('badges', 'insignias')}</span></li>
            <li>${ic('check')}<strong>${pr.perfect}</strong><span>${tx('perfect days', 'días perfectos')}</span></li>
            <li>${ic('chart')}<strong>${pr.values}</strong><span>${tx('values logged', 'valores registrados')}</span></li>
          </ul>
        </div>
        <div class="card breath-card" id="breath-card">
          <h2 class="card-title">${ic('wind')} ${tx('Breathing break', 'Pausa de respiración')}</h2>
          <p class="small muted">${tx('Box breathing (4-4-4-4) for 1 minute: it lowers stress and helps you sleep. Ideal in confined spaces.', 'Respiración en caja 4-4-4-4 durante 1 minuto: reduce el estrés y ayuda a dormir. Ideal en espacios confinados.')}</p>
          <div class="breath-stage"><div class="breath-circle" id="breath-circle" data-phase="idle"><span id="breath-label">${tx('Ready', 'Listo')}</span><small id="breath-count"></small></div></div>
          <div class="bar"><span id="breath-progress" style="width:0%"></span></div>
          <div class="btn-row center"><button type="button" class="btn btn-primary" data-action="breath-toggle" id="breath-btn">${ic('play')} ${tx('Start', 'Comenzar')}</button></div>
        </div>
      </div>
      <div class="grid two">
        <div class="card">
          <div class="card-head"><h2 class="card-title">${tx("Today's routine", 'Rutina de hoy')}</h2><span class="muted small">${r.doneCount}/${r.total} ${tx('done', 'completadas')}</span></div>
          <ul class="tasks">${r.tasks.map(taskRow).join('')}</ul>
          <h3 class="sub">${tx('Weekly', 'Semanal')}</h3>
          <ul class="tasks">${r.weekly.map(weeklyRow).join('')}</ul>
        </div>
        <div class="card">
          <h2 class="card-title">${tx('Badges', 'Insignias')}</h2>
          <ul class="badges">${V.BADGES.map((b) => {
            const on = pr.earned.has(b.id);
            return `<li class="badge ${on ? 'on' : ''}"><span class="badge-ic">${ic(on ? b.icon : 'lock')}</span><strong>${esc(b.name)}</strong><small>${esc(b.desc)}</small><span class="sr-only">${on ? tx('Unlocked', 'Desbloqueada') : tx('Locked', 'Bloqueada')}</span></li>`;
          }).join('')}</ul>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title">${tx('How to earn XP', 'Cómo ganar XP')}</h2>
        <ul class="xp-rules">
          <li><b>+10</b> ${tx('for every value you log', 'por cada valor registrado')}</li>
          <li><b>+5</b> ${tx('for reporting symptoms', 'por reportar síntomas')}</li>
          <li><b>+50</b> ${tx("for completing a whole day's routine", 'por completar toda la rutina de un día')}</li>
          <li><b>+15</b> ${tx('for each breathing break', 'por cada pausa de respiración')}</li>
          <li><b>+25</b> ${tx('for sending a report to Earth', 'por enviar un reporte a Tierra')}</li>
          <li><b>+5</b> ${tx('for exploring each body region', 'por explorar cada región del cuerpo')}</li>
        </ul>
      </div>`;
  }

  function toggleBreath() {
    if (breathTimer) stopBreath(true);
    else startBreath();
  }

  function startBreath() {
    const circle = $('#breath-circle');
    if (!circle) return;
    const phases = [
      [tx('Breathe in', 'Inhala'), 'in'], [tx('Hold', 'Mantén'), 'hold'],
      [tx('Breathe out', 'Exhala'), 'out'], [tx('Hold', 'Mantén'), 'rest']
    ];
    const total = 64;
    let elapsed = 0, pi = 0, left = 4;
    const label = $('#breath-label'), count = $('#breath-count'), bar = $('#breath-progress'), btn = $('#breath-btn');
    const setPhase = () => { label.textContent = phases[pi][0]; circle.dataset.phase = phases[pi][1]; count.textContent = left; };
    setPhase();
    btn.innerHTML = `${ic('stop')} ${tx('Stop', 'Detener')}`;
    breathTimer = setInterval(() => {
      elapsed++; left--;
      bar.style.width = (elapsed / total) * 100 + '%';
      if (elapsed >= total) { finishBreath(); return; }
      if (left <= 0) { pi = (pi + 1) % 4; left = 4; }
      setPhase();
    }, 1000);
  }

  function stopBreath(rerender) {
    if (!breathTimer) return;
    clearInterval(breathTimer);
    breathTimer = null;
    if (rerender && view === 'routine') renderRoutine();
  }

  function finishBreath() {
    clearInterval(breathTimer);
    breathTimer = null;
    state.events.breath.push(new Date().toISOString());
    toast(tx('Breathing break complete', 'Pausa de respiración completada'), 'info', 'wind');
    commit();
  }

  /* ================================================================= Guide */
  function renderGuide() {
    const env = A.ctx.env;
    const oneWay = V.fmtDelay(env.delaySec), round = V.fmtDelay(env.delaySec * 2);
    $('#view-guide').innerHTML = `
      <div class="page-head"><div><h1>${tx('Space health guide', 'Guía de salud espacial')}</h1><p class="muted">${tx("What to measure, why, and when to act. Based on resources from NASA's Human Research Program (HRP).", 'Qué medir, por qué y cuándo actuar. Basado en los recursos del Programa de Investigación Humana (HRP) de NASA.')}</p></div></div>
      <div class="card">
        <h2 class="card-title">${tx('When should you act?', '¿Cuándo actuar?')}</h2>
        <div class="levels">
          <div class="lvl-box lvl-ok"><h3>${ic('check')} ${V.LEVEL_TEXT.ok}</h3><p>${tx('The value is within range. Keep up your routine and your scheduled measurements.', 'El valor está en rango. Sigue con tu rutina y con tus mediciones programadas.')}</p></div>
          <div class="lvl-box lvl-watch"><h3>${ic('alert')} ${V.LEVEL_TEXT.watch}</h3><p>${tx('Follow the suggested actions and measure again. If it stays out of range for 2–3 days, tell the Crew Medical Officer (CMO) and include it in your report to Earth.', 'Aplica las acciones sugeridas y repite la medición. Si sigue fuera de rango 2–3 días, infórmalo al oficial médico de la tripulación (CMO) e inclúyelo en tu reporte a Tierra.')}</p></div>
          <div class="lvl-box lvl-crit"><h3>${ic('alert')} ${V.LEVEL_TEXT.crit}</h3><p>${tx('Act now: alert the CMO and send a report to the flight surgeon. For chest pain, shortness of breath or loss of consciousness, start the emergency protocol without waiting for Earth to reply.', 'Actúa ahora: avisa al CMO y envía un reporte al cirujano de vuelo. Ante dolor en el pecho, falta de aire o pérdida de conciencia, activa el protocolo de emergencia sin esperar la respuesta de Tierra.')}</p></div>
        </div>
        <p class="callout">${ic('signal')}<span>${tx(
          `In your current environment (<strong>${esc(env.name)}</strong>) a message takes <strong>${oneWay}</strong> to reach Earth${env.delaySec ? `, and a reply takes at least <strong>${round}</strong> round trip` : ''}.`,
          `En tu entorno actual (<strong>${esc(env.name)}</strong>) un mensaje tarda <strong>${oneWay}</strong> en llegar a la Tierra${env.delaySec ? ` y una respuesta tarda al menos <strong>${round}</strong> ida y vuelta` : ''}.`)} ${env.delaySec >= 60
          ? tx('That is why the crew must be able to assess themselves and act on their own.', 'Por eso la tripulación debe poder evaluarse y actuar con autonomía.')
          : tx('You can consult the flight surgeon almost in real time.', 'Puedes consultar al cirujano de vuelo casi en tiempo real.')}</span></p>
      </div>

      <div class="section-head"><h2>${tx('The 5 hazards of human spaceflight', 'Los 5 peligros del vuelo espacial')}</h2><span class="muted small">${tx('NASA Human Research Program', 'Programa de Investigación Humana de NASA')}</span></div>
      <div class="grid hazards">${Object.values(V.HAZARDS).map((h) => `
        <article class="card hazard">
          <div class="hz-letter" aria-hidden="true">${h.id}</div>
          <h3>${esc(h.name)}</h3>
          <p>${esc(h.text)}</p>
          <p><strong>${tx('Effects', 'Efectos')}:</strong> ${esc(h.effects)}</p>
          <p><strong>${tx('Countermeasures', 'Contramedidas')}:</strong> ${esc(h.counter)}</p>
          <div class="hz-inds">${h.indicators.map((i) => `<button type="button" class="chip sm" data-trend="${i === 'sys' ? 'bp' : i}">${esc(i === 'sys' ? tx('BP', 'Presión') : V.INDICATORS[i].short)}</button>`).join('')}</div>
        </article>`).join('')}</div>

      <div class="section-head"><h2>${tx('Indicators: how to measure and why they matter', 'Indicadores: cómo medir y por qué importan')}</h2></div>
      <div class="card"><div class="accordion">${V.TREND_ORDER.map((id) => {
        const ind = id === 'bp' ? V.INDICATORS.sys : V.INDICATORS[id];
        const nm = id === 'bp' ? bpName() : ind.name;
        const range = id === 'bp' ? BP_RANGE : V.rangeText(id, A.ctx);
        return `<details><summary>${ic(ind.icon)}<span>${esc(nm)}</span><small>${esc(range)}</small></summary>
          <div class="acc-body"><p><strong>${tx('How to measure', 'Cómo medir')}:</strong> ${esc(ind.how)}</p><p><strong>${tx('Why it matters in space', '¿Por qué en el espacio?')}:</strong> ${esc(ind.why)}</p></div></details>`;
      }).join('')}</div></div>

      <div class="grid two">
        <div class="card"><h2 class="card-title">${ic('book')} ${tx('Sources', 'Fuentes')}</h2>
          <ul class="resources">${V.RESOURCES.map((r) => `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a><span class="muted small">${esc(r.org)}</span></li>`).join('')}</ul>
        </div>
        <div class="card"><h2 class="card-title">${ic('info')} ${tx('Important notice', 'Aviso importante')}</h2>
          <p>${tx(
            'AstroHealth is an educational prototype built for the NASA Space Apps Challenge 2026. Its ranges and models are approximate and simplified (for example, the estimated bone loss). It is not a medical device and does not replace evaluation by a flight surgeon or a health professional.',
            'AstroHealth es un prototipo educativo creado para el NASA Space Apps Challenge 2026. Los rangos y modelos son orientativos y simplificados (por ejemplo, la pérdida ósea estimada). No es un dispositivo médico ni sustituye la evaluación del cirujano de vuelo o de un profesional de la salud.')}</p>
          <p class="small muted">${cloudOn()
            ? tx('Your logs are stored only in this browser. Only the reports you transmit to Earth are sent to the Mission Control database (Supabase), linked to an anonymous ID for this browser. Use fictional or demo data only.',
              'Tus registros se guardan solo en este navegador. Solo los reportes que transmites a Tierra se envían a la base de datos del control de misión (Supabase), vinculados a un ID anónimo de este navegador. Usa solo datos ficticios o de demostración.')
            : tx('Your data is stored only in this browser and is never sent to any server. The "transmission to Earth" is a simulation.',
              'Tus datos se guardan solo en este navegador y nunca se envían a ningún servidor. La «transmisión a Tierra» es una simulación.')}</p>
        </div>
      </div>`;
  }

  /* =============================================================== Dialogs */
  function openModal(html, opts = {}) {
    closeModal(true);
    const root = $('#modal-root');
    lastFocus = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.label || tx('Dialog', 'Diálogo'))}">${html}</div></div>`;
    root.hidden = false;
    document.body.classList.add('no-scroll');
    const bd = $('.modal-backdrop', root);
    bd.addEventListener('mousedown', (e) => { if (e.target === bd) closeModal(); });
    modalClose = opts.onClose || null;
    const first = $('.modal input:not([type="hidden"]), .modal select, .modal textarea, .modal button:not([data-close-btn])', root);
    if (first) first.focus({ preventScroll: true });
    return $('.modal', root);
  }

  function closeModal(silent) {
    const root = $('#modal-root');
    if (root.hidden) return;
    txTimers.forEach(clearTimeout);
    txTimers = [];
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('no-scroll');
    const cb = modalClose;
    modalClose = null;
    if (cb) cb(!!silent);
    if (!silent && lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /* In-page confirmation (the artifact viewer blocks window.confirm) */
  function confirmDialog({ title, text, yes, danger = true }, onYes) {
    const m = openModal(`
      <div class="modal-head"><h2>${ic(danger ? 'alert' : 'info')} ${esc(title)}</h2><button type="button" class="icon-btn" data-close-btn aria-label="${tx('Cancel', 'Cancelar')}">${ic('x')}</button></div>
      <p>${esc(text)}</p>
      <div class="btn-row end">
        <button type="button" class="btn btn-ghost" data-close-btn>${tx('Cancel', 'Cancelar')}</button>
        <button type="button" class="btn ${danger ? 'btn-crit' : 'btn-primary'}" id="confirm-yes">${esc(yes)}</button>
      </div>`, { label: title });
    const btn = $('#confirm-yes', m);
    btn.addEventListener('click', () => { closeModal(true); onYes(); });
    btn.focus();
  }

  function ensureProfile() {
    if (state.profile) return;
    state.profile = { name: tx('Astronaut', 'Astronauta'), mission: tx('My mission', 'Mi misión'), env: 'iss', missionStart: V.dayKey(new Date()), baselineMass: null };
    commit({ quiet: true });
  }

  function openWelcome() {
    openModal(`
      <div class="welcome">
        <div class="welcome-logo">${V.logo(68)}</div>
        <h2>${tx('Welcome to AstroHealth', 'Bienvenido a AstroHealth')}</h2>
        <p>${tx('Your health self-assessment assistant for long-duration space missions.', 'Tu asistente de autoevaluación de salud para misiones espaciales de larga duración.')}</p>
        <ul class="welcome-points">
          <li>${ic('plus')}<span>${tx('<strong>Log</strong> vital signs, sleep, mood, radiation and symptoms with step-by-step instructions.', '<strong>Registra</strong> signos vitales, sueño, ánimo, radiación y síntomas con instrucciones paso a paso.')}</span></li>
          <li>${ic('body')}<span>${tx('<strong>Understand</strong> how space affects each part of your body, with color coding.', '<strong>Entiende</strong> cómo el espacio afecta a cada parte de tu cuerpo, con códigos de color.')}</span></li>
          <li>${ic('send')}<span>${tx('<strong>Act</strong>: get recommended actions and know when to contact the flight surgeon.', '<strong>Actúa</strong>: recibe acciones recomendadas y sabe cuándo avisar al cirujano de vuelo.')}</span></li>
        </ul>
        <div class="btn-col">
          <button type="button" class="btn btn-primary btn-lg" data-action="demo-welcome">${ic('rocket')} ${tx('Explore a demo mission', 'Explorar una misión de demostración')}</button>
          <button type="button" class="btn btn-lg" data-action="setup">${ic('sliders')} ${tx('Set up my own mission', 'Configurar mi propia misión')}</button>
        </div>
        <p class="fineprint">${tx('Educational prototype for the NASA Space Apps Challenge 2026. It does not replace evaluation by a medical professional.', 'Prototipo educativo para el NASA Space Apps Challenge 2026. No sustituye la evaluación de un profesional médico.')}</p>
      </div>`, { cls: 'welcome-modal', label: tx('Welcome to AstroHealth', 'Bienvenida a AstroHealth'), onClose: (silent) => { if (!silent) ensureProfile(); } });
  }

  function envPreview(id) {
    const e = V.ENVIRONMENTS[id] || V.ENVIRONMENTS.iss;
    return `<div><span>${tx('Gravity', 'Gravedad')}</span><strong>${esc(e.gravityLabel)}</strong></div>
      <div><span>${tx('Typical radiation', 'Radiación típica')}</span><strong>${V.fmtNum(e.radBaseline, 2)} mSv/${tx('day', 'día')}</strong></div>
      <div><span>${tx('Earth delay', 'Retardo con Tierra')}</span><strong>${esc(e.delayLabel)}</strong></div>
      <div><span>${tx('Exercise goal', 'Meta de ejercicio')}</span><strong>${e.exerciseTarget} min/${tx('day', 'día')}</strong></div>
      <p>${esc(e.note)}</p>`;
  }

  function openSettings(welcome) {
    // "New mission" mode starts from scratch (without the demo data)
    const blank = { name: '', mission: '', env: 'iss', missionStart: V.dayKey(new Date()), baselineMass: '' };
    const p = welcome ? Object.assign({}, blank, state.profile && !state.profile.demo ? state.profile : {}) : (state.profile || blank);
    const replacing = welcome && state.records.length > 0;
    openModal(`
      <div class="modal-head"><h2>${ic('sliders')} ${welcome ? tx('Set up your mission', 'Configura tu misión') : tx('Mission settings', 'Ajustes de misión')}</h2><button type="button" class="icon-btn" data-close-btn aria-label="${tx('Close', 'Cerrar')}">${ic('x')}</button></div>
      ${replacing ? `<p class="small muted">${tx('A new mission will start with no logs. The demo data will be removed from this browser.', 'Se empezará una misión nueva, sin registros. Los datos de demostración se borrarán de este navegador.')}</p>` : ''}
      <form id="settings-form" class="settings-form" novalidate${welcome ? ' data-fresh="1"' : ''}>
        <label>${tx('Astronaut name', 'Nombre del astronauta')}<input name="name" required maxlength="40" value="${esc(p.name)}" placeholder="${tx('Your name', 'Tu nombre')}" autocomplete="off"></label>
        <label>${tx('Mission name', 'Nombre de la misión')}<input name="mission" maxlength="40" value="${esc(p.mission)}" placeholder="${tx('e.g. South Pole Base', 'Ej.: Base Lunar Sur')}" autocomplete="off"></label>
        <label class="span2">${tx('Mission environment', 'Entorno de la misión')}<select name="env">${Object.values(V.ENVIRONMENTS).map((e) => `<option value="${e.id}" ${e.id === p.env ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
        <div class="env-preview span2" id="env-preview">${envPreview(p.env)}</div>
        <label>${tx('Mission start date', 'Inicio de la misión')}<input type="date" name="missionStart" value="${esc(p.missionStart || '')}" max="${V.dayKey(new Date())}"></label>
        <label>${tx('Baseline body mass (kg)', 'Masa corporal base (kg)')}<input type="number" name="baselineMass" min="30" max="200" step="0.1" value="${p.baselineMass == null ? '' : esc(p.baselineMass)}" placeholder="${tx('e.g. 72', 'Ej.: 72')}"></label>
        <p class="form-error span2" id="settings-error" role="alert"></p>
        <div class="btn-row end span2"><button type="submit" class="btn btn-primary">${ic('check')} ${welcome ? tx('Start mission', 'Empezar misión') : tx('Save', 'Guardar')}</button></div>
      </form>
      ${welcome ? '' : `
      <hr>
      <h3>${tx('Data', 'Datos')}</h3>
      <p class="small muted">${tx(`Your logs are stored only in this browser (${state.records.length} logs).`, `Tus registros se guardan solo en este navegador (${state.records.length} registros).`)}${cloudOn()
        ? ' ' + tx('Reports you transmit to Earth are stored in the Mission Control database under an anonymous ID.', 'Los reportes que transmites a Tierra se guardan en la base de datos del control de misión con un ID anónimo.')
        : ''}</p>
      <div class="btn-row">
        <button type="button" class="btn" data-action="demo">${ic('rocket')} ${tx('Load demo mission', 'Cargar misión de demostración')}</button>
        <button type="button" class="btn" data-action="export">${ic('download')} ${tx('Export JSON', 'Exportar JSON')}</button>
        <button type="button" class="btn" data-action="import">${ic('upload')} ${tx('Import JSON', 'Importar JSON')}</button>
        <button type="button" class="btn btn-crit-ghost" data-action="wipe">${ic('trash')} ${tx('Delete everything', 'Borrar todo')}</button>
      </div>`}`, { label: tx('Mission settings', 'Ajustes de misión'), onClose: welcome ? (silent) => { if (!silent) ensureProfile(); } : null });
  }

  function saveSettings(form) {
    const fd = new FormData(form);
    const errEl = $('#settings-error');
    const name = String(fd.get('name') || '').trim();
    if (!name) { errEl.textContent = tx("Enter the astronaut's name.", 'Escribe el nombre del astronauta.'); form.elements.name.focus(); return; }
    const massRaw = String(fd.get('baselineMass') || '').trim();
    const mass = massRaw ? parseFloat(massRaw.replace(',', '.')) : null;
    if (mass != null && (isNaN(mass) || mass < 30 || mass > 200)) { errEl.textContent = tx('Baseline mass must be between 30 and 200 kg.', 'La masa base debe estar entre 30 y 200 kg.'); form.elements.baselineMass.focus(); return; }
    const start = String(fd.get('missionStart') || '') || V.dayKey(new Date());
    const fresh = form.dataset.fresh === '1';
    const values = { name, mission: String(fd.get('mission') || '').trim(), env: String(fd.get('env') || 'iss'), missionStart: start, baselineMass: mass };
    if (fresh) {
      state = V.defaultState();
      state.profile = values;
      region = 'heart';
    } else {
      state.profile = Object.assign({}, state.profile || {}, values);
    }
    closeModal(true);
    commit({ quiet: true });
    if (fresh) {
      setView('log');
      toast(tx('Mission created: log your first measurements', 'Misión creada: registra tus primeras mediciones'), 'info', 'rocket');
    } else {
      toast(tx('Settings saved', 'Ajustes guardados'), 'info', 'check');
    }
  }

  function loadDemo(askFirst) {
    const hasOwn = state.records.length && !(state.profile && state.profile.demo);
    const go = () => {
      state = V.makeDemo();
      region = 'heart';
      closeModal(true);
      V.saveState(state);
      refresh();
      setView('dashboard');
      renderHeader(); renderSidebarXP(); renderReminder();
      toast(tx('Demo mission loaded: 30 days in transit to Mars', 'Misión de demostración cargada: 30 días en tránsito a Marte'), 'info', 'rocket');
    };
    if (askFirst && hasOwn) {
      confirmDialog({
        title: tx('Load the demo mission', 'Cargar la demostración'),
        text: tx('Your current logs will be replaced by the demo mission. To keep them, export them first from Settings.', 'Tus registros actuales se reemplazarán por la misión de demostración. Si quieres conservarlos, expórtalos antes desde Ajustes.'),
        yes: tx('Replace my data', 'Reemplazar mis datos')
      }, go);
    } else go();
  }

  function wipe() {
    const linked = cloudOn() && !!V.cloud.deviceId();
    confirmDialog({
      title: tx('Delete all data', 'Borrar todos los datos'),
      text: linked
        ? tx('All your logs and settings stored in this browser will be deleted, together with the reports this browser sent to the Mission Control database. This cannot be undone.', 'Se borrarán todos tus registros y ajustes guardados en este navegador, junto con los reportes que este navegador envió a la base de datos del control de misión. No se puede deshacer.')
        : tx('All your logs and settings stored in this browser will be deleted. This cannot be undone.', 'Se borrarán todos tus registros y ajustes guardados en este navegador. No se puede deshacer.'),
      yes: tx('Delete everything', 'Borrar todo')
    }, () => {
      if (linked) {
        V.cloud.removeAll()
          .then(() => toast(tx('Reports deleted from the Mission Control database', 'Reportes borrados de la base de datos del control de misión'), 'info', 'trash'))
          .catch(() => toast(tx("Couldn't reach Mission Control: the reports stored there were not deleted. Try again when you have a connection.", 'No se pudo contactar con el control de misión: los reportes guardados allí no se borraron. Vuelve a intentarlo cuando tengas conexión.'), 'error', 'alert'));
      }
      cloudRows = null;
      cloudErr = null;
      state = V.defaultState();
      V.saveState(state);
      refresh();
      setView('dashboard');
      renderHeader(); renderSidebarXP(); renderReminder();
      openWelcome();
    });
  }

  /* Copy to the clipboard; if the browser refuses, select the text instead */
  function copyText(text, el, okMsg) {
    const fallback = () => {
      if (!el) return;
      if (el.select) { el.focus(); el.select(); }
      else {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
      }
      toast(tx('Text selected: copy it with Ctrl+C', 'Texto seleccionado: cópialo con Ctrl+C'), 'info', 'copy');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => toast(okMsg, 'info', 'copy')).catch(fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }

  function openExport() {
    const json = JSON.stringify(state, null, 2);
    openModal(`
      <div class="modal-head"><h2>${ic('download')} ${tx('Export data', 'Exportar datos')}</h2><button type="button" class="icon-btn" data-close-btn aria-label="${tx('Close', 'Cerrar')}">${ic('x')}</button></div>
      <p class="small muted">${tx('Copy this text and save it in a <strong>.json</strong> file. To restore it, use "Import JSON" in Settings.', 'Copia este texto y guárdalo en un archivo <strong>.json</strong>. Para recuperarlo, usa «Importar JSON» en Ajustes.')}</p>
      <label class="sr-only" for="export-text">${tx('AstroHealth data in JSON format', 'Datos de AstroHealth en formato JSON')}</label>
      <textarea id="export-text" class="export-text" rows="12" readonly>${esc(json)}</textarea>
      <div class="btn-row end"><button type="button" class="btn btn-primary" data-action="copy-export">${ic('copy')} ${tx('Copy JSON', 'Copiar JSON')}</button></div>`,
      { cls: 'wide', label: tx('Export data', 'Exportar datos') });
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.records)) throw new Error('format');
        state = V.normalizeState(obj);
        closeModal(true);
        commit({ quiet: true });
        ensureProfile();
        toast(tx(`Data imported: ${state.records.length} logs`, `Datos importados: ${state.records.length} registros`), 'info', 'upload');
      } catch (err) {
        toast(tx('Import failed: the file is not in AstroHealth format.', 'No se pudo importar: el archivo no tiene el formato de AstroHealth.'), 'error', 'alert');
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------- Report to Earth */
  function openReport() {
    refresh();
    reportCache = V.reportText(state, A);
    const env = A.ctx.env;
    openModal(`
      <div class="modal-head"><h2>${ic('send')} ${tx('Report for the flight surgeon', 'Reporte para el cirujano de vuelo')}</h2><button type="button" class="icon-btn" data-close-btn aria-label="${tx('Close', 'Cerrar')}">${ic('x')}</button></div>
      <div class="tx">
        <div class="tx-track">
          <div class="tx-node">${ic('rocket')}<small>${esc(env.short)}</small></div>
          <div class="tx-line"><span class="tx-dot" id="tx-dot"></span></div>
          <div class="tx-node">${ic('globe')}<small>${tx('Mission Control', 'Control de misión')}</small></div>
        </div>
        <p class="tx-status" id="tx-status">${tx('One-way delay', 'Retardo de ida')}: <strong>${V.fmtDelay(env.delaySec)}</strong>. ${env.delaySec >= 60
          ? tx('In an emergency, act with the CMO without waiting for a reply.', 'En una emergencia, actúa con el CMO sin esperar la respuesta.')
          : tx('Near-instant communication with Mission Control.', 'Comunicación casi inmediata con el control de misión.')}</p>
        <div class="tx-reply" id="tx-reply" hidden></div>
      </div>
      <pre class="report" id="report-text" tabindex="0" aria-label="${tx('Report content', 'Contenido del reporte')}">${esc(reportCache)}</pre>
      <div class="btn-row end">
        <button type="button" class="btn" data-action="copy-report">${ic('copy')} ${tx('Copy report', 'Copiar reporte')}</button>
        <button type="button" class="btn btn-primary" data-action="transmit" id="tx-btn">${ic('send')} ${tx('Transmit to Earth', 'Transmitir a Tierra')}</button>
      </div>
      <p class="mc-note small muted">${ic(cloudOn() ? 'lock' : 'info')}<span>${cloudOn()
        ? tx('Transmitted reports are stored in the Mission Control database (Supabase) under an anonymous ID for this browser. Use fictional or demo data only.', 'Los reportes transmitidos se guardan en la base de datos del control de misión (Supabase) con un ID anónimo de este navegador. Usa solo datos ficticios o de demostración.')
        : tx('Simulated link: this copy of AstroHealth is not connected to a database.', 'Enlace simulado: esta copia de AstroHealth no está conectada a una base de datos.')}
        <button type="button" class="link" data-view-link="control">${tx('Open Mission Control', 'Abrir el control de misión')}</button></span></p>`, { cls: 'wide', label: tx('Report to Earth', 'Reporte a Tierra') });
  }

  function transmit() {
    const btn = $('#tx-btn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const env = A.ctx.env;
    // With the cloud link on, the report goes to the outbox and is sent to Supabase right away
    const linked = cloudOn();
    const row = linked ? buildCloudRow() : null;
    if (linked) {
      state.outbox.push({ row, queuedAt: row.onboard_at });
      V.saveState(state);
    }
    const sendP = linked ? flushOutbox() : Promise.resolve(null);
    const dur = env.delaySec ? Math.min(6, Math.max(2, env.delaySec / 120)) : 1.2;
    const dot = $('#tx-dot'), status = $('#tx-status'), reply = $('#tx-reply');
    reply.hidden = true;
    const fly = (from, to) => {
      dot.style.transition = 'none';
      dot.style.left = from;
      dot.classList.add('on');
      void dot.offsetWidth;
      dot.style.transition = `left ${dur}s linear`;
      dot.style.left = to;
    };
    fly('0%', '100%');
    status.innerHTML = `${tx('Transmitting… real transit time', 'Transmitiendo… tránsito real')}: <strong>${V.fmtDelay(env.delaySec)}</strong>${env.delaySec >= 60 ? tx(' (sped-up simulation)', ' (simulación acelerada)') : ''}.`;
    txTimers.push(setTimeout(() => sendP.then((res) => {
      if (!document.contains(status)) return; // the dialog was closed meanwhile
      state.events.reports.push(new Date().toISOString());
      commit();
      const pending = linked ? state.outbox.find((o) => o.row.client_id === row.client_id) : null;
      if (pending) {
        // No signal (or the database refused it): the report waits in the outbox
        dot.classList.remove('on', 'back');
        const err = res && res.error;
        status.innerHTML = err && err.kind === 'rejected'
          ? `${ic('alert')} ${esc(cloudErrorText(err))}`
          : `${ic('clock')} ${tx('No signal right now. The report is saved in the outbox and will be sent automatically when the link is back.', 'Ahora no hay señal. El reporte queda guardado en la bandeja de salida y se enviará solo cuando vuelva el enlace.')}`;
        btn.disabled = false;
        btn.innerHTML = `${ic('send')} ${tx('Transmit again', 'Transmitir de nuevo')}`;
        return;
      }
      status.innerHTML = linked
        ? `${ic('check')} ${tx("Stored in the Mission Control database. Waiting for the flight surgeon's reply…", 'Guardado en la base de datos del control de misión. Esperando respuesta del cirujano de vuelo…')}`
        : `${ic('check')} ${tx("Received by Mission Control. Waiting for the flight surgeon's reply…", 'Recibido en el control de misión. Esperando respuesta del cirujano de vuelo…')}`;
      dot.classList.add('back');
      fly('100%', '0%');
      txTimers.push(setTimeout(() => {
        dot.classList.remove('on', 'back');
        const lv = A.alerts.some((a) => a.level === 'crit') ? 'crit' : A.alerts.some((a) => a.level === 'watch') ? 'watch' : 'ok';
        const msg = {
          crit: tx("Copy that. We're reviewing your critical values. Follow the protocol with the Crew Medical Officer, repeat your measurements in 1 hour and send us a new report. We're with you.",
            'Recibido. Revisamos tus valores críticos. Sigue el protocolo con el oficial médico de la tripulación, repite las mediciones en 1 hora y envíanos un nuevo reporte. Estamos contigo.'),
          watch: tx('Copy that. We see a few values to watch. Follow the actions AstroHealth suggests and repeat your measurements tomorrow. If anything gets worse, report it right away.',
            'Recibido. Vemos algunos valores en vigilancia. Aplica las acciones sugeridas por AstroHealth y repite las mediciones mañana. Si algo empeora, repórtalo de inmediato.'),
          ok: tx('Copy that. Your indicators look good. Keep up your exercise, sleep and hydration routine. Great work!',
            'Recibido. Tus indicadores se ven bien. Mantén tu rutina de ejercicio, sueño e hidratación. ¡Buen trabajo!')
        }[lv];
        reply.hidden = false;
        reply.className = `tx-reply lvl-${lv}`;
        reply.innerHTML = `<strong>${ic('globe')} ${tx('Flight surgeon · simulated reply', 'Cirujano de vuelo · respuesta simulada')}</strong><p>${esc(msg)}</p>`;
        status.innerHTML = `${ic('check')} ${tx('Communication complete · round trip', 'Comunicación completa · ida y vuelta')}: <strong>${V.fmtDelay(env.delaySec * 2)}</strong>.`;
        btn.disabled = false;
        btn.innerHTML = `${ic('send')} ${tx('Transmit again', 'Transmitir de nuevo')}`;
      }, dur * 1000));
    }), dur * 1000));
  }

  /* ------------------------------------------ Mission Control (cloud link) */
  const cloudOn = () => !!(V.cloud && V.cloud.enabled());
  let cloudRows = null;   // reports received by Mission Control (latest list from the cloud)
  let cloudErr = null;
  let cloudBusy = false;
  let flushing = null;

  function overallLevel() {
    return A.alerts.some((a) => a.level === 'crit') ? 'crit' : A.alerts.some((a) => a.level === 'watch') ? 'watch' : 'ok';
  }

  function buildCloudRow() {
    const p = state.profile || {};
    const env = A.ctx.env;
    const md = V.missionDay(state);
    return {
      client_id: V.newId(),
      onboard_at: new Date().toISOString(),
      astronaut: String(p.name || tx('Astronaut', 'Astronauta')).slice(0, 60),
      mission: String(p.mission || '').slice(0, 60),
      environment: env.id,
      mission_day: md == null ? null : Math.max(0, Math.min(5000, Math.round(md))),
      delay_sec: env.delaySec,
      score: A.score == null ? null : Math.max(0, Math.min(100, Math.round(A.score))),
      level: overallLevel(),
      alert_count: A.alerts.filter((a) => a.level === 'crit' || a.level === 'watch').length,
      lang: V.lang,
      report: reportCache.slice(0, 20000)
    };
  }

  function cloudErrorText(e) {
    if (!e) return '';
    if (e.kind === 'offline') return tx('No signal: Mission Control cannot be reached right now.', 'Sin señal: ahora no se puede contactar con el control de misión.');
    if (e.kind === 'auth') return tx('Mission Control did not accept this device. Try again later.', 'El control de misión no aceptó este dispositivo. Inténtalo más tarde.');
    if (e.kind === 'server') return tx('Mission Control is not responding. Try again in a few minutes.', 'El control de misión no responde. Inténtalo en unos minutos.');
    return `${tx('Mission Control rejected the report', 'El control de misión rechazó el reporte')}: ${e.message}`;
  }

  /* Sends the reports waiting in the outbox, oldest first. Never throws. */
  function flushOutbox(opts = {}) {
    if (!cloudOn() || !state.outbox.length) return Promise.resolve({ sent: 0, error: null });
    if (flushing) return flushing;
    flushing = (async () => {
      let sent = 0, error = null;
      for (const item of state.outbox.slice()) {
        if (item.error && !opts.all) continue; // refused before: retried only on request
        try {
          const got = await V.cloud.send(item.row);
          state.outbox = state.outbox.filter((o) => o.row.client_id !== item.row.client_id);
          if (got && got.id && Array.isArray(cloudRows)) cloudRows = [got].concat(cloudRows.filter((r) => r.client_id !== got.client_id));
          sent++;
        } catch (e) {
          error = e;
          if (e.kind === 'rejected') { item.error = e.message; continue; }
          break; // no signal or server problem: keep the rest for later
        }
      }
      V.saveState(state);
      return { sent, error };
    })().finally(() => { flushing = null; });
    return flushing;
  }

  function afterFlush(res) {
    if (res && res.sent) toast(tx(`${res.sent} queued report${res.sent > 1 ? 's' : ''} delivered to Mission Control`, `${res.sent} ${res.sent > 1 ? 'reportes pendientes entregados' : 'reporte pendiente entregado'} al control de misión`), 'info', 'send');
    if (view === 'control' && $('#modal-root').hidden) renderControl();
  }

  function loadControl() {
    if (!cloudOn() || cloudBusy) return;
    cloudBusy = true;
    cloudErr = null;
    if (view === 'control') renderControl();
    flushOutbox({ all: true })
      .then(() => V.cloud.list(30))
      .then((rows) => { cloudRows = Array.isArray(rows) ? rows : []; })
      .catch((e) => { cloudErr = e; })
      .finally(() => { cloudBusy = false; if (view === 'control') renderControl(); });
  }

  function discardQueued(id) {
    state.outbox = state.outbox.filter((o) => o.row.client_id !== id);
    V.saveState(state);
    renderControl();
    toast(tx('Report removed from the outbox', 'Reporte quitado de la bandeja de salida'), 'info', 'trash');
  }

  function renderControl() {
    const on = cloudOn();
    if (on && cloudRows === null && !cloudBusy && !cloudErr) { loadControl(); return; }
    const env = A.ctx.env;
    const devId = on ? V.cloud.deviceId() : null;
    let st;
    if (!on) st = ['none', tx('Simulated link', 'Enlace simulado'), tx('This copy of AstroHealth runs offline: reports are simulated and stay on this device.', 'Esta copia de AstroHealth funciona sin conexión: los reportes se simulan y se quedan en este dispositivo.')];
    else if (cloudBusy) st = ['info', tx('Contacting Mission Control…', 'Contactando con el control de misión…'), tx('Sending queued reports and downloading the received ones.', 'Enviando los reportes pendientes y descargando los recibidos.')];
    else if (cloudErr) st = [cloudErr.kind === 'offline' ? 'watch' : 'crit', cloudErr.kind === 'offline' ? tx('No signal', 'Sin señal') : tx('Link problem', 'Problema de enlace'), cloudErrorText(cloudErr)];
    else st = ['ok', tx('Link established', 'Enlace establecido'), tx('Transmitted reports are stored in the Mission Control database and are available on Earth.', 'Los reportes transmitidos se guardan en la base de datos del control de misión y están disponibles en Tierra.')];
    const rows = cloudRows || [];
    const envShort = (id) => (V.ENVIRONMENTS[id] ? V.ENVIRONMENTS[id].short : id || '—');

    const queued = state.outbox.map((o) => `
      <li class="mc-queued">
        <div class="rec-main"><span class="dot lvl-${esc(o.row.level)}" aria-hidden="true"></span><strong>${esc(V.fmtDateTime(o.row.onboard_at))}</strong>${pill(o.row.level)}
          <span class="small ${o.error ? '' : 'muted'}">${o.error ? `${ic('alert')} ${esc(tx('Refused', 'Rechazado'))}: ${esc(o.error)}` : tx('Waiting for signal', 'Esperando señal')}</span></div>
        ${o.error ? `<button type="button" class="icon-btn" data-action="cloud-discard" data-id="${esc(o.row.client_id)}" aria-label="${tx('Remove from the outbox', 'Quitar de la bandeja de salida')}" title="${tx('Remove from the outbox', 'Quitar de la bandeja de salida')}">${ic('trash')}</button>` : ''}
      </li>`).join('');

    const received = rows.map((r) => {
      const lv = ['ok', 'watch', 'crit'].includes(r.level) ? r.level : 'none';
      return `
      <details class="mc-report lvl-${lv}">
        <summary>
          <span class="dot" aria-hidden="true"></span>
          <span class="mc-main"><strong>${esc(V.fmtDateTime(r.created_at))}</strong>
            <span class="small muted">${esc([r.astronaut, r.mission, envShort(r.environment), r.mission_day ? `${tx('day', 'día')} ${r.mission_day}` : ''].filter(Boolean).join(' · '))}</span></span>
          <span class="mc-tags">${lv === 'none' ? '' : pill(lv)}${r.score == null ? '' : `<span class="mc-score" title="${tx('AstroHealth score', 'Índice AstroHealth')}">${r.score}</span>`}</span>
        </summary>
        <div class="mc-body">
          <p class="small muted">${tx('Generated on board', 'Generado a bordo')}: ${esc(r.onboard_at ? V.fmtDateTime(r.onboard_at) : '—')} · ${tx('Stored in the database', 'Guardado en la base de datos')}: ${esc(V.fmtDateTime(r.created_at))}${r.delay_sec ? ` · ${tx('On a real mission it reaches Earth after', 'En una misión real llega a la Tierra tras')} ${esc(V.fmtDelay(Number(r.delay_sec)))}` : ''}</p>
          <pre class="report">${esc(r.report)}</pre>
        </div>
      </details>`;
    }).join('');

    $('#view-control').innerHTML = `
      <div class="page-head"><div><h1>${tx('Mission Control', 'Control de misión')}</h1><p class="muted">${tx('Reports this device has transmitted to the flight surgeons on Earth.', 'Reportes que este dispositivo ha transmitido a los cirujanos de vuelo en la Tierra.')}</p></div>
        <button type="button" class="btn btn-primary" data-action="report">${ic('send')} ${tx('New report', 'Nuevo reporte')}</button></div>

      <div class="card mc-link">
        <div class="mc-status lvl-${st[0]}" role="status">${ic(st[0] === 'ok' ? 'signal' : st[0] === 'info' ? 'clock' : st[0] === 'none' ? 'info' : 'alert')}<div><strong>${st[1]}</strong><span class="small muted">${esc(st[2])}</span></div></div>
        <ul class="mc-facts">
          <li><span>${tx('Database', 'Base de datos')}</span><strong>${on ? tx('Supabase (cloud)', 'Supabase (nube)') : tx('None (offline)', 'Ninguna (sin conexión)')}</strong></li>
          <li><span>${tx('Anonymous device ID', 'ID anónimo del dispositivo')}</span><strong class="mono">${devId ? esc(devId) : '—'}</strong></li>
          <li><span>${tx('One-way delay', 'Retardo de ida')}</span><strong>${esc(V.fmtDelay(env.delaySec))}</strong></li>
          <li><span>${tx('In the outbox', 'En la bandeja de salida')}</span><strong>${state.outbox.length}</strong></li>
        </ul>
        ${on ? `<div class="btn-row"><button type="button" class="btn" data-action="cloud-refresh" ${cloudBusy ? 'disabled' : ''}>${ic('down')} ${state.outbox.length ? tx('Send queued and refresh', 'Enviar pendientes y actualizar') : tx('Refresh', 'Actualizar')}</button></div>` : ''}
      </div>

      ${state.outbox.length ? `
      <div class="section-head"><h2>${tx('Outbox', 'Bandeja de salida')}</h2><span class="muted small">${tx('Saved on board until there is a signal', 'Guardados a bordo hasta que haya señal')}</span></div>
      <div class="card"><ul class="rec-list">${queued}</ul></div>` : ''}

      ${on ? `
      <div class="section-head"><h2>${tx('Received on Earth', 'Recibidos en la Tierra')}</h2><span class="muted small">${cloudRows ? tx(`${rows.length} report${rows.length === 1 ? '' : 's'}`, `${rows.length} reporte${rows.length === 1 ? '' : 's'}`) : ''}</span></div>
      <div class="card">${rows.length
        ? `<div class="mc-list">${received}</div>`
        : `<div class="empty">${ic('send')}<p>${cloudBusy || cloudRows === null ? tx('Loading…', 'Cargando…') : tx('No reports yet. Use Report to Earth to send the first one.', 'Todavía no hay reportes. Usa «Reporte a Tierra» para enviar el primero.')}</p></div>`}</div>` : ''}

      <p class="callout">${ic('lock')}<span>${on
        ? tx('Privacy: reports are linked to an anonymous ID for this browser, and database rules (row-level security) stop anyone else from reading them. AstroHealth is a prototype, not a medical system: use fictional or demo data only. "Delete everything" in Settings also deletes them from the database.', 'Privacidad: los reportes se vinculan a un ID anónimo de este navegador y las reglas de la base de datos (seguridad a nivel de fila) impiden que nadie más los lea. AstroHealth es un prototipo, no un sistema médico: usa solo datos ficticios o de demostración. «Borrar todo» en Ajustes también los borra de la base de datos.')
        : tx('Nothing leaves this device: the transmission to Earth is a simulation.', 'Nada sale de este dispositivo: la transmisión a Tierra es una simulación.')}</span></p>`;
  }

  /* ================================================================ Toasts */
  function toast(msg, type = 'info', icon = 'check') {
    const root = $('#toast-root');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `${ic(icon)}<span>${esc(msg)}</span>`;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3600);
  }

  /* ================================================================ Events */
  function handleAction(a, el) {
    switch (a) {
      case 'report': openReport(); break;
      case 'settings': openSettings(false); break;
      case 'goto-log':
        if (el.dataset.taskWeekly) { closeModal(true); setView('log'); setTimeout(() => focusField(el.dataset.taskWeekly), 80); }
        else goLog(el.dataset.task, el.dataset.regionLog);
        break;
      case 'goto-breath':
        setView('routine');
        setTimeout(() => {
          const c = $('#breath-card');
          if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#breath-btn').focus({ preventScroll: true }); }
        }, 60);
        break;
      case 'snooze':
        snoozeUntil = Date.now() + 30 * 60000;
        renderReminder();
        toast(tx("I'll remind you again in 30 minutes", 'Te lo recordaré en 30 minutos'), 'info', 'clock');
        break;
      case 'tap': openTap(); break;
      case 'ts-now': { const ts = $('#f-ts'); if (ts) ts.value = V.toLocalInput(new Date()); break; }
      case 'close-result': { lastResult = null; const r = $('#result'); if (r) r.remove(); break; }
      case 'breath-toggle': toggleBreath(); break;
      case 'transmit': transmit(); break;
      case 'copy-report': copyText(reportCache, $('#report-text'), tx('Report copied to the clipboard', 'Reporte copiado al portapapeles')); break;
      case 'copy-export': { const t = $('#export-text'); if (t) copyText(t.value, t, tx('Data copied to the clipboard', 'Datos copiados al portapapeles')); break; }
      case 'intro-dismiss':
        if (state.ui) state.ui.intro = false;
        commit({ quiet: true });
        break;
      case 'demo': loadDemo(true); break;
      case 'demo-welcome': loadDemo(false); break;
      case 'setup': openSettings(true); break;
      case 'export': openExport(); break;
      case 'import': $('#import-file').click(); break;
      case 'wipe': wipe(); break;
      case 'del-record': delRecord(el.dataset.id); break;
      case 'cloud-refresh': loadControl(); break;
      case 'cloud-discard': discardQueued(el.dataset.id); break;
      default: break;
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest) return;
    const lang = t.closest('[data-lang]');
    if (lang) { switchLang(lang.dataset.lang); return; }
    const nav = t.closest('#nav [data-view]');
    if (nav) { setView(nav.dataset.view); return; }
    const vl = t.closest('[data-view-link]');
    if (vl) { closeModal(true); setView(vl.dataset.viewLink); return; }
    if (t.closest('[data-close-btn]')) { closeModal(); return; }
    const tr = t.closest('[data-trend]');
    if (tr) { trendSel = tr.dataset.trend; closeModal(true); setView('trends'); return; }
    const tsel = t.closest('[data-trend-sel]');
    if (tsel) { trendSel = tsel.dataset.trendSel; renderTrends(); return; }
    const rg = t.closest('[data-range]');
    if (rg) { trendRange = Number(rg.dataset.range); renderTrends(); return; }
    const reg = t.closest('[data-region]');
    if (reg) { selectRegion(reg, e.detail === 0); return; }
    const pk = t.closest('[data-pick]');
    if (pk) { pick(pk); return; }
    const hb = t.closest('[data-help]');
    if (hb) { toggleHelp(hb); return; }
    const act = t.closest('[data-action]');
    if (act) handleAction(act.dataset.action, act);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal-root').hidden) { closeModal(); return; }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.closest) return;
    if (t.closest('#log-form') && t.name && V.INDICATORS[t.name]) updateLive(t.name);
    if (t.closest('#settings-form') && t.name === 'env') $('#env-preview').innerHTML = envPreview(t.value);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.closest && t.closest('#settings-form') && t.name === 'env') $('#env-preview').innerHTML = envPreview(t.value);
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'log-form') { e.preventDefault(); submitLog(e.target); }
    else if (e.target.id === 'settings-form') { e.preventDefault(); saveSettings(e.target); }
  });

  document.addEventListener('reset', (e) => { if (e.target.id === 'log-form') resetLogForm(); });

  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (VIEWS.includes(h) && h !== view) { closeModal(true); setView(h); }
  });

  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importFile(f);
    e.target.value = '';
  });

  /* ================================================================ Start */
  function init() {
    $('#brand-logo').innerHTML = V.logo(38);
    $$('[data-icon]').forEach((el) => { el.outerHTML = V.icon(el.dataset.icon); });
    // First visit: open straight into the demo mission with a welcome card
    if (!state.profile && !state.records.length) {
      state = V.makeDemo();
      state.ui = { intro: true };
      V.saveState(state);
    } else {
      V.relocalizeDemo(state);
    }
    applyStatic();
    refresh();
    const h = (location.hash || '').replace('#', '');
    setView(VIEWS.includes(h) ? h : 'dashboard', { keepScroll: true });
    renderHeader();
    renderSidebarXP();
    renderReminder();
    if (!state.profile) openWelcome();

    setInterval(() => { const c = $('#clock'); if (c) c.textContent = clockText(); }, 15000);
    setInterval(() => {
      refresh();
      renderHeader();
      renderSidebarXP();
      renderReminder();
      if (view === 'dashboard' && $('#modal-root').hidden) renderDashboard();
      if (cloudOn() && state.outbox.some((o) => !o.error)) flushOutbox().then(afterFlush);
    }, 60000);

    // Store-and-forward: queued reports leave as soon as the link is back
    if (cloudOn()) {
      window.addEventListener('online', () => flushOutbox().then(afterFlush));
      if (state.outbox.length) setTimeout(() => flushOutbox().then(afterFlush), 2500);
    }

    // Offline copy of the app (sw.js): after the first visit the link opens with no connection.
    // Browsers only allow it over https or on localhost, so a copy opened from a file skips it.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
    }
  }

  init();
})();
