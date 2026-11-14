/* =========================================================================
   AstroHealth · 3D hologram body (no libraries)
   A procedural human figure drawn as a holographic wireframe by a small
   software 3D engine on <canvas>: perspective projection, orbit camera,
   depth-faded glowing strokes and additive blending. Inner organs glow in
   the color of their health status, and choosing a region flies the camera
   to it. Works offline and from file://, like the rest of the app.
   SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
   tool. See README, "Use of Super Intelligence (SI)".
   ========================================================================= */
(function () {
  'use strict';
  const V = window.AH;
  const TAU = Math.PI * 2;
  const S = [-1, 1]; // right / left side of the figure (x > 0 is the figure's left)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function seeded(seed) {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }

  /* ============================================================ Geometry */
  // Units are metres: feet at y = 0, top of the head at y ≈ 1.78, +z faces the viewer.
  class Mesh {
    constructor() { this.v = []; this.s = []; this.d = []; }
    line(pts, closed) {
      const base = this.v.length / 3;
      pts.forEach((p) => this.v.push(p[0], p[1], p[2]));
      for (let i = 0; i < pts.length - 1; i++) this.s.push(base + i, base + i + 1);
      if (closed && pts.length > 2) this.s.push(base + pts.length - 1, base);
      return this;
    }
    dots(pts) { pts.forEach((p) => this.d.push(p[0], p[1], p[2])); return this; }
    done(extra) {
      const m = Object.assign({ verts: new Float32Array(this.v), segs: new Uint32Array(this.s), dots: new Float32Array(this.d) }, extra || {});
      m.P = new Float32Array(m.verts.length); // projected vertices (x, y, depth)
      m.Q = new Float32Array(m.dots.length);  // projected dots
      return m;
    }
  }

  function circle(c, u, v, ru, rv, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU, cu = Math.cos(t) * ru, sv = Math.sin(t) * rv;
      pts.push([c[0] + u[0] * cu + v[0] * sv, c[1] + u[1] * cu + v[1] * sv, c[2] + u[2] * cu + v[2] * sv]);
    }
    return pts;
  }

  function basis(A, B) {
    const a = norm(sub(B, A));
    let u = cross(a, [0, 0, 1]);
    if (Math.hypot(u[0], u[1], u[2]) < 1e-3) u = cross(a, [1, 0, 0]);
    u = norm(u);
    return { u, v: norm(cross(a, u)) };
  }

  const at = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

  // Limb segment: rings along the axis plus a few lengthwise lines
  function tube(m, A, B, rA, rB, n = 14, step = 0.034, meridians = 4) {
    const { u, v } = basis(A, B);
    const k = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) / step));
    const rings = [];
    for (let i = 0; i <= k; i++) {
      const t = i / k, r = lerp(rA, rB, t) * (1 + 0.06 * Math.sin(Math.PI * t));
      const ring = circle(at(A, B, t), u, v, r, r, n);
      rings.push(ring);
      m.line(ring, true);
    }
    for (let j = 0; j < meridians; j++) {
      const idx = Math.round((j * n) / meridians) % n;
      m.line(rings.map((r) => r[idx]), false);
    }
  }

  function ellipsoid(m, c, r, lat = 8, n = 18, mer = 6) {
    for (let i = 1; i < lat; i++) {
      const phi = -Math.PI / 2 + (i / lat) * Math.PI, k = Math.cos(phi);
      m.line(circle([c[0], c[1] + Math.sin(phi) * r[1], c[2]], [1, 0, 0], [0, 0, 1], r[0] * k, r[2] * k, n), true);
    }
    for (let j = 0; j < mer; j++) {
      const th = (j / mer) * TAU, pts = [];
      for (let i = 0; i <= 14; i++) {
        const phi = -Math.PI / 2 + (i / 14) * Math.PI;
        pts.push([c[0] + Math.cos(phi) * Math.cos(th) * r[0], c[1] + Math.sin(phi) * r[1], c[2] + Math.cos(phi) * Math.sin(th) * r[2]]);
      }
      m.line(pts, false);
    }
  }

  // Random points inside a thin shell of an ellipsoid (deterministic)
  function cloud(m, c, r, count, rnd, inner = 0.82) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      let x, y, z, l;
      do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.01);
      const s = lerp(inner, 1, rnd()) / Math.sqrt(l);
      pts.push([c[0] + x * s * r[0], c[1] + y * s * r[1], c[2] + z * s * r[2]]);
    }
    m.dots(pts);
  }

  // Muscle fibres running along a limb segment, on its front (or back)
  function fibers(m, A, B, rA, rB, count, back) {
    const { u, v } = basis(A, B);
    const front = Math.atan2(v[2], u[2]) + (back ? Math.PI : 0);
    for (let f = 0; f < count; f++) {
      const th = front + (count > 1 ? (f / (count - 1) - 0.5) * 2.2 : 0), pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, r = lerp(rA, rB, t) * (0.96 + 0.12 * Math.sin(Math.PI * t)), c = at(A, B, t);
        const cu = Math.cos(th + 0.25 * Math.sin(Math.PI * t)) * r, sv = Math.sin(th + 0.25 * Math.sin(Math.PI * t)) * r;
        pts.push([c[0] + u[0] * cu + v[0] * sv, c[1] + u[1] * cu + v[1] * sv, c[2] + u[2] * cu + v[2] * sv]);
      }
      m.line(pts, false);
    }
  }

  const TORSO = [
    // y, half width, half depth, forward offset
    [0.86, 0.128, 0.094, 0], [0.92, 0.165, 0.108, 0], [0.99, 0.172, 0.11, 0.002], [1.06, 0.158, 0.1, 0.006],
    [1.13, 0.143, 0.097, 0.01], [1.2, 0.148, 0.103, 0.014], [1.27, 0.162, 0.113, 0.02], [1.34, 0.17, 0.117, 0.022],
    [1.4, 0.178, 0.11, 0.014], [1.45, 0.186, 0.096, 0.002], [1.49, 0.14, 0.078, -0.004], [1.52, 0.075, 0.062, -0.004]
  ];

  function torso(m) {
    const n = 26, rings = [], last = TORSO[TORSO.length - 1][0];
    for (let y = TORSO[0][0]; y <= last + 1e-6; y += 0.03) {
      let i = 0;
      while (i < TORSO.length - 2 && TORSO[i + 1][0] < y) i++;
      const a = TORSO[i], b = TORSO[i + 1];
      let t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
      t = t * t * (3 - 2 * t);
      const ring = circle([0, y, lerp(a[3], b[3], t)], [1, 0, 0], [0, 0, 1], lerp(a[1], b[1], t), lerp(a[2], b[2], t), n);
      rings.push(ring);
      m.line(ring, true);
    }
    for (let j = 0; j < 10; j++) {
      const idx = Math.round((j * n) / 10) % n;
      m.line(rings.map((r) => r[idx]), false);
    }
  }

  function buildBody() {
    const m = new Mesh();
    torso(m);
    tube(m, [0, 1.51, -0.002], [0, 1.585, 0.004], 0.052, 0.047, 16, 0.025, 4); // neck
    ellipsoid(m, [0, 1.668, 0.006], [0.082, 0.112, 0.097], 12, 22, 8);         // head
    S.forEach((s) => {
      ellipsoid(m, [s * 0.198, 1.438, -0.002], [0.058, 0.05, 0.056], 5, 14, 0);  // shoulder
      tube(m, [s * 0.205, 1.43, -0.004], [s * 0.262, 1.17, 0], 0.048, 0.037, 14);  // upper arm
      tube(m, [s * 0.262, 1.17, 0], [s * 0.3, 0.925, 0.038], 0.036, 0.027, 12);    // forearm
      ellipsoid(m, [s * 0.311, 0.85, 0.05], [0.022, 0.066, 0.04], 6, 12, 4);       // hand
      tube(m, [s * 0.086, 0.9, 0], [s * 0.094, 0.5, 0.012], 0.08, 0.05, 16);       // thigh
      tube(m, [s * 0.094, 0.5, 0.012], [s * 0.098, 0.085, -0.012], 0.048, 0.03, 14); // shin
      ellipsoid(m, [s * 0.1, 0.036, 0.045], [0.04, 0.034, 0.105], 5, 14, 4);      // foot
    });
    return m.done();
  }

  function withLengths(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    return { pts, cum, total: cum[cum.length - 1] };
  }

  function pointOn(path, f) {
    const L = f * path.total;
    let i = 1;
    while (i < path.cum.length - 1 && path.cum[i] < L) i++;
    const t = (L - path.cum[i - 1]) / ((path.cum[i] - path.cum[i - 1]) || 1);
    return at(path.pts[i - 1], path.pts[i], clamp(t, 0, 1));
  }

  function buildOrgans() {
    const rnd = seeded(20261114);
    const O = {};
    let m;

    // Brain: mesh, midline fissure and neural "point cloud"
    m = new Mesh();
    ellipsoid(m, [0, 1.697, 0.002], [0.066, 0.055, 0.078], 7, 20, 6);
    const fissure = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; fissure.push([0, 1.697 + Math.sin(a) * 0.058, 0.002 - Math.cos(a) * 0.08]); }
    m.line(fissure, false);
    cloud(m, [0, 1.697, 0.002], [0.063, 0.052, 0.075], 170, rnd);
    O.brain = m.done();

    // Eyes and optic nerves
    m = new Mesh();
    S.forEach((s) => {
      const c = [s * 0.032, 1.648, 0.085];
      m.line(circle(c, [1, 0, 0], [0, 1, 0], 0.016, 0.011, 18), true);
      m.line(circle(c, [1, 0, 0], [0, 1, 0], 0.006, 0.006, 10), true);
      m.line([[s * 0.032, 1.648, 0.075], [s * 0.016, 1.66, 0.03], [0, 1.672, 0]], false);
    });
    O.eyes = m.done();

    // Lungs, trachea and bronchi
    m = new Mesh();
    S.forEach((s) => {
      ellipsoid(m, [s * 0.074, 1.325, 0.004], [0.058, 0.105, 0.062], 8, 16, 5);
      cloud(m, [s * 0.074, 1.325, 0.004], [0.054, 0.1, 0.058], 110, rnd);
      m.line([[0, 1.43, 0.012], [s * 0.04, 1.39, 0.01], [s * 0.07, 1.34, 0.008]], false);
    });
    m.line([[0, 1.5, 0.01], [0, 1.43, 0.012]], false);
    O.lungs = m.done();

    // Heart (it beats)
    m = new Mesh();
    ellipsoid(m, [0.03, 1.285, 0.036], [0.04, 0.048, 0.037], 7, 14, 5);
    cloud(m, [0.03, 1.285, 0.036], [0.036, 0.044, 0.034], 70, rnd);
    O.heart = m.done({ center: [0.03, 1.285, 0.036], beat: true });

    // Blood: main arteries, with flowing particles
    const paths = [[[0.03, 1.3, 0.03], [0.02, 1.36, 0.02], [0, 1.38, -0.01], [-0.005, 1.3, -0.035], [0, 1.1, -0.03], [0, 0.97, -0.01]]];
    S.forEach((s) => {
      paths.push([[0, 0.97, -0.01], [s * 0.07, 0.9, 0.02], [s * 0.092, 0.7, 0.03], [s * 0.096, 0.5, 0.025], [s * 0.098, 0.3, 0], [s * 0.1, 0.1, -0.005]]);
      paths.push([[0, 1.38, 0], [s * 0.1, 1.43, 0.005], [s * 0.2, 1.43, 0], [s * 0.262, 1.17, 0.015], [s * 0.3, 0.925, 0.045], [s * 0.311, 0.85, 0.055]]);
      paths.push([[s * 0.012, 1.4, 0.015], [s * 0.025, 1.52, 0.02], [s * 0.03, 1.6, 0.02]]);
    });
    m = new Mesh();
    paths.forEach((p) => m.line(p, false));
    O.blood = m.done({ paths: paths.map(withLengths) });

    // Digestion: stomach, small intestine and colon
    m = new Mesh();
    ellipsoid(m, [0.05, 1.165, 0.05], [0.05, 0.034, 0.035], 6, 14, 4);
    const snake = [];
    for (let r = 0; r < 7; r++) {
      const y = 1.105 - r * 0.022;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        snake.push([(r % 2 ? 1 - t : t) * 0.17 - 0.085, y + Math.sin(t * TAU * 2) * 0.006, 0.055 + Math.cos(t * TAU) * 0.012]);
      }
    }
    m.line(snake, false);
    m.line([[-0.1, 0.95, 0.04], [-0.105, 1.11, 0.045], [0.105, 1.11, 0.045], [0.1, 0.95, 0.04]], false);
    O.gut = m.done();

    // Kidneys (on the back) and ureters
    m = new Mesh();
    S.forEach((s) => {
      ellipsoid(m, [s * 0.066, 1.13, -0.055], [0.022, 0.044, 0.02], 6, 12, 4);
      cloud(m, [s * 0.066, 1.13, -0.055], [0.02, 0.04, 0.018], 40, rnd);
      m.line([[s * 0.05, 1.12, -0.05], [s * 0.03, 1.05, -0.03], [s * 0.02, 0.92, 0.03]], false);
    });
    O.kidneys = m.done();

    // Skeleton: spine, ribs, clavicles, pelvis and long bones
    m = new Mesh();
    const spine = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; spine.push([0, lerp(1.56, 0.97, t), -0.05 + 0.018 * Math.sin(t * TAU * 0.9)]); }
    m.line(spine, false);
    spine.forEach((p) => m.line(circle(p, [1, 0, 0], [0, 0, 1], 0.014, 0.011, 8), true));
    for (let i = 0; i < 7; i++) {
      const y = 1.42 - i * 0.032, rx = 0.12 + i * 0.008 - (i > 4 ? (i - 4) * 0.012 : 0), rz = 0.085 + i * 0.003;
      S.forEach((s) => {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const a = lerp(0.12, 2.5, k / 12); pts.push([s * Math.sin(a) * rx, y - 0.025 * Math.sin(a / 2), 0.012 - Math.cos(a) * rz]); }
        m.line(pts, false);
      });
    }
    m.line([[0, 1.43, 0.11], [0, 1.24, 0.12]], false);
    m.line(circle([0, 0.96, 0], [1, 0, 0], [0, 0, 1], 0.125, 0.075, 22), true);
    m.line(circle([0, 0.9, 0.01], [1, 0, 0], [0, 0, 1], 0.085, 0.055, 18), true);
    S.forEach((s) => {
      m.line([[s * 0.01, 1.47, 0.07], [s * 0.1, 1.475, 0.04], [s * 0.19, 1.46, 0]], false);
      m.line([[s * 0.2, 1.44, 0], [s * 0.262, 1.17, 0]], false);
      m.line([[s * 0.262, 1.17, 0], [s * 0.296, 0.925, 0.032]], false);
      m.line([[s * 0.268, 1.165, 0.008], [s * 0.306, 0.925, 0.046]], false);
      m.line([[s * 0.1, 0.93, 0], [s * 0.094, 0.5, 0.012]], false);
      m.line([[s * 0.094, 0.5, 0.012], [s * 0.098, 0.09, -0.01]], false);
      m.line(circle([s * 0.095, 0.5, 0.014], [1, 0, 0], [0, 1, 0], 0.02, 0.02, 10), true);
    });
    O.bones = m.done();

    // Muscles: fibres on thighs, calves, upper arms and chest
    m = new Mesh();
    S.forEach((s) => {
      fibers(m, [s * 0.086, 0.9, 0], [s * 0.094, 0.5, 0.012], 0.08, 0.05, 7);
      fibers(m, [s * 0.094, 0.5, 0.012], [s * 0.098, 0.085, -0.012], 0.048, 0.03, 5, true);
      fibers(m, [s * 0.205, 1.43, -0.004], [s * 0.262, 1.17, 0], 0.048, 0.037, 5);
      for (let i = 0; i < 4; i++) {
        const pts = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([s * lerp(0.02, 0.17, t), 1.42 - i * 0.03 - 0.05 * Math.sin(Math.PI * t), 0.125 - 0.04 * t * t]); }
        m.line(pts, false);
      }
    });
    O.muscles = m.done();
    return O;
  }

  /* Where each region's marker sits, and where the camera goes to zoom in on it */
  const ANCHOR = {
    brain: [0, 1.72, 0.03], eyes: [0, 1.648, 0.095], lungs: [-0.078, 1.34, 0.065], heart: [0.03, 1.29, 0.075],
    blood: [0.27, 1.12, 0.04], gut: [0, 1.05, 0.08], kidneys: [0.066, 1.13, -0.08], bones: [-0.105, 0.93, 0.05],
    muscles: [0.1, 0.7, 0.085], skin: [-0.24, 1.36, 0.045]
  };
  const FOCUS = {
    brain: { t: [0, 1.69, 0], d: 0.62, yaw: 0.45, pitch: 0.12 },
    eyes: { t: [0, 1.65, 0.05], d: 0.5, yaw: 0, pitch: 0.04 },
    lungs: { t: [0, 1.32, 0], d: 0.95, yaw: 0.3, pitch: 0.06 },
    heart: { t: [0.03, 1.29, 0.03], d: 0.62, yaw: -0.35, pitch: 0.05 },
    blood: { t: [0.1, 1.12, 0], d: 1.55, yaw: 0.25, pitch: 0.06 },
    gut: { t: [0.01, 1.07, 0.03], d: 0.8, yaw: 0.25, pitch: 0.1 },
    kidneys: { t: [0, 1.12, -0.05], d: 0.82, yaw: Math.PI - 0.35, pitch: 0.08 },
    bones: { t: [0, 1, 0], d: 1.95, yaw: 0.55, pitch: 0.05 },
    muscles: { t: [0.09, 0.62, 0.01], d: 1.05, yaw: -0.4, pitch: 0.05 },
    skin: { t: [0, 1.2, 0], d: 1.55, yaw: 0.7, pitch: 0.06 }
  };

  /* ============================================================== Engine */
  const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  V.createHolo = function createHolo() {
    const body = buildBody();
    const organs = buildOrgans();
    const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    // DOM: the root is created once and moved into each new render of the Body view
    const root = el('div', 'holo');
    const canvas = el('canvas');
    canvas.setAttribute('role', 'img');
    const overlay = el('div', 'holo-overlay');
    const tag = el('div', 'holo-tag');
    tag.hidden = true;
    const hud = el('div', 'holo-hud', '<span class="holo-title"></span><span class="holo-zoom"></span>');
    const hint = el('p', 'holo-hint');
    const tools = el('div', 'holo-tools');
    const btnL = el('button', 'holo-btn', '&#10226;');
    const btnR = el('button', 'holo-btn', '&#10227;');
    const btnReset = el('button', 'holo-btn holo-reset');
    [btnL, btnR, btnReset].forEach((b) => { b.type = 'button'; tools.appendChild(b); });
    ['tl', 'tr', 'bl', 'br'].forEach((c) => root.appendChild(el('span', 'holo-corner ' + c)));
    root.append(canvas, overlay, tag, hud, hint, tools);
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0, dpr = 1;
    const cam = { yaw: 0.35, pitch: 0.06, d: 2.2, t: [0, 0.93, 0] };
    let anim = null, focused = null, selected = null, levels = {}, names = {}, hs = {};
    let running = false, raf = 0, last = 0, time = 0, holdUntil = 0, drag = null, zoomText = '', tagW = 0, tagH = 0;
    const C = {};

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const get = (n, f) => cs.getPropertyValue(n).trim() || f;
      C.accent = get('--accent', '#4cc9f0');
      C.ok = get('--ok', '#34d399');
      C.watch = get('--watch', '#fbbf24');
      C.crit = get('--crit', '#f87171');
      C.none = '#8ea3c4';
    }
    const colorOf = (id) => C[levels[id]] || C.none;

    const fitD = () => Math.max(2.05, (0.78 * H) / Math.max(1, W));
    const fullView = () => ({ t: [0, 0.93, 0], d: fitD(), yaw: cam.yaw, pitch: 0.06 });

    function resize() {
      const w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = w; H = h;
      tagW = 0;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!focused && !anim) cam.d = fitD();
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', resize);

    /* ---------------------------------------------------- Projection */
    let f = 1, cx = 0, cy = 0, cyw = 1, syw = 0, cp = 1, sp = 0, tx = 0, ty = 0, tz = 0, dist = 2;
    function setupCamera() {
      f = H * 0.9; cx = W / 2; cy = H / 2;
      cyw = Math.cos(cam.yaw); syw = Math.sin(cam.yaw);
      cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch);
      tx = cam.t[0]; ty = cam.t[1]; tz = cam.t[2]; dist = cam.d;
    }
    // Writes screen x, y and depth (towards the camera, relative to the target) into out[i..i+2]
    function project(x, y, z, out, i) {
      x -= tx; y -= ty; z -= tz;
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const zc = dist - z2;
      if (zc < 0.05) { out[i] = NaN; return; }
      const k = f / zc;
      out[i] = cx + x1 * k; out[i + 1] = cy - y2 * k; out[i + 2] = z2;
    }

    const ALPHA = [0.16, 0.36, 0.64, 1];
    const bucket = (z) => (z > 0.05 ? 3 : z > -0.005 ? 2 : z > -0.07 ? 1 : 0);

    function drawMesh(mesh, color, alpha, width, scaleAt, k) {
      const vs = mesh.verts, P = mesh.P, n = vs.length;
      for (let i = 0; i < n; i += 3) {
        let x = vs[i], y = vs[i + 1], z = vs[i + 2];
        if (scaleAt) { x = scaleAt[0] + (x - scaleAt[0]) * k; y = scaleAt[1] + (y - scaleAt[1]) * k; z = scaleAt[2] + (z - scaleAt[2]) * k; }
        project(x, y, z, P, i);
      }
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const sg = mesh.segs;
      for (let s = 0; s < sg.length; s += 2) {
        const a = sg[s] * 3, b = sg[s + 1] * 3;
        if (P[a] !== P[a] || P[b] !== P[b]) continue; // NaN: behind the camera
        const p = paths[bucket((P[a + 2] + P[b + 2]) / 2)];
        p.moveTo(P[a], P[a + 1]);
        p.lineTo(P[b], P[b + 1]);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 3.4;
      for (let q = 0; q < 4; q++) { ctx.globalAlpha = ALPHA[q] * alpha * 0.13; ctx.stroke(paths[q]); }
      ctx.lineWidth = width;
      for (let q = 0; q < 4; q++) { ctx.globalAlpha = ALPHA[q] * alpha; ctx.stroke(paths[q]); }
      const ds = mesh.dots;
      if (ds.length) {
        const Q = mesh.Q, sz = width + 0.6;
        ctx.fillStyle = color;
        for (let i = 0; i < ds.length; i += 3) {
          let x = ds[i], y = ds[i + 1], z = ds[i + 2];
          if (scaleAt) { x = scaleAt[0] + (x - scaleAt[0]) * k; y = scaleAt[1] + (y - scaleAt[1]) * k; z = scaleAt[2] + (z - scaleAt[2]) * k; }
          project(x, y, z, Q, i);
          if (Q[i] !== Q[i]) continue;
          ctx.globalAlpha = ALPHA[bucket(Q[i + 2])] * alpha * 0.9;
          ctx.fillRect(Q[i] - sz / 2, Q[i + 1] - sz / 2, sz, sz);
        }
      }
    }

    const tmp = new Float32Array(3);
    function ellipseAt(y, rx, rz, n, color, alpha, width, rot) {
      const p = new Path2D();
      let first = true;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU + (rot || 0);
        project(Math.cos(a) * rx, y, Math.sin(a) * rz, tmp, 0);
        if (tmp[0] !== tmp[0]) { first = true; continue; }
        if (first) { p.moveTo(tmp[0], tmp[1]); first = false; } else p.lineTo(tmp[0], tmp[1]);
      }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
      ctx.stroke(p);
    }

    function drawBase() {
      ellipseAt(-0.004, 0.26, 0.26, 48, C.accent, 0.55, 1.2);
      ellipseAt(-0.004, 0.38, 0.38, 56, C.accent, 0.32, 1);
      ellipseAt(-0.004, 0.52, 0.52, 64, C.accent, 0.18, 1);
      const p = new Path2D(), rot = reduce.matches ? 0 : time * 0.25;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU + rot, r0 = i % 3 ? 0.53 : 0.5;
        project(Math.cos(a) * r0, -0.004, Math.sin(a) * r0, tmp, 0);
        if (tmp[0] !== tmp[0]) continue;
        const x0 = tmp[0], y0 = tmp[1];
        project(Math.cos(a) * 0.57, -0.004, Math.sin(a) * 0.57, tmp, 0);
        if (tmp[0] !== tmp[0]) continue;
        p.moveTo(x0, y0); p.lineTo(tmp[0], tmp[1]);
      }
      ctx.strokeStyle = C.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.stroke(p);
    }

    function organAlpha(id) {
      if (focused) return focused === id ? 1 : 0.22;
      return selected === id ? 0.95 : 0.62;
    }

    function draw() {
      if (!W || !H) return;
      setupCamera();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawBase();

      // Organs, in their status colors
      Object.keys(organs).forEach((id) => {
        const o = organs[id];
        let k = 1;
        if (o.beat && !reduce.matches) k = 1 + 0.07 * Math.pow(Math.max(0, Math.sin(time * TAU * 1.1)), 6);
        drawMesh(o, colorOf(id), organAlpha(id), focused === id ? 1.6 : 1.1, o.beat ? o.center : null, k);
      });

      // Blood flow
      const bp = organs.blood.paths, ba = organAlpha('blood'), bcol = colorOf('blood');
      ctx.fillStyle = bcol;
      bp.forEach((path, pi) => {
        for (let j = 0; j < 3; j++) {
          const fr = ((reduce.matches ? 0 : time * 0.22) + j / 3 + pi * 0.137) % 1;
          const p = pointOn(path, fr);
          project(p[0], p[1], p[2], tmp, 0);
          if (tmp[0] !== tmp[0]) continue;
          ctx.globalAlpha = ALPHA[bucket(tmp[2])] * ba;
          ctx.beginPath();
          ctx.arc(tmp[0], tmp[1], focused === 'blood' ? 2.6 : 1.8, 0, TAU);
          ctx.fill();
        }
      });

      // Skin and body outline
      const skinFocus = focused === 'skin';
      drawMesh(body, skinFocus ? colorOf('skin') : C.accent, focused ? (skinFocus ? 1 : 0.4) : 0.85, skinFocus ? 1.25 : 1, null, 1);

      // Scanning plane
      if (!reduce.matches) {
        const y = 0.06 + (0.5 - 0.5 * Math.cos(time * 0.55)) * 1.72;
        ellipseAt(y, 0.34, 0.2, 60, C.accent, 0.5, 1.3, time);
        ellipseAt(y, 0.37, 0.22, 60, C.accent, 0.14, 4, time);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      placeMarkers();
    }

    function placeMarkers() {
      Object.keys(hs).forEach((id) => {
        const a = ANCHOR[id], b = hs[id];
        if (!a) return;
        project(a[0], a[1], a[2], tmp, 0);
        if (tmp[0] !== tmp[0] || tmp[0] < -20 || tmp[0] > W + 20 || tmp[1] < -20 || tmp[1] > H + 20) { b.style.visibility = 'hidden'; return; }
        b.style.visibility = '';
        b.style.transform = `translate3d(${tmp[0].toFixed(1)}px, ${tmp[1].toFixed(1)}px, 0)`;
        b.classList.toggle('behind', tmp[2] < -0.03 && id !== focused);
        if (id === focused) {
          // Label next to the marker, kept inside the stage
          if (!tagW) { tagW = tag.offsetWidth; tagH = tag.offsetHeight; }
          let x = tmp[0] + 22;
          if (x + tagW > W - 10) x = tmp[0] - 22 - tagW;
          x = clamp(x, 10, Math.max(10, W - tagW - 10));
          const y = clamp(tmp[1] - tagH / 2, 52, Math.max(52, H - tagH - 56));
          tag.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }
      });
      const z = `ZOOM ×${(fitD() / cam.d).toFixed(1)}`;
      if (z !== zoomText) { zoomText = z; hud.lastChild.textContent = z; }
    }

    /* -------------------------------------------------------- Loop */
    function frame(now) {
      if (!running) return;
      if (!root.isConnected) { running = false; return; }
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      time += dt;
      if (anim) {
        const k = clamp((now - anim.start) / anim.dur, 0, 1), e = ease(k), a = anim.from, b = anim.to;
        cam.yaw = lerp(a.yaw, b.yaw, e);
        cam.pitch = lerp(a.pitch, b.pitch, e);
        cam.d = lerp(a.d, b.d, e);
        cam.t = [lerp(a.t[0], b.t[0], e), lerp(a.t[1], b.t[1], e), lerp(a.t[2], b.t[2], e)];
        if (k >= 1) anim = null;
      } else if (!focused && !drag && !reduce.matches && now > holdUntil) {
        cam.yaw += dt * 0.22; // slow turntable
      }
      draw();
    }

    function start() {
      if (running || !root.isConnected || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

    function flyTo(view) {
      const to = { t: view.t.slice(), d: view.d, pitch: view.pitch, yaw: cam.yaw + wrap(view.yaw - cam.yaw) };
      if (reduce.matches) {
        Object.assign(cam, { t: to.t, d: to.d, pitch: to.pitch, yaw: to.yaw });
        anim = null;
        draw();
      } else {
        anim = { from: { t: cam.t.slice(), d: cam.d, pitch: cam.pitch, yaw: cam.yaw }, to, start: performance.now(), dur: 1100 };
      }
    }

    function markSelected() {
      Object.keys(hs).forEach((id) => {
        hs[id].classList.toggle('selected', id === selected);
        hs[id].setAttribute('aria-pressed', String(id === selected));
      });
      btnReset.hidden = !focused;
      tagW = 0;
      if (focused && names[focused]) {
        tag.hidden = false;
        tag.style.setProperty('--lv', `var(--${levels[focused] || 'none'})`);
        tag.innerHTML = `${escHtml(names[focused].name)}<small>${escHtml(names[focused].levelText)}</small>`;
      } else tag.hidden = true;
    }

    /* ------------------------------------------------- Interaction */
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, id: e.pointerId };
      anim = null;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      cam.yaw = drag.yaw + (e.clientX - drag.x) * 0.009;
      cam.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.004, -0.35, 0.5);
      if (reduce.matches) draw();
    });
    const endDrag = () => { if (drag) { drag = null; holdUntil = performance.now() + 4000; } };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    btnL.addEventListener('click', () => { holdUntil = performance.now() + 4000; flyTo({ t: cam.t, d: cam.d, pitch: cam.pitch, yaw: cam.yaw - Math.PI / 4 }); });
    btnR.addEventListener('click', () => { holdUntil = performance.now() + 4000; flyTo({ t: cam.t, d: cam.d, pitch: cam.pitch, yaw: cam.yaw + Math.PI / 4 }); });
    btnReset.addEventListener('click', () => api.reset());

    const api = {
      /* (Re)attaches the hologram to the Body view. Keeps the camera where it was. */
      mount(container, opts) {
        readColors();
        levels = {}; names = {}; hs = {};
        selected = opts.selected || null;
        overlay.innerHTML = '';
        (opts.regions || []).forEach((r) => {
          levels[r.id] = r.level;
          names[r.id] = r;
          const b = el('button', `holo-hs lvl-${r.level}`, '<span class="holo-hs-ring"></span><span class="holo-hs-dot"></span>');
          b.type = 'button';
          b.dataset.region = r.id;
          b.setAttribute('aria-label', `${r.name}: ${r.levelText}`);
          b.title = `${r.name} · ${r.levelText}`;
          overlay.appendChild(b);
          hs[r.id] = b;
        });
        const t = opts.texts || {};
        canvas.setAttribute('aria-label', t.canvas || '');
        hud.firstChild.textContent = t.title || '';
        hint.textContent = t.hint || '';
        btnReset.textContent = t.reset || 'Reset';
        btnL.title = t.left || ''; btnL.setAttribute('aria-label', t.left || '');
        btnR.title = t.right || ''; btnR.setAttribute('aria-label', t.right || '');
        markSelected();
        if (root.parentNode !== container) container.appendChild(root);
        resize();
        draw();
        start();
      },
      /* Zooms in on a region */
      focus(id) {
        if (!FOCUS[id]) return;
        focused = id;
        selected = id;
        markSelected();
        flyTo(FOCUS[id]);
        start();
      },
      /* Back to the whole body */
      reset() {
        focused = null;
        markSelected();
        flyTo(fullView());
      },
      pause: stop,
      get focused() { return focused; }
    };
    return api;
  };
})();
