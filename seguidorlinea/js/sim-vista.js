/* sim-vista.js — vista 3D (three.js), controles y gráficas del simulador */
{
  "use strict";
  const $ = s => document.querySelector(s);
  // resuelve variables CSS (incluidas las que usan light-dark()) a un color que entienda el canvas
  const sonda = document.createElement("span"); sonda.style.display = "none"; document.body.append(sonda);
  const css = n => { sonda.style.color = "var(" + n + ")"; return getComputedStyle(sonda).color; };

  /* ---------- parámetros editables, agrupados por subsistema ---------- */
  const PARAMS = [
    { g: "mec", gn: "Mecánica", k: "trocha", l: "Distancia entre ruedas", min: 0.07, max: 0.20, st: 0.005, f: 1000, u: "mm", d: 0, ay: "Más trocha: giros más suaves pero menos ágiles." },
    { g: "mec", gn: "Mecánica", k: "lookahead", l: "Eje → sensores (lookahead)", min: 0.02, max: 0.14, st: 0.005, f: 1000, u: "mm", d: 0, ay: "Ver más adelante estabiliza, pero recorta curvas." },
    { g: "mec", gn: "Mecánica", k: "radioRueda", l: "Radio de rueda", min: 0.010, max: 0.035, st: 0.0005, f: 1000, u: "mm", d: 1, ay: "Rueda grande: más velocidad, menos par." },
    { g: "mec", gn: "Mecánica", k: "masa", l: "Masa total", min: 0.15, max: 1.2, st: 0.01, f: 1000, u: "g", d: 0, ay: "Más masa: el carrito tarda más en responder (τ = m·v₀/F₀)." },
    { g: "mec", gn: "Mecánica", k: "mu", l: "Fricción llanta-piso μ", min: 0.2, max: 1.2, st: 0.05, f: 1, u: "", d: 2, ay: "Fija la aceleración lateral máxima μ·g." },
    { g: "ele", gn: "Motores y potencia", k: "reduccion", l: "Reducción de la caja (1:N)", min: 5, max: 300, st: 1, f: 1, u: "", d: 0, ay: "N grande: más par, menos velocidad (Módulo 1)." },
    { g: "ele", gn: "Motores y potencia", k: "vBat", l: "Voltaje de batería", min: 3.0, max: 12.6, st: 0.1, f: 1, u: "V", d: 1, ay: "Si baja, todo el carrito se vuelve más lento." },
    { g: "sen", gn: "Sensado", k: "nSens", l: "Número de sensores", min: 2, max: 16, st: 1, f: 1, u: "", d: 0, ay: "Más sensores: más rango y resolución." },
    { g: "sen", gn: "Sensado", k: "pasoSens", l: "Separación entre sensores", min: 0.004, max: 0.025, st: 0.0005, f: 1000, u: "mm", d: 1, ay: "Compárala con el ancho de la cinta." },
    { g: "ele", gn: "Motores y potencia", k: "caidaDriver", l: "Caída en el puente H", min: 0, max: 3, st: 0.05, f: 1, u: "V", d: 2, ay: "L298N ≈ 2 V; TB6612 o DRV8833 ≈ 0.3 V (Módulo 3)." },
    { g: "ele", gn: "Motores y potencia", k: "compensarV", l: "Compensar voltaje de batería", min: 0, max: 1, st: 1, f: 1, u: "", d: 0, tx: v => v ? "Sí" : "No", ay: "El firmware mide Vbat y escala el PWM (Módulo 3)." },
    { g: "sen", gn: "Sensado", k: "barraForma", l: "Forma de la barra", min: 0, max: 1, st: 1, f: 1, u: "", d: 0, get: q => q.barraForma === "curva" ? 1 : 0, set: (q, v) => { q.barraForma = v ? "curva" : "recta"; }, tx: v => v ? "Curva (arco)" : "Recta", ay: "En arco, los sensores de las orillas quedan más cerca del eje (Módulo 2)." },
    { g: "sen", gn: "Sensado", k: "radioBarra", l: "Radio del arco (barra curva)", min: 0.06, max: 0.5, st: 0.01, f: 1000, u: "mm", d: 0, ay: "Más chico: barra más curva." },
    { g: "sen", gn: "Sensado", k: "alturaSens", l: "Altura sobre el piso", min: 0.0005, max: 0.012, st: 0.0005, f: 1000, u: "mm", d: 1, ay: "Más alto: punto más grande y menos señal (Módulo 2)." },
    { g: "sen", gn: "Sensado", k: "digital", l: "Lectura digital (umbral)", min: 0, max: 1, st: 1, f: 1, u: "", d: 0, tx: v => v ? "Sí" : "No, analógica", ay: "Con umbral la posición sale escalonada." },
    { g: "sen", gn: "Sensado", k: "ruido", l: "Ruido de lectura", min: 0, max: 0.25, st: 0.01, f: 100, u: "%", d: 0, ay: "Ruido eléctrico y de reflectancia." },
    { g: "ctl", gn: "Control y firmware", k: "kp", l: "Kp (proporcional)", min: 0, max: 4, st: 0.05, f: 1, u: "", d: 2, ay: "Corrige en proporción al error." },
    { g: "ctl", gn: "Control y firmware", k: "ki", l: "Ki (integral)", min: 0, max: 5, st: 0.1, f: 1, u: "", d: 1, ay: "Elimina el error que se queda (p. ej. motores desiguales)." },
    { g: "ctl", gn: "Control y firmware", k: "kd", l: "Kd (derivativo)", min: 0, max: 0.15, st: 0.005, f: 1, u: "", d: 3, ay: "Amortigua: frena la corrección antes de pasarse." },
    { g: "ctl", gn: "Control y firmware", k: "vBase", l: "Velocidad base (ciclo de trabajo)", min: 0, max: 1, st: 0.01, f: 100, u: "%", d: 0, ay: "PWM de ambos motores cuando el error es cero." },
    { g: "ctl", gn: "Control y firmware", k: "filtroD", l: "Filtro de la derivada α", min: 0, max: 0.95, st: 0.05, f: 1, u: "", d: 2, ay: "Suaviza el ruido que amplifica Kd (Módulo 5)." },
    { g: "ctl", gn: "Control y firmware", k: "antiWindup", l: "Anti-windup", min: 0, max: 1, st: 1, f: 1, u: "", d: 0, tx: v => v ? "Sí" : "No", ay: "Limita lo que acumula la integral (Módulo 5)." },
    { g: "ctl", gn: "Control y firmware", k: "modoCtl", l: "Tipo de controlador", min: 0, max: 1, st: 1, f: 1, u: "", d: 0, tx: v => v ? "On/off" : "PID", ay: "On/off: corrige siempre con la misma fuerza." },
    { g: "ctl", gn: "Control y firmware", k: "periodo", l: "Periodo del lazo de control", min: 0.001, max: 0.05, st: 0.001, f: 1000, u: "ms", d: 0, ay: "Cada cuánto el microcontrolador lee y corrige." }
  ];
  const FALLAS = [
    { k: "bateria", t: "Batería baja" },
    { k: "sensorSucio", t: "Sensor sucio" },
    { k: "luz", t: "Luz ambiente sin recalibrar" },
    { k: "patina", t: "Piso resbaloso" },
    { k: "motorDesigual", t: "Motores desiguales" }
  ];
  const PRESETS = [
    { t: "On/off", v: { modoCtl: 1, vBase: 0.5 } },
    { t: "Sólo P", v: { modoCtl: 0, kp: 0.8, ki: 0, kd: 0, vBase: 0.5 } },
    { t: "PD sintonizado", v: { modoCtl: 0, kp: 0.8, ki: 0, kd: 0.03, vBase: 0.5 } },
    { t: "PD rápido", v: { modoCtl: 0, kp: 1.4, ki: 0, kd: 0.05, vBase: 0.75 } },
    { t: "PID", v: { modoCtl: 0, kp: 0.8, ki: 2.0, kd: 0.03, vBase: 0.5 } }
  ];

  /* ---------- estado ---------- */
  let ficha = window.Ficha.leer();
  let claveP = "competencia";
  const sim = SimCore.crearSim(ficha, claveP);
  let simF = null;                       // carrito "fantasma" con el otro perfil, para comparar
  let corriendo = false, vel = 1, camModo = "sigue";

  $("#verFicha").textContent = ficha.version;

  /* ---------- selector de pista ---------- */
  const selP = $("#pista");
  selP.innerHTML = Object.keys(SimCore.PISTAS).map(k => `<option value="${k}">${SimCore.PISTAS[k].nombre}</option>`).join("");
  selP.value = claveP;
  selP.addEventListener("change", () => { claveP = selP.value; sim.cambiarPista(claveP); if (simF) simF.cambiarPista(claveP); construirPista(); reiniciar(); });

  /* ---------- panel de parámetros ---------- */
  const panel = $("#panel");
  const grupos = {};
  for (const p of PARAMS) {
    if (!grupos[p.g]) {
      const div = document.createElement("div");
      div.className = "grupo";
      div.innerHTML = `<h3><span class="tag t-${p.g}">${p.gn}</span></h3>`;
      panel.append(div); grupos[p.g] = div;
    }
    const id = "p_" + p.k;
    const c = document.createElement("div");
    c.className = "ctl";
    c.innerHTML = `<label for="${id}" title="${p.ay}">${p.l}</label><output id="o_${p.k}"></output><input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.st}">`;
    grupos[p.g].append(c);
    const inp = c.querySelector("input");
    inp.value = p.get ? p.get(sim.p) : sim.p[p.k];
    inp.addEventListener("input", () => {
      if (p.set) p.set(sim.p, parseFloat(inp.value)); else sim.p[p.k] = parseFloat(inp.value);
      Object.assign(sim.p, window.Ficha.derivar(sim.p));
      if (["nSens", "pasoSens", "lookahead", "trocha", "radioRueda", "barraForma", "radioBarra"].includes(p.k)) construirCarrito();
      if (p.k === "nSens") construirBarras();
      refrescarTextos();
    });
  }
  function refrescarTextos() {
    for (const p of PARAMS) {
      const v = p.get ? p.get(sim.p) : sim.p[p.k];
      $("#o_" + p.k).textContent = p.tx ? p.tx(v) : fmt(v * p.f, p.d, p.u);
      $("#p_" + p.k).value = v;
    }
    indicadores(); tablaFicha();
  }

  /* ---------- indicadores de diseño (acoplamientos) ---------- */
  function indicadores() {
    const p = sim.p, g = SimCore.G;
    const vMax = p.rpmMax * 2 * Math.PI / 60 * p.radioRueda * window.Ficha.vMotor(p) / p.vNom;
    const vB = vMax * p.vBase;
    const rMin = sim.pista.rMin;
    const ac = vB * vB / rMin, acMax = p.mu * (p.fTraccion || 1) * g;
    const ancho = 2 * SimCore.geomSensores(p).half;
    const hueco = p.pasoSens > p.anchoLinea;
    const tV = sim.pista.longitud / Math.max(vB, 1e-6);
    const muestras = vB * p.periodo * 1000;
    const est = (ok, warn) => ok ? '<span class="est ok">✓</span>' : warn ? '<span class="est warn">!</span>' : '<span class="est bad">✗</span>';
    const filas = [
      ["Velocidad de rueda sin carga", fmt(p.rpmMax, 0, "rpm"), ""],
      ["Constante de tiempo τ (sale de la masa)", fmt(p.tauMotor * 1000, 0, "ms"), ""],
      ["Velocidad máxima posible", fmt(vMax, 2, "m/s"), ""],
      ["Velocidad base estimada", fmt(vB, 2, "m/s"), est(vB >= p.vObjetivo, vB >= 0.8 * p.vObjetivo) + " objetivo " + fmt(p.vObjetivo, 2, "m/s")],
      ["Tiempo de vuelta estimado", fmt(tV, 1, "s"), ""],
      ["Aceleración lateral en la curva más cerrada", fmt(ac, 1, "m/s²"), est(ac < 0.7 * acMax, ac < acMax) + " límite μ·f·g = " + fmt(acMax, 1, "m/s²")],
      ["Ancho del arreglo de sensores", fmt(ancho * 1000, 0, "mm"), ""],
      ["Separación vs. ancho de cinta", fmt(p.pasoSens * 1000, 1, "mm") + " / " + fmt(p.anchoLinea * 1000, 0, "mm"), hueco ? '<span class="est bad">✗ hay huecos</span>' : '<span class="est ok">✓</span>'],
      ["Avance entre dos correcciones", fmt(muestras, 1, "mm"), est(muestras < 3, muestras < 8)]
    ];
    $("#ind").innerHTML = filas.map(f => `<div class="fila"><span>${f[0]}</span><span><b>${f[1]}</b> ${f[2]}</span></div>`).join("");
  }

  /* ---------- tabla de ficha ---------- */
  function tablaFicha() {
    $("#tabFicha tbody").innerHTML = PARAMS.map(p => `<tr><td><span class="tag t-${p.g}">${p.gn}</span></td><td>${p.l}${window.marcaConfirmar ? window.marcaConfirmar(p.k) : ""}</td><td class="num">${p.tx ? p.tx(p.get ? p.get(sim.p) : sim.p[p.k]) : fmt(sim.p[p.k] * p.f, p.d, p.u)}</td><td>${p.ay}</td></tr>`).join("");
  }

  /* ---------- fallas y presets ---------- */
  $("#fallas").innerHTML = FALLAS.map(f => `<button type="button" aria-pressed="false" data-f="${f.k}">${f.t}</button>`).join("");
  $("#fallas").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", on); sim.fallas[b.dataset.f] = on;
  });
  $("#presets").innerHTML = PRESETS.map((p, i) => `<button type="button" data-i="${i}">${p.t}</button>`).join("");
  $("#presets").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    Object.assign(sim.p, PRESETS[+b.dataset.i].v); refrescarTextos();
  });

  /* ---------- ficha: guardar / restablecer / copiar ---------- */
  const msg = t => { $("#msg").textContent = t; setTimeout(() => { $("#msg").textContent = ""; }, 3000); };
  $("#btnGuardar").addEventListener("click", () => { const c = {}; for (const p of PARAMS) c[p.k] = sim.p[p.k]; ficha = window.Ficha.guardar(c); Object.assign(sim.p, window.Ficha.derivar(sim.p)); msg("Guardado en este navegador."); });
  $("#btnRestablecer").addEventListener("click", () => { ficha = window.Ficha.restablecer(); Object.assign(sim.p, ficha); construirCarrito(); construirBarras(); reiniciar(); refrescarTextos(); msg("Valores originales del perfil restablecidos."); });
  $("#btnCopiar").addEventListener("click", async () => {
    const c = Object.assign({}, window.Ficha.leer()); for (const p of PARAMS) c[p.k] = sim.p[p.k];
    try { await navigator.clipboard.writeText(JSON.stringify(c, null, 2)); msg("Ficha copiada al portapapeles."); } catch (e) { msg("El navegador no permitió copiar."); }
  });

  /* ================= three.js ================= */
  const cont = $("#vista");
  const hayThree = typeof THREE !== "undefined";
  let renderer, scene, camera, controls, malla = null, mallaF = null, pistaGrp, estela, estelaPos, estelaN = 0, estelaF, estelaFPos, estelaFN = 0;
  const ESTELA_MAX = 3000;

  function colEscena() {
    const t = document.documentElement.dataset.theme;
    const osc = t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches);
    return osc ? { fondo: 0x15181c, tapete: 0xa8a9a4, cinta: 0x0e0e0e } : { fondo: 0xe9eae4, tapete: 0xfbfbf7, cinta: 0x111111 };
  }

  if (hayThree) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    cont.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.005, 50);
    camera.position.set(0, 2.2, 1.8);
    if (THREE.OrbitControls) { controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.05; }
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 0.75));
    const sol = new THREE.DirectionalLight(0xffffff, 0.7);
    sol.position.set(1.5, 3, 1); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -1.6, right: 1.6, top: 1.2, bottom: -1.2, near: 0.5, far: 6 });
    scene.add(sol);

    // estela
    estelaPos = new Float32Array(ESTELA_MAX * 3);
    const ge = new THREE.BufferGeometry(); ge.setAttribute("position", new THREE.BufferAttribute(estelaPos, 3)); ge.setDrawRange(0, 0);
    estela = new THREE.Line(ge, new THREE.LineBasicMaterial({ color: 0xd9381e }));
    scene.add(estela);
    estelaFPos = new Float32Array(ESTELA_MAX * 3);
    const gf = new THREE.BufferGeometry(); gf.setAttribute("position", new THREE.BufferAttribute(estelaFPos, 3)); gf.setDrawRange(0, 0);
    estelaF = new THREE.Line(gf, new THREE.LineBasicMaterial({ color: 0x3d6fd6 }));
    scene.add(estelaF);

    construirPista(); construirCarrito();
    const ro = new ResizeObserver(() => { const w = cont.clientWidth, h = cont.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); });
    ro.observe(cont);
    document.addEventListener("cambio-tema", () => { construirPista(); dibujarGraficas(); });
  } else {
    cont.insertAdjacentHTML("afterbegin", '<p style="padding:20px">No se pudo cargar three.js (revisa la conexión). Las gráficas sí funcionan.</p>');
  }

  function construirPista() {
    if (!hayThree) return;
    const c = colEscena();
    scene.background = new THREE.Color(c.fondo);
    if (pistaGrp) scene.remove(pistaGrp);
    pistaGrp = new THREE.Group();
    const bx = sim.pista.caja, m = 0.18;
    const W = bx.xmax - bx.xmin + 2 * m, H = bx.ymax - bx.ymin + 2 * m;
    const tap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.006, H), new THREE.MeshStandardMaterial({ color: c.tapete, roughness: 0.9 }));
    tap.position.set((bx.xmin + bx.xmax) / 2, -0.003, -(bx.ymin + bx.ymax) / 2); tap.receiveShadow = true;
    pistaGrp.add(tap);
    // cinta: listón de 19 mm construido a partir de la trayectoria
    const P = sim.pista.P, N = P.length, w2 = sim.p.anchoLinea / 2;
    const pos = new Float32Array((N + 1) * 6), idx = [];
    for (let i = 0; i <= N; i++) {
      const a = P[(i - 1 + N) % N], b = P[(i + 1) % N], q = P[i % N];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
      const nx = -ty, ny = tx;
      pos.set([q[0] + nx * w2, 0.0006, -(q[1] + ny * w2), q[0] - nx * w2, 0.0006, -(q[1] - ny * w2)], i * 6);
      if (i < N) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const cinta = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c.cinta, roughness: 0.5, side: THREE.DoubleSide }));
    cinta.receiveShadow = true; pistaGrp.add(cinta);
    // línea de salida
    const a0 = P[0], a1 = P[6];
    const meta = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.001, 0.09), new THREE.MeshStandardMaterial({ color: 0xd9381e }));
    meta.position.set(a0[0], 0.0012, -a0[1]); meta.rotation.y = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
    pistaGrp.add(meta);
    scene.add(pistaGrp);
  }

  /* Construye la malla 3D de un carrito a partir de sus parámetros.
     fantasma = true: versión semitransparente para comparar perfiles. */
  function crearMalla(p, fantasma) {
    const M = { grupo: new THREE.Group(), sensores: [], ruedas: [], spots: [] };
    const r = p.radioRueda, b = p.trocha, la = p.lookahead, Gs = window.SimCore.geomSensores(p);
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: fantasma ? 0x3d6fd6 : c, roughness: 0.6 }, fantasma ? { transparent: true, opacity: 0.38, depthWrite: false } : {}, o || {}));
    const add = (geo, m, x, h, y, sombra = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, h, -y); o.castShadow = sombra && !fantasma; M.grupo.add(o); return o; };
    const barraEntre = (x1, y1, x2, y2, alto, ancho, m) => { const L = Math.hypot(x2 - x1, y2 - y1); const o = add(new THREE.BoxGeometry(L, 0.0018, ancho), m, (x1 + x2) / 2, alto, (y1 + y2) / 2); o.rotation.y = Math.atan2(y2 - y1, x2 - x1); return o; };
    const pcb = mat(p.perfilId === "especifico01" ? 0x5b2a86 : 0x1d6b47, { roughness: 0.5 });
    const patin = p.apoyo === "patin";
    // chasis
    if (patin) add(new THREE.BoxGeometry(0.05, 0.0018, b - 0.012), pcb, 0, r + 0.003, 0);
    else { const largo = la + 0.06, x0 = -0.045; add(new THREE.BoxGeometry(largo, 0.0025, b - 0.018), pcb, x0 + largo / 2, r + 0.004, 0); }
    // ruedas y motores
    for (const sg of [1, -1]) {
      const rueda = new THREE.Group();
      const llanta = new THREE.Mesh(new THREE.CylinderGeometry(r, r, patin ? 0.02 : 0.011, 28), mat(0x1b1b1b, { roughness: 0.95 }));
      llanta.rotation.x = Math.PI / 2; llanta.castShadow = !fantasma; rueda.add(llanta);
      rueda.add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, r * 0.35, patin ? 0.0205 : 0.0115), mat(0xe0e0e0)));
      rueda.position.set(0, r, -sg * b / 2);
      M.grupo.add(rueda); M.ruedas.push(rueda);
      if (patin) { const mot = add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.035, 18), mat(0xb8b8b8, { metalness: 0.6, roughness: 0.4 }), 0, r, sg * (b / 2 - 0.03)); mot.rotation.x = Math.PI / 2; }
      else add(new THREE.BoxGeometry(0.024, 0.010, 0.012), mat(0xb8b8b8, { metalness: 0.6, roughness: 0.4 }), 0, r, sg * (b / 2 - 0.018));
    }
    // batería, microcontrolador, puente H
    if (patin) {
      add(new THREE.BoxGeometry(0.03, 0.012, 0.055), mat(0xc0392b), 0.002, r + 0.010, 0);
      add(new THREE.BoxGeometry(0.018, 0.004, 0.043), mat(0x0d4f7a), -0.018, r + 0.006, 0);
    } else {
      add(new THREE.BoxGeometry(0.05, 0.016, 0.032), mat(0x2b3f6b), p.posBateria + 0.023, r + 0.013, 0);
      add(new THREE.BoxGeometry(0.03, 0.004, 0.022), mat(0x0d4f7a), 0.022, r + 0.0075, 0.012);
      add(new THREE.BoxGeometry(0.014, 0.004, 0.014), mat(0x7a1d1d), 0.022, r + 0.0075, -0.016);
    }
    // barra de sensores (recta o en arco) y su unión con el chasis
    const n = Gs.xf.length, hb = 0.006;
    const ext = k => { const d = k === 0 ? -1 : 1, i = k === 0 ? 0 : n - 1, j = k === 0 ? 1 : n - 2; return [Gs.xf[i] + (Gs.xf[i] - Gs.xf[j]) * 0.8, Gs.yl[i] + (Gs.yl[i] - Gs.yl[j]) * 0.8]; };
    const pts = [ext(0)].concat(Gs.xf.map((x, k) => [x, Gs.yl[k]]), [ext(1)]);
    for (let k = 0; k < pts.length - 1; k++) barraEntre(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], hb, 0.012, pcb);
    if (patin) {
      const e0 = pts[0], e1 = pts[pts.length - 1];
      barraEntre(0.02, b / 2 - 0.012, e0[0], e0[1], hb + 0.002, 0.005, mat(0x222222));
      barraEntre(0.02, -(b / 2 - 0.012), e1[0], e1[1], hb + 0.002, 0.005, mat(0x222222));
      barraEntre(0.02, 0, Gs.xf[Math.floor(n / 2)] - 0.006, 0, hb + 0.003, 0.006, mat(0xdddddd)); // cable plano
      for (const e of [e0, e1]) add(new THREE.SphereGeometry(0.0035, 12, 10), mat(0xeeeeee, { metalness: 0.3 }), e[0], 0.0035, e[1]); // patines
    } else {
      add(new THREE.BoxGeometry(0.006, 0.0025, 0.016), pcb, la - 0.008, (0.006 + r + 0.004) / 2, 0);
      add(new THREE.SphereGeometry(0.006, 16, 12), mat(0x9a9a9a, { metalness: 0.7, roughness: 0.3 }), p.xApoyo || -0.04, 0.006, 0);
      add(new THREE.CylinderGeometry(0.004, 0.006, Math.max(0.001, r - 0.004), 12), mat(0x333333), p.xApoyo || -0.04, (r + 0.008) / 2, 0);
    }
    for (let k = 0; k < n; k++) {
      const s = add(new THREE.BoxGeometry(0.004, 0.003, 0.004), mat(0x222222, { emissive: 0x000000 }), Gs.xf[k], 0.0045, Gs.yl[k], false);
      M.sensores.push(s);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 16), new THREE.MeshBasicMaterial({ color: fantasma ? 0x3d6fd6 : 0xff3b1f, transparent: true, opacity: 0.0 }));
      spot.rotation.x = -Math.PI / 2; spot.position.set(Gs.xf[k], 0.0013, -Gs.yl[k]); M.grupo.add(spot); M.spots.push(spot);
    }
    return M;
  }
  function construirCarrito() {
    if (!hayThree) return;
    if (malla) scene.remove(malla.grupo);
    malla = crearMalla(sim.p, false); scene.add(malla.grupo);
    if (mallaF) { scene.remove(mallaF.grupo); mallaF = null; }
    if (simF) { mallaF = crearMalla(simF.p, true); scene.add(mallaF.grupo); }
  }
  function moverMalla(M, S) {
    M.grupo.position.set(S.x, 0, -S.y); M.grupo.rotation.y = S.th;
    for (let k = 0; k < M.sensores.length; k++) {
      const v = S.lect[k] || 0;
      M.sensores[k].material.emissive.setRGB(0.85 * v, 0.12 * v, 0.05 * v);
      M.spots[k].material.opacity = 0.15 + 0.6 * v;
    }
    if (M.ruedas[0]) M.ruedas[0].rotation.z -= S.wL * 0.016 * vel;
    if (M.ruedas[1]) M.ruedas[1].rotation.z -= S.wR * 0.016 * vel;
  }

  function actualizarEscena() {
    if (!hayThree) return;
    moverMalla(malla, sim);
    if (simF && mallaF) moverMalla(mallaF, simF);
    // estela
    if ($("#chkEstela").checked && sim.estado === "corriendo") {
      const c = Math.cos(sim.th), s = Math.sin(sim.th);
      const x = sim.x + sim.p.lookahead * c, y = sim.y + sim.p.lookahead * s;
      if (estelaN >= ESTELA_MAX) { estelaPos.copyWithin(0, 3); estelaN = ESTELA_MAX - 1; }
      estelaPos.set([x, 0.0016, -y], estelaN * 3); estelaN++;
      estela.geometry.attributes.position.needsUpdate = true; estela.geometry.setDrawRange(0, estelaN);
    }
    if (simF && $("#chkEstela").checked && simF.estado === "corriendo") {
      const c = Math.cos(simF.th), s = Math.sin(simF.th);
      if (estelaFN >= ESTELA_MAX) { estelaFPos.copyWithin(0, 3); estelaFN = ESTELA_MAX - 1; }
      estelaFPos.set([simF.x + simF.p.lookahead * c, 0.0018, -(simF.y + simF.p.lookahead * s)], estelaFN * 3); estelaFN++;
      estelaF.geometry.attributes.position.needsUpdate = true; estelaF.geometry.setDrawRange(0, estelaFN);
    }
    estela.visible = $("#chkEstela").checked;
    estelaF.visible = !!simF && $("#chkEstela").checked;
    // cámara
    if (camModo === "sigue") {
      const c = Math.cos(sim.th), s = Math.sin(sim.th);
      const obj = new THREE.Vector3(sim.x - 0.38 * c, 0.22, -(sim.y - 0.38 * s));
      camera.position.lerp(obj, 0.08);
      camera.lookAt(sim.x + 0.15 * c, 0, -(sim.y + 0.15 * s));
    } else if (camModo === "arriba") {
      const bx = sim.pista.caja;
      camera.position.set((bx.xmin + bx.xmax) / 2, 2.9, -(bx.ymin + bx.ymax) / 2 + 0.001);
      camera.lookAt((bx.xmin + bx.xmax) / 2, 0, -(bx.ymin + bx.ymax) / 2);
    } else if (controls) controls.update();
    renderer.render(scene, camera);
  }

  document.querySelectorAll("[data-cam]").forEach(b => b.addEventListener("click", () => {
    camModo = b.dataset.cam;
    document.querySelectorAll("[data-cam]").forEach(x => x.setAttribute("aria-pressed", x === b));
    if (camModo === "libre" && hayThree) { camera.position.set(0, 1.9, 1.7); if (controls) { controls.target.set(0, 0, 0); controls.update(); } }
  }));

  /* ---------- barras de sensores ---------- */
  function construirBarras() {
    $("#barSens").innerHTML = Array.from({ length: sim.p.nSens }, (_, k) => `<div><span style="height:0%"></span><em>S${k + 1}</em></div>`).join("");
  }
  function actualizarBarras() {
    const spans = document.querySelectorAll("#barSens span");
    spans.forEach((s, k) => { s.style.height = Math.round((sim.lect[k] || 0) * 100) + "%"; });
  }

  /* ---------- gráficas (canvas 2D) ---------- */
  function prepCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function trazo(ctx, datos, sel, ymin, ymax, x0, w, h, color, t0, T) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath();
    let primero = true;
    for (const d of datos) {
      const x = x0 + (d[0] - t0) / T * (w - x0), y = h - 18 - (sel(d) - ymin) / (ymax - ymin) * (h - 26);
      if (primero) { ctx.moveTo(x, y); primero = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  function ejes(ctx, w, h, x0, ymin, ymax, marcas, t0, T, etiq) {
    ctx.font = "12px Barlow, sans-serif"; ctx.fillStyle = css("--ink2"); ctx.strokeStyle = css("--line"); ctx.lineWidth = 1;
    for (const m of marcas) {
      const y = h - 18 - (m - ymin) / (ymax - ymin) * (h - 26);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillText(etiq(m), 2, y + 4);
    }
    for (let s = Math.ceil(t0); s <= t0 + T; s += 2) { const x = x0 + (s - t0) / T * (w - x0); if (x < w - 24 && (w > 300 || s % 4 === 0)) ctx.fillText(s + " s", x - 8, h - 3); }
  }
  function dibujarGraficas() {
    const H = sim.hist, T = 10;
    const t1 = H.length ? H[H.length - 1][0] : 0, t0 = Math.max(0, t1 - T);
    const datos = H.filter(d => d[0] >= t0);
    { const { ctx, w, h } = prepCanvas($("#gErr")); const x0 = 34;
      ejes(ctx, w, h, x0, -1.3, 1.3, [-1, 0, 1], t0, T, m => m.toFixed(0));
      trazo(ctx, datos, d => Math.max(-1.3, Math.min(1.3, d[1])), -1.3, 1.3, x0, w, h, css("--ctl"), t0, T);
      trazo(ctx, datos, d => Math.min(1.3, d[4] / 0.03), -1.3, 1.3, x0, w, h, css("--ir"), t0, T);
      ctx.fillStyle = css("--ink2"); ctx.fillText("rojo: 1 = 30 mm", w - 98, 12); }
    { const { ctx, w, h } = prepCanvas($("#gPwm")); const x0 = 40;
      ejes(ctx, w, h, x0, -1, 1, [-1, 0, 1], t0, T, m => (m * 100).toFixed(0) + "%");
      trazo(ctx, datos, d => d[2], -1, 1, x0, w, h, css("--mec"), t0, T);
      trazo(ctx, datos, d => d[3], -1, 1, x0, w, h, css("--ele"), t0, T); }
  }

  /* ---------- HUD ---------- */
  function hud() {
    const v = sim.tVueltas, mejor = v.length ? Math.min(...v) : NaN;
    let h = `<span class="chip">t <b>${fmt(sim.t, 1, "s")}</b></span><span class="chip">v <b>${fmt(sim.v, 2, "m/s")}</b></span>` +
      `<span class="chip">vueltas <b>${sim.vueltas}</b></span>` +
      (v.length ? `<span class="chip">última <b>${fmt(v[v.length - 1], 2, "s")}</b> · mejor <b>${fmt(mejor, 2, "s")}</b></span>` : "") +
      `<span class="chip">error RMS <b>${fmt(sim.errorRMS() * 1000, 1, "mm")}</b></span>`;
    if (sim.perdida && sim.estado === "corriendo") h += '<span class="chip aviso">Línea perdida</span>';
    if (sim.derrape) h += '<span class="chip alerta">Derrape</span>';
    if (simF) {
      const vf = simF.tVueltas;
      h += `<span class="chip" style="border-color:#3d6fd6;color:#3d6fd6">fantasma · ${simF.p.version}: ${simF.estado === "fuera" ? "se salió" : (vf.length ? "vuelta " + fmt(vf[vf.length - 1], 2, "s") + " · " : "") + "RMS " + fmt(simF.errorRMS() * 1000, 1, "mm")}</span>`;
    }
    $("#hud").innerHTML = h;
  }

  /* ---------- ciclo principal ---------- */
  function reiniciar() {
    sim.reiniciar(); estelaN = 0; if (estela) estela.geometry.setDrawRange(0, 0);
    if (simF) { simF.reiniciar(); simF.lect = new Array(simF.p.nSens).fill(0); } estelaFN = 0; if (estelaF) estelaF.geometry.setDrawRange(0, 0);
    $("#fuera").classList.remove("on");
    corriendo = false; $("#btnPlay").textContent = "▶ Iniciar";
    sim.lect = new Array(sim.p.nSens).fill(0);
    if (hayThree && camModo === "sigue") { const c = Math.cos(sim.th), s = Math.sin(sim.th); camera.position.set(sim.x - 0.38 * c, 0.22, -(sim.y - 0.38 * s)); }
    hud(); dibujarGraficas(); actualizarBarras();
  }
  $("#btnPlay").addEventListener("click", () => {
    if (sim.estado === "fuera") reiniciar();
    corriendo = !corriendo; $("#btnPlay").textContent = corriendo ? "❚❚ Pausa" : "▶ Continuar";
  });
  $("#btnReiniciar").addEventListener("click", reiniciar);
  $("#btnReiniciar2").addEventListener("click", reiniciar);
  document.querySelectorAll("[data-vel]").forEach(b => b.addEventListener("click", () => {
    vel = parseFloat(b.dataset.vel);
    document.querySelectorAll("[data-vel]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));

  let tAnt = performance.now(), cuadro = 0;
  function bucle(t) {
    const dt = Math.min(0.05, (t - tAnt) / 1000); tAnt = t;
    if (corriendo && sim.estado !== "fuera") {
      sim.avanzar(dt * vel);
      if (simF && simF.estado !== "fuera") simF.avanzar(dt * vel);
      if (sim.estado === "fuera") {
        corriendo = false; $("#btnPlay").textContent = "▶ Iniciar";
        $("#fueraTxt").textContent = `Recorrió ${fmt(sim.dist, 2, "m")} en ${fmt(sim.t, 1, "s")}. Revisa la velocidad base, las ganancias o las fallas activas.`;
        $("#fuera").classList.add("on");
      }
    }
    actualizarEscena();
    if (++cuadro % 3 === 0) { dibujarGraficas(); actualizarBarras(); hud(); }
    requestAnimationFrame(bucle);
  }

  // si otro módulo cambia la ficha (p. ej. Módulo 1), el simulador la toma
  window.addEventListener("ficha-cambiada", e => {
    ficha = e.detail; Object.assign(sim.p, ficha);
    $("#verFicha").textContent = ficha.version;
    construirCarrito(); construirBarras(); reiniciar(); refrescarTextos();
  });

  // comparación con el otro perfil
  const chkF = $("#chkFantasma");
  if (chkF) {
    const otro = window.Ficha.otroPerfil();
    $("#lblFantasma").textContent = "Comparar con " + window.Ficha.leer(otro).version;
    chkF.addEventListener("change", () => {
      simF = chkF.checked ? SimCore.crearSim(window.Ficha.leer(otro), claveP) : null;
      construirCarrito(); reiniciar();
    });
  }

  construirBarras(); refrescarTextos(); reiniciar();
  requestAnimationFrame(bucle);
}
