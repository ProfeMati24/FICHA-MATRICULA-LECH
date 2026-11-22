/* =============================================================
   buscadorEstablecimientos.js — Lectura, filtrado y búsqueda.
   Script clásico: expone window.BuscadorEstablecimientos.
   Orden de carga:
     1) BD_CARGABLE/establecimientos.json (por fetch: requiere servidor)
     2) BD_CARGABLE/establecimientos.js   (funciona con doble clic)
   Si no existe ninguno, la lista queda vacía y el campo acepta texto libre.
   ============================================================= */
(function () {
  "use strict";

  const RUTA_JSON = "BD_CARGABLE/establecimientos.json";
  const RUTA_JS = "BD_CARGABLE/establecimientos.js";

  function normalizar(texto) {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function cargarScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { s.remove(); res(); };
      s.onerror = () => { s.remove(); rej(new Error("No existe " + src)); };
      document.head.appendChild(s);
    });
  }

  const BuscadorEstablecimientos = {
    datos: [],
    cargado: false,
    _cargando: null,

    cargar() {
      if (this.cargado) return Promise.resolve(this.datos.length);
      if (this._cargando) return this._cargando;

      this._cargando = (async () => {
        let lista = null;

        // 1) JSON por fetch (funciona con servidor local / http)
        try {
          const res = await fetch(RUTA_JSON, { cache: "no-store" });
          if (res.ok) {
            const j = await res.json();
            if (Array.isArray(j)) lista = j;
          }
        } catch (_) { /* file:// u otro error: seguimos con el respaldo */ }

        // 2) Respaldo .js (funciona con doble clic)
        if (!lista) {
          try {
            window.ESTABLECIMIENTOS = undefined;
            await cargarScript(RUTA_JS);
            if (Array.isArray(window.ESTABLECIMIENTOS)) lista = window.ESTABLECIMIENTOS;
          } catch (_) { /* no existe: sin lista */ }
        }

        this._cargando = null;
        if (!lista) throw new Error("No hay lista de establecimientos (BD_CARGABLE/establecimientos.json o .js)");

        this.datos = lista;
        this.cargado = true;
        return lista.length;
      })();

      return this._cargando;
    },

    /* Desplegable propio sobre un <input>. Permite escribir texto libre. */
    montarSelector(input) {
      const BE = this;
      const campo = input.closest(".campo");
      if (!campo || campo.querySelector(".sel-panel")) return;

      const panel = document.createElement("div");
      panel.className = "sel-panel";
      panel.setAttribute("role", "listbox");
      panel.hidden = true;
      campo.appendChild(panel);

      let items = [];
      let activo = -1;

      const cerrar = () => { panel.hidden = true; activo = -1; };

      const marcar = () => {
        panel.querySelectorAll(".sel-op").forEach((el, i) => {
          el.classList.toggle("is-activo", i === activo);
          if (i === activo) el.scrollIntoView({ block: "nearest" });
        });
      };

      const pintar = () => {
        if (input.readOnly || !BE.cargado) { cerrar(); return; }
        items = BE.buscar(input.value).slice(0, 40);
        if (!items.length) {
          panel.innerHTML = '<div class="sel-vacio">Sin coincidencias. Puedes escribir el nombre tal como aparece.</div>';
        } else {
          panel.innerHTML = items.map((e, i) => `
            <button type="button" class="sel-op" role="option" data-i="${i}">
              <span class="sel-nombre">${esc(e.nombre)}</span>
              <span class="sel-meta">${esc([e.categoria, e.ciudad].filter(Boolean).join(" · "))}</span>
            </button>`).join("");
        }
        activo = -1;
        panel.hidden = false;
      };

      const elegir = (e) => {
        input.value = e.nombre;
        cerrar();
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      input.addEventListener("focus", pintar);
      input.addEventListener("input", pintar);
      input.addEventListener("blur", () => setTimeout(cerrar, 150));

      input.addEventListener("keydown", ev => {
        if (panel.hidden) return;
        const n = items.length;
        if (ev.key === "ArrowDown" && n) { ev.preventDefault(); activo = (activo + 1) % n; marcar(); }
        else if (ev.key === "ArrowUp" && n) { ev.preventDefault(); activo = (activo - 1 + n) % n; marcar(); }
        else if (ev.key === "Enter") {
          ev.preventDefault();   // no enviar el formulario mientras el desplegable está abierto
          if (activo >= 0) elegir(items[activo]); else cerrar();
        }
        else if (ev.key === "Escape") cerrar();
      });

      panel.addEventListener("mousedown", ev => {
        const op = ev.target.closest(".sel-op");
        if (!op) return;
        ev.preventDefault();   // evita el blur antes de elegir
        elegir(items[Number(op.dataset.i)]);
      });

      BE.cargar().catch(err => console.warn("Establecimientos:", err.message));
    },

    obtenerTodos() { return this.datos; },

    filtrar(criterios = {}) {
      const texto = normalizar(criterios.texto);
      const ciudad = normalizar(criterios.ciudad);

      return this.datos.filter(e => {
        if (criterios.categoria && e.categoria !== criterios.categoria) return false;
        if (criterios.distancia && e.distancia !== criterios.distancia) return false;
        if (ciudad && normalizar(e.ciudad) !== ciudad) return false;
        if (texto && !normalizar(e.nombre).includes(texto)) return false;
        return true;
      });
    },

    buscar(texto) { return this.filtrar({ texto }); },
    porCategoria(categoria) { return this.filtrar({ categoria }); },
    porDistancia(distancia) { return this.filtrar({ distancia }); },
    porCiudad(ciudad) { return this.filtrar({ ciudad }); },
    contar(criterios = {}) { return this.filtrar(criterios).length; }
  };

  window.BuscadorEstablecimientos = BuscadorEstablecimientos;
})();