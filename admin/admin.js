/* =============================================================
   admin/admin.js — Panel de administración
   Script clásico (funciona con doble clic). Usa window.BD,
   cargado antes por ../ScriptBD.js.
   Tema compartido con el formulario: clave "charme-tema".
   ============================================================= */
(function () {
  "use strict";

  const BD = window.BD;

  // Tema propio del admin
  const temaGuardado = localStorage.getItem("charme-tema");
  if (temaGuardado) {
    document.documentElement.setAttribute("data-theme", temaGuardado);
  }

  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PWD_ADMIN = "2448";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function toast(m, t = "info", ms = 4000) {
    let c = qs("#toast-cont");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-cont";
      c.className = "toast-cont";
      document.body.appendChild(c);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${t}`;
    el.textContent = m;
    c.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function truncar(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  /* ---------- LOGIN ---------- */
  qs("#btn-login").addEventListener("click", entrar);
  qs("#pwd").addEventListener("keydown", e => { if (e.key === "Enter") entrar(); });
  function entrar() {
    if (qs("#pwd").value === PWD_ADMIN) {
      qs("#login").style.display = "none";
      qs("#admin").classList.add("on");
      iniciar();
    } else {
      qs("#login-error").classList.add("on");
    }
  }
  qs("#btn-salir").addEventListener("click", () => {
    qs("#admin").classList.remove("on");
    qs("#login").style.display = "";
    qs("#pwd").value = "";
    qs("#login-error").classList.remove("on");
  });

  /* ---------- ARRANQUE ---------- */
  let yaIniciado = false;
  async function iniciar() {
    if (yaIniciado) return;
    yaIniciado = true;

    if (window.lucide) lucide.createIcons();

    qs("#btn-excel").addEventListener("click", exportarExcel);

    qs("#btn-limpiar-filtros").addEventListener("click", () => {
      qs("#f-buscar").value = "";
      qs("#f-anio").value = "";
      qs("#f-establecimiento").value = "";
      qs("#f-estado").value = "";
      refrescar();
    });

    ["f-buscar", "f-anio", "f-establecimiento", "f-estado"].forEach(id => {
      qs("#" + id).addEventListener("input", refrescar);
      qs("#" + id).addEventListener("change", refrescar);
    });

    const r = await BD.intentarRestaurar();
    if (r.ok) {
      refrescar();
    } else if (r.motivo === "sin-token") {
      toast("Configura el token de GitHub en ScriptBD.js para cargar los datos.", "error", 6000);
      refrescar();
    } else {
      toast("No se pudo cargar desde GitHub: " + (r.error || "error de conexión"), "error", 6000);
      refrescar();
    }

    BD.suscribir(t => {
      if (["alta", "cambio", "baja", "cargado", "conexion", "desconexion"].includes(t)) {
        refrescar();
      }
    });
  }

  /* ---------- TABLA + FILTROS ---------- */
  function refrescar() {
    if (!BD.conectado) {
      qs("#contador").textContent = "Sin conexión a la base de datos.";
      qs("#tbody").innerHTML = `<tr><td colspan="8" class="vacio">No hay datos cargados desde GitHub.</td></tr>`;
      return;
    }

    const anios = new Set();
    const establecimientos = new Set();
    const estados = new Set();
    for (const p of BD.postulantes) {
      anios.add(p.anio);
      const est = p.alumno?.establecimientoAnterior;
      if (est) establecimientos.add(est);
      estados.add(p.estado);
    }
    rellenar("f-anio", [...anios].sort(), "Todos");
    rellenar("f-establecimiento", [...establecimientos].sort((a, b) => a.localeCompare(b)), "Todos");
    rellenar("f-estado", [...estados].sort(), "Todos");

    const filtros = {
      texto: qs("#f-buscar").value.toLowerCase().trim(),
      anio: qs("#f-anio").value,
      establecimiento: qs("#f-establecimiento").value,
      estado: qs("#f-estado").value
    };

    const filas = BD.postulantes.filter(p => {
      if (filtros.anio && String(p.anio) !== filtros.anio) return false;
      if (filtros.establecimiento && (p.alumno?.establecimientoAnterior || "") !== filtros.establecimiento) return false;
      if (filtros.estado && p.estado !== filtros.estado) return false;
      if (filtros.texto) {
        const blob = JSON.stringify(p).toLowerCase();
        if (!blob.includes(filtros.texto)) return false;
      }
      return true;
    });

    filas.sort((a, b) =>
      (b.anio - a.anio) || String(a.numeroMatricula).localeCompare(String(b.numeroMatricula)));

    qs("#contador").innerHTML =
      `Mostrando <strong>${filas.length}</strong> de <strong>${BD.postulantes.length}</strong> postulantes`;

    const tb = qs("#tbody");
    if (!filas.length) {
      tb.innerHTML = `<tr><td colspan="8" class="vacio">Sin postulantes para estos filtros.</td></tr>`;
      return;
    }
    tb.innerHTML = "";
    for (const p of filas) {
      const tr = document.createElement("tr");
      const nom = `${p.alumno?.apellidoPaterno || ""} ${p.alumno?.apellidoMaterno || ""}, ${p.alumno?.nombres || ""}`.trim();
      const est = p.alumno?.establecimientoAnterior || "—";
      tr.innerHTML = `
        <td class="mono">${esc(p.numeroMatricula || "—")}</td>
        <td>${esc(p.anio || "—")}</td>
        <td><strong>${esc(nom)}</strong></td>
        <td class="mono">${esc(p.alumno?.rut || "—")}</td>
        <td class="cell-est" title="${esc(est)}">${esc(truncar(est, 40))}</td>
        <td><span class="estado ${esc(p.estado)}">${esc(p.estado)}</span></td>
        <td class="mono">${esc((p.creado || "").slice(0, 10) || "—")}</td>
        <td><button class="btn" data-id="${esc(p.id)}"><i data-lucide="eye"></i></button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => abrirModal(p.id));
      tb.appendChild(tr);
    }
    if (window.lucide) lucide.createIcons();
  }

  function rellenar(id, valores, placeholder) {
    const s = qs("#" + id);
    const actual = s.value;
    s.innerHTML = `<option value="">${placeholder}</option>`;
    for (const v of valores) {
      const op = document.createElement("option");
      op.value = v;
      op.textContent = v;
      s.appendChild(op);
    }
    if (valores.map(String).includes(actual)) s.value = actual;
  }

  /* ---------- MODAL ---------- */
  let idActual = null;
  let editando = false;

  function abrirModal(id) {
    idActual = id;
    editando = false;
    renderModal();
    qs("#modal").classList.add("on");
  }

  function renderModal() {
    const p = BD.postulantes.find(x => x.id === idActual);
    if (!p) return;
    const ed = editando;
    const docs = p.documentos || {};
    qs("#m-titulo").textContent = `${p.numeroMatricula} · ${p.alumno?.nombres || ""}`;

    // Modo lectura: texto. Modo edición: input con data-k="grupo.campo"
    const campo = (ruta, valor, mono = false) => ed
      ? `<input class="edit-input${mono ? " mono" : ""}" data-k="${ruta}" value="${esc(valor)}">`
      : `<span class="${mono ? "mono" : ""}">${esc(valor) || "—"}</span>`;

    const docItem = (clave, texto) => {
      const marcado = !!docs[clave];
      return ed
        ? `<label class="doc-line ${marcado ? "on" : ""}"><input type="checkbox" data-doc="${clave}" ${marcado ? "checked" : ""}> ${texto}</label>`
        : `<span class="doc-line ${marcado ? "on" : ""}">${texto}</span>`;
    };

    // Especialidad: se muestra si tiene valor o si el grado es 3°/4°
    const grado = Number(p.lobby?.grado) || 0;
    const mostrarEspecialidad = !!p.alumno?.especialidad || grado >= 3;
    const campoEspecialidad = mostrarEspecialidad
      ? `<dt>Especialidad</dt><dd>${campo("alumno.especialidad", p.alumno?.especialidad)}</dd>`
      : "";

    qs("#m-body").innerHTML = `
      <div class="modal-section">
        <h3><i data-lucide="clipboard-list"></i> Datos de matrícula</h3>
        <dl class="dl">
          <dt>N° matrícula</dt><dd class="mono">${esc(p.numeroMatricula)}</dd>
          <dt>Año</dt><dd>${esc(p.anio)}</dd>
          <dt>Curso</dt><dd>${esc(p.curso)}</dd>
          <dt>Estado</dt><dd>
            ${ed
              ? `<select id="m-estado">${BD.config.estados.map(e =>
                  `<option ${e === p.estado ? "selected" : ""}>${esc(e)}</option>`).join("")}</select>`
              : `<span class="estado ${esc(p.estado)}">${esc(p.estado)}</span>`}
          </dd>
          <dt>Creado</dt><dd class="mono">${esc((p.creado || "").slice(0, 19) || "—")}</dd>
        </dl>
      </div>

      <div class="modal-section">
        <h3><i data-lucide="file-check-2"></i> Documentos recibidos</h3>
        <div class="docs-grid">
          ${docItem("certificadoNacimiento", "a) Certificado de nacimiento")}
          ${docItem("certificadoEstudio", "b) Certificado de estudio")}
          ${docItem("informePersonalidad", "c) Informe de personalidad")}
          ${docItem("fichaEscolar", "d) Ficha escolar")}
          ${docItem("carpetaPIE", "e) Carpeta PIE")}
        </div>
      </div>

      <div class="modal-section modal-section--full">
        <h3><i data-lucide="user-round"></i> Datos del alumno</h3>
        <dl class="dl dl--two">
          <dt>Apellidos</dt><dd>${campo("alumno.apellidoPaterno", p.alumno?.apellidoPaterno)} ${campo("alumno.apellidoMaterno", p.alumno?.apellidoMaterno)}</dd>
          <dt>Nombres</dt><dd>${campo("alumno.nombres", p.alumno?.nombres)}</dd>
          ${campoEspecialidad}
          <dt>RUT</dt><dd>${campo("alumno.rut", p.alumno?.rut, true)}</dd>
          <dt>Nacimiento</dt><dd>${campo("alumno.fechaNacimiento", p.alumno?.fechaNacimiento)}</dd>
          <dt>Vive con</dt><dd>${campo("alumno.viveCon", p.alumno?.viveCon)}</dd>
          <dt>Fono</dt><dd>${campo("alumno.fono", p.alumno?.fono)}</dd>
          <dt>Domicilio</dt><dd>${campo("alumno.domicilio", p.alumno?.domicilio)}</dd>
          <dt>Establecimiento anterior</dt><dd>${campo("alumno.establecimientoAnterior", p.alumno?.establecimientoAnterior)}</dd>
          <dt>Padre</dt><dd>${campo("alumno.padre", p.alumno?.padre)}</dd>
          <dt>Madre</dt><dd>${campo("alumno.madre", p.alumno?.madre)}</dd>
          <dt>Antecedentes médicos</dt><dd>${campo("alumno.antecedentesMedicos", p.alumno?.antecedentesMedicos)}</dd>
        </dl>
      </div>

      <div class="modal-section">
        <h3><i data-lucide="user-check"></i> Apoderado titular</h3>
        <dl class="dl">
          <dt>Nombre</dt><dd>${campo("apoderadoTitular.nombre", p.apoderadoTitular?.nombre)}</dd>
          <dt>RUT</dt><dd>${campo("apoderadoTitular.rut", p.apoderadoTitular?.rut, true)}</dd>
          <dt>Fono</dt><dd>${campo("apoderadoTitular.fono", p.apoderadoTitular?.fono)}</dd>
          <dt>Domicilio</dt><dd>${campo("apoderadoTitular.domicilio", p.apoderadoTitular?.domicilio)}</dd>
        </dl>
      </div>

      <div class="modal-section">
        <h3><i data-lucide="user-plus"></i> Apoderado suplente</h3>
        <dl class="dl">
          <dt>Nombre</dt><dd>${campo("apoderadoSuplente.nombre", p.apoderadoSuplente?.nombre)}</dd>
          <dt>RUT</dt><dd>${campo("apoderadoSuplente.rut", p.apoderadoSuplente?.rut, true)}</dd>
          <dt>Fono</dt><dd>${campo("apoderadoSuplente.fono", p.apoderadoSuplente?.fono)}</dd>
          <dt>Domicilio</dt><dd>${campo("apoderadoSuplente.domicilio", p.apoderadoSuplente?.domicilio)}</dd>
        </dl>
      </div>
    `;

    qs("#m-editar").innerHTML = ed
      ? '<i data-lucide="x"></i> Cancelar'
      : '<i data-lucide="pencil"></i> Editar';
    qs("#m-guardar").disabled = !ed;
    if (window.lucide) lucide.createIcons();
  }

  function cerrarModal() {
    qs("#modal").classList.remove("on");
    idActual = null;
    editando = false;
  }

  qs("#m-cerrar").addEventListener("click", cerrarModal);
  qs("#m-cerrar-2").addEventListener("click", cerrarModal);
  qs("#modal").addEventListener("click", e => { if (e.target === qs("#modal")) cerrarModal(); });

  qs("#m-editar").addEventListener("click", () => {
    if (!idActual) return;
    editando = !editando;
    renderModal();
  });

  qs("#m-guardar").addEventListener("click", async () => {
    if (!idActual || !editando) return;
    const p = BD.postulantes.find(x => x.id === idActual);
    if (!p) return;

    // Copia completa de los grupos anidados; luego se aplican los valores del formulario
    const alumno = JSON.parse(JSON.stringify(p.alumno || {}));
    const titular = JSON.parse(JSON.stringify(p.apoderadoTitular || {}));
    const suplente = JSON.parse(JSON.stringify(p.apoderadoSuplente || {}));
    const documentos = JSON.parse(JSON.stringify(p.documentos || {}));
    const grupos = { alumno, apoderadoTitular: titular, apoderadoSuplente: suplente };

    qs("#m-body").querySelectorAll("[data-k]").forEach(el => {
      const [grupo, clave] = el.dataset.k.split(".");
      grupos[grupo][clave] = el.value.trim();
    });
    qs("#m-body").querySelectorAll("[data-doc]").forEach(el => {
      documentos[el.dataset.doc] = el.checked;
    });

    try {
      await BD.actualizarPostulante(idActual, {
        estado: qs("#m-estado").value,
        alumno,
        apoderadoTitular: titular,
        apoderadoSuplente: suplente,
        documentos
      });
      toast("Cambios guardados.", "ok");
      editando = false;
      renderModal();
      refrescar();
    } catch (e) { toast(e.message, "error"); }
  });

  qs("#m-eliminar").addEventListener("click", async () => {
    if (!idActual) return;
    if (!confirm("¿Eliminar permanentemente este postulante?")) return;
    try {
      await BD.eliminarPostulante(idActual);
      toast("Postulante eliminado.", "ok");
      cerrarModal();
      refrescar();
    } catch (e) { toast(e.message, "error"); }
  });

  qs("#m-pdf").addEventListener("click", () => {
    if (!idActual) return;
    const p = BD.postulantes.find(x => x.id === idActual);
    if (p) generarPDFEstudiante(p);
  });

  /* ---------- VENTANAS CON IFRAME (visualizar tablas y gestionar años) ---------- */
  const ventanas = {
    visor:  { bg: qs("#visor"),  frame: qs("#visor-frame"),  url: "FuncionesComp/visualizar-tablas.html" },
    gestor: { bg: qs("#gestor"), frame: qs("#gestor-frame"), url: "FuncionesComp/gestionar-anios.html" },
    manual: { bg: qs("#manual"), frame: qs("#manual-frame"), url: "FuncionesComp/manual-usuario.html" }
  };
  let huboCambios = false;

  function abrirVentana(nombre) {
    const v = ventanas[nombre];
    if (!v.frame.getAttribute("src")) v.frame.src = v.url;
    v.bg.classList.add("on");
  }

  async function cerrarVentana(nombre) {
    ventanas[nombre].bg.classList.remove("on");
    if (nombre === "gestor" && huboCambios) {
      huboCambios = false;
      const r = await BD.intentarRestaurar();
      if (r.ok) refrescar();
    }
  }

  qs("#btn-visualizar").addEventListener("click", () => abrirVentana("visor"));
  qs("#btn-gestionar").addEventListener("click", () => abrirVentana("gestor"));
  qs("#btn-manual").addEventListener("click", () => abrirVentana("manual"));
  qs("#manual-cerrar").addEventListener("click", () => cerrarVentana("manual"));
  ventanas.manual.bg.addEventListener("click", e => { if (e.target === ventanas.manual.bg) cerrarVentana("manual"); });
  qs("#visor-cerrar").addEventListener("click", () => cerrarVentana("visor"));
  qs("#gestor-cerrar").addEventListener("click", () => cerrarVentana("gestor"));
  ventanas.visor.bg.addEventListener("click", e => { if (e.target === ventanas.visor.bg) cerrarVentana("visor"); });
  ventanas.gestor.bg.addEventListener("click", e => { if (e.target === ventanas.gestor.bg) cerrarVentana("gestor"); });

  // Las ventanas piden cerrarse (en vez de navegar) y avisan si hubo cambios de datos
  window.addEventListener("message", e => {
    const origen = e.source;
    if (e.data?.tipo === "cerrar-visor") {
      if (origen === ventanas.visor.frame.contentWindow) cerrarVentana("visor");
      if (origen === ventanas.gestor.frame.contentWindow) cerrarVentana("gestor");
      if (origen === ventanas.manual.frame.contentWindow) cerrarVentana("manual");
    }
    if (e.data?.tipo === "datos-cambiados" && origen === ventanas.gestor.frame.contentWindow) {
      huboCambios = true;
    }
  });


/* =============================================================
     EXCEL GLOBAL (1 hoja por curso + hoja Resumen, tablas decoradas)
     ============================================================= */
  function colLetraExcel(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function limpiarNombreHoja(nombre, usados) {
    let base = String(nombre || "Sin curso")
      .replace(/[\\/?*\[\]:]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Sin curso";
    let candidato = base.slice(0, 31);
    let i = 2;
    while (usados.has(candidato.toLowerCase())) {
      const suf = ` (${i++})`;
      candidato = base.slice(0, 31 - suf.length) + suf;
    }
    usados.add(candidato.toLowerCase());
    return candidato;
  }

  function ordenCurso(nombre) {
    const t = String(nombre || "").toLowerCase();
    if (/primero|^1\b|1°|1ro/.test(t)) return 1;
    if (/segundo|^2\b|2°|2do/.test(t)) return 2;
    if (/tercero|^3\b|3°|3ro/.test(t)) return 3;
    if (/cuarto|^4\b|4°|4to/.test(t)) return 4;
    return 99;
  }

  async function exportarExcel() {
    if (!BD.conectado) { toast("No hay conexión con la base de datos.", "error"); return; }
    if (typeof ExcelJS === "undefined") {
      toast("No se cargó la librería de Excel. Revisa la conexión a internet.", "error");
      return;
    }
    if (!BD.postulantes.length) { toast("No hay postulantes para exportar.", "info"); return; }

    const btn = qs("#btn-excel");
    if (btn) btn.disabled = true;

    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Liceo Eduardo Charme";
      wb.created = new Date();

      const COLOR = {
        azulOscuro: "FF0D2766",
        azulPrimario: "FF1F4FB5",
        azulSuave: "FFE8EFF9",
        zebra: "FFF2F6FE",
        bordeSuave: "FFC6CFDF",
        dorado: "FFFFC20E",
        textoOscuro: "FF0E1A33",
        textoGris: "FF66738F",
        blanco: "FFFFFFFF"
      };

      const ESTILO_ESTADO = {
        matriculado: { fill: "FFDCE8FC", font: "FF0D2766" },
        aceptado:    { fill: "FFE3ECFC", font: "FF1F4FB5" },
        recibido:    { fill: "FFFFF4C7", font: "FF7A5A00" },
        postulante:  { fill: "FFEEF2F9", font: "FF33436A" },
        rechazado:   { fill: "FFFDE2E2", font: "FF9B1C1C" }
      };

      const bordeCelda = {
        top:    { style: "thin", color: { argb: COLOR.bordeSuave } },
        bottom: { style: "thin", color: { argb: COLOR.bordeSuave } },
        left:   { style: "thin", color: { argb: COLOR.bordeSuave } },
        right:  { style: "thin", color: { argb: COLOR.bordeSuave } }
      };

      const grupos = new Map();
      for (const p of BD.postulantes) {
        const curso = String(p.curso || "Primero Medio").trim() || "Primero Medio";
        if (!grupos.has(curso)) grupos.set(curso, []);
        grupos.get(curso).push(p);
      }

      const cursosOrdenados = [...grupos.keys()].sort((a, b) =>
        (ordenCurso(a) - ordenCurso(b)) || a.localeCompare(b, "es")
      );

      const ahora = new Date();
      const fechaISO = ahora.toISOString().slice(0, 10);
      const fechaTexto = ahora.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
      const hojasUsadas = new Set(["resumen"]);

      /* ---------- HOJA 1: RESUMEN ---------- */
      const wsRes = wb.addWorksheet("Resumen", {
        properties: { tabColor: { argb: COLOR.dorado } },
        views: [{ state: "frozen", ySplit: 4 }]
      });

      wsRes.mergeCells("A1:G1");
      wsRes.getCell("A1").value = "LICEO EDUARDO CHARME · RESUMEN DE MATRÍCULAS POR CURSO";
      wsRes.getCell("A1").font = { name: "Calibri", size: 13, bold: true, color: { argb: COLOR.blanco } };
      wsRes.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulOscuro } };
      wsRes.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      wsRes.getRow(1).height = 30;
      for (let c = 1; c <= 7; c++) {
        wsRes.getCell(1, c).border = { bottom: { style: "medium", color: { argb: COLOR.dorado } } };
      }

      wsRes.mergeCells("A2:G2");
      wsRes.getCell("A2").value = `Exportado el ${fechaTexto} · Total de cursos: ${cursosOrdenados.length} · Total registros: ${BD.postulantes.length}`;
      wsRes.getCell("A2").font = { name: "Calibri", size: 10, italic: true, color: { argb: COLOR.textoOscuro } };
      wsRes.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulSuave } };
      wsRes.getCell("A2").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      wsRes.getRow(2).height = 22;
      wsRes.getRow(3).height = 10;

      const cabRes = ["Curso", "Total", "Matriculado", "Aceptado", "Recibido", "Postulante", "Rechazado"];
      const rowCabRes = wsRes.getRow(4);
      rowCabRes.height = 26;
      cabRes.forEach((txt, idx) => {
        const cell = rowCabRes.getCell(idx + 1);
        cell.value = txt;
        cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: COLOR.blanco } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulPrimario } };
        cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "center" };
        cell.border = {
          top: { style: "thin", color: { argb: COLOR.azulOscuro } },
          bottom: { style: "medium", color: { argb: COLOR.dorado } },
          left: { style: "thin", color: { argb: "FF4A7FE6" } },
          right: { style: "thin", color: { argb: "FF4A7FE6" } }
        };
      });

      const totalesCol = [0, 0, 0, 0, 0, 0];
      cursosOrdenados.forEach((curso, idx) => {
        const lista = grupos.get(curso);
        const cEstado = est => lista.filter(p => p.estado === est).length;
        const vals = [
          lista.length,
          cEstado("matriculado"),
          cEstado("aceptado"),
          cEstado("recibido"),
          cEstado("postulante"),
          cEstado("rechazado")
        ];
        vals.forEach((v, j) => { totalesCol[j] += v; });

        const rNum = 5 + idx;
        const row = wsRes.getRow(rNum);
        row.height = 22;
        const bg = idx % 2 === 1 ? COLOR.zebra : COLOR.blanco;

        [curso, ...vals].forEach((val, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = val;
          cell.font = { name: "Calibri", size: 10.5, bold: cIdx <= 1, color: { argb: COLOR.textoOscuro } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
          cell.alignment = { vertical: "middle", horizontal: cIdx === 0 ? "left" : "center" };
          cell.border = bordeCelda;
        });
      });

      const filaFinRes = 4 + cursosOrdenados.length;
      const rowTotal = wsRes.getRow(filaFinRes + 1);
      rowTotal.height = 25;
      rowTotal.getCell(1).value = "TOTAL GENERAL";
      rowTotal.getCell(1).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: COLOR.azulOscuro } };
      rowTotal.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3ECFC" } };
      rowTotal.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
      rowTotal.getCell(1).border = {
        top: { style: "medium", color: { argb: COLOR.azulOscuro } },
        bottom: { style: "medium", color: { argb: COLOR.azulOscuro } },
        left: { style: "thin", color: { argb: COLOR.bordeSuave } },
        right: { style: "thin", color: { argb: COLOR.bordeSuave } }
      };
      for (let c = 2; c <= 7; c++) {
        const colL = colLetraExcel(c);
        const cell = rowTotal.getCell(c);
        cell.value = { formula: `SUM(${colL}5:${colL}${filaFinRes})`, result: totalesCol[c - 2] };
        cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: COLOR.azulOscuro } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3ECFC" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "medium", color: { argb: COLOR.azulOscuro } },
          bottom: { style: "medium", color: { argb: COLOR.azulOscuro } },
          left: { style: "thin", color: { argb: COLOR.bordeSuave } },
          right: { style: "thin", color: { argb: COLOR.bordeSuave } }
        };
      }
      wsRes.columns = [
        { width: 26 }, { width: 13 }, { width: 15 }, { width: 14 },
        { width: 14 }, { width: 14 }, { width: 14 }
      ];

      /* ---------- HOJAS POR CURSO ---------- */
      const COLUMNAS = [
        { header: "N° Matrícula",             key: "numero",          align: "center", min: 14 },
        { header: "Año",                      key: "anio",            align: "center", min: 9  },
        { header: "Curso",                    key: "curso",           align: "left",   min: 16 },
        { header: "Especialidad",             key: "especialidad",    align: "left",   min: 16 },
        { header: "Estado",                   key: "estado",          align: "center", min: 14 },
        { header: "Apellido Paterno",         key: "apPaterno",       align: "left",   min: 18 },
        { header: "Apellido Materno",         key: "apMaterno",       align: "left",   min: 18 },
        { header: "Nombres",                  key: "nombres",         align: "left",   min: 20 },
        { header: "RUT",                      key: "rut",             align: "center", min: 14 },
        { header: "Fecha Nacimiento",         key: "nacimiento",      align: "center", min: 16 },
        { header: "Vive Con",                 key: "viveCon",         align: "left",   min: 14 },
        { header: "Fono Alumno",              key: "fono",            align: "center", min: 14 },
        { header: "Domicilio",                key: "domicilio",       align: "left",   min: 26 },
        { header: "Establecimiento Anterior", key: "establecimiento", align: "left",   min: 26 },
        { header: "Padre",                    key: "padre",           align: "left",   min: 20 },
        { header: "Madre",                    key: "madre",           align: "left",   min: 20 },
        { header: "Antecedentes Médicos",     key: "medicos",         align: "left",   min: 22 },
        { header: "Apoderado Titular",        key: "tNombre",         align: "left",   min: 22 },
        { header: "RUT Titular",              key: "tRut",            align: "center", min: 14 },
        { header: "Fono Titular",             key: "tFono",           align: "center", min: 14 },
        { header: "Domicilio Titular",        key: "tDomicilio",      align: "left",   min: 24 },
        { header: "Apoderado Suplente",       key: "sNombre",         align: "left",   min: 22 },
        { header: "RUT Suplente",             key: "sRut",            align: "center", min: 14 },
        { header: "Fono Suplente",            key: "sFono",           align: "center", min: 14 },
        { header: "Domicilio Suplente",       key: "sDomicilio",      align: "left",   min: 24 },
        { header: "Doc. Nacimiento",          key: "docNac",          align: "center", min: 15 },
        { header: "Doc. Estudio",             key: "docEst",          align: "center", min: 13 },
        { header: "Doc. Personalidad",        key: "docPers",         align: "center", min: 16 },
        { header: "Doc. Ficha",               key: "docFicha",        align: "center", min: 12 },
        { header: "Doc. PIE",                 key: "docPie",          align: "center", min: 11 },
        { header: "Fecha Retiro",             key: "retiro",          align: "center", min: 14 },
        { header: "Fecha Registro",           key: "creado",          align: "center", min: 19 }
      ];

      const ultimaCol = colLetraExcel(COLUMNAS.length);
      const coloresTab = ["FF1F4FB5", "FF2C63D6", "FF163A8C", "FF4A7FE6"];

      cursosOrdenados.forEach((curso, cIdx) => {
        const nombreHoja = limpiarNombreHoja(curso, hojasUsadas);
        const ws = wb.addWorksheet(nombreHoja, {
          properties: { tabColor: { argb: coloresTab[cIdx % coloresTab.length] } },
          views: [{ state: "frozen", ySplit: 4 }],
          pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        const lista = [...grupos.get(curso)].sort((a, b) =>
          (Number(b.anio) - Number(a.anio)) ||
          String(a.numeroMatricula || "").localeCompare(String(b.numeroMatricula || ""), "es")
        );

        ws.mergeCells(`A1:${ultimaCol}1`);
        const tCell = ws.getCell("A1");
        tCell.value = `LICEO EDUARDO CHARME · NÓMINA DE MATRÍCULAS — ${curso.toUpperCase()}`;
        tCell.font = { name: "Calibri", size: 13, bold: true, color: { argb: COLOR.blanco } };
        tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulOscuro } };
        tCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws.getRow(1).height = 30;
        for (let c = 1; c <= COLUMNAS.length; c++) {
          ws.getCell(1, c).border = { bottom: { style: "medium", color: { argb: COLOR.dorado } } };
        }

        ws.mergeCells(`A2:${ultimaCol}2`);
        const sCell = ws.getCell("A2");
        sCell.value = `Estudiantes en este curso: ${lista.length} · Exportado el ${fechaTexto}`;
        sCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: COLOR.textoOscuro } };
        sCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulSuave } };
        sCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws.getRow(2).height = 22;
        ws.getRow(3).height = 8;

        const rowCab = ws.getRow(4);
        rowCab.height = 28;
        const anchos = COLUMNAS.map(col => Math.max(col.min, col.header.length + 4));

        COLUMNAS.forEach((col, i) => {
          const cell = rowCab.getCell(i + 1);
          cell.value = col.header;
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLOR.blanco } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.azulPrimario } };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: COLOR.azulOscuro } },
            bottom: { style: "medium", color: { argb: COLOR.dorado } },
            left: { style: "thin", color: { argb: "FF4A7FE6" } },
            right: { style: "thin", color: { argb: "FF4A7FE6" } }
          };
        });

        lista.forEach((p, rIdx) => {
          const datos = [
            p.numeroMatricula || "",
            p.anio || "",
            curso,
            p.alumno?.especialidad || "",
            p.estado || "",
            p.alumno?.apellidoPaterno || "",
            p.alumno?.apellidoMaterno || "",
            p.alumno?.nombres || "",
            p.alumno?.rut || "",
            p.alumno?.fechaNacimiento || "",
            p.alumno?.viveCon || "",
            p.alumno?.fono || "",
            p.alumno?.domicilio || "",
            p.alumno?.establecimientoAnterior || "",
            p.alumno?.padre || "",
            p.alumno?.madre || "",
            p.alumno?.antecedentesMedicos || "",
            p.apoderadoTitular?.nombre || "",
            p.apoderadoTitular?.rut || "",
            p.apoderadoTitular?.fono || "",
            p.apoderadoTitular?.domicilio || "",
            p.apoderadoSuplente?.nombre || "",
            p.apoderadoSuplente?.rut || "",
            p.apoderadoSuplente?.fono || "",
            p.apoderadoSuplente?.domicilio || "",
            p.documentos?.certificadoNacimiento ? "Sí" : "No",
            p.documentos?.certificadoEstudio ? "Sí" : "No",
            p.documentos?.informePersonalidad ? "Sí" : "No",
            p.documentos?.fichaEscolar ? "Sí" : "No",
            p.documentos?.carpetaPIE ? "Sí" : "No",
            p.retiro || "",
            (p.creado || "").slice(0, 19).replace("T", " ")
          ];

          const row = ws.getRow(5 + rIdx);
          row.height = 22;
          const bg = rIdx % 2 === 1 ? COLOR.zebra : COLOR.blanco;

          datos.forEach((val, i) => {
            const col = COLUMNAS[i];
            const cell = row.getCell(i + 1);
            cell.value = val;
            cell.border = bordeCelda;
            cell.alignment = { vertical: "middle", horizontal: col.align };
            cell.font = { name: "Calibri", size: 10, color: { argb: COLOR.textoOscuro } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };

            if (col.key === "estado") {
              const est = ESTILO_ESTADO[String(val).toLowerCase()];
              if (est) {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: est.fill } };
                cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: est.font } };
              }
            } else if (col.key.startsWith("doc")) {
              if (val === "Sí") {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F6EC" } };
                cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1B6B3A" } };
              } else {
                cell.font = { name: "Calibri", size: 10, color: { argb: COLOR.textoGris } };
              }
            } else if (col.key === "numero") {
              cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLOR.azulOscuro } };
            }

            const largo = String(val).length + 3;
            if (largo > anchos[i]) anchos[i] = Math.min(38, largo);
          });
        });

        ws.columns = anchos.map(w => ({ width: w }));
        ws.autoFilter = `A4:${ultimaCol}4`;
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matriculas-charme-${fechaISO}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      toast(`${BD.postulantes.length} postulantes exportados en ${cursosOrdenados.length} hojas por curso.`, "ok", 6000);
    } catch (e) {
      toast("Error al generar Excel: " + e.message, "error", 6000);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* =============================================================
     COMPROBANTE DE IMPRESIÓN (mismo formato A4 que el formulario)
     ============================================================= */
  function construirComprobanteHTML(reg) {
    const v = (val) => esc(String(val || "").trim() || "—");
    const si = (cond) => cond ? "☑" : "☐";
    const fmt = (iso) => {
      if (!iso) return new Date().toLocaleDateString("es-CL");
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
      if (!m) return String(iso);
      return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
    };
    const fecha = fmt(reg.fechaChile || (reg.creado || "").slice(0, 10));

    const logoHtml = `<img src="../BD_CARGABLE/logo.png" alt="Logo" style="height:2cm;width:auto;" onerror="this.style.display='none'">`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Matrícula ${v(reg.numeroMatricula)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 9pt;
    line-height: 1.25;
    color: #000;
    background: #fff;
    padding: 0.8cm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .membrete {
    display: flex;
    align-items: center;
    gap: 1cm;
    border-bottom: 2pt solid #1f4fb5;
    padding-bottom: 0.2cm;
    margin-bottom: 0.5cm;
  }
  .membrete h1 {
    font-size: 14pt;
    font-weight: 700;
    color: #0d2766;
    margin: 0;
    line-height: 1.1;
  }
  .membrete p {
    font-size: 8pt;
    color: #33436a;
    margin: 0;
  }
  h2 {
    font-size: 10pt;
    font-weight: 700;
    color: #0d2766;
    margin: 0.3cm 0 0.15cm 0;
    padding-bottom: 0.05cm;
    border-bottom: 0.5pt solid #97a6c4;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.2cm;
  }
  th, td {
    border: 0.5pt solid #999;
    padding: 0.12cm 0.2cm;
    text-align: left;
    vertical-align: top;
    font-size: 8.5pt;
  }
  th {
    background: #f1f5fc;
    font-weight: 700;
    width: 22%;
    color: #1c2a48;
  }
  td { width: 28%; }
  .docs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2cm 0.6cm;
    font-size: 8.5pt;
    padding: 0.15cm 0;
  }
  .declaracion {
    margin: 0.4cm 0 0.2cm 0;
    font-style: italic;
    font-size: 9pt;
    padding: 0.15cm 0.3cm;
    background: #f1f5fc;
    border-left: 2pt solid #1f4fb5;
  }
  .firmas {
    display: flex;
    justify-content: space-between;
    margin-top: 0.8cm;
    gap: 1cm;
  }
  .firma {
    flex: 1;
    text-align: center;
    font-size: 8pt;
  }
  .firma .linea {
    border-bottom: 1pt solid #000;
    height: 1.2cm;
    margin-bottom: 0.1cm;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-family: 'Caveat', cursive;
    font-size: 14pt;
    color: #1f4fb5;
  }
  .pie {
    margin-top: 0.5cm;
    text-align: right;
    font-size: 8pt;
    color: #33436a;
  }
</style>
</head>
<body>
  <header class="membrete">
    ${logoHtml}
    <div>
      <h1>Liceo Eduardo Charme</h1>
      <p>San Fernando · Chile</p>
    </div>
  </header>

  <h2>1. Datos del Alumno</h2>
  <table>
    <tr><th>Curso</th><td>${v(reg.curso)}</td><th>Año escolar</th><td>${v(reg.anio)}</td></tr>
    ${reg.alumno?.especialidad ? `<tr><th>Especialidad</th><td colspan="3">${v(reg.alumno.especialidad)}</td></tr>` : ""}
    <tr><th>N° matrícula</th><td>${v(reg.numeroMatricula)}</td><th>R.U.T</th><td>${v(reg.alumno?.rut)}</td></tr>
    <tr><th>Apellido paterno</th><td>${v(reg.alumno?.apellidoPaterno)}</td><th>Apellido materno</th><td>${v(reg.alumno?.apellidoMaterno)}</td></tr>
    <tr><th>Nombres</th><td>${v(reg.alumno?.nombres)}</td><th>Fecha nacimiento</th><td>${v(reg.alumno?.fechaNacimiento)}</td></tr>
    <tr><th>Vive con</th><td>${v(reg.alumno?.viveCon)}</td><th>Fono</th><td>${v(reg.alumno?.fono)}</td></tr>
    <tr><th>Domicilio</th><td colspan="3">${v(reg.alumno?.domicilio)}</td></tr>
    <tr><th>Establecimiento anterior</th><td colspan="3">${v(reg.alumno?.establecimientoAnterior)}</td></tr>
    <tr><th>Antecedentes médicos</th><td colspan="3">${v(reg.alumno?.antecedentesMedicos)}</td></tr>
    <tr><th>Padre</th><td>${v(reg.alumno?.padre)}</td><th>Madre</th><td>${v(reg.alumno?.madre)}</td></tr>
  </table>

  <h2>2. Apoderado Titular</h2>
  <table>
    <tr><th>Nombre</th><td colspan="3">${v(reg.apoderadoTitular?.nombre)}</td></tr>
    <tr><th>R.U.T</th><td>${v(reg.apoderadoTitular?.rut)}</td><th>Fono</th><td>${v(reg.apoderadoTitular?.fono)}</td></tr>
    <tr><th>Domicilio</th><td colspan="3">${v(reg.apoderadoTitular?.domicilio)}</td></tr>
  </table>

  <h2>3. Apoderado Suplente</h2>
  <table>
    <tr><th>Nombre</th><td colspan="3">${v(reg.apoderadoSuplente?.nombre)}</td></tr>
    <tr><th>R.U.T</th><td>${v(reg.apoderadoSuplente?.rut)}</td><th>Fono</th><td>${v(reg.apoderadoSuplente?.fono)}</td></tr>
    <tr><th>Domicilio</th><td colspan="3">${v(reg.apoderadoSuplente?.domicilio)}</td></tr>
  </table>

  <h2>4. Documentos recibidos</h2>
  <div class="docs">
    <span>${si(reg.documentos?.certificadoNacimiento)} a) Certificado de nacimiento</span>
    <span>${si(reg.documentos?.certificadoEstudio)} b) Certificado de estudio</span>
    <span>${si(reg.documentos?.informePersonalidad)} c) Informe de personalidad</span>
    <span>${si(reg.documentos?.fichaEscolar)} d) Ficha escolar</span>
    <span>${si(reg.documentos?.carpetaPIE)} e) Carpeta PIE</span>
  </div>

  <div class="declaracion">
    Declaro haber recibido los documentos antes señalados.
  </div>

  <div class="firmas">
    <div class="firma">
      <div class="linea"></div>
      Firma del Apoderado
    </div>
    <div class="firma">
      <div class="linea">R. Charme</div>
      Firma del Director
    </div>
  </div>

  <div class="pie">
    San Fernando, ${esc(fecha)}
  </div>
</body>
</html>`;
  }

  function generarPDFEstudiante(p) {
    const html = construirComprobanteHTML(p);
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1500);
    }, 400);
  }

  if (window.lucide) lucide.createIcons();
})();