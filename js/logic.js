/* =========================================================================
   AstroHealth · Assessment logic
   Persistent state, daily aggregation, health assessment, alerts,
   routine, gamification, demo data and the report to Earth.
   SI notice: code and simulated demo data generated with Claude (Anthropic),
   a Super Intelligence (SI) tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;
  const DAY = 86400000;
  const HOUR = 3600000;

  /* ------------------------------------------------------------- Language */
  // English is the default; js/i18n.js switches content and V.lang to Spanish.
  V.lang = V.lang || 'en';
  V.tx = (en, es) => (V.lang === 'es' ? es : en);
  V.locale = () => (V.lang === 'es' ? 'es-ES' : 'en-US');

  V.LEVEL_RANK = { none: 0, ok: 1, info: 1, watch: 2, crit: 3 };
  V.LEVEL_TEXT = { ok: 'Normal', watch: 'Watch', crit: 'Critical', none: 'No data', info: 'Notice' };
  V.worst = (...levels) => levels.reduce((a, b) => (V.LEVEL_RANK[b] > V.LEVEL_RANK[a] ? b : a), 'none');

  /* ----------------------------------------------------------------- Dates */
  V.pad2 = (n) => String(n).padStart(2, '0');
  V.dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${V.pad2(x.getMonth() + 1)}-${V.pad2(x.getDate())}`;
  };
  V.keyToDate = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  V.addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  V.daysBetween = (a, b) => Math.round((V.keyToDate(V.dayKey(b)) - V.keyToDate(V.dayKey(a))) / DAY);
  V.lastNDays = (n, end = new Date()) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(V.dayKey(V.addDays(end, -i)));
    return out;
  };
  V.timeAgo = (ts, now = Date.now()) => {
    const m = Math.round((now - new Date(ts).getTime()) / 60000);
    if (m < 1) return V.tx('just now', 'ahora');
    if (m < 60) return V.tx(`${m} min ago`, `hace ${m} min`);
    const h = Math.round(m / 60);
    if (h < 36) return V.tx(`${h} h ago`, `hace ${h} h`);
    const d = Math.round(h / 24);
    return V.tx(`${d} d ago`, `hace ${d} d`);
  };
  V.fmtNum = (v, d = 0) => Number(v).toLocaleString(V.locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  V.fmtVal = (id, v) => V.fmtNum(v, V.INDICATORS[id].decimals);
  /* Units written right after the number: "3/5" always, "97%" in English (Spanish uses "97 %") */
  V.tightUnit = (unit) => !!unit && (unit.startsWith('/') || (unit === '%' && V.lang !== 'es'));
  V.withUnit = (txt, unit) => (V.tightUnit(unit) ? `${txt}${unit}` : `${txt} ${unit}`);
  V.pct = (txt) => V.withUnit(txt, '%');
  V.fmtFull = (id, v) => V.withUnit(V.fmtVal(id, v), V.INDICATORS[id].unit);
  V.fmtShort = (k) => V.keyToDate(k).toLocaleDateString(V.locale(), { month: 'short', day: 'numeric' });
  V.fmtLong = (k) => V.keyToDate(k).toLocaleDateString(V.locale(), { weekday: 'short', month: 'short', day: 'numeric' });
  V.fmtDateTime = (ts) => new Date(ts).toLocaleString(V.locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  V.fmtDelay = (sec) => {
    if (!sec) return V.tx('real time (< 1 s)', 'tiempo real (< 1 s)');
    if (sec < 60) return `${V.fmtNum(sec, sec % 1 ? 1 : 0)} s`;
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return s ? `${m} min ${s} s` : `${m} min`;
  };
  V.toLocalInput = (d) => {
    const x = new Date(d);
    return `${V.dayKey(x)}T${V.pad2(x.getHours())}:${V.pad2(x.getMinutes())}`;
  };

  /* ----------------------------------------------------------------- State */
  const KEY = 'astrohealth.state.v1';
  const LEGACY_KEY = 'vita.state.v1'; // name used by the first prototype
  let memoryCopy = null; // fallback when local storage is unavailable

  V.defaultState = () => ({
    version: 1,
    profile: null,
    records: [],
    events: { breath: [], reports: [], visited: [] },
    outbox: [] // reports to Earth waiting for a signal (see js/cloud.js)
  });

  V.normalizeState = (s) => {
    const base = V.defaultState();
    if (!s || typeof s !== 'object') return base;
    const out = Object.assign(base, s);
    out.events = Object.assign(V.defaultState().events, s.events || {});
    ['breath', 'reports', 'visited'].forEach((k) => { if (!Array.isArray(out.events[k])) out.events[k] = []; });
    out.outbox = Array.isArray(s.outbox) ? s.outbox.filter((o) => o && o.row && o.row.client_id && o.row.report) : [];
    out.records = Array.isArray(s.records)
      ? s.records.filter((r) => r && r.ts && !isNaN(new Date(r.ts))).map((r) => ({
          id: r.id || V.newId(),
          ts: r.ts,
          values: r.values || {},
          symptoms: Array.isArray(r.symptoms) ? r.symptoms : [],
          note: r.note || ''
        }))
      : [];
    V.sortRecords(out.records);
    return out;
  };

  V.loadState = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return V.normalizeState(JSON.parse(raw));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const s = JSON.parse(legacy);
        // An old demo is regenerated; real user data is kept
        if (s && s.profile && !s.profile.demo) return V.normalizeState(s);
      }
    } catch (e) { /* storage unavailable */ }
    return memoryCopy ? V.normalizeState(JSON.parse(memoryCopy)) : V.defaultState();
  };

  V.saveState = (s) => {
    const json = JSON.stringify(s);
    memoryCopy = json;
    try { localStorage.setItem(KEY, json); return true; } catch (e) { return false; }
  };

  V.newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  V.sortRecords = (records) => records.sort((a, b) => new Date(a.ts) - new Date(b.ts));

  V.ctx = (state) => ({
    env: V.ENVIRONMENTS[state.profile && state.profile.env] || V.ENVIRONMENTS.iss,
    profile: state.profile || {}
  });

  V.rangeText = (id, ctx) => {
    const r = V.INDICATORS[id].rangeText;
    return typeof r === 'function' ? r(ctx.env, ctx.profile) : r;
  };

  V.statusOf = (id, v, ctx) => V.INDICATORS[id].status(v, ctx);

  V.actionsFor = (id, it) => {
    const a = V.INDICATORS[id].actions || {};
    return a[`${it.level}_${it.dir}`] || a[it.level] || [];
  };

  /* ---------------------------------------------------- Daily aggregation */
  V.buildDays = (records) => {
    const map = new Map();
    for (const r of records) {
      const k = V.dayKey(r.ts);
      let d = map.get(k);
      if (!d) {
        d = { key: k, raw: {}, values: {}, symptoms: new Set(), records: [] };
        map.set(k, d);
      }
      d.records.push(r);
      for (const [id, v] of Object.entries(r.values || {})) {
        if (v == null || !V.INDICATORS[id]) continue;
        (d.raw[id] = d.raw[id] || []).push(v);
      }
      (r.symptoms || []).forEach((s) => d.symptoms.add(s));
    }
    for (const d of map.values()) {
      for (const [id, arr] of Object.entries(d.raw)) {
        d.values[id] = V.INDICATORS[id].agg === 'last'
          ? arr[arr.length - 1]
          : arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    }
    return map;
  };

  V.dayValue = (days, key, id) => {
    const d = days.get(key);
    return d && d.values[id] != null ? d.values[id] : null;
  };

  V.latest = (records, id) => {
    for (let i = records.length - 1; i >= 0; i--) {
      const v = records[i].values && records[i].values[id];
      if (v != null) return { value: v, ts: records[i].ts };
    }
    return null;
  };

  const missionStartKey = (state, now) =>
    (state.profile && state.profile.missionStart) ||
    (state.records[0] ? V.dayKey(state.records[0].ts) : V.dayKey(now));

  V.missionDay = (state, now = new Date()) => {
    if (!state.profile || !state.profile.missionStart) return null;
    const d = V.daysBetween(V.keyToDate(state.profile.missionStart), now) + 1;
    return d > 0 ? d : null;
  };

  /* --------------------------------------------------- Derived indicators */
  V.cumulativeDose = (state, days, ctx, now = new Date()) => {
    const start = V.keyToDate(missionStartKey(state, now));
    const n = Math.max(1, V.daysBetween(start, now) + 1);
    let logged = 0, est = 0, loggedDays = 0, estDays = 0;
    for (let i = 0; i < n; i++) {
      const v = V.dayValue(days, V.dayKey(V.addDays(start, i)), 'radiation');
      if (v != null) { logged += v; loggedDays++; }
      else if (i < n - 1) { est += ctx.env.radBaseline; estDays++; } // today is not over yet
    }
    const total = logged + est;
    const pct = (total / V.CAREER_DOSE_LIMIT) * 100;
    const level = pct >= 80 ? 'crit' : pct >= 50 ? 'watch' : 'ok';
    return { total, logged, est, loggedDays, estDays, pct, level, days: n };
  };

  V.boneLoss = (state, days, ctx, now = new Date()) => {
    const start = V.keyToDate(missionStartKey(state, now));
    const n = Math.max(1, V.daysBetween(start, now) + 1);
    const target = ctx.env.exerciseTarget;
    let loss = 0, compSum = 0, compDays = 0;
    for (let i = 0; i < n; i++) {
      const ex = V.dayValue(days, V.dayKey(V.addDays(start, i)), 'exercise');
      const c = ex != null ? Math.min(1, ex / target) : 0.5; // no data: assume partial compliance
      if (ex != null) { compSum += c; compDays++; }
      loss += (ctx.env.boneRate / 30) * (1 - 0.6 * c);
    }
    const level = loss < 2 ? 'ok' : loss <= 5 ? 'watch' : 'crit';
    return { pct: loss, level, days: n, compliance: compDays ? compSum / compDays : null };
  };

  /* ------------------------------------------------------------ Assessment */
  V.assess = (state, now = new Date()) => {
    const ctx = V.ctx(state);
    const records = state.records;
    const days = V.buildDays(records);
    const nowMs = now.getTime();
    const items = {};

    for (const id of Object.keys(V.INDICATORS)) {
      const ind = V.INDICATORS[id];
      const l = V.latest(records, id);
      if (!l) { items[id] = { id, value: null, ts: null, fresh: false, level: 'none', dir: null }; continue; }
      const fresh = nowMs - new Date(l.ts).getTime() <= ind.staleHours * HOUR;
      const st = ind.status(l.value, ctx);
      items[id] = { id, value: l.value, ts: l.ts, fresh, level: fresh ? st.level : 'none', rawLevel: st.level, dir: st.dir };
    }
    items.bp = {
      id: 'bp',
      value: items.sys.value != null && items.dia.value != null ? [items.sys.value, items.dia.value] : null,
      ts: items.sys.ts,
      fresh: items.sys.fresh && items.dia.fresh,
      level: V.worst(items.sys.level, items.dia.level)
    };

    // Symptoms from the last 24 h
    const symptoms = new Map();
    for (const r of records) {
      const age = nowMs - new Date(r.ts).getTime();
      if (age <= 24 * HOUR && age >= -HOUR) (r.symptoms || []).forEach((s) => { if (V.SYMPTOMS[s]) symptoms.set(s, r.ts); });
    }

    const cumDose = V.cumulativeDose(state, days, ctx, now);
    const boneLoss = V.boneLoss(state, days, ctx, now);
    const lastTs = records.length ? records[records.length - 1].ts : null;
    const recent = lastTs && nowMs - new Date(lastTs).getTime() <= 36 * HOUR;

    // Status per body region
    const regions = {};
    for (const reg of Object.values(V.REGIONS)) {
      let level = 'none';
      reg.indicators.forEach((id) => { level = V.worst(level, items[id].level); });
      (reg.derived || []).forEach((dk) => {
        if (!records.length) return;
        level = V.worst(level, dk === 'boneLoss' ? boneLoss.level : cumDose.level);
      });
      const regSymptoms = [];
      for (const sid of symptoms.keys()) {
        const s = V.SYMPTOMS[sid];
        if (s.regions.includes(reg.id)) { level = V.worst(level, s.level); regSymptoms.push(sid); }
      }
      if (level === 'none' && !reg.indicators.length && recent) level = 'ok';
      regions[reg.id] = { level, symptoms: regSymptoms };
    }

    // Alerts
    const alerts = [];
    const outside = (dir, range) => (dir === 'low'
      ? V.tx(`Below the normal range (${range}).`, `Por debajo del rango normal (${range}).`)
      : V.tx(`Above the normal range (${range}).`, `Por encima del rango normal (${range}).`));
    for (const cid of V.CARD_ORDER) {
      if (cid === 'bp') {
        if (V.LEVEL_RANK[items.bp.level] >= 2) {
          const wid = V.LEVEL_RANK[items.sys.level] >= V.LEVEL_RANK[items.dia.level] ? 'sys' : 'dia';
          const it = items[wid];
          alerts.push({
            level: items.bp.level, indicator: 'bp',
            title: `${V.tx('Blood pressure', 'Presión arterial')} ${V.fmtVal('sys', items.sys.value)}/${V.fmtVal('dia', items.dia.value)} mmHg`,
            text: `${V.INDICATORS[wid].name}: ${outside(it.dir, V.rangeText(wid, ctx)).replace(/^./, (c) => c.toLowerCase())}`,
            actions: V.actionsFor(wid, it)
          });
        }
        continue;
      }
      const it = items[cid];
      if (V.LEVEL_RANK[it.level] < 2) continue;
      const ind = V.INDICATORS[cid];
      alerts.push({
        level: it.level, indicator: cid,
        title: `${ind.name}: ${V.fmtFull(cid, it.value)}`,
        text: outside(it.dir, V.rangeText(cid, ctx)),
        actions: V.actionsFor(cid, it)
      });
    }
    for (const sid of symptoms.keys()) {
      const s = V.SYMPTOMS[sid];
      alerts.push({ level: s.level, title: `${V.tx('Reported symptom', 'Síntoma reportado')}: ${s.name}`, text: s.advice, actions: [], symptom: sid });
    }

    // Multi-day trends
    const avgOf = (id, n) => {
      const vals = V.lastNDays(n, now).map((k) => V.dayValue(days, k, id)).filter((v) => v != null);
      return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: vals.length };
    };
    const sl = avgOf('sleep', 7);
    if (sl.count >= 4 && sl.avg < 6.5) {
      const a = V.fmtNum(sl.avg, 1);
      alerts.push({
        level: 'watch', indicator: 'sleep', title: V.tx('Accumulated sleep debt', 'Déficit de sueño acumulado'),
        text: V.tx(`Average of ${a} h over the last 7 days. Sleep loss adds up and increases the risk of errors.`,
          `Promedio de ${a} h en los últimos 7 días. La falta de sueño se acumula y aumenta el riesgo de errores.`),
        actions: V.INDICATORS.sleep.actions.watch_low
      });
    }
    const md = avgOf('mood', 3);
    if (md.count >= 2 && md.avg <= 3) {
      const a = V.fmtNum(md.avg, 1);
      alerts.push({
        level: 'watch', indicator: 'mood', title: V.tx('Low mood for several days', 'Ánimo bajo varios días seguidos'),
        text: V.tx(`Average of ${a}/5 over the last 3 days. Prolonged isolation can affect behavioral health.`,
          `Promedio de ${a}/5 en los últimos 3 días. El aislamiento prolongado puede afectar la salud conductual.`),
        actions: V.INDICATORS.mood.actions.watch
      });
    }
    const ex = avgOf('exercise', 7);
    if (ex.count >= 3 && ex.avg < ctx.env.exerciseTarget * 0.8) {
      const a = Math.round(ex.avg), t = ctx.env.exerciseTarget;
      alerts.push({
        level: 'watch', indicator: 'exercise', title: V.tx('Exercise below the weekly goal', 'Ejercicio por debajo de la meta semanal'),
        text: V.tx(`Average of ${a} min/day against a goal of ${t} min.`, `Promedio de ${a} min/día frente a una meta de ${t} min.`),
        actions: V.INDICATORS.exercise.actions.watch
      });
    }
    if (records.length && cumDose.level !== 'ok') {
      const tot = V.fmtNum(cumDose.total, 1), p = V.pct(V.fmtNum(cumDose.pct, 0));
      alerts.push({
        level: cumDose.level, indicator: 'radiation', title: V.tx('High cumulative mission dose', 'Dosis acumulada de misión elevada'),
        text: V.tx(`${tot} mSv: ${p} of NASA's career limit (600 mSv).`, `${tot} mSv: ${p} del límite de carrera de NASA (600 mSv).`),
        actions: V.tx(
          ['Prioritize time in the most shielded areas.', 'Coordinate spacewalk planning with Mission Control.'],
          ['Prioriza el tiempo en las zonas más blindadas.', 'Coordina con el control de misión la planificación de actividades extravehiculares.'])
      });
    }
    if (records.length && boneLoss.level !== 'ok') {
      const p = V.pct(V.fmtNum(boneLoss.pct, 1));
      alerts.push({
        level: boneLoss.level, indicator: 'exercise', title: V.tx('Significant estimated bone loss', 'Pérdida ósea estimada significativa'),
        text: V.tx(`The model estimates a ${p} loss of bone mineral density during the mission.`,
          `El modelo estima una pérdida de ${p} de densidad mineral ósea en la misión.`),
        actions: V.tx(
          ['Prioritize loaded resistance exercise.', 'Review your calcium and vitamin D intake.', 'Mention it to the flight surgeon in your next report.'],
          ['Prioriza el ejercicio de resistencia con carga.', 'Revisa tu ingesta de calcio y vitamina D.', 'Coméntalo con el cirujano de vuelo en tu próximo reporte.'])
      });
    }
    if (!recent) {
      alerts.push({
        level: 'info',
        title: records.length ? V.tx('No recent logs', 'Sin registros recientes') : V.tx('No logs yet', 'Aún no hay registros'),
        text: V.tx('Log your vital signs to get an up-to-date assessment.', 'Registra tus signos vitales para obtener una evaluación actualizada.'),
        actions: [], cta: 'log'
      });
    }
    alerts.sort((a, b) => V.LEVEL_RANK[b.level] - V.LEVEL_RANK[a.level]);

    // Health score
    const S = { ok: 100, watch: 60, crit: 15 };
    let wsum = 0, ssum = 0;
    for (const id of Object.keys(V.INDICATORS)) {
      const it = items[id];
      if (!S[it.level]) continue;
      const w = V.INDICATORS[id].weight;
      wsum += w; ssum += w * S[it.level];
    }
    let score = wsum ? ssum / wsum : null;
    if (score != null) {
      for (const sid of symptoms.keys()) score -= V.SYMPTOMS[sid].level === 'crit' ? 12 : 4;
      score = Math.max(0, Math.min(100, Math.round(score)));
    }
    const scoreLevel = score == null ? 'none' : score >= 85 ? 'ok' : score >= 65 ? 'watch' : 'crit';
    const scoreLabel = V.tx(
      { ok: 'Optimal', watch: 'Attention', crit: 'At risk', none: 'No data' },
      { ok: 'Óptimo', watch: 'Atención', crit: 'Riesgo', none: 'Sin datos' })[scoreLevel];
    const counts = { ok: 0, watch: 0, crit: 0, none: 0 };
    V.CARD_ORDER.forEach((id) => { counts[items[id].level]++; });

    return { ctx, days, items, symptoms, cumDose, boneLoss, regions, alerts, score, scoreLevel, scoreLabel, counts, lastTs, now };
  };

  /* --------------------------------------------------------------- Routine */
  const breathDays = (state) => new Set(state.events.breath.map((ts) => V.dayKey(ts)));

  V.dayComplete = (state, days, key, bdays = breathDays(state)) => {
    const d = days.get(key);
    if (!d) return false;
    return V.ROUTINE.every((t) => (t.special === 'breath' ? bdays.has(key) : t.needs.every((n) => d.values[n] != null)));
  };

  V.routine = (state, days, now = new Date()) => {
    const key = V.dayKey(now);
    const d = days.get(key);
    const has = (n) => !!(d && d.values[n] != null);
    const breathToday = breathDays(state).has(key);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const tasks = V.ROUTINE.map((t) => {
      const done = t.special === 'breath' ? breathToday : t.needs.every(has);
      const [h, m] = t.time.split(':').map(Number);
      return Object.assign({}, t, {
        done,
        overdue: !done && nowMin >= h * 60 + m,
        partial: !done && !!t.needs && t.needs.some(has)
      });
    });
    const weekly = V.WEEKLY.map((t) => {
      const l = V.latest(state.records, t.needs[0]);
      const done = !!l && now - new Date(l.ts) < t.days * DAY;
      return Object.assign({}, t, { done, lastTs: l ? l.ts : null });
    });
    const doneCount = tasks.filter((t) => t.done).length;
    return { tasks, weekly, doneCount, total: tasks.length, next: tasks.find((t) => !t.done) || null };
  };

  /* ---------------------------------------------------------- Gamification */
  V.progress = (state, days, ctx, now = new Date()) => {
    let values = 0, symptomChecks = 0;
    for (const r of state.records) {
      values += Object.values(r.values || {}).filter((v) => v != null).length;
      if (r.symptoms && r.symptoms.length) symptomChecks++;
    }
    const bdays = breathDays(state);
    const keys = [...days.keys()].sort();
    let perfect = 0;
    keys.forEach((k) => { if (V.dayComplete(state, days, k, bdays)) perfect++; });
    const breath = state.events.breath.length;
    const reports = state.events.reports.length;
    const visited = state.events.visited.length;

    const xp = values * 10 + symptomChecks * 5 + perfect * 50 + breath * 15 + reports * 25 + visited * 5;
    let level = 1, floor = 0;
    while (xp >= floor + V.xpForLevel(level)) { floor += V.xpForLevel(level); level++; }
    const need = V.xpForLevel(level);
    const into = xp - floor;
    const rank = V.RANKS[Math.min(level - 1, V.RANKS.length - 1)];

    // Streaks: an active day has at least 5 logged values
    const isActive = (k) => { const d = days.get(k); return !!d && Object.keys(d.values).length >= 5; };
    let streak = 0;
    let cursor = new Date(now);
    if (!isActive(V.dayKey(cursor))) cursor = V.addDays(cursor, -1);
    while (isActive(V.dayKey(cursor))) { streak++; cursor = V.addDays(cursor, -1); }

    let bestStreak = 0, run = 0, prev = null;
    let sleepRun = 0, sleepBest = 0, prevSleep = null;
    let waterDays = 0, athleteDays = 0;
    for (const k of keys) {
      const consecutive = prev && V.daysBetween(V.keyToDate(prev), V.keyToDate(k)) === 1;
      if (isActive(k)) { run = consecutive && run ? run + 1 : 1; } else run = 0;
      bestStreak = Math.max(bestStreak, run);
      prev = k;

      const sv = V.dayValue(days, k, 'sleep');
      const sConsec = prevSleep && V.daysBetween(V.keyToDate(prevSleep), V.keyToDate(k)) === 1;
      if (sv != null && sv >= 7) { sleepRun = sConsec && sleepRun ? sleepRun + 1 : 1; prevSleep = k; }
      else { sleepRun = 0; prevSleep = null; }
      sleepBest = Math.max(sleepBest, sleepRun);

      const wv = V.dayValue(days, k, 'water');
      if (wv != null && wv >= 2) waterDays++;
      const ev = V.dayValue(days, k, 'exercise');
      if (ev != null && ev >= ctx.env.exerciseTarget) athleteDays++;
    }
    bestStreak = Math.max(bestStreak, streak);

    const earned = new Set();
    if (state.records.length) earned.add('first');
    if (bestStreak >= 3) earned.add('streak3');
    if (bestStreak >= 7) earned.add('streak7');
    if (perfect >= 1) earned.add('perfect');
    if (sleepBest >= 3) earned.add('sleep3');
    if (waterDays >= 5) earned.add('water5');
    if (athleteDays >= 7) earned.add('athlete');
    if (breath >= 3) earned.add('breath3');
    if (Object.keys(V.REGIONS).every((r) => state.events.visited.includes(r))) earned.add('explorer');
    if (reports >= 1) earned.add('report');
    if (values >= 100) earned.add('scientist');

    return { xp, level, rank, into, need, streak, bestStreak, earned, values, perfect, breath, reports };
  };

  /* ------------------------------------------------------------- Demo data */
  // Demo texts in both languages, so switching language also translates the demo
  const DEMO_TEXT = {
    mission: ['Horizon Mission', 'Misión Horizonte'],
    day1: ['Day 1: adapting to microgravity. Mild nausea on waking.', 'Día 1: adaptación a la microgravedad. Náuseas leves al despertar.'],
    today: ['Slept poorly because of ventilation noise. Mild headache on waking.', 'Dormí mal por el ruido del sistema de ventilación. Dolor de cabeza leve al despertar.'],
    storm: ['Solar storm alert: 6 h in the storm shelter.', 'Alerta de tormenta solar: 6 h en el refugio blindado.']
  };
  const demoText = (k) => V.tx(DEMO_TEXT[k][0], DEMO_TEXT[k][1]);

  /* Re-translate the demo profile and notes after a language switch */
  V.relocalizeDemo = (state) => {
    if (!state.profile || !state.profile.demo) return;
    if (DEMO_TEXT.mission.includes(state.profile.mission)) state.profile.mission = demoText('mission');
    state.records.forEach((r) => {
      for (const k of ['day1', 'today', 'storm']) if (DEMO_TEXT[k].includes(r.note)) r.note = demoText(k);
    });
  };

  V.makeDemo = (now = new Date()) => {
    let seed = 20261114;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const noise = (a) => (rand() * 2 - 1) * a;
    const round = (v, step) => {
      const dec = step < 1 ? String(step).split('.')[1].length : 0;
      return Number((Math.round(v / step) * step).toFixed(dec));
    };
    const N = 30;
    const start = V.addDays(now, -(N - 1));
    const at = (day, h, m) => { const x = new Date(day); x.setHours(h, m, 0, 0); return x; };
    const records = [];
    const push = (ts, values, symptoms = [], note = '') => {
      if (ts.getTime() > now.getTime()) return; // never in the future
      records.push({ id: V.newId() + records.length, ts: ts.toISOString(), values, symptoms, note });
    };

    for (let i = 0; i < N; i++) {
      const day = V.addDays(start, i);
      const t = i / (N - 1);
      const isToday = i === N - 1;
      const spe = i === 22; // solar particle event
      const after = i === 23;

      const mv = {
        hr: Math.round(62 + 3 * Math.sin(i / 4) + noise(2) + (spe ? 9 : 0)),
        sys: Math.round(116 - 2 * t + noise(4) + (spe ? 8 : 0)),
        dia: Math.round(75 + noise(3) + (spe ? 5 : 0)),
        temp: round(36.6 + 0.55 * t + noise(0.12), 0.1),
        spo2: Math.max(95, Math.min(99, Math.round(97 + noise(1.2)))),
        glucose: Math.round(88 + 9 * t + noise(6)),
        sleep: round(Math.max(4.5, 7.4 - 1.1 * t + noise(0.45) - (i === 21 || i === 22 ? 1.2 : 0)), 0.25)
      };
      if (i % 7 === 0) mv.mass = round(72 - 0.058 * i + noise(0.1), 0.1);
      const ms = [];
      if (i <= 1) ms.push('nausea');
      if (i <= 4) ms.push('congestion');
      if (i >= 3 && i <= 6) ms.push('back');
      if (i === 20 || i === 21) ms.push('insomnia');
      if (spe) ms.push('headache');
      let mNote = '';
      if (i === 0) mNote = demoText('day1');
      if (isToday) {
        Object.assign(mv, { hr: 66, sys: 127, dia: 82, temp: 37.3, spo2: 97, glucose: 104, sleep: 6 });
        ms.length = 0; ms.push('headache');
        mNote = demoText('today');
      }
      push(at(day, 7, 5 + Math.floor(rand() * 15)), mv, ms, mNote);

      const ev = {
        exercise: [9, 17, 24].includes(i) ? 60 : round(122 + noise(14), 5),
        water: round(([12, 19, 25].includes(i) ? 1.6 : 2.25) + noise(0.25), 0.1),
        radiation: spe ? 14.6 : after ? 4.2 : round(1.8 + noise(0.12), 0.01),
        mood: i >= 18 && i <= 23 ? (spe ? 2 : 3) : rand() < 0.75 ? 4 : rand() < 0.5 ? 5 : 3,
        stress: spe ? 4 : i >= 18 && i <= 23 ? 3 : rand() < 0.7 ? 2 : 1
      };
      if (i === N - 2) Object.assign(ev, { exercise: 85, water: 1.8, radiation: 1.86, mood: 3, stress: 3 });
      push(at(day, 21, 10), ev, [], spe ? demoText('storm') : '');
    }

    const evAt = (i, h, m) => at(V.addDays(start, i), h, m).toISOString();
    return V.normalizeState({
      version: 1,
      profile: {
        name: 'Alex Rivera',
        mission: demoText('mission'),
        env: 'transit',
        missionStart: V.dayKey(start),
        baselineMass: 72,
        demo: true
      },
      records,
      events: { breath: [evAt(10, 13, 5), evAt(23, 13, 10)], reports: [evAt(22, 22, 0)], visited: [] }
    });
  };

  /* ------------------------------------------------------- Report to Earth */
  V.reportText = (state, A, now = new Date()) => {
    const tx = V.tx;
    const p = state.profile || {};
    const env = A.ctx.env;
    const md = V.missionDay(state, now);
    const out = [];
    const line = (s = '') => out.push(s);
    const tag = (lv) => `[${V.LEVEL_TEXT[lv].toUpperCase()}]`;
    const noData = tx('no data', 'sin datos');
    line(tx('ASTROHEALTH · HEALTH REPORT FOR THE FLIGHT SURGEON', 'ASTROHEALTH · REPORTE DE SALUD PARA EL CIRUJANO DE VUELO'));
    line('='.repeat(56));
    line(`${tx('Generated', 'Generado')}: ${now.toLocaleString(V.locale(), { hour12: false })} (${tx('onboard time', 'hora a bordo')})`);
    line(`${tx('Astronaut', 'Astronauta')}: ${p.name || tx('Astronaut', 'Astronauta')} · ${p.mission || tx('Mission', 'Misión')}`);
    line(`${tx('Environment', 'Entorno')}: ${env.name}${md ? ` · ${tx('Mission day', 'Día de misión')} ${md}` : ''}`);
    line(`${tx('Communication delay (one way)', 'Retardo de comunicación (ida)')}: ${V.fmtDelay(env.delaySec)}`);
    line(`${tx('AstroHealth score', 'Índice AstroHealth')}: ${A.score == null ? noData : `${A.score}/100 (${A.scoreLabel})`}`);
    line();
    line(tx('INDICATORS (latest value)', 'INDICADORES (último valor)'));
    for (const id of V.CARD_ORDER) {
      if (id === 'bp') {
        const s = A.items.sys, d = A.items.dia;
        line(`- ${tx('Blood pressure', 'Presión arterial')}: ${s.value != null && d.value != null ? `${V.fmtVal('sys', s.value)}/${V.fmtVal('dia', d.value)} mmHg ${tag(A.items.bp.level)} (${V.timeAgo(s.ts, now)})` : noData}`);
        continue;
      }
      const it = A.items[id], ind = V.INDICATORS[id];
      line(`- ${ind.name}: ${it.value != null ? `${V.fmtFull(id, it.value)} ${tag(it.level)} (${V.timeAgo(it.ts, now)})` : noData}`);
    }
    line();
    line(tx('SYMPTOMS (last 24 h)', 'SÍNTOMAS (últimas 24 h)'));
    if (A.symptoms.size) for (const sid of A.symptoms.keys()) line(`- ${V.SYMPTOMS[sid].name} ${tag(V.SYMPTOMS[sid].level)}`);
    else line(tx('- None reported', '- Ninguno reportado'));
    line();
    line(tx('ACTIVE ALERTS', 'ALERTAS ACTIVAS'));
    const al = A.alerts.filter((a) => a.level === 'crit' || a.level === 'watch');
    if (al.length) al.forEach((a) => line(`- ${tag(a.level)} ${a.title}. ${a.text}`));
    else line(tx('- None', '- Ninguna'));
    line();
    line(tx('MISSION EXPOSURE', 'EXPOSICIÓN DE MISIÓN'));
    const dose = V.fmtNum(A.cumDose.total, 1), dosePct = V.pct(V.fmtNum(A.cumDose.pct, 1));
    line(tx(`- Cumulative dose: ${dose} mSv (${dosePct} of the 600 mSv career limit)`, `- Dosis acumulada: ${dose} mSv (${dosePct} del límite de carrera de 600 mSv)`));
    line(`${tx('- Estimated bone loss (model)', '- Pérdida ósea estimada (modelo)')}: ${V.pct(V.fmtNum(A.boneLoss.pct, 1))}`);
    line();
    line(tx('RECENT NOTES', 'NOTAS RECIENTES'));
    const notes = state.records.filter((r) => r.note).slice(-3).reverse();
    if (notes.length) notes.forEach((r) => line(`- ${V.fmtDateTime(r.ts)}: ${r.note}`));
    else line(tx('- No notes', '- Sin notas'));
    line();
    line(tx('Report generated automatically by AstroHealth. Educational self-assessment', 'Reporte generado automáticamente por AstroHealth. Herramienta educativa de autoevaluación;'));
    line(tx('tool; it does not replace evaluation by the flight surgeon.', 'no sustituye la evaluación del cirujano de vuelo.'));
    return out.join('\n');
  };
})();
