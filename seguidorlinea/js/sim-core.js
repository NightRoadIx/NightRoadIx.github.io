/* ============================================================
   sim-core.js — Núcleo del simulador (sin gráficos)
   Pista · sensores IR · lazo PID · motores de 1er orden ·
   cinemática diferencial · límite de adherencia.
   Se puede ejecutar en el navegador o en Node para pruebas.
   ============================================================ */
(function (g) {
  "use strict";
  const G = 9.81;

  /* ---------- Generador pseudoaleatorio reproducible ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { u, n: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()) };
  }

  /* ---------------- Óptica del sensor reflectivo ----------------
     El punto iluminado es un disco de radio s que crece con la altura h.
     La lectura es la fracción del disco que cae sobre la cinta negra. */
  const OPTICA = {
    h0: 0.0025,                                        // altura de máxima señal (TCRT5000 ≈ 2.5 mm)
    radioSpot: h => 0.001 + 0.6 * h,                   // m
    amplitud: h => { const u = Math.max(h, 1e-5) / 0.0025; return u * Math.exp(1 - u); }, // 0…1
    fraccion(t, s) { const u = Math.max(-1, Math.min(1, t / s)); return 1 - Math.acos(u) / Math.PI + u * Math.sqrt(1 - u * u) / Math.PI; },
    cobertura(d, w, s) { return Math.max(0, Math.min(1, OPTICA.fraccion(d + w / 2, s) - OPTICA.fraccion(d - w / 2, s))); }
  };

  /* -------- Geometría del arreglo de sensores (recto o en arco) --------
     Recta: todos los sensores a la distancia L del eje, separados "paso".
     Curva: sensores sobre un arco de radio R cuyo sensor central está a L;
            los de las orillas quedan más cerca del eje: x = L − R(1 − cos φ). */
  function geomSensores(p) {
    const n = Math.round(p.nSens), xf = [], yl = [];
    const curva = p.barraForma === "curva" && p.radioBarra > 0;
    for (let k = 0; k < n; k++) {
      const j = (n - 1) / 2 - k;                       // k = 0 es el sensor de la izquierda
      if (curva) { const phi = j * p.pasoSens / p.radioBarra; yl.push(p.radioBarra * Math.sin(phi)); xf.push(p.lookahead - p.radioBarra * (1 - Math.cos(phi))); }
      else { yl.push(j * p.pasoSens); xf.push(p.lookahead); }
    }
    return { xf, yl, half: Math.max(1e-6, Math.abs(yl[0] || 0)) };
  }

  /* ---------------------- Pistas ---------------------- */
  function catmull(pts, ds) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(2, Math.ceil(len / ds));
      for (let k = 0; k < m; k++) {
        const t = k / m, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    return out;
  }
  function poligonal(pts, ds) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / ds));
      for (let k = 0; k < m; k++) out.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]);
    }
    return out;
  }
  function ovalo(ds) {
    const out = [], L = 1.2, R = 0.42;
    const push = (x, y) => out.push([x, y]);
    for (let s = 0; s < L; s += ds) push(-L / 2 + s, -R);
    for (let a = -Math.PI / 2; a < Math.PI / 2; a += ds / R) push(L / 2 + R * Math.cos(a), R * Math.sin(a));
    for (let s = 0; s < L; s += ds) push(L / 2 - s, R);
    for (let a = Math.PI / 2; a < 1.5 * Math.PI; a += ds / R) push(-L / 2 + R * Math.cos(a), R * Math.sin(a));
    return out;
  }

  const PISTAS = {
    ovalo: { nombre: "Óvalo (calentamiento)", gen: ds => ovalo(ds) },
    competencia: {
      nombre: "Competencia (curvas y S)",
      gen: ds => catmull([[-0.7, -0.55], [0.0, -0.55], [0.6, -0.55], [1.0, -0.35], [1.05, 0.05], [0.8, 0.4], [0.45, 0.3], [0.2, 0.05], [-0.1, 0.1], [-0.2, 0.42], [-0.55, 0.55], [-0.95, 0.4], [-1.05, 0.0], [-0.95, -0.4]], ds)
    },
    recta: {
      nombre: "Recta larga (pruebas)",
      gen: ds => poligonal([[-3, 0], [3, 0], [3, 0.8], [-3, 0.8]], ds)
    },
    esquinas: {
      nombre: "Esquinas a 90°",
      gen: ds => poligonal([[-0.9, -0.5], [0.9, -0.5], [0.9, 0.05], [0.25, 0.05], [0.25, 0.5], [-0.9, 0.5]], ds)
    }
  };

  function crearPista(clave) {
    const def = PISTAS[clave] || PISTAS.competencia;
    const P = def.gen(0.004);
    const N = P.length;
    const s = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) { const b = P[(i + 1) % N]; s[i + 1] = s[i] + Math.hypot(b[0] - P[i][0], b[1] - P[i][1]); }
    // radio de curvatura (con puntos separados ~4 cm)
    let rMin = Infinity; const k = 10;
    for (let i = 0; i < N; i += 2) {
      const a = P[(i - k + N) % N], b = P[i], c = P[(i + k) % N];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (area2 > 1e-9) rMin = Math.min(rMin, ab * bc * ca / (2 * area2));
    }
    // rejilla espacial para búsqueda rápida del segmento más cercano
    const C = 0.05, grid = new Map();
    const key = (ix, iy) => ix * 100003 + iy;
    for (let i = 0; i < N; i++) {
      const a = P[i], b = P[(i + 1) % N];
      const x0 = Math.floor((Math.min(a[0], b[0]) - 0.03) / C), x1 = Math.floor((Math.max(a[0], b[0]) + 0.03) / C);
      const y0 = Math.floor((Math.min(a[1], b[1]) - 0.03) / C), y1 = Math.floor((Math.max(a[1], b[1]) + 0.03) / C);
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
        const kk = key(ix, iy); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(i);
      }
    }
    function cercano(x, y) {
      const ix = Math.floor(x / C), iy = Math.floor(y / C);
      let best = Infinity, bi = -1;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const lst = grid.get(key(ix + dx, iy + dy)); if (!lst) continue;
        for (const i of lst) {
          const a = P[i], b = P[(i + 1) % N];
          const vx = b[0] - a[0], vy = b[1] - a[1], wx = x - a[0], wy = y - a[1];
          const L2 = vx * vx + vy * vy || 1e-12;
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / L2));
          const d = Math.hypot(wx - t * vx, wy - t * vy);
          if (d < best) { best = d; bi = i; }
        }
      }
      return { d: best, i: bi };
    }
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of P) { xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
    return { clave, nombre: def.nombre, P, N, longitud: s[N], rMin, cercano, caja: { xmin, xmax, ymin, ymax } };
  }

  /* ---------------------- Simulador ---------------------- */
  function crearSim(paramsIn, claveP, semilla) {
    const S = {};
    S.p = Object.assign({}, paramsIn);
    S.fallas = { bateria: false, sensorSucio: false, luz: false, patina: false, motorDesigual: false };
    S.pista = crearPista(claveP);
    S.dtFis = 0.001;

    S.reiniciar = function () {
      const P = S.pista.P, N = S.pista.N;
      const a = P[0], b = P[6 % N];
      S.th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      // el arreglo de sensores queda justo sobre la línea al inicio
      S.x = a[0] - S.p.lookahead * Math.cos(S.th) * 0.0; S.y = a[1];
      S.wL = 0; S.wR = 0; S.v = 0; S.w = 0;
      S.t = 0; S.tCtl = 0;
      S.I = 0; S.ePrev = 0; S.e = 0; S.u = 0; S.ultimoSigno = 0; S.Df = 0; S.tP = 0; S.tI = 0; S.tD = 0; S.satur = false; S.log = [];
      S.dutyL = 0; S.dutyR = 0;
      S.lect = new Array(S.p.nSens).fill(0);
      S.perdida = false; S.tPerdida = 0;
      S.derrape = false; S.tDerrape = 0;
      S.estado = "listo";
      S.idx = 0; S.vueltas = 0; S.tVueltaIni = 0; S.tVueltas = [];
      S.sumE2 = 0; S.nE = 0; S.dist = 0; S.energia = 0;
      S.r = rng(semilla || 7);
      S.hist = []; // [t, e, dutyL, dutyR, errReal]
    };

    // posición (mundo) de los sensores
    S.posSensores = function () {
      const G = geomSensores(S.p), c = Math.cos(S.th), s = Math.sin(S.th), out = [];
      for (let k = 0; k < G.yl.length; k++) {
        const yl = G.yl[k], xf = G.xf[k];
        out.push([S.x + xf * c - yl * s, S.y + xf * s + yl * c, yl]);
      }
      return out;
    };

    function leerSensores() {
      if (S.levantado) return new Array(S.p.nSens).fill(0); // carrito en el aire: los sensores no ven nada
      const pos = S.posSensores(), w = S.p.anchoLinea, h = S.p.alturaSens || 0.003;
      const spot = OPTICA.radioSpot(h), amp = Math.max(0.05, OPTICA.amplitud(h));
      const out = [];
      for (let k = 0; k < pos.length; k++) {
        const d = S.pista.cercano(pos[k][0], pos[k][1]).d;
        const cobertura = OPTICA.cobertura(d, w, spot);
        let raw = 0.06 + 0.88 * cobertura;                 // reflectancia "oscuridad" 0..1
        if (S.fallas.luz) raw += 0.30 + 0.12 * S.r.u();    // luz ambiente que no se calibró
        raw += S.p.ruido / amp * S.r.n();                  // con poca señal (h mala) el ruido pesa más
        let v = (raw - 0.06) / 0.88;                       // normalización con la calibración original
        if (S.fallas.sensorSucio && k === Math.floor(pos.length / 2) - 1) v = 0.05;
        if (S.p.digital) v = v > 0.5 ? 1 : 0;              // lectura por umbral
        out.push(Math.max(0, Math.min(1, v)));
      }
      return out;
    }

    function control() {
      const Gs = geomSensores(S.p);
      const p = S.p, n = p.nSens;
      S.lect = leerSensores();
      let sv = 0, sy = 0, mx = 0;
      for (let k = 0; k < n; k++) {
        const v = S.lect[k] > 0.2 ? S.lect[k] : 0;   // umbral para ignorar el blanco
        const yl = Gs.yl[k];
        sv += v; sy += v * yl; mx = Math.max(mx, S.lect[k]);
      }
      const half = Gs.half;
      if (mx < 0.35 || sv < 1e-6) {          // línea perdida: se recuerda hacia dónde se fue
        S.perdida = true;
        S.e = (S.ultimoSigno || 1) * 1.2;
      } else {
        S.perdida = false;
        S.e = (sy / sv) / half;              // error normalizado: -1 (derecha) … +1 (izquierda)
        if (Math.abs(S.e) > 0.15) S.ultimoSigno = Math.sign(S.e);
      }
      const dt = p.periodo;
      S.I += S.e * dt;
      if (p.antiWindup !== 0) {                        // anti-windup: limitar la contribución integral a ±50 % de PWM
        const lim = 0.5 / Math.max(1e-6, Math.abs(p.ki));
        S.I = Math.max(-lim, Math.min(lim, S.I));
      }
      const Draw = (S.e - S.ePrev) / dt; S.ePrev = S.e;
      const a = Math.max(0, Math.min(0.98, p.filtroD || 0)); // filtro pasa-bajas de 1er orden sobre la derivada
      S.Df = a * S.Df + (1 - a) * Draw;
      S.tP = p.kp * S.e; S.tI = p.ki * S.I; S.tD = p.kd * S.Df;
      if (p.modoCtl === 1) { S.tP = (Math.abs(S.e) < 0.05 ? 0 : Math.sign(S.e)) * (p.onoffU || 0.4); S.tI = 0; S.tD = 0; } // on/off
      S.u = S.tP + S.tI + S.tD;
      const q = x => Math.round(Math.max(-1, Math.min(1, x)) * 255) / 255; // PWM de 8 bits
      S.dutyL = q(p.vBase - S.u);
      S.dutyR = q(p.vBase + S.u);
      S.satur = Math.abs(p.vBase - S.u) >= 1 || Math.abs(p.vBase + S.u) >= 1;
      if (S.registrar) S.log.push({ t: S.t, lect: S.lect.slice(), e: S.e, P: S.tP, I: S.tI, D: S.tD, Iacc: S.I, u: S.u, dL: S.dutyL, dR: S.dutyR, perdida: S.perdida });
    }

    S.paso = function () {
      const p = S.p;
      if (S.estado === "fuera") return;
      if (S.estado === "listo") S.estado = "corriendo";
      S.tCtl += S.dtFis;
      if (S.tCtl >= p.periodo - 1e-9) { S.tCtl -= p.periodo; control(); }
      // motores: modelo de primer orden  τ·dω/dt + ω = K·duty·Vbat/Vnom
      const wMax = p.rpmMax * 2 * Math.PI / 60;
      // voltaje efectivo en el motor: batería (quizá descargada) menos la caída del puente H
      const vEf = Math.max(0, p.vBat * (S.fallas.bateria ? 0.8 : 1) - (p.caidaDriver || 0));
      const kv = vEf / p.vNom;
      // compensación por firmware: escalar el PWM para que el motor "vea" siempre el mismo voltaje
      const KREF = Math.min(0.9 * p.vNom, 0.89 * p.vBat - (p.caidaDriver || 0)) / p.vNom; // igual que Ficha.vRefComp
      let dL = S.dutyL, dR = S.dutyR;
      if (p.compensarV && kv > 1e-3) { const g = KREF / kv; dL = Math.max(-1, Math.min(1, dL * g)); dR = Math.max(-1, Math.min(1, dR * g)); S.kvEf = KREF; }
      else S.kvEf = kv;
      const kR = S.fallas.motorDesigual ? 0.85 : 1;
      S.wL += (wMax * kv * dL - S.wL) * S.dtFis / p.tauMotor;
      S.wR += (wMax * kv * kR * dR - S.wR) * S.dtFis / p.tauMotor;
      const vL = S.wL * p.radioRueda, vR = S.wR * p.radioRueda;
      S.v = (vL + vR) / 2;
      let w = (vR - vL) / p.trocha;
      // límite de adherencia: a_c = v·ω ≤ μ·g
      const mu = (S.fallas.patina ? 0.3 : p.mu) * (p.fTraccion || 1); // la rueda loca casi no da agarre lateral
      const ac = Math.abs(S.v * w);
      S.derrape = ac > mu * G;
      if (S.derrape) { w = Math.sign(w) * mu * G / Math.max(1e-6, Math.abs(S.v)); S.tDerrape += S.dtFis; }
      S.w = w;
      if (S.levantado) { S.t += S.dtFis; S.v = 0; return; } // ruedas al aire: giran pero el carrito no se mueve
      S.th += w * S.dtFis;
      S.x += S.v * Math.cos(S.th) * S.dtFis;
      S.y += S.v * Math.sin(S.th) * S.dtFis;
      S.t += S.dtFis;
      S.dist += Math.abs(S.v) * S.dtFis;
      S.energia += (Math.abs(S.dutyL) + Math.abs(S.dutyR)) * S.dtFis; // proxy de consumo

      // métricas: error real del centro del arreglo respecto a la línea
      const c = Math.cos(S.th), s = Math.sin(S.th);
      const ax = S.x + p.lookahead * c, ay = S.y + p.lookahead * s;
      const near = S.pista.cercano(ax, ay);
      const dReal = near.i < 0 ? 1 : near.d;
      S.errReal = dReal;
      S.sumE2 += dReal * dReal; S.nE++;
      if (S.perdida) S.tPerdida += S.dtFis; else S.tPerdida = 0;
      if (dReal > 0.10 || (S.tPerdida > 0.6 && dReal > 0.05)) { S.estado = "fuera"; return; }
      // conteo de vueltas por avance sobre la pista
      if (near.i >= 0) {
        const N = S.pista.N;
        if (S.idx > 0.9 * N && near.i < 0.1 * N) {
          S.vueltas++; S.tVueltas.push(S.t - S.tVueltaIni); S.tVueltaIni = S.t;
        }
        if (Math.abs(near.i - S.idx) < 0.5 * N || near.i < 0.1 * N) S.idx = near.i;
      }
      if (Math.round(S.t * 1000) % 20 === 0) {
        S.hist.push([S.t, S.e, S.dutyL, S.dutyR, dReal, S.tI, S.u]);
        if (S.hist.length > 600) S.hist.shift();
      }
    };

    S.avanzar = function (seg) { const n = Math.round(seg / S.dtFis); for (let i = 0; i < n; i++) { S.paso(); if (S.estado === "fuera") break; } };
    S.errorRMS = () => S.nE ? Math.sqrt(S.sumE2 / S.nE) : 0;
    S.cambiarPista = function (clave) { S.pista = crearPista(clave); S.reiniciar(); };
    S.reiniciar();
    return S;
  }

  const API = { crearSim, crearPista, PISTAS, G, OPTICA, geomSensores };
  g.SimCore = API;
  if (typeof module !== "undefined") module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
