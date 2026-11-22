/* =============================================================
   start.js — Lobby previo al formulario de matrícula.
   Script clásico: usa window.BD (cargado por ScriptBD.js).
   Pregunta curso y, para 2°-4°, si el alumno ya estudiaba aquí.
   Si ya estudiaba: pide RUT, busca en toda la BD y precarga.
   Al terminar, publica window.__matricula y dispara el formulario.
   ============================================================= */
(function () {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);

  /* ---------- helpers ---------- */
  function formatearRUT(v) {
    const l = String(v || "").replace(/[^0-9kK]/g, "").toUpperCase();
    if (l.length < 2) return l;
    return l.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + l.slice(-1);
  }

  function toast(msg, tipo = "info", ms = 4500) {
    let cont = qs("#toast-cont");
    if (!cont) {
      cont = document.createElement("div");
      cont.id = "toast-cont";
      cont.className = "toast-cont";
      document.body.appendChild(cont);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${tipo}`;
    el.textContent = msg;
    cont.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  const CURSOS = {
    1: "Primero Medio",
    2: "Segundo Medio",
    3: "Tercer Medio",
    4: "Cuarto Medio"
  };

  /* ---------- estado del lobby ---------- */
  const estado = {
    grado: null,       // 1..4
    repitente: null,   // true/false (solo 2-4)
    rut: null,         // RUT ingresado (solo repitente=true)
    preload: null      // registro encontrado (solo repitente=true)
  };

  /* ---------- arranque ---------- */
  document.addEventListener("DOMContentLoaded", arrancar);

  function arrancar() {
    const cont = qs("#lobby");
    if (!cont) { console.warn("start.js: no existe #lobby"); return; }
    mostrarGrado();
  }

  function render(html) {
    const cont = qs("#lobby");
    cont.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  /* ============================================================
     PASO 1 · Grado
     ============================================================ */
  function mostrarGrado() {
    render(`
      <div class="lobby-step" data-step="grado">
        <h2>¿A qué curso ingresa el alumno?</h2>
        <p>Selecciona el nivel al que se matricula este año.</p>
        <div class="grado-grid">
          ${[1, 2, 3, 4].map(g => `
            <button type="button" class="grado-btn" data-grado="${g}">
              <span class="num">${g}°</span>
              ${CURSOS[g]}
            </button>
          `).join("")}
        </div>
      </div>
    `);
    qs("#lobby").querySelectorAll("[data-grado]").forEach(b => {
      b.addEventListener("click", () => {
        estado.grado = Number(b.dataset.grado);
        if (estado.grado === 1) {
          // 1° Medio: siempre formulario normal, establecimiento obligatorio
          finalizar(false);
        } else {
          mostrarRepitente();
        }
      });
    });
  }

  /* ============================================================
     PASO 2 · ¿Ya estudiaba en el Liceo? (solo 2-4)
     ============================================================ */
  function mostrarRepitente() {
    render(`
      <div class="lobby-step" data-step="repitente">
        <h2>¿El alumno ya estudiaba en el Liceo Eduardo Charme?</h2>
        <p>Si ya fue matriculado en años anteriores, podemos reutilizar sus datos.</p>
        <div class="choice-row">
          <button type="button" class="choice-btn" data-repitente="si">
            <strong>Sí, ya estudiaba aquí</strong>
            <span>Buscaré sus datos por RUT y los precargaré.</span>
          </button>
          <button type="button" class="choice-btn" data-repitente="no">
            <strong>No, es nuevo en el Liceo</strong>
            <span>Llenaré el formulario desde cero.</span>
          </button>
        </div>
        <div class="lobby-nav">
          <button type="button" data-volver>← Volver</button>
        </div>
      </div>
    `);
    const lobby = qs("#lobby");
    lobby.querySelectorAll("[data-repitente]").forEach(b => {
      b.addEventListener("click", () => {
        estado.repitente = b.dataset.repitente === "si";
        if (estado.repitente) mostrarRut();
        else finalizar(false);
      });
    });
    lobby.querySelector("[data-volver]")?.addEventListener("click", mostrarGrado);
  }

  /* ============================================================
     PASO 3 · RUT del alumno (solo repitente=true)
     ============================================================ */
  function mostrarRut() {
    render(`
      <div class="lobby-step" data-step="rut">
        <h2>Ingresa el R.U.T del alumno</h2>
        <p>Buscaremos el registro más reciente entre todas las matrículas del liceo.</p>
        <input type="text" id="lobby-rut" class="lobby-input" placeholder="21.345.678-9" autocomplete="off">
        <div class="lobby-nav">
          <button type="button" data-volver>← Volver</button>
          <button type="button" class="btn-primary" data-buscar>Buscar alumno</button>
        </div>
      </div>
    `);
    const lobby = qs("#lobby");
    const inp = lobby.querySelector("#lobby-rut");
    inp.focus();
    inp.addEventListener("blur", () => {
      if (inp.value.trim()) inp.value = formatearRUT(inp.value);
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); buscarYContinuar(); }
    });
    lobby.querySelector("[data-volver]").addEventListener("click", () => mostrarRepitente());
    lobby.querySelector("[data-buscar]").addEventListener("click", buscarYContinuar);

    async function buscarYContinuar() {
      const rutRaw = inp.value.trim();
      if (!rutRaw) { toast("Ingresa el R.U.T del alumno.", "error"); return; }
      const btn = lobby.querySelector("[data-buscar]");
      const htmlOrig = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = "Buscando…";

      try {
        // Asegurar BD cargada (Form.js también la inicializa; si no, la restauramos)
        if (!window.BD.ultimaCarga) {
          const r = await window.BD.intentarRestaurar();
          if (!r.ok) {
            toast("Conecta la carpeta de datos para buscar el R.U.T.", "error");
            mostrarErrorBD();
            return;
          }
        }

        const encontrado = window.BD.buscarPorRUT(rutRaw);
        estado.rut = formatearRUT(rutRaw);

        if (encontrado) {
          estado.preload = encontrado;
          finalizar(true);
        } else {
          mostrarErrorRut();
        }
      } catch (e) {
        toast("No se pudo buscar: " + e.message, "error");
        btn.disabled = false;
        btn.innerHTML = htmlOrig;
      }
    }
  }

  /* ============================================================
     PASO 4a · RUT no encontrado → reintentar / manual
     ============================================================ */
  function mostrarErrorRut() {
    render(`
      <div class="lobby-step" data-step="rut-error">
        <div class="lobby-error">
          No encontramos un registro con el R.U.T <strong>${estado.rut}</strong> en la base del liceo.
        </div>
        <h2>¿Qué deseas hacer?</h2>
        <p>Verifica el R.U.T y vuelve a intentarlo, o llena los datos manualmente
           (el establecimiento igual quedará bloqueado como «Liceo Eduardo Charme»).</p>
        <div class="lobby-nav">
          <button type="button" data-volver>← Volver</button>
          <button type="button" class="btn-primary" data-manual>Rellenar manualmente</button>
          <button type="button" class="btn-primary" data-reintentar>Buscar de nuevo</button>
        </div>
      </div>
    `);
    const lobby = qs("#lobby");
    lobby.querySelector("[data-volver]").addEventListener("click", () => {
      estado.rut = null;
      mostrarRut();
    });
    lobby.querySelector("[data-reintentar]").addEventListener("click", () => {
      estado.rut = null;
      mostrarRut();
    });
    lobby.querySelector("[data-manual]").addEventListener("click", () => {
      // preload parcial: solo el RUT ya escrito
      estado.preload = {
        alumno: { rut: estado.rut },
        _manual: true
      };
      finalizar(true);
    });
  }

  /* ============================================================
     PASO 4b · Sin BD disponible
     ============================================================ */
  function mostrarErrorBD() {
    render(`
      <div class="lobby-step" data-step="rut-error-bd">
        <div class="lobby-error">
          No hay carpeta de datos conectada. Conéctala desde la barra superior
          (botón «Conectar carpeta») y luego vuelve a intentarlo.
        </div>
        <div class="lobby-nav">
          <button type="button" data-volver>← Volver</button>
          <button type="button" class="btn-primary" data-manual>Rellenar manualmente</button>
        </div>
      </div>
    `);
    const lobby = qs("#lobby");
    lobby.querySelector("[data-volver]").addEventListener("click", mostrarRut);
    lobby.querySelector("[data-manual]").addEventListener("click", () => {
      estado.preload = {
        alumno: { rut: estado.rut || "" },
        _manual: true
      };
      finalizar(true);
    });
  }

  /* ============================================================
     FINALIZAR · construir contexto y transicionar al formulario
     ============================================================ */
  function finalizar(esRepitente) {
    const bloqueado = esRepitente; // 2-4 y ya estudiaba: establecimiento fijo

    const ctx = {
      grado: estado.grado,
      curso: CURSOS[estado.grado],
      establecimientoObligatorio: true,        // siempre obligatorio
      establecimientoBloqueado: bloqueado,     // 2-4 + ya estudiaba → "Liceo Eduardo Charme"
      establecimientoFijo: bloqueado ? "Liceo Eduardo Charme" : null,
      preload: esRepitente ? (estado.preload || null) : null,
      esRepitente
    };

    window.__matricula = ctx;

    const lobbyEl = qs("#lobby");
    const formEl = qs("#form-matricula");
    if (!lobbyEl || !formEl) return;

    lobbyEl.style.transition = "opacity .28s ease, transform .28s ease";
    lobbyEl.style.opacity = "0";
    lobbyEl.style.transform = "translateY(-8px)";

    setTimeout(() => {
      lobbyEl.classList.add("oculto");
      formEl.classList.remove("form-oculto");
      formEl.style.animation = "aparecer .4s ease";
      if (window.lucide) lucide.createIcons();
      // Avisar a Form.js que aplique el contexto
      document.dispatchEvent(new CustomEvent("matricula:context", { detail: ctx }));
    }, 300);
  }
})();