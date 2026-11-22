/* =============================================================
   selectorFecha.js — Selector de fecha propio (reemplaza <input type="date">).
   Dos formas de ingresar: escribiendo (dd/mm/aaaa, con corrección automática)
   o eligiendo en el calendario. El <input> original queda oculto y conserva el
   valor YYYY-MM-DD, así que la validación y el guardado no cambian.
   Script clásico: expone window.SelectorFecha.montar(input, opciones).
   Opciones: { max: "hoy" | "AAAA-MM-DD", min, anioMin }
   ============================================================= */
(function () {
  "use strict";

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
  const ICONO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  const pad = n => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const parsear = s => {
    const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    return r ? { y: +r[1], m: +r[2], d: +r[3] } : null;
  };
  const hoy = () => {
    const h = new Date();
    return iso(h.getFullYear(), h.getMonth() + 1, h.getDate());
  };
  const diasEnMes = (y, m) => new Date(y, m, 0).getDate();
  const aTexto = s => {
    const p = parsear(s);
    return p ? `${pad(p.d)}/${pad(p.m)}/${p.y}` : "";
  };

  /* Interpreta lo escrito y devuelve YYYY-MM-DD, "" (vacío) o null (no entendible). */
  function interpretar(texto, min, max) {
    const t = String(texto || "").trim();
    if (!t) return "";
    const partes = t.match(/\d+/g);
    if (!partes) return null;
    const digitos = t.replace(/\D/g, "");

    let d, m, yRaw;
    if (partes.length === 3 && partes[0].length === 4) {          // AAAA-MM-DD
      yRaw = partes[0]; m = partes[1]; d = partes[2];
    } else if (partes.length === 3) {                              // DD/MM/AAAA (separadores bien puestos)
      d = partes[0]; m = partes[1]; yRaw = partes[2];
    } else if (digitos.length === 8 || digitos.length === 6) {     // barras mal puestas o sin barras: 03/082008, 03082008
      d = digitos.slice(0, 2); m = digitos.slice(2, 4); yRaw = digitos.slice(4);
    } else {
      return null;
    }

    // Año de dos dígitos: 26 → 2026, 90 → 1990
    let y = Number(yRaw);
    if (yRaw.length <= 2) {
      const actual = new Date().getFullYear();
      y = y <= actual % 100 ? 2000 + y : 1900 + y;
    }
    m = Number(m); d = Number(d);

    if (!Number.isInteger(y) || y < 1900 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1) return null;
    if (d > diasEnMes(y, m)) d = diasEnMes(y, m);       // 31/02 → último día del mes

    let f = iso(y, m, d);
    if (max && f > max) f = max;                         // fuera de rango → límite permitido
    if (min && f < min) f = min;
    return f;
  }

  function montar(input, opciones = {}) {
    if (!input || input.dataset.selectorFecha) return;
    input.dataset.selectorFecha = "1";
    const campo = input.closest(".campo");
    if (!campo) return;

    const max = opciones.max === "hoy" ? hoy() : (opciones.max || "");
    const min = opciones.min || "";
    const anioMin = opciones.anioMin || 1950;
    const anioMax = max ? parsear(max).y : new Date().getFullYear() + 1;

    // Control visible: campo de texto + botón de calendario
    const control = document.createElement("div");
    control.className = "fecha-control";
    control.innerHTML = `
      <input type="text" class="fecha-texto" inputmode="numeric" maxlength="10"
             placeholder="dd/mm/aaaa" autocomplete="off" aria-label="Fecha (dd/mm/aaaa)">
      <button type="button" class="fecha-cal-btn" aria-label="Abrir calendario" title="Abrir calendario">${ICONO}</button>`;
    const texto = control.querySelector(".fecha-texto");
    const botonCal = control.querySelector(".fecha-cal-btn");

    // Ventana del calendario
    const pop = document.createElement("div");
    pop.className = "fecha-pop";
    pop.hidden = true;

    campo.appendChild(control);
    campo.appendChild(pop);

    let vista = { y: new Date().getFullYear(), m: new Date().getMonth() + 1 };
    let modo = "dias"; // "dias" | "anios"

    function actualizarTexto() {
      texto.value = aTexto(input.value);
      control.classList.toggle("vacio", !texto.value);
    }

    // Si el valor cambia por código (precarga del registro), actualizar el texto visible
    const descValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    Object.defineProperty(input, "value", {
      configurable: true,
      get() { return descValor.get.call(this); },
      set(v) { descValor.set.call(this, v); actualizarTexto(); }
    });

    // Mantener el color de error del formulario (campo-invalido) en el control visible
    new MutationObserver(() => {
      control.classList.toggle("campo-invalido", input.classList.contains("campo-invalido"));
    }).observe(input, { attributes: true, attributeFilter: ["class"] });

    function asignar(v) {
      const anterior = input.value;
      input.value = v;            // el hook actualiza el texto visible
      actualizarTexto();
      if (anterior !== v) input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    /* ---------- ESCRIBIR ---------- */
    texto.addEventListener("input", () => {
      const v = texto.value;
      // Solo números: poner las barras automáticamente
      if (/^\d+$/.test(v) && v.length > 2) {
        const dig = v.slice(0, 8);
        let out = dig.slice(0, 2);
        if (dig.length > 2) out += "/" + dig.slice(2, 4);
        if (dig.length > 4) out += "/" + dig.slice(4);
        texto.value = out;
      }
      // Fecha completa escrita: confirmar al instante
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto.value)) confirmarTexto();
    });

    function confirmarTexto() {
      const txt = texto.value;
      if (!txt.trim()) { asignar(""); return; }
      const v = interpretar(txt, min, max);
      if (v === null) { actualizarTexto(); return; }   // no se entiende: vuelve al último valor
      asignar(v);
    }

    texto.addEventListener("blur", confirmarTexto);
    texto.addEventListener("keydown", ev => {
      if (ev.key === "Enter") { ev.preventDefault(); confirmarTexto(); }
      else if (ev.key === "ArrowDown") { ev.preventDefault(); abrir(); }
    });

    /* ---------- CALENDARIO ---------- */
    function renderDias() {
      const sel = parsear(input.value);
      const hoyISO = hoy();
      const { y, m } = vista;
      const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // semana empieza en lunes
      const dias = diasEnMes(y, m);

      let celdas = "";
      for (let i = 0; i < offset; i++) celdas += '<span></span>';
      for (let d = 1; d <= dias; d++) {
        const f = iso(y, m, d);
        const fuera = (max && f > max) || (min && f < min);
        const clases = ["fp-dia"];
        if (f === hoyISO) clases.push("is-hoy");
        if (sel && sel.y === y && sel.m === m && sel.d === d) clases.push("is-sel");
        celdas += `<button type="button" class="${clases.join(" ")}" data-iso="${f}"${fuera ? " disabled" : ""}>${d}</button>`;
      }
      const hoyPermitido = !(max && hoyISO > max);

      pop.innerHTML = `
        <div class="fp-cab">
          <button type="button" class="fp-nav" data-nav="-1" aria-label="Mes anterior">‹</button>
          <button type="button" class="fp-titulo" data-accion="anios" title="Elegir año">
            ${MESES[m - 1]} <span class="fp-anio-num">${y}</span>
          </button>
          <button type="button" class="fp-nav" data-nav="1" aria-label="Mes siguiente">›</button>
        </div>
        <div class="fp-semana">${DIAS.map(d => `<span>${d}</span>`).join("")}</div>
        <div class="fp-grid">${celdas}</div>
        <div class="fp-pie">
          <button type="button" class="fp-accion" data-accion="hoy"${hoyPermitido ? "" : " disabled"}>Hoy</button>
          <button type="button" class="fp-accion" data-accion="borrar">Borrar</button>
        </div>`;
    }

    function renderAnios() {
      let html = "";
      for (let a = anioMax; a >= anioMin; a--) {
        html += `<button type="button" class="fp-anio${a === vista.y ? " is-sel" : ""}" data-anio="${a}">${a}</button>`;
      }
      pop.innerHTML = `
        <div class="fp-cab">
          <span class="fp-titulo fp-titulo--fijo">Elegir año</span>
          <button type="button" class="fp-volver" data-accion="dias">Volver</button>
        </div>
        <div class="fp-anios">${html}</div>`;
      // Llevar el año seleccionado a la vista del contenedor (sin mover la página)
      const cont = pop.querySelector(".fp-anios");
      const sel = pop.querySelector(".fp-anio.is-sel");
      if (cont && sel) cont.scrollTop = sel.offsetTop - cont.clientHeight / 2 + sel.clientHeight / 2;
    }

    function render() { modo === "anios" ? renderAnios() : renderDias(); }

    const estaAbierto = () => !pop.hidden;

    function abrir() {
      const base = parsear(input.value) || parsear(max) || parsear(hoy());
      vista = { y: base.y, m: base.m };
      modo = "dias";
      render();
      pop.style.top = (control.offsetTop + control.offsetHeight + 6) + "px";
      pop.style.left = "0px";
      pop.hidden = false;
    }

    function cerrar() { pop.hidden = true; }

    function moverMes(delta) {
      const total = vista.y * 12 + (vista.m - 1) + delta;
      const nuevoY = Math.floor(total / 12);
      if (nuevoY < anioMin || nuevoY > anioMax) return;
      vista = { y: nuevoY, m: (total % 12) + 1 };
      render();
    }

    botonCal.addEventListener("click", () => (estaAbierto() ? cerrar() : abrir()));

    pop.addEventListener("click", ev => {
      const t = ev.target;

      const nav = t.closest(".fp-nav");
      if (nav && !nav.disabled) { moverMes(Number(nav.dataset.nav)); return; }

      const anioBtn = t.closest(".fp-anio");
      if (anioBtn) {
        vista.y = Number(anioBtn.dataset.anio);
        modo = "dias";
        render();
        return;
      }

      const dia = t.closest(".fp-dia");
      if (dia && !dia.disabled) { asignar(dia.dataset.iso); cerrar(); return; }

      const acc = t.closest("[data-accion]");
      if (!acc || acc.disabled) return;
      const a = acc.dataset.accion;
      if (a === "anios") { modo = "anios"; render(); }
      else if (a === "dias") { modo = "dias"; render(); }
      else if (a === "hoy") { asignar(hoy()); cerrar(); }
      else if (a === "borrar") { asignar(""); cerrar(); }
    });

    document.addEventListener("mousedown", ev => {
      if (estaAbierto() && !campo.contains(ev.target)) cerrar();
    });
    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") cerrar();
    });

    // Al limpiar el formulario, el valor oculto se vacía: refrescar el texto visible
    const form = input.form || campo.closest("form");
    form?.addEventListener("reset", () => setTimeout(() => { input.value = ""; actualizarTexto(); }, 0));

    actualizarTexto();
  }

  window.SelectorFecha = { montar };
})();