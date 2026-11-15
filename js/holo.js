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
    constructor() { this.v = []; this.n = []; this.s = []; this.d = []; this.f = []; }
    // Polyline; `normals` (one per point, or a single shared one) enables rim lighting
    line(pts, closed, normals) {
      const base = this.v.length / 3;
      pts.forEach((p, i) => {
        this.v.push(p[0], p[1], p[2]);
        if (normals) { const q = Array.isArray(normals[0]) ? normals[i] : normals; this.n.push(q[0], q[1], q[2]); }
      });
      for (let i = 0; i < pts.length - 1; i++) this.s.push(base + i, base + i + 1);
      if (closed && pts.length > 2) this.s.push(base + pts.length - 1, base);
      return base;
    }
    fill(base, count) { this.f.push(base, count); }
    dots(pts) { pts.forEach((p) => this.d.push(p[0], p[1], p[2])); return this; }
    done(extra) {
      const m = Object.assign({
        verts: new Float32Array(this.v), segs: new Uint32Array(this.s), dots: new Float32Array(this.d),
        norms: this.n.length ? new Float32Array(this.n) : null, fills: new Uint32Array(this.f)
      }, extra || {});
      m.P = new Float32Array(m.verts.length);     // projected vertices (x, y, depth)
      m.Q = new Float32Array(m.dots.length);      // projected dots
      m.SH = new Float32Array(m.verts.length / 3); // rim-light shade per vertex
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

  /* ---------------------------------------------- Anatomical body surface */
  const gauss = (d, w) => Math.exp(-(d * d) / (w * w));

  // Interpolates a table of rows [key, ...values] at `key` (smooth between rows)
  function rowAt(rows, key) {
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] < key) i++;
    const a = rows[i], b = rows[i + 1];
    let t = clamp((key - a[0]) / (b[0] - a[0]), 0, 1);
    t = t * t * (3 - 2 * t);
    return a.map((v, k) => lerp(v, b[k], t));
  }

  // Cross-section: a superellipse with its own front and back depth, plus radial bumps
  // (muscles, bones). Angle 0 points along `lat`, PI/2 along `fwd` (the front).
  function section(c, lat, fwd, rl, rf, rb, e, bumps, n) {
    const pts = [], k = 2 / e;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU, co = Math.cos(th), si = Math.sin(th);
      let bx = Math.sign(co) * Math.pow(Math.abs(co), k) * rl;
      let bz = Math.sign(si) * Math.pow(Math.abs(si), k) * (si >= 0 ? rf : rb);
      let b = 0;
      if (bumps) for (let j = 0; j < bumps.length; j++) b += bumps[j][2] * gauss(wrap(th - bumps[j][0]), bumps[j][1]);
      if (b) { const l = Math.hypot(bx, bz) || 1; bx += (bx / l) * b; bz += (bz / l) * b; }
      pts.push([c[0] + lat[0] * bx + fwd[0] * bz, c[1] + lat[1] * bx + fwd[1] * bz, c[2] + lat[2] * bx + fwd[2] * bz]);
    }
    return pts;
  }

  // Surface through a stack of sections: every ring, every `mstep`-th lengthwise line,
  // per-vertex normals (for rim lighting) and translucent ring fills (for volume)
  function loft(m, rings, mstep) {
    const R = rings.length, n = rings[0].length;
    const centers = rings.map((r) => {
      const c = [0, 0, 0];
      r.forEach((p) => { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n; });
      return c;
    });
    const normals = rings.map((ring, i) => ring.map((p, j) => {
      const tr = sub(ring[(j + 1) % n], ring[(j - 1 + n) % n]);
      const tl = sub(rings[Math.min(R - 1, i + 1)][j], rings[Math.max(0, i - 1)][j]);
      const out = sub(p, centers[i]);
      let nv = cross(tr, tl);
      if (Math.hypot(nv[0], nv[1], nv[2]) < 1e-12) nv = out;
      nv = norm(nv);
      return nv[0] * out[0] + nv[1] * out[1] + nv[2] * out[2] < 0 ? [-nv[0], -nv[1], -nv[2]] : nv;
    }));
    rings.forEach((r, i) => {
      const base = m.line(r, true, normals[i]);
      if (i % 2 === 0) m.fill(base, n);
    });
    for (let j = 0; j < n; j += mstep) m.line(rings.map((r) => r[j]), false, normals.map((nr) => nr[j]));
  }

  // Smooth curve through control points (Catmull-Rom), with arc-length lookup
  function curve(ctrl) {
    const pts = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = 0; k < 20; k++) {
        const t = k / 20, t2 = t * t, t3 = t2 * t;
        pts.push([0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    pts.push(ctrl[ctrl.length - 1].slice());
    return withLengths(pts);
  }

  // Limb: sections swept along a curve; prof(u) gives [lateral, front, back, bumps]
  function sweep(m, ctrl, prof, opts = {}) {
    const path = curve(ctrl), n = opts.n || 16, e = opts.e || 2;
    const K = Math.max(3, Math.round(path.total / (opts.step || 0.02)));
    const rings = [];
    for (let k = 0; k <= K; k++) {
      const u = k / K, p = pointOn(path, u);
      const tan = norm(sub(pointOn(path, Math.min(1, u + 0.01)), pointOn(path, Math.max(0, u - 0.01))));
      let lat = cross(tan, [0, 0, 1]);
      if (Math.hypot(lat[0], lat[1], lat[2]) < 1e-3) lat = cross(tan, [1, 0, 0]);
      lat = norm(lat);
      const fwd = norm(cross(lat, tan)), r = prof(u);
      rings.push(section(p, lat, fwd, r[0], r[1], r[2], e, r[3], n));
    }
    loft(m, rings, opts.mstep || 2);
  }

  // Torso rows: y, half width, front depth, back depth, forward offset, pectorals, glutes, shoulder blades, spine groove
  const TORSO = [
    [0.84, 0.1, 0.065, 0.07, 0, 0, 0, 0, 0],
    [0.88, 0.15, 0.08, 0.095, 0, 0, 0.018, 0, 0.004],
    [0.93, 0.172, 0.088, 0.104, 0, 0, 0.026, 0, 0.006],
    [0.98, 0.172, 0.088, 0.1, 0, 0, 0.018, 0, 0.006],
    [1.04, 0.158, 0.088, 0.088, 0, 0, 0.004, 0, 0.006],
    [1.1, 0.146, 0.088, 0.08, 0, 0, 0, 0, 0.007],
    [1.15, 0.14, 0.088, 0.078, 0, 0, 0, 0, 0.007],
    [1.21, 0.146, 0.094, 0.082, 0, 0.002, 0, 0.002, 0.007],
    [1.27, 0.158, 0.1, 0.088, 0, 0.012, 0, 0.006, 0.007],
    [1.33, 0.168, 0.104, 0.094, 0, 0.018, 0, 0.012, 0.007],
    [1.39, 0.176, 0.098, 0.096, 0, 0.012, 0, 0.014, 0.006],
    [1.435, 0.19, 0.082, 0.088, -0.004, 0.002, 0, 0.01, 0.005],
    [1.47, 0.176, 0.068, 0.076, -0.008, 0, 0, 0.004, 0.004],
    [1.495, 0.14, 0.06, 0.07, -0.01, 0, 0, 0, 0.002],
    [1.515, 0.095, 0.056, 0.064, -0.012, 0, 0, 0, 0],
    [1.53, 0.06, 0.055, 0.057, -0.013, 0, 0, 0, 0]
  ];
  // Head rows: y, half width, front depth, back depth, forward offset, nose, brow, eye sockets
  const HEAD = [
    [1.552, 0.022, 0.012, 0.012, 0.07, 0, 0, 0],
    [1.565, 0.035, 0.02, 0.035, 0.06, 0, 0, 0],
    [1.58, 0.048, 0.025, 0.06, 0.05, 0, 0, 0],
    [1.595, 0.058, 0.03, 0.075, 0.045, 0.002, 0, 0],
    [1.615, 0.066, 0.035, 0.09, 0.04, 0.012, 0, 0],
    [1.635, 0.071, 0.042, 0.1, 0.035, 0.022, 0, 0.002],
    [1.655, 0.074, 0.05, 0.105, 0.03, 0.012, 0, 0.007],
    [1.675, 0.075, 0.055, 0.108, 0.025, 0.004, 0.005, 0.002],
    [1.7, 0.075, 0.058, 0.108, 0.02, 0, 0.001, 0],
    [1.725, 0.071, 0.055, 0.103, 0.015, 0, 0, 0],
    [1.75, 0.062, 0.046, 0.09, 0.01, 0, 0, 0],
    [1.768, 0.047, 0.034, 0.07, 0.005, 0, 0, 0],
    [1.78, 0.024, 0.018, 0.036, 0.005, 0, 0, 0],
    [1.785, 0.005, 0.004, 0.006, 0.005, 0, 0, 0]
  ];
  // Limb profiles: u along the limb (0 = top), lateral, front, back.
  // The arm starts inside the torso with a rounded deltoid cap; at the wrist it matches the hand.
  const ARM = [
    [0, 0.03, 0.034, 0.036], [0.05, 0.046, 0.046, 0.048], [0.1, 0.052, 0.05, 0.052], [0.17, 0.053, 0.049, 0.05],
    [0.25, 0.046, 0.044, 0.045], [0.36, 0.041, 0.044, 0.042], [0.48, 0.037, 0.036, 0.039], [0.565, 0.035, 0.031, 0.035],
    [0.62, 0.038, 0.035, 0.034], [0.74, 0.033, 0.03, 0.029], [0.88, 0.024, 0.025, 0.024], [1, 0.019, 0.024, 0.024]
  ];
  const LEG = [
    [0, 0.08, 0.085, 0.09], [0.1, 0.082, 0.083, 0.084], [0.25, 0.072, 0.077, 0.07], [0.4, 0.06, 0.064, 0.058],
    [0.48, 0.05, 0.052, 0.048], [0.52, 0.048, 0.055, 0.046], [0.58, 0.046, 0.044, 0.05], [0.66, 0.047, 0.04, 0.062],
    [0.75, 0.042, 0.036, 0.052], [0.86, 0.034, 0.031, 0.036], [0.95, 0.03, 0.028, 0.03], [1, 0.03, 0.028, 0.03]
  ];
  // Foot rows: z, x, y, half width, top height, sole depth
  const FOOT = [
    [-0.05, 0.1, 0.035, 0.022, 0.03, 0.03], [-0.035, 0.1, 0.038, 0.03, 0.036, 0.034], [0, 0.1, 0.045, 0.036, 0.042, 0.04],
    [0.04, 0.102, 0.04, 0.04, 0.036, 0.034], [0.08, 0.104, 0.03, 0.043, 0.026, 0.026], [0.12, 0.106, 0.022, 0.044, 0.016, 0.018],
    [0.15, 0.106, 0.017, 0.04, 0.011, 0.013], [0.17, 0.105, 0.014, 0.03, 0.008, 0.01], [0.178, 0.105, 0.013, 0.012, 0.004, 0.006]
  ];
  // Joint positions shared by the skin, skeleton, vessels and muscles
  const J = (s) => ({
    shoulder: [s * 0.19, 1.445, -0.008], elbow: [s * 0.252, 1.17, -0.012], wrist: [s * 0.293, 0.93, 0.03],
    hip: [s * 0.09, 0.93, 0], knee: [s * 0.095, 0.5, 0.012], ankle: [s * 0.1, 0.08, -0.012]
  });
  // Depth of the front of the chest at (x, y), so muscles can sit just under the skin
  function chestZ(x, y) {
    const r = rowAt(TORSO, y), q = Math.min(0.999, Math.abs(x) / r[1]);
    return r[4] + Math.pow(1 - Math.pow(q, 2.5), 0.4) * (r[2] + r[5]);
  }

  function buildBody() {
    const m = new Mesh();
    const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

    // Torso: chest, back, waist and hips
    let rings = [];
    for (let y = TORSO[0][0]; y <= 1.53 + 1e-6; y += 0.022) {
      const r = rowAt(TORSO, y), h = Math.PI / 2;
      rings.push(section([0, y, r[4]], X, Z, r[1], r[2], r[3], 2.5, [
        [h - 0.5, 0.42, r[5]], [h + 0.5, 0.42, r[5]], [-h - 0.55, 0.5, r[6]], [-h + 0.55, 0.5, r[6]],
        [-h - 0.75, 0.45, r[7]], [-h + 0.75, 0.45, r[7]], [-h, 0.12, -r[8]]
      ], 32));
    }
    loft(m, rings, 2);

    // Neck: its rings tilt towards the top, so it meets the jaw in front and the skull behind
    rings = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, a = 0.62 * Math.pow(t, 1.6), q = t * t;
      rings.push(section([0, lerp(1.472, 1.612, t), lerp(-0.012, -0.016, t)], X, [0, -Math.sin(a), Math.cos(a)],
        lerp(0.06, 0.052, t), lerp(0.054, 0.068, q), lerp(0.058, 0.068, q), 2, null, 20));
    }
    loft(m, rings, 2);

    // Head: jaw, chin, nose, brow, eye sockets and skull
    rings = [];
    for (let y = HEAD[0][0]; y <= 1.785 + 1e-6; y += 0.011) {
      const r = rowAt(HEAD, y), h = Math.PI / 2;
      rings.push(section([0, y, r[4]], X, Z, r[1], r[2], r[3], 2.2, [
        [h, 0.16, r[5]], [h - 0.45, 0.3, r[6]], [h + 0.45, 0.3, r[6]], [h - 0.42, 0.16, -r[7]], [h + 0.42, 0.16, -r[7]]
      ], 28));
    }
    loft(m, rings, 2);

    // Face details and ears: a separate, brighter mesh so the face reads clearly
    const dm = new Mesh();
    const mouth = [], browL = [], browR = [];
    for (let i = 0; i <= 10; i++) {
      const x = lerp(-0.022, 0.022, i / 10);
      mouth.push([x, 1.597 + 0.0025 * Math.cos((x / 0.022) * Math.PI / 2), 0.074 - x * x * 6]);
      const bx = lerp(0.012, 0.05, i / 10);
      browL.push([bx, 1.674 + 0.004 * Math.sin((i / 10) * Math.PI), 0.081 - bx * bx * 7]);
      browR.push([-bx, 1.674 + 0.004 * Math.sin((i / 10) * Math.PI), 0.081 - bx * bx * 7]);
    }
    [mouth, browL, browR].forEach((l) => dm.line(l, false));
    dm.line(mouth.map((p) => [p[0] * 0.8, p[1] - 0.006 - 0.003 * Math.cos((p[0] / 0.022) * Math.PI / 2), p[2] - 0.002]), false); // lower lip
    dm.line([[0, 1.672, 0.083], [0, 1.65, 0.092], [0, 1.632, 0.1], [0, 1.621, 0.09]], false); // nose
    S.forEach((s) => {
      dm.line([[0, 1.621, 0.09], [s * 0.012, 1.622, 0.085], [s * 0.017, 1.628, 0.08]], false); // nostril
      dm.line([[s * 0.072, 1.625, -0.006], [s * 0.062, 1.588, 0.018], [s * 0.034, 1.562, 0.058], [0, 1.553, 0.074]], false); // jaw
      dm.line([[s * 0.058, 1.645, 0.06], [s * 0.066, 1.628, 0.045]], false); // cheekbone
      const ear = [], inner = [];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        ear.push([s * 0.075, 1.65 + Math.sin(a) * 0.03, -0.012 + Math.cos(a) * 0.016 * (Math.sin(a) > 0 ? 1 : 0.8)]);
        inner.push([s * 0.077, 1.652 + Math.sin(a) * 0.017, -0.012 + Math.cos(a) * 0.008]);
      }
      dm.line(ear, true);
      dm.line(inner, true);
    });

    S.forEach((s) => {
      const j = J(s);
      // Arm: deltoid cap (from inside the torso), biceps and triceps, elbow, forearm, wrist
      sweep(m, [[s * 0.14, 1.452, -0.01], [s * 0.19, 1.418, -0.01], j.elbow, j.wrist], (u) => rowAt(ARM, u).slice(1), { n: 18, step: 0.018 });

      // Hand: palm facing the thigh, four fingers and a thumb; it starts inside the wrist
      rings = [];
      [[0.945, 0, 0.019, 0.024, 0.024], [0.905, 0.003, 0.0175, 0.034, 0.03], [0.875, 0.005, 0.016, 0.04, 0.036],
        [0.85, 0.005, 0.013, 0.042, 0.038], [0.838, 0.005, 0.011, 0.04, 0.036]].forEach((r, i, all) => {
        if (i === 0) return;
        const a = all[i - 1];
        for (let k = 0; k < 3; k++) {
          const t = k / 3, row = a.map((v, q) => lerp(v, r[q], t));
          rings.push(section([s * (0.293 + row[1]), row[0], 0.032], X, Z, row[2], row[3], row[4], 3, null, 14));
        }
      });
      loft(m, rings, 2);
      [[-0.028, 0.058, 0.0075], [-0.009, 0.07, 0.0085], [0.01, 0.076, 0.009], [0.028, 0.07, 0.0085]].forEach(([dz, L, r]) => {
        const z = 0.032 + dz, x0 = s * 0.298;
        sweep(m, [[x0, 0.852, z], [x0 - s * 0.004, 0.847 - L * 0.5, z + 0.003], [x0 - s * 0.012, 0.842 - L, z + 0.004]],
          (u) => [r * (1 - 0.25 * u), r * (1 - 0.25 * u), r * (1 - 0.25 * u)], { n: 8, step: 0.012, mstep: 4 });
      });
      sweep(m, [[s * 0.291, 0.918, 0.048], [s * 0.285, 0.88, 0.074], [s * 0.278, 0.852, 0.083]],
        (u) => [0.011 * (1 - 0.25 * u), 0.011 * (1 - 0.25 * u), 0.011 * (1 - 0.25 * u)], { n: 8, step: 0.012, mstep: 4 });

      // Leg: thigh with quadriceps, kneecap, calf, ankle; it ends inside the foot
      sweep(m, [j.hip, j.knee, j.ankle, [s * 0.1, 0.045, 0.004]], (u) => rowAt(LEG, Math.min(1, u * 1.04)).slice(1), { n: 20, step: 0.022 });

      // Foot: heel, arch and toes, with a flat sole
      rings = [];
      for (let z = FOOT[0][0]; z <= 0.178 + 1e-6; z += 0.012) {
        const r = rowAt(FOOT, z);
        rings.push(section([s * r[1], r[2], z], X, Y, r[3], r[4], r[5], 2.4, null, 16));
      }
      loft(m, rings, 2);
    });
    return m.done({ details: dm.done() });
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
    ellipsoid(m, [0, 1.71, -0.01], [0.062, 0.05, 0.074], 7, 20, 6);
    const fissure = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; fissure.push([0, 1.71 + Math.sin(a) * 0.053, -0.01 - Math.cos(a) * 0.076]); }
    m.line(fissure, false);
    S.forEach((s) => m.line(circle([s * 0.03, 1.665, -0.07], [1, 0, 0], [0, 1, 0], 0.026, 0.016, 14), true)); // cerebellum
    cloud(m, [0, 1.71, -0.01], [0.059, 0.047, 0.071], 170, rnd);
    O.brain = m.done();

    // Eyes and optic nerves
    m = new Mesh();
    S.forEach((s) => {
      const c = [s * 0.031, 1.652, 0.07];
      m.line(circle(c, [1, 0, 0], [0, 1, 0], 0.015, 0.009, 18), true);
      m.line(circle(c, [1, 0, 0], [0, 1, 0], 0.0055, 0.0055, 10), true);
      m.line([[s * 0.031, 1.652, 0.06], [s * 0.016, 1.664, 0.03], [0, 1.676, 0]], false);
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
      paths.push([[0, 1.38, 0], [s * 0.1, 1.43, 0.005], [s * 0.19, 1.425, -0.004], [s * 0.252, 1.17, 0.004], [s * 0.293, 0.93, 0.042], [s * 0.298, 0.86, 0.045]]);
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

    // Skeleton: spine, ribs, clavicles, pelvis and long bones, joined at the joints
    m = new Mesh();
    // Spine from the skull base to the pelvis: neck and lower back curve forward, upper back curves back
    const spineZ = (y) => -0.052 + 0.013 * Math.cos((TAU * (1.58 - y)) / 0.53);
    const sternumZ = (y) => (y > 1.33 ? lerp(0.088, 0.066, (y - 1.33) / 0.125) : lerp(0.088, 0.086, (1.33 - y) / 0.095));
    const spine = [];
    for (let i = 0; i <= 18; i++) { const y = lerp(1.62, 0.97, i / 18); spine.push([0, y, spineZ(y)]); }
    m.line(spine, false);
    spine.forEach((p) => m.line(circle(p, [1, 0, 0], [0, 0, 1], 0.014, 0.011, 8), true));
    for (let i = 0; i < 7; i++) {
      const y = 1.42 - i * 0.032, rx = 0.12 + i * 0.008 - (i > 4 ? (i - 4) * 0.012 : 0), rz = 0.085 + i * 0.003;
      S.forEach((s) => {
        const pts = [[s * 0.013, y + 0.006, spineZ(y)]]; // rib head, on its vertebra
        for (let k = 0; k <= 12; k++) { const a = lerp(0.12, 2.5, k / 12); pts.push([s * Math.sin(a) * rx, y - 0.025 * Math.sin(a / 2), 0.012 - Math.cos(a) * rz]); }
        if (i < 5) { const ye = pts[pts.length - 1][1] - 0.008; pts.push([s * 0.008, ye, sternumZ(ye)]); } // cartilage to the sternum
        m.line(pts, false);
      });
    }
    m.line([[0, 1.455, 0.066], [0, 1.33, 0.088], [0, 1.235, 0.086]], false); // sternum
    m.line(circle([0, 0.96, 0], [1, 0, 0], [0, 0, 1], 0.125, 0.075, 22), true);
    m.line(circle([0, 0.9, 0.01], [1, 0, 0], [0, 0, 1], 0.085, 0.055, 18), true);
    S.forEach((s) => {
      const j = J(s);
      m.line([[s * 0.012, 1.455, 0.064], [s * 0.1, 1.472, 0.035], [s * 0.185, 1.455, -0.008]], false); // clavicle
      m.line([[s * 0.06, 1.42, -0.07], [s * 0.15, 1.43, -0.065], [s * 0.1, 1.3, -0.07], [s * 0.06, 1.42, -0.07]], false); // shoulder blade
      m.line([[s * 0.15, 1.43, -0.065], [s * 0.18, 1.452, -0.03], [s * 0.185, 1.455, -0.008]], false); // acromion, to the clavicle
      m.line([j.shoulder, j.elbow], false);                                                  // humerus
      m.line([j.elbow, [s * 0.288, 0.928, 0.022]], false);                                   // ulna
      m.line([[s * 0.258, 1.165, -0.004], [s * 0.298, 0.928, 0.038]], false);                 // radius
      m.line(circle([s * 0.294, 0.916, 0.031], [0, 1, 0], [0, 0, 1], 0.012, 0.02, 10), true);  // wrist bones
      [-0.028, -0.009, 0.01, 0.028].forEach((dz) => m.line([[s * 0.295, 0.91, 0.031 + dz * 0.4], [s * 0.297, 0.875, 0.032 + dz * 0.8],
        [s * 0.298, 0.842, 0.032 + dz], [s * 0.288, 0.78, 0.036 + dz]], false));             // hand and finger bones
      m.line([[s * 0.292, 0.912, 0.044], [s * 0.285, 0.88, 0.072], [s * 0.278, 0.852, 0.082]], false); // thumb
      m.line([[s * 0.085, 0.95, 0], j.knee], false);                                          // femur
      m.line([j.knee, j.ankle, [s * 0.1, 0.056, 0]], false);                                   // tibia, down to the ankle bone
      m.line([[s * 0.11, 0.49, 0.0], [s * 0.112, 0.09, -0.02]], false);                        // fibula
      m.line(circle([s * 0.095, 0.5, 0.05], [1, 0, 0], [0, 1, 0], 0.02, 0.022, 10), true);   // kneecap
      m.line([[s * 0.094, 0.522, 0.05], [s * 0.093, 0.575, 0.034]], false);                    // quadriceps tendon
      m.line([[s * 0.095, 0.478, 0.05], [s * 0.096, 0.43, 0.03]], false);                      // kneecap tendon
      m.line([[s * 0.1, 0.022, -0.042], [s * 0.1, 0.056, 0], [s * 0.102, 0.04, 0.07], [s * 0.104, 0.015, 0.16]], false); // foot
    });
    // Skull outline
    m.line(circle([0, 1.69, -0.005], [0, 1, 0], [0, 0, 1], 0.085, 0.1, 28), true);
    m.line(circle([0, 1.69, -0.005], [1, 0, 0], [0, 0, 1], 0.07, 0.1, 24), true);
    O.bones = m.done();

    // Muscles: fibres on thighs, calves, upper arms and chest
    m = new Mesh();
    S.forEach((s) => {
      const j = J(s);
      fibers(m, [s * 0.09, 0.88, 0.004], j.knee, 0.074, 0.047, 7);
      fibers(m, [s * 0.095, 0.47, 0.008], [s * 0.1, 0.16, -0.01], 0.05, 0.034, 5, true);
      fibers(m, [s * 0.2, 1.4, -0.008], j.elbow, 0.046, 0.034, 5);
      // Pectorals: from the sternum to the upper arm, just under the skin of the chest
      for (let i = 0; i < 4; i++) {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10, x = lerp(0.016, 0.175, t), y = lerp(1.435 - i * 0.034, 1.4, t) - 0.012 * Math.sin(Math.PI * t);
          pts.push([s * x, y, chestZ(x, y) - 0.005]);
        }
        m.line(pts, false);
      }
    });
    O.muscles = m.done();
    return O;
  }

  /* Where each region's marker sits, and where the camera goes to zoom in on it */
  const ANCHOR = {
    brain: [0, 1.738, 0.03], eyes: [0, 1.652, 0.094], lungs: [-0.078, 1.34, 0.065], heart: [0.03, 1.29, 0.075],
    blood: [0.262, 1.12, 0.04], gut: [0, 1.05, 0.08], kidneys: [0.066, 1.13, -0.08], bones: [-0.105, 0.93, 0.05],
    muscles: [0.1, 0.7, 0.085], skin: [-0.209, 1.36, 0.048]
  };
  const FOCUS = {
    brain: { t: [0, 1.7, -0.005], d: 0.62, yaw: 0.45, pitch: 0.12 },
    eyes: { t: [0, 1.652, 0.05], d: 0.48, yaw: 0.2, pitch: 0.04 },
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

    // Skin: rim lighting (lines glow where the surface turns away from the viewer, like a
    // real hologram), faint back faces and a translucent volume from stacked ring fills
    const SHADES = 7;
    function drawSurface(mesh, color, alpha, width) {
      const vs = mesh.verts, ns = mesh.norms, P = mesh.P, SH = mesh.SH;
      for (let i = 0, v = 0; i < vs.length; i += 3, v++) {
        project(vs[i], vs[i + 1], vs[i + 2], P, i);
        const nx = ns[i], ny = ns[i + 1], nz = ns[i + 2];
        const nzv = ny * sp + (-nx * syw + nz * cyw) * cp; // normal towards the camera
        const rim = 1 - Math.abs(nzv);
        SH[v] = nzv >= 0 ? 0.16 + 0.84 * rim * rim * rim : 0.05 + 0.3 * rim;
      }
      // Volume
      const fl = mesh.fills;
      if (fl.length) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.02 * alpha;
        for (let k = 0; k < fl.length; k += 2) {
          const b = fl[k] * 3, c = fl[k + 1];
          if (P[b] !== P[b]) continue;
          ctx.beginPath();
          ctx.moveTo(P[b], P[b + 1]);
          for (let q = 1; q < c; q++) { const o = b + q * 3; if (P[o] === P[o]) ctx.lineTo(P[o], P[o + 1]); }
          ctx.fill();
        }
      }
      // Lines, grouped by brightness
      const paths = [];
      for (let q = 0; q < SHADES; q++) paths.push(new Path2D());
      const sg = mesh.segs;
      for (let s = 0; s < sg.length; s += 2) {
        const a = sg[s], b = sg[s + 1], a3 = a * 3, b3 = b * 3;
        if (P[a3] !== P[a3] || P[b3] !== P[b3]) continue;
        const p = paths[Math.min(SHADES - 1, (((SH[a] + SH[b]) / 2) * SHADES) | 0)];
        p.moveTo(P[a3], P[a3 + 1]);
        p.lineTo(P[b3], P[b3 + 1]);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 3.2;
      for (let q = 1; q < SHADES; q++) { ctx.globalAlpha = ((q + 0.5) / SHADES) * alpha * 0.12; ctx.stroke(paths[q]); }
      ctx.lineWidth = width;
      for (let q = 0; q < SHADES; q++) { ctx.globalAlpha = ((q + 0.5) / SHADES) * alpha; ctx.stroke(paths[q]); }
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
      const skinCol = skinFocus ? colorOf('skin') : C.accent, skinA = focused ? (skinFocus ? 1.1 : 0.6) : 1;
      drawSurface(body, skinCol, skinA, skinFocus ? 1.15 : 0.9);
      drawMesh(body.details, skinCol, Math.min(1, skinA * 0.95), 1.1, null, 1);

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
