/* comun.js — tema claro/oscuro, encabezado, pie y utilidades compartidas */
(function () {
  "use strict";
  const CLAVE_TEMA = "seguidor_tema";
  const raiz = document.documentElement;
  try { const t = localStorage.getItem(CLAVE_TEMA); if (t) raiz.dataset.theme = t; } catch (e) {}

  const MODULOS = [
    { n: 0, t: "Requisitos y arquitectura", tag: "int", tn: "Sistema", href: "modulo0.html", listo: true,
      d: "Qué debe cumplir el carrito, cómo se cierra el lazo y cómo se acoplan los subsistemas." },
    { n: 1, t: "Mecánica", tag: "mec", tn: "Mecánica", href: "modulo1.html", listo: true,
      d: "Chasis diferencial, centro de masa, ruedas, par requerido, reducción y límite de derrape." },
    { n: 2, t: "Sensado", tag: "sen", tn: "Sensado", href: "modulo2.html", listo: true,
      d: "Sensores IR, altura, separación, calibración y cálculo de la posición de la línea." },
    { n: 3, t: "Electrónica y potencia", tag: "ele", tn: "Electrónica", href: "modulo3.html", listo: true,
      d: "Puente H, PWM, batería, regulación, presupuesto de corriente y ruido." },
    { n: 4, t: "Modelado", tag: "ctl", tn: "Modelado", href: "modulo4.html", listo: true,
      d: "Cinemática diferencial y motor de primer orden identificado con una prueba escalón." },
    { n: 5, t: "Control", tag: "ctl", tn: "Control", href: "modulo5.html", listo: true,
      d: "De on/off a P, PD y PID; muestreo, saturación y anti-windup." },
    { n: 6, t: "Programación", tag: "prg", tn: "Firmware", href: "modulo6.html", listo: true,
      d: "Lazo con temporización fija, máquina de estados, calibración y telemetría." },
    { n: 7, t: "Integración y pruebas", tag: "int", tn: "Sistema", href: "modulo7.html", listo: true,
      d: "Pruebas por subsistema, diagnóstico síntoma → causa y métricas de desempeño." },
    { n: 8, t: "Materiales, costo y sostenibilidad", tag: "int", tn: "Sistema", href: "modulo8.html", listo: true,
      d: "Lista de materiales, costo, energía por vuelta y ficha técnica final." }
  ];
  window.MODULOS = MODULOS;

  const icono = '<svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true"><rect x="3" y="3" width="22" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6" y="0" width="7" height="4" rx="1" fill="currentColor"/><rect x="6" y="18" width="7" height="4" rx="1" fill="currentColor"/><rect x="27" y="2" width="4" height="18" rx="1" fill="var(--ir)"/></svg>';
  const sol = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  const luna = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

  function esOscuro() {
    if (raiz.dataset.theme) return raiz.dataset.theme === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function montar() {
    const pagina = document.body.dataset.pagina || "";
    const top = document.createElement("header");
    top.className = "top";
    top.innerHTML =
      '<div class="wrap"><a class="marca" href="index.html">' + icono + "<span>Seguidor de línea · ingeniería aplicada</span></a>" +
      '<nav class="nav" aria-label="Secciones">' +
      '<a href="index.html" data-p="inicio">Inicio</a>' +
      MODULOS.filter(m => m.listo).map(m => '<a href="' + m.href + '" data-p="m' + m.n + '" title="Módulo ' + m.n + ': ' + m.t + '" aria-label="Módulo ' + m.n + ': ' + m.t + '">M' + m.n + '</a>').join("") +
      '<a href="simulador.html" data-p="sim">Simulador</a>' +
      "</nav>" +
      '<label class="perfil"><span>Perfil</span><select id="perfilSel" aria-label="Perfil del carrito"></select></label>' +
      '<button class="tema" id="tema" type="button" aria-label="Cambiar tema claro/oscuro"></button></div>';
    document.body.prepend(top);
    const a = top.querySelector('[data-p="' + pagina + '"]');
    if (a) a.setAttribute("aria-current", "page");

    // selector de perfil: Genérico v0 / Robot específico 01
    const selP = top.querySelector("#perfilSel");
    if (window.Ficha && window.Ficha.perfiles) {
      const act = window.Ficha.perfil();
      selP.innerHTML = window.Ficha.perfiles().map(p => '<option value="' + p.id + '"' + (p.id === act ? " selected" : "") + ">" + p.nombre + "</option>").join("");
      selP.addEventListener("change", () => { window.Ficha.cambiarPerfil(selP.value); location.reload(); });
      document.documentElement.dataset.perfil = act;
    }
    const btn = top.querySelector("#tema");
    const pintar = () => { btn.innerHTML = esOscuro() ? sol : luna; };
    pintar();
    btn.addEventListener("click", () => {
      const nuevo = esOscuro() ? "light" : "dark";
      raiz.dataset.theme = nuevo;
      try { localStorage.setItem(CLAVE_TEMA, nuevo); } catch (e) {}
      pintar();
      document.dispatchEvent(new CustomEvent("cambio-tema", { detail: nuevo }));
    });

    const pie = document.createElement("footer");
    pie.className = "pie";
    let version = "Genérico v0";
    try { version = window.Ficha ? window.Ficha.leer().version : version; } catch (e) {}
    pie.innerHTML = '<div class="wrap"><span>Ejemplo de ingeniería aplicada — carrito seguidor de línea.</span><span>Ficha técnica: <b class="ficha-version"></b></span></div>';
    pie.querySelector(".ficha-version").textContent = version;
    document.body.append(pie);
  }

  // marca para datos estimados del perfil activo que el grupo aún debe medir
  window.marcaConfirmar = function (campo) {
    const t = window.Ficha && window.Ficha.porConfirmar ? window.Ficha.porConfirmar(campo) : null;
    return t ? ' <span class="porconf" title="' + t + '">por confirmar</span>' : "";
  };

  // formato de números para la ficha
  window.fmt = function (x, dec, unidad) {
    if (typeof x !== "number" || !isFinite(x)) return "—";
    return x.toLocaleString("es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (unidad ? " " + unidad : "");
  };

  // etiquetas de columna para tablas .stack en pantallas angostas
  const etiquetar = () => { for (const c of document.querySelectorAll(".stack td:not([data-l])")) { let i = 0, q = c; while ((q = q.previousElementSibling)) i += q.colSpan; const t = c.closest("table"); c.dataset.l = (t.rows[0].cells[i] || {}).textContent || ""; } };
  new MutationObserver(etiquetar).observe(document, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();
})();
