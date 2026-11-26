/* ============================================================
   carrito.js — FICHA TÉCNICA DEL CARRITO
   Este es el ÚNICO lugar donde viven los parámetros por defecto.
   Hay dos perfiles: el carrito genérico y el "Robot específico 01" del grupo.
   Cuando el carrito real se vaya definiendo (motor elegido, rueda,
   sensores, batería), basta con actualizar estos valores y subir
   el número de versión: todo el sitio y el simulador los toman.
   ============================================================ */
(function (g) {
  const CARRITO_GENERICO = {
    perfilId: "generico",
    version: "Genérico v0",
    // --- Requisitos (Módulo 0) ---
    anchoLinea: 0.019,   // m  (cinta de aislar estándar, 19 mm)
    radioMin: 0.20,      // m  radio de curva más cerrada de la pista
    vObjetivo: 0.60,     // m/s velocidad media deseada
    longPista: 6.0,      // m  longitud de la pista de prueba
    masaMax: 0.40,       // kg
    presupuesto: 1500,   // MXN
    // --- Mecánica (Módulo 1) ---
    masa: 0.35,          // kg (estimada)
    radioRueda: 0.0165,  // m  (rueda de 33 mm de diámetro)
    trocha: 0.12,        // m  distancia entre ruedas motrices
    lookahead: 0.06,     // m  distancia eje de ruedas -> arreglo de sensores
    mu: 0.8,             // coef. de fricción llanta-piso
    fTraccion: 0.91,     // fracción del peso sobre las ruedas motrices (Módulo 1)
    posBateria: -0.045,  // m  posición de la batería respecto al eje (negativo = atrás)
    masaBateria: 0.09,   // kg
    crr: 0.02,           // coef. de resistencia a la rodadura
    apoyo: "loca",       // "loca" = rueda loca atrás · "patin" = patines bajo la barra de sensores
    xApoyo: -0.05,       // m  posición del apoyo respecto al eje (negativo = atrás)
    // masas fijas para el centro de masa: [nombre, kg, x en m (o "L·f" = fracción del lookahead)]
    masasFijas: [["Motores, cajas y ruedas", 0.080, 0], ["Chasis (placa)", 0.070, "L·0.5-0.015"], ["Barra de sensores", 0.025, "L·1"], ["Microcontrolador y puente H", 0.035, 0.02], ["Rueda loca", 0.015, -0.05], ["Tornillería y cables", 0.035, 0]],
    // --- Motorreductor (Módulos 1, 3 y 4) ---
    n0Motor: 30000,      // rpm del motor SIN reducción, sin carga, a V nominal
    tauStall: 0.00075,   // N·m par de arranque del motor SIN reducción a V nominal
    iStall: 1.6,         // A   corriente de arranque (rotor bloqueado) por motor
    reduccion: 50,       // relación de la caja 1:N
    eta: 0.65,           // eficiencia de la caja de engranes
    factorTau: 1.0,      // τ medido / τ teórico (Módulo 4: inercia del rotor, fricciones)
    i0Motor: 0.06,       // A   corriente sin carga por motor
    vNom: 7.4,           // V   voltaje nominal del motor
    // --- Electrónica y potencia (Módulo 3) ---
    driver: "TB6612FNG", // puente H elegido
    caidaDriver: 0.3,    // V   caída en los transistores del puente H a la corriente de trabajo
    bateriaMah: 500,     // mAh capacidad de la batería
    regulador: "AMS1117", // regulador de 5 V para lógica y sensores
    iTrabajo: 0.5,       // A   corriente típica por motor al seguir la línea
    compensarV: 0,       // 1 = el firmware mide Vbat y escala el PWM
    // derivados (se recalculan con derivar()):
    rpmMax: 600,         // rpm de la rueda sin carga
    tauMotor: 0.12,      // s   constante de tiempo del carrito completo
    vBat: 7.4,           // V   voltaje de batería (LiPo 2S)
    // --- Sensado (Módulo 2) ---
    nSens: 8,            // número de sensores IR
    pasoSens: 0.0095,    // m   separación entre sensores
    ruido: 0.015,        // ruido relativo de lectura (0–1)
    alturaSens: 0.003,   // m  altura de los sensores sobre el piso
    digital: 0,          // 0 = lectura analógica ponderada, 1 = umbral (digital)
    rLed: 220,           // Ω  resistencia limitadora del LED IR
    rPullup: 10000,      // Ω  resistencia de carga del fototransistor
    barraForma: "recta", // "recta" o "curva"
    radioBarra: 0.20,    // m  radio del arco si la barra es curva
    mux: 0,              // 1 = sensores leídos por multiplexor (una sola entrada analógica)
    tAdcUs: 112,         // µs por conversión del ADC (Arduino por defecto)
    // --- Control y firmware (Módulos 5 y 6) ---
    kp: 0.8,
    ki: 0.0,
    kd: 0.03,
    vBase: 0.50,         // ciclo de trabajo base (0–1)
    periodo: 0.005,      // s   periodo del lazo de control (200 Hz)
    filtroD: 0.0,        // 0–0.95 filtro pasa-bajas de la derivada (α)
    antiWindup: 1,       // 1 = limitar la acción integral
    modoCtl: 0,          // 0 = PID, 1 = on/off
    onoffU: 0.4,         // corrección fija del control on/off
    // --- Firmware (Módulo 6) ---
    baud: 115200,        // velocidad del puerto serial
    telemCada: 4,        // enviar telemetría 1 de cada N periodos
    // --- Materiales (Módulo 8) ---
    material: "MDF"      // material del chasis
  };

  /* ---------------- Robot específico 01 ----------------
     Datos dados por el grupo: motores planetarios 5:1, 5000 rpm a 12 V, 1.6 A de arranque,
     0.23 kg·cm, 29 g; llantas 20 × 20 mm; barra 16sMuxHS (16 sensores QRE1113 en arco,
     multiplexor 16:1, 125 mA, 3 mm de altura ideal); PCB TB6612 + Arduino Nano como chasis
     (pensada para batería 2S). Lo marcado en POR_CONFIRMAR es estimado y hay que medirlo. */
  const ESPECIFICO_01 = Object.assign({}, CARRITO_GENERICO, {
    perfilId: "especifico01",
    version: "Robot específico 01",
    vObjetivo: 1.5, longPista: 6.0, masaMax: 0.25, presupuesto: 3500, radioMin: 0.20,
    masa: 0.165, radioRueda: 0.010, trocha: 0.10, lookahead: 0.12, mu: 0.9,
    apoyo: "patin", xApoyo: 0.12, posBateria: 0.0, masaBateria: 0.030, fTraccion: 0.835,
    masasFijas: [["Motores planetarios (2 × 29 g)", 0.058, 0], ["Llantas 20 × 20 mm (par)", 0.010, 0], ["PCB TB6612 + Arduino Nano (chasis)", 0.025, 0.005], ["Brazos y barra 16sMuxHS", 0.030, "L·0.55"], ["Cables, tornillos y patines", 0.012, "L·0.8"]],
    n0Motor: 25000, tauStall: 0.00564, iStall: 1.6, reduccion: 5, eta: 0.8, vNom: 12, i0Motor: 0.12,
    driver: "TB6612FNG", caidaDriver: 0.15, bateriaMah: 450, regulador: "AMS1117", iTrabajo: 0.3, vBat: 7.4,
    nSens: 16, pasoSens: 0.0078, alturaSens: 0.003, rLed: 470, rPullup: 10000,
    barraForma: "curva", radioBarra: 0.20, mux: 1, tAdcUs: 112,
    kp: 0.9, ki: 0, kd: 0.06, vBase: 0.35, periodo: 0.003, filtroD: 0.5,
    material: "FR4"
  });
  const POR_CONFIRMAR = {
    especifico01: {
      trocha: "estimada de la foto", lookahead: "estimada de la foto (eje → sensor central)", radioBarra: "estimado del plano de la barra",
      masa: "estimada por componentes; falta pesar", masaBateria: "batería aún no elegida", bateriaMah: "batería aún no elegida",
      mu: "supuesto para llanta de silicón", eta: "supuesta para caja planetaria", regulador: "modelo no indicado por el fabricante de la PCB",
      xApoyo: "supuesto: patines bajo la barra", periodo: "propuesta inicial", kp: "sintonía inicial en el simulador", kd: "sintonía inicial en el simulador",
      vObjetivo: "falta el reglamento de la competencia", longPista: "falta el reglamento de la competencia", masaMax: "falta el reglamento", presupuesto: "supuesto"
    }
  };
  const PERFILES = { generico: CARRITO_GENERICO, especifico01: ESPECIFICO_01 };
  const CLAVES = { generico: "seguidor_ficha_v0", especifico01: "seguidor_ficha_esp01" };
  const CLAVE_PERFIL = "seguidor_perfil";

  /* Modelo del motorreductor con curva par–velocidad lineal:
     rueda:  n0 = n0Motor/N,   τ0 = N·η·τStall
     carrito (2 motores): F(v) = F0·(1 − v/v0),  F0 = 2·τ0/r,  v0 = n0·2π/60·r
     m·dv/dt = F0(1 − v/v0)  →  constante de tiempo τ = m·v0/F0  (no depende del voltaje) */
  function derivar(f) {
    const d = {};
    d.rpmMax = f.n0Motor / f.reduccion;
    const v0 = d.rpmMax * 2 * Math.PI / 60 * f.radioRueda;
    const F0 = 2 * f.reduccion * f.eta * f.tauStall / f.radioRueda;
    d.tauMotor = f.masa * v0 / F0 * (f.factorTau || 1);
    return d;
  }

  function perfilActivo() {
    let k = "generico";
    try { k = localStorage.getItem(CLAVE_PERFIL) || "generico"; } catch (e) {}
    return PERFILES[k] ? k : "generico";
  }
  function leerFicha(perfil) {
    const k = perfil || perfilActivo();
    let guardada = {};
    try { guardada = JSON.parse(localStorage.getItem(CLAVES[k]) || "{}") || {}; } catch (e) { guardada = {}; }
    const f = Object.assign({}, PERFILES[k]);
    for (const c in guardada) if (c in f && c !== "perfilId" && typeof guardada[c] === typeof f[c]) f[c] = guardada[c];
    return Object.assign(f, derivar(f));
  }
  const avisar = f => { if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new CustomEvent("ficha-cambiada", { detail: f })); };
  function guardarFicha(cambios, perfil) {
    const k = perfil || perfilActivo();
    const f = Object.assign(leerFicha(k), cambios || {});
    Object.assign(f, derivar(f));
    try { localStorage.setItem(CLAVES[k], JSON.stringify(f)); } catch (e) {}
    if (k === perfilActivo()) avisar(f);
    return f;
  }
  function restablecerFicha(perfil) {
    const k = perfil || perfilActivo();
    try { localStorage.removeItem(CLAVES[k]); } catch (e) {}
    const f = leerFicha(k);
    if (k === perfilActivo()) avisar(f);
    return f;
  }
  function cambiarPerfil(k) {
    if (!PERFILES[k]) return;
    try { localStorage.setItem(CLAVE_PERFIL, k); } catch (e) {}
    if (g.dispatchEvent && g.CustomEvent) g.dispatchEvent(new CustomEvent("perfil-cambiado", { detail: k }));
  }
  const porConfirmar = (campo, perfil) => ((POR_CONFIRMAR[perfil || perfilActivo()] || {})[campo]) || null;
  const otroPerfil = () => perfilActivo() === "generico" ? "especifico01" : "generico";

  // voltaje que realmente llega al motor
  const vMotor = f => Math.max(0, f.vBat - (f.caidaDriver || 0));
  // voltaje de referencia de la compensación: el que el motor puede recibir aun con la batería
  // casi descargada (≈ 89 % del nominal en una LiPo), sin pasar del 90 % del voltaje del motor
  const vRefComp = f => Math.min(0.9 * f.vNom, 0.89 * f.vBat - (f.caidaDriver || 0));
  // posición x de una masa fija (admite "L·f" o "L·f-c")
  const xMasa = (x, f) => { if (typeof x === "number") return x; const m = /^L·([\d.]+)(-[\d.]+)?$/.exec(x); return m ? f.lookahead * parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) : 0) : 0; };

  Object.assign(CARRITO_GENERICO, derivar(CARRITO_GENERICO));
  Object.assign(ESPECIFICO_01, derivar(ESPECIFICO_01));
  g.CARRITO_GENERICO = CARRITO_GENERICO;
  g.Ficha = {
    leer: leerFicha, guardar: guardarFicha, restablecer: restablecerFicha, derivar, vMotor, vRefComp, xMasa,
    perfil: perfilActivo, cambiarPerfil, otroPerfil, porConfirmar,
    perfiles: () => Object.keys(PERFILES).map(k => ({ id: k, nombre: PERFILES[k].version }))
  };
  if (typeof module !== "undefined") module.exports = { CARRITO_GENERICO, ESPECIFICO_01, POR_CONFIRMAR, derivar, vMotor, vRefComp, xMasa };
})(typeof window !== "undefined" ? window : globalThis);
