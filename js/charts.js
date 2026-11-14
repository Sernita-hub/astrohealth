/* =========================================================================
   AstroHealth · Charts (canvas, no external libraries)
   - LineChart: line chart with status bands and a tooltip
   - sparkline: small SVG chart for the indicator cards
   SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
   tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function niceStep(range, ticks) {
    const raw = range / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    return step * mag;
  }

  class LineChart {
    constructor(canvas, tip) {
      this.canvas = canvas;
      this.tip = tip;
      this.data = null;
      this.hover = -1;
      this.pad = { l: 46, r: 14, t: 14, b: 30 };
      this.onMove = this.onMove.bind(this);
      this.onLeave = this.onLeave.bind(this);
      this.redraw = () => this.draw();
      canvas.addEventListener('pointermove', this.onMove);
      canvas.addEventListener('pointerdown', this.onMove);
      canvas.addEventListener('pointerleave', this.onLeave);
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(this.redraw);
        this.ro.observe(canvas.parentElement);
      } else {
        window.addEventListener('resize', this.redraw);
      }
    }

    destroy() {
      if (this.ro) this.ro.disconnect();
      else window.removeEventListener('resize', this.redraw);
    }

    set(data) {
      this.data = data;
      this.hover = -1;
      this.hideTip();
      this.draw();
    }

    range() {
      const d = this.data;
      const all = [];
      d.series.forEach((s) => s.values.forEach((v) => { if (v != null) all.push(v); }));
      const hint = d.hint || [];
      let lo = Math.min(...all, ...hint);
      let hi = Math.max(...all, ...hint);
      if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
      if (lo === hi) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.08;
      lo -= pad; hi += pad;
      if (d.clamp) { lo = Math.max(lo, d.clamp[0]); hi = Math.min(hi, d.clamp[1]); }
      const step = niceStep(hi - lo, 4);
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
      if (d.clamp) { lo = Math.max(lo, d.clamp[0]); hi = Math.min(hi, d.clamp[1]); }
      return { lo, hi, step };
    }

    draw() {
      const c = this.canvas, d = this.data;
      if (!d) return;
      const w = c.parentElement.clientWidth;
      const h = c.clientHeight || 280;
      if (!w) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const P = this.pad;
      const pw = w - P.l - P.r, ph = h - P.t - P.b;
      const { lo, hi, step } = this.range();
      const n = d.labels.length;
      const X = (i) => P.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
      const Y = (v) => P.t + ph - ((v - lo) / (hi - lo)) * ph;
      this.geo = { X, Y, n, P, pw, ph, w, h };
      const col = {
        ok: css('--ok'), watch: css('--watch'), crit: css('--crit'),
        grid: css('--grid'), text: css('--muted'), bg: css('--surface'), line: css('--text')
      };
      const font = '12px ' + (css('--font') || 'system-ui, sans-serif');

      // Status bands (green / amber / red)
      if (d.bandFn) {
        const bc = { ok: css('--band-ok'), watch: css('--band-watch'), crit: css('--band-crit') };
        let startY = P.t, cur = null;
        for (let py = P.t; py <= P.t + ph; py += 2) {
          const v = lo + ((P.t + ph - py) / ph) * (hi - lo);
          const lv = d.bandFn(v);
          if (lv !== cur) {
            if (cur && bc[cur]) { g.fillStyle = bc[cur]; g.fillRect(P.l, startY, pw, py - startY); }
            cur = lv; startY = py;
          }
        }
        if (cur && bc[cur]) { g.fillStyle = bc[cur]; g.fillRect(P.l, startY, pw, P.t + ph - startY); }
      }

      // Grid and Y axis
      g.font = font;
      g.lineWidth = 1;
      g.strokeStyle = col.grid;
      g.fillStyle = col.text;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      const dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
      for (let v = lo; v <= hi + step / 1000; v += step) {
        const y = Math.round(Y(v)) + 0.5;
        g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.l + pw, y); g.stroke();
        g.fillText(V.fmtNum(v, dec), P.l - 8, y);
      }

      // X axis (anchored on the last day)
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 58))));
      for (let i = 0; i < n; i++) {
        if ((n - 1 - i) % every !== 0) continue;
        g.fillText(d.labels[i], X(i), P.t + ph + 9);
      }

      // Reference lines
      (d.refLines || []).forEach((r) => {
        if (r.y < lo || r.y > hi) return;
        const y = Math.round(Y(r.y)) + 0.5;
        g.save();
        g.setLineDash([5, 5]);
        g.strokeStyle = r.color || col.watch;
        g.globalAlpha = 0.7;
        g.beginPath(); g.moveTo(P.l, y); g.lineTo(P.l + pw, y); g.stroke();
        g.restore();
      });

      const hasData = d.series.some((s) => s.values.some((v) => v != null));
      if (!hasData) {
        g.fillStyle = col.text;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '14px ' + (css('--font') || 'system-ui');
        g.fillText(V.tx('No data for this period', 'Sin datos en este periodo'), P.l + pw / 2, P.t + ph / 2);
        return;
      }

      // Vertical hover line
      if (this.hover >= 0) {
        const x = Math.round(X(this.hover)) + 0.5;
        g.save();
        g.strokeStyle = col.text;
        g.globalAlpha = 0.5;
        g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, P.t + ph); g.stroke();
        g.restore();
      }

      // Series
      d.series.forEach((s) => {
        g.strokeStyle = s.color;
        g.lineWidth = 2.25;
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.beginPath();
        let pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          const x = X(i), y = Y(v);
          if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
        });
        g.stroke();
        s.values.forEach((v, i) => {
          if (v == null) return;
          const lv = s.levels && s.levels[i];
          g.beginPath();
          g.arc(X(i), Y(v), i === this.hover ? 6 : 3.75, 0, Math.PI * 2);
          g.fillStyle = lv && col[lv] ? col[lv] : s.color;
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = col.bg;
          g.stroke();
        });
      });
    }

    onMove(e) {
      if (!this.geo || !this.data) return;
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const { P, pw, n } = this.geo;
      let i = n <= 1 ? 0 : Math.round(((mx - P.l) / pw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      if (i !== this.hover) { this.hover = i; this.draw(); }
      this.showTip(i);
    }

    onLeave() {
      this.hover = -1;
      this.draw();
      this.hideTip();
    }

    showTip(i) {
      const d = this.data, tip = this.tip;
      if (!tip || !this.geo) return;
      const rows = d.series.map((s) => {
        const v = s.values[i];
        const lv = s.levels && s.levels[i];
        return `<div class="tt-row"><span class="tt-dot" style="background:${s.color}"></span>${s.name}: <strong>${v == null ? '—' : V.withUnit(V.fmtNum(v, d.decimals), d.unit)}</strong>${lv ? ` <span class="tt-lv lvl-${lv}">${V.LEVEL_TEXT[lv]}</span>` : ''}</div>`;
      }).join('');
      tip.innerHTML = `<div class="tt-date">${d.fullLabels ? d.fullLabels[i] : d.labels[i]}</div>${rows}`;
      tip.hidden = false;
      const x = this.geo.X(i);
      const tw = tip.offsetWidth;
      let left = x + 14;
      if (left + tw > this.geo.w) left = x - tw - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = '6px';
    }

    hideTip() {
      if (this.tip) this.tip.hidden = true;
    }
  }
  V.LineChart = LineChart;

  /* Small chart for the indicator cards */
  V.sparkline = (values, levels, w = 88, h = 30) => {
    const pts = values.map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
    if (pts.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
    const vs = pts.map((p) => p[1]);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const n = values.length;
    const X = (i) => 3 + (i * (w - 6)) / (n - 1);
    const Y = (v) => h - 4 - ((v - lo) / (hi - lo)) * (h - 8);
    const path = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    const lv = levels[last[0]] || 'none';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path}" class="spark-line"/><circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="3" class="spark-dot lvl-${lv}"/></svg>`;
  };
})();
