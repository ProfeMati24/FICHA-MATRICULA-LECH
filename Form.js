/* =============================================================
   Form.js — Orquestador del formulario
   ============================================================= */
(function () {
  "use strict";

  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function formatearRUT(v) {
    const l = String(v || "").replace(/[^0-9kK]/g, "").toUpperCase();
    if (l.length < 2) return l;
    return l.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + l.slice(-1);
  }
  
  function validarRUT(v) {
    const l = String(v || "").replace(/[^0-9kK]/g, "").toUpperCase();
    if (l.length < 8 || l.length > 9) return false;
    const c = l.slice(0, -1), dv = l.slice(-1);
    if (!/^\d+$/.test(c)) return false;
    let s = 0, m = 2;
    for (let i = c.length - 1; i >= 0; i--) { s += Number(c[i]) * m; m = m === 7 ? 2 : m + 1; }
    const r = s % 11, esp = r === 0 ? "0" : r === 1 ? "K" : String(11 - r);
    return dv === esp;
  }
  
  function marcarError(input, msg) {
    if (!input) return;
    input.classList.add("campo-invalido");
    const campo = input.closest(".campo");
    if (!campo) return;
    let a = campo.querySelector(".campo-error");
    if (!a) { a = document.createElement("div"); a.className = "campo-error"; campo.appendChild(a); }
    a.textContent = msg || "Revisa este campo";
  }
  
  function limpiarErrores(raiz) {
    if (!raiz) return;
    qsa(".campo-invalido", raiz).forEach(el => el.classList.remove("campo-invalido"));
    qsa(".campo-error", raiz).forEach(el => el.remove());
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

  async function obtenerFechaChile() {
    const intentos = [
      ["https://worldtimeapi.org/api/timezone/America/Santiago", j => j?.datetime],
      ["https://timeapi.io/api/Time/current/zone?timeZone=America/Santiago", j => j?.dateTime]
    ];
    for (const [url, extraer] of intentos) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(extraer(await res.json())));
        if (m) return { ok: true, fuente: "api", anio: +m[1], mes: +m[2], dia: +m[3], iso: `${m[1]}-${m[2]}-${m[3]}` };
      } catch {}
    }
    const a = new Date();
    const y = a.getFullYear(), mo = String(a.getMonth() + 1).padStart(2, "0"), d = String(a.getDate()).padStart(2, "0");
    return { ok: true, fuente: "local", anio: y, mes: +mo, dia: +d, iso: `${y}-${mo}-${d}` };
  }

  let fechaChile = null;
  let contexto = null;

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.lucide) lucide.createIcons();
    await prepararFechaYAnio();
    prepararEstablecimientos();
    prepararFechas();
    engancharRUTs();
    inicializarReglas();
    actualizarIndicadorConexion();
    await arrancarBD();
    actualizarNumeroMatricula();

    if (window.__matricula) aplicarContexto(window.__matricula);
    document.addEventListener("matricula:context", (ev) => aplicarContexto(ev.detail));

    qs("#form-matricula")?.addEventListener("submit", manejarEnvio);
    qs("#btn-pdf")?.addEventListener("click", generarPDFClick);
    qs("#r-acepto")?.addEventListener("change", validarBotonEnvio);
    
    // CORRECCIÓN: Cancelar vuelve al lobby recargando la página
    qs("#btn-cancelar")?.addEventListener("click", () => {
      if (confirm("¿Seguro que deseas cancelar? Se perderán los datos ingresados y volverás al inicio.")) {
        location.reload();
      }
    });

    window.BD.suscribir(tipo => {
      if (["alta", "cambio", "cargado", "conexion", "desconexion"].includes(tipo)) {
        actualizarIndicadorConexion();
        actualizarNumeroMatricula();
        validarBotonEnvio();
      }
    });
  });

  function aplicarContexto(c) {
    if (!c) return;
    contexto = c; 
    window.__matricula = c;

    const cursoInput = qs("#a-curso");
    if (cursoInput) cursoInput.value = c.curso || "Primero Medio";
    const matCurso = qs("#mat-curso");
    if (matCurso) matCurso.textContent = c.curso || "Primero Medio";

    const estLabel = qs("#label-establecimiento");
    if (estLabel) {
      estLabel.innerHTML = (c.establecimientoObligatorio !== false)
        ? 'Establecimiento anterior <span class="req">*</span>'
        : 'Establecimiento anterior <span class="opt">(opcional)</span>';
    }

    const estInput = qs("#a-establecimiento");
    if (estInput) {
      if (c.establecimientoBloqueado && c.establecimientoFijo) {
        estInput.value = c.establecimientoFijo; 
        estInput.readOnly = true;
      } else { 
        estInput.readOnly = false; 
      }
    }

    const gradoActual = Number(c.grado) || 1;
    const campoEsp = qs("#campo-especialidad");
    const selEsp = qs("#a-especialidad");
    if (campoEsp) campoEsp.style.display = gradoActual >= 3 ? "" : "none";
    if (selEsp && gradoActual < 3) selEsp.value = "";

    if (c.preload) precargarDesdeRegistro(c.preload);
    validarBotonEnvio();
  }

  function precargarDesdeRegistro(p) {
    const setVal = (id, val) => { const el = qs("#" + id); if (el && val != null) el.value = val; };
    const setCheck = (id, val) => { const el = qs("#" + id); if (el) el.checked = !!val; };

    if (p.alumno) {
      setVal("a-apellido-paterno", p.alumno.apellidoPaterno); 
      setVal("a-apellido-materno", p.alumno.apellidoMaterno);
      setVal("a-nombres", p.alumno.nombres); 
      setVal("a-rut", p.alumno.rut);
      setVal("a-nacimiento", p.alumno.fechaNacimiento); 
      setVal("a-vive-con", p.alumno.viveCon);
      setVal("a-fono", p.alumno.fono); 
      setVal("a-domicilio", p.alumno.domicilio);
      setVal("a-medicos", p.alumno.antecedentesMedicos); 
      setVal("a-padre", p.alumno.padre);
      setVal("a-madre", p.alumno.madre); 
      setVal("a-especialidad", p.alumno.especialidad);
    }
    if (p.apoderadoTitular) {
      setVal("t-nombre", p.apoderadoTitular.nombre); 
      setVal("t-rut", p.apoderadoTitular.rut);
      setVal("t-fono", p.apoderadoTitular.fono); 
      setVal("t-domicilio", p.apoderadoTitular.domicilio);
    }
    if (p.apoderadoSuplente) {
      setVal("s-nombre", p.apoderadoSuplente.nombre); 
      setVal("s-rut", p.apoderadoSuplente.rut);
      setVal("s-fono", p.apoderadoSuplente.fono); 
      setVal("s-domicilio", p.apoderadoSuplente.domicilio);
    }
    if (p.documentos) {
      setCheck("d-nacimiento", p.documentos.certificadoNacimiento); 
      setCheck("d-estudio", p.documentos.certificadoEstudio);
      setCheck("d-personalidad", p.documentos.informePersonalidad); 
      setCheck("d-ficha", p.documentos.fichaEscolar);
      setCheck("d-pie", p.documentos.carpetaPIE);
    }
  }

  async function arrancarBD() {
    const r = await window.BD.intentarRestaurar();
    if (r.ok) return;
    if (r.motivo === "sin-token") toast("Falta configurar el acceso a la base de datos.", "error", 7000);
    else toast("No se pudo conectar con la base de datos: " + (r.error || "revisa tu conexión."), "error", 7000);
  }

  function actualizarIndicadorConexion() {
    const el = qs("#estado-conexion");
    if (!el) return;
    el.className = "estado-conexion" + (window.BD.conectado ? " ok" : "");
    el.innerHTML = `<i data-lucide="database"></i> ${window.BD.conectado ? "Conectado a GitHub" : "Sin conexión"}`;
    if (window.lucide) lucide.createIcons();
  }

  async function prepararFechaYAnio() {
    fechaChile = await obtenerFechaChile();
    const sel = qs("#a-anio"); if (!sel) return;
    sel.innerHTML = "";
    if (fechaChile.fuente === "local") toast("No se pudo obtener fecha oficial de Chile. Usando fecha local.", "info", 7000);
    for (let i = 0; i < 4; i++) {
      const a = fechaChile.anio + i;
      const op = document.createElement("option"); 
      op.value = a; 
      op.textContent = a; 
      sel.appendChild(op);
    }
    const ft = qs("#mat-fecha-texto");
    if (ft) ft.textContent = `${fechaChile.dia} de ${MESES[fechaChile.mes - 1]} de ${fechaChile.anio}`;
    const cierre = qs("#mat-cierre");
    if (cierre) cierre.innerHTML = `San Fernando, <strong>${fechaChile.dia}</strong> de <strong>${MESES[fechaChile.mes - 1]}</strong> de <strong>${fechaChile.anio}</strong>`;
  }

  function prepararEstablecimientos() {
    const input = qs("#a-establecimiento");
    if (input && window.BuscadorEstablecimientos) window.BuscadorEstablecimientos.montarSelector(input);
  }

  function prepararFechas() {
    const SF = window.SelectorFecha; 
    if (!SF) return;
    SF.montar(qs("#a-nacimiento"), { max: "hoy", anioMin: 1990 });
    SF.montar(qs("#m-retiro"), { max: "hoy", anioMin: 1990 });
  }

  function engancharRUTs() {
    ["a-rut", "t-rut", "s-rut"].forEach(id => {
      const el = qs("#" + id);
      el?.addEventListener("blur", () => { if (el.value.trim()) el.value = formatearRUT(el.value); });
    });
    qs("#a-anio")?.addEventListener("change", actualizarNumeroMatricula);
  }

  // UX: Aclarar que el número es estimado hasta guardar
  function actualizarNumeroMatricula() {
    const campo = qs("#a-numero"); if (!campo) return;
    if (!window.BD.conectado) { campo.value = "—"; return; }
    const anio = Number(qs("#a-anio")?.value); if (!anio) { campo.value = "—"; return; }
    try { 
      campo.value = window.BD.siguienteNumero(anio) + " (est.)"; 
    } catch { 
      campo.value = "—"; 
    }
  }

  function inicializarReglas() {
    const cont = qs("#pdf-contenedor"); if (!cont) return;
    cont.innerHTML = `
      <div class="pdf-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <span style="display:flex;align-items:center;gap:8px;">
          <i data-lucide="file-text"></i>
          <strong>reglas.pdf</strong>
        </span>
        <button type="button" class="btn" id="btn-ver-reglas">
          <i data-lucide="eye"></i> Ver declaración
        </button>
      </div>
    `;
    qs("#btn-ver-reglas")?.addEventListener("click", abrirVisorReglas);
    if (window.lucide) lucide.createIcons();
  }

  function abrirVisorReglas() {
    if (qs("#visor-reglas")) return;
    const fondo = document.createElement("div");
    fondo.id = "visor-reglas";
    fondo.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;";
    fondo.innerHTML = `
      <div id="visor-caja" style="background:#fff;color:#111;width:min(900px,100%);height:min(90vh,1000px);display:flex;flex-direction:column;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.4);">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #ddd;">
          <i data-lucide="file-text"></i>
          <strong style="flex:1;">reglas.pdf · Declaración</strong>
          <button type="button" class="btn" id="visor-cerrar"><i data-lucide="x"></i> Cerrar</button>
        </div>
        <object data="BD_CARGABLE/reglas.pdf" type="application/pdf" style="flex:1;width:100%;border:0;">
          <div style="padding:24px;text-align:center;font-weight:600;">No está cargada la declaración.</div>
        </object>
      </div>
    `;
    document.body.appendChild(fondo);
    if (window.lucide) lucide.createIcons();
    
    const cerrar = () => { fondo.remove(); document.removeEventListener("keydown", onEsc); };
    const onEsc = (e) => { if (e.key === "Escape") cerrar(); };
    
    fondo.querySelector("#visor-cerrar").addEventListener("click", cerrar);
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
    document.addEventListener("keydown", onEsc);
  }

  function validarBloqueAlumno() {
    const raiz = qs("#bloque-alumno"); 
    limpiarErrores(raiz); 
    let ok = true;
    
    const req = [
      ["a-apellido-paterno", "Ingresa el apellido paterno"], 
      ["a-apellido-materno", "Ingresa el apellido materno"],
      ["a-nombres", "Ingresa los nombres"], 
      ["a-nacimiento", "Selecciona fecha de nacimiento"],
      ["a-vive-con", "Selecciona con quién vive"], 
      ["a-fono", "Ingresa el fono"], 
      ["a-domicilio", "Ingresa el domicilio"]
    ];
    
    if (contexto?.establecimientoObligatorio !== false) req.push(["a-establecimiento", "Ingresa el establecimiento"]);
    
    for (const [id, msg] of req) {
      const el = qs("#" + id);
      if (!String(el?.value || "").trim()) { 
        marcarError(el, msg); 
        ok = false; 
      }
    }
    
    const rut = qs("#a-rut");
    if (!rut.value.trim()) { 
      marcarError(rut, "Ingresa el R.U.T"); 
      ok = false; 
    } else if (!validarRUT(rut.value)) { 
      marcarError(rut, "R.U.T inválido"); 
      ok = false; 
    }

    const nac = qs("#a-nacimiento"), anio = Number(qs("#a-anio")?.value);
    if (nac.value && anio && Number(nac.value.slice(0, 4)) >= anio) { 
      marcarError(nac, "Fecha posterior al año de ingreso"); 
      ok = false; 
    }
    
    const fono = qs("#a-fono");
    if (fono.value.trim() && fono.value.replace(/\D/g, "").length < 8) { 
      marcarError(fono, "Fono incompleto"); 
      ok = false; 
    }

    const grado = Number(contexto?.grado) || 1;
    if (grado >= 3) {
      const esp = qs("#a-especialidad");
      if (!String(esp?.value || "").trim()) { 
        marcarError(esp, "Selecciona la especialidad"); 
        ok = false; 
      }
    }
    return ok;
  }

  function validarApoderado(raizSel, pref) {
    const raiz = qs(raizSel); 
    limpiarErrores(raiz); 
    let ok = true;
    
    if (!qs(`#${pref}-nombre`).value.trim()) { 
      marcarError(qs(`#${pref}-nombre`), "Ingresa el nombre"); 
      ok = false; 
    }
    if (!qs(`#${pref}-domicilio`).value.trim()) { 
      marcarError(qs(`#${pref}-domicilio`), "Ingresa el domicilio"); 
      ok = false; 
    }
    
    const rut = qs(`#${pref}-rut`);
    if (!rut.value.trim()) { 
      marcarError(rut, "Ingresa el R.U.T"); 
      ok = false; 
    } else if (!validarRUT(rut.value)) { 
      marcarError(rut, "R.U.T inválido"); 
      ok = false; 
    }
    
    const fono = qs(`#${pref}-fono`);
    if (!fono.value.trim()) { 
      marcarError(fono, "Ingresa el fono"); 
      ok = false; 
    } else if (fono.value.replace(/\D/g, "").length < 8) { 
      marcarError(fono, "Fono incompleto"); 
      ok = false; 
    }
    
    return ok;
  }

  function validarReglas() { return qs("#r-acepto")?.checked === true; }

  function validarBotonEnvio() {
    const b = qs("#btn-enviar"); 
    if (!b) return;
    b.disabled = !window.BD.conectado || !validarReglas();
  }

  function recolectar() {
    const v = id => String(qs("#" + id)?.value ?? "").trim();
    const curso = contexto?.curso || "Primero Medio";
    
    return {
      anio: Number(qs("#a-anio")?.value), 
      curso,
      alumno: {
        apellidoPaterno: v("a-apellido-paterno"), 
        apellidoMaterno: v("a-apellido-materno"), 
        nombres: v("a-nombres"),
        rut: formatearRUT(qs("#a-rut").value), 
        fechaNacimiento: v("a-nacimiento"), 
        viveCon: v("a-vive-con"),
        fono: v("a-fono"), 
        domicilio: v("a-domicilio"), 
        antecedentesMedicos: v("a-medicos"),
        padre: v("a-padre"), 
        madre: v("a-madre"), 
        establecimientoAnterior: v("a-establecimiento"),
        especialidad: (Number(contexto?.grado) || 1) >= 3 ? v("a-especialidad") : ""
      },
      apoderadoTitular: { 
        nombre: v("t-nombre"), 
        rut: formatearRUT(qs("#t-rut").value), 
        fono: v("t-fono"), 
        domicilio: v("t-domicilio") 
      },
      apoderadoSuplente: { 
        nombre: v("s-nombre"), 
        rut: formatearRUT(qs("#s-rut").value), 
        fono: v("s-fono"), 
        domicilio: v("s-domicilio") 
      },
      documentos: {
        certificadoNacimiento: qs("#d-nacimiento").checked, 
        certificadoEstudio: qs("#d-estudio").checked,
        informePersonalidad: qs("#d-personalidad").checked, 
        fichaEscolar: qs("#d-ficha").checked, 
        carpetaPIE: qs("#d-pie").checked
      },
      retiro: v("m-retiro"), 
      fechaChile: fechaChile?.iso || null, 
      aceptoTerminos: true,
      lobby: { 
        grado: contexto?.grado ?? 1, 
        esRepitente: contexto?.esRepitente ?? false 
      }
    };
  }

  function validarTodo() {
    const ok1 = validarBloqueAlumno();
    const ok2 = validarApoderado("#bloque-titular", "t");
    const ok3 = validarApoderado("#bloque-suplente", "s");
    const ok4 = validarReglas();
    
    if (!ok1 || !ok2 || !ok3 || !ok4) {
      toast("Revisa los campos marcados en rojo.", "error");
      qs(".campo-invalido")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function generarPDFClick() {
    if (!validarTodo()) return;
    const reg = { 
      ...recolectar(), 
      numeroMatricula: qs("#a-numero")?.value.replace(" (est.)","") || "—", 
      seccion: "—" 
    };
    imprimirHTML(construirComprobanteHTML(reg));
  }

  async function manejarEnvio(ev) {
    ev.preventDefault();
    if (!window.BD.conectado) { 
      toast("Sin conexión con la base de datos.", "error"); 
      return; 
    }
    if (!validarTodo()) return;

    const btn = qs("#btn-enviar");
    const htmlOrig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader"></i> Procesando…`;
    if (window.lucide) lucide.createIcons();

    try {
      const reg = await window.BD.agregarPostulante(recolectar());
      toast(`¡Matrícula guardada con éxito! N° asignado: ${reg.numeroMatricula}.`, "ok", 5000);
      setTimeout(() => location.reload(), 2500);
    } catch (e) {
      toast("No se pudo guardar: " + e.message, "error", 8000);
      btn.disabled = false;
      btn.innerHTML = htmlOrig;
      if (window.lucide) lucide.createIcons();
    }
  }

  function construirComprobanteHTML(reg) {
    const v = (val) => String(val || "").trim() || "—";
    const si = (cond) => cond ? "☑" : "☐";
    const fecha = fechaChile ? `${fechaChile.dia} de ${MESES[fechaChile.mes - 1]} de ${fechaChile.anio}` : new Date().toLocaleDateString("es-CL");
    const logoHtml = `<img src="BD_CARGABLE/logo.png" alt="Logo" style="height:2cm;width:auto;" onerror="this.style.display='none'">`;

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Matrícula ${v(reg.numeroMatricula)}</title>
<style>
  @page { size: A4 portrait; margin: 0; } * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 9pt; line-height: 1.25; color: #000; background: #fff; padding: 0.8cm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .membrete { display: flex; align-items: center; gap: 1cm; border-bottom: 2pt solid #1f4fb5; padding-bottom: 0.2cm; margin-bottom: 0.5cm; }
  .membrete h1 { font-size: 14pt; font-weight: 700; color: #0d2766; margin: 0; line-height: 1.1; } .membrete p { font-size: 8pt; color: #33436a; margin: 0; }
  h2 { font-size: 10pt; font-weight: 700; color: #0d2766; margin: 0.3cm 0 0.15cm 0; padding-bottom: 0.05cm; border-bottom: 0.5pt solid #97a6c4; text-transform: uppercase; letter-spacing: 0.02em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0.2cm; }
  th, td { border: 0.5pt solid #999; padding: 0.12cm 0.2cm; text-align: left; vertical-align: top; font-size: 8.5pt; }
  th { background: #f1f5fc; font-weight: 700; width: 22%; color: #1c2a48; } td { width: 28%; }
  .docs { display: flex; flex-wrap: wrap; gap: 0.2cm 0.6cm; font-size: 8.5pt; padding: 0.15cm 0; }
  .declaracion { margin: 0.4cm 0 0.2cm 0; font-style: italic; font-size: 9pt; padding: 0.15cm 0.3cm; background: #f1f5fc; border-left: 2pt solid #1f4fb5; }
  .firmas { display: flex; justify-content: space-between; margin-top: 0.8cm; gap: 1cm; }
  .firma { flex: 1; text-align: center; font-size: 8pt; }
  .firma .linea { border-bottom: 1pt solid #000; height: 1.2cm; margin-bottom: 0.1cm; display: flex; align-items: flex-end; justify-content: center; font-family: 'Caveat', cursive; font-size: 14pt; color: #1f4fb5; }
  .pie { margin-top: 0.5cm; text-align: right; font-size: 8pt; color: #33436a; }
</style></head><body>
  <header class="membrete">${logoHtml}<div><h1>Liceo Eduardo Charme</h1><p>San Fernando · Chile</p></div></header>
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
  <table><tr><th>Nombre</th><td colspan="3">${v(reg.apoderadoTitular?.nombre)}</td></tr><tr><th>R.U.T</th><td>${v(reg.apoderadoTitular?.rut)}</td><th>Fono</th><td>${v(reg.apoderadoTitular?.fono)}</td></tr><tr><th>Domicilio</th><td colspan="3">${v(reg.apoderadoTitular?.domicilio)}</td></tr></table>
  <h2>3. Apoderado Suplente</h2>
  <table><tr><th>Nombre</th><td colspan="3">${v(reg.apoderadoSuplente?.nombre)}</td></tr><tr><th>R.U.T</th><td>${v(reg.apoderadoSuplente?.rut)}</td><th>Fono</th><td>${v(reg.apoderadoSuplente?.fono)}</td></tr><tr><th>Domicilio</th><td colspan="3">${v(reg.apoderadoSuplente?.domicilio)}</td></tr></table>
  <h2>4. Documentos recibidos</h2>
  <div class="docs">
    <span>${si(reg.documentos?.certificadoNacimiento)} a) Certificado de nacimiento</span>
    <span>${si(reg.documentos?.certificadoEstudio)} b) Certificado de estudio</span>
    <span>${si(reg.documentos?.informePersonalidad)} c) Informe de personalidad</span>
    <span>${si(reg.documentos?.fichaEscolar)} d) Ficha escolar</span>
    <span>${si(reg.documentos?.carpetaPIE)} e) Carpeta PIE</span>
  </div>
  <div class="declaracion">Declaro haber recibido los documentos antes señalados.</div>
  <div class="firmas">
    <div class="firma"><div class="linea"></div>Firma del Apoderado</div>
    <div class="firma"><div class="linea">R. Charme</div>Firma del Director</div>
  </div>
  <div class="pie">San Fernando, ${fecha}</div>
</body></html>`;
  }

  function imprimirHTML(html) {
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
})();