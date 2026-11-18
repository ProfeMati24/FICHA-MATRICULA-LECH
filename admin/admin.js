/* =============================================================
   admin/admin.js — Panel de administración
   ============================================================= */
import { BD } from "../ScriptBD.js";

// Sincronizar tema guardado desde el formulario (clave correcta: charme-tema)
const temaGuardado = localStorage.getItem("charme-tema") || localStorage.getItem("tema") || localStorage.getItem("theme");
if (temaGuardado) {
  document.documentElement.setAttribute("data-theme", temaGuardado);
}

const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const PWD_ADMIN = "2448";

function toast(m, t = "info", ms = 4000) {
  let c = qs("#toast-cont");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-cont"; c.className = "toast-cont";
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
  actualizarEstado();

  qs("#btn-conectar").addEventListener("click", async () => {
    try { await BD.conectar(); actualizarEstado(); await refrescar(); }
    catch (e) { if (e.name !== "AbortError") toast("Error: " + e.message, "error"); }
  });

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
  actualizarEstado();
  if (r.ok) await refrescar();
  else if (r.motivo === "permiso-pendiente")
    toast("Pulsa «Conectar carpeta» para confirmar el permiso.", "info", 6000);

  BD.suscribir(t => {
    if (["alta", "cambio", "baja", "cargado", "conexion", "desconexion"].includes(t)) {
      actualizarEstado();
      refrescar();
    }
  });
}

function actualizarEstado() {
  const el = qs("#estado-conexion");
  el.className = "estado-conexion";
  if (BD.conectado) {
    el.classList.add("ok");
    el.innerHTML = `<i data-lucide="database"></i> ${esc(BD.carpeta)}`;
    qs("#btn-conectar").innerHTML = `<i data-lucide="refresh-cw"></i> Reconectar`;
  } else {
    el.innerHTML = `<i data-lucide="database"></i> Sin carpeta`;
    qs("#btn-conectar").innerHTML = `<i data-lucide="folder-open"></i> Conectar carpeta`;
  }
  if (window.lucide) lucide.createIcons();
}

/* ---------- TABLA + FILTROS ---------- */
function refrescar() {
  if (!BD.conectado) return;

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
function abrirModal(id) {
  const p = BD.postulantes.find(x => x.id === id);
  if (!p) return;
  idActual = id;
  qs("#m-titulo").textContent = `${p.numeroMatricula} · ${p.alumno?.nombres || ""}`;
  const docs = p.documentos || {};
  const chk = v => v ? "on" : "";
  qs("#m-body").innerHTML = `
    <div>
      <h3>Datos de matrícula</h3>
      <dl class="dl">
        <dt>N° matrícula</dt><dd class="mono">${esc(p.numeroMatricula)}</dd>
        <dt>Año</dt><dd>${esc(p.anio)}</dd>
        <dt>Curso</dt><dd>${esc(p.curso)}</dd>
        <dt>Estado</dt><dd>
          <select id="m-estado">
            ${BD.config.estados.map(e =>
              `<option ${e === p.estado ? "selected" : ""}>${esc(e)}</option>`).join("")}
          </select>
        </dd>
        <dt>Creado</dt><dd class="mono">${esc((p.creado || "").slice(0, 19) || "—")}</dd>
      </dl>
    </div>
    <div>
      <h3>Alumno</h3>
      <dl class="dl">
        <dt>Apellidos</dt><dd>${esc(p.alumno?.apellidoPaterno)} ${esc(p.alumno?.apellidoMaterno)}</dd>
        <dt>Nombres</dt><dd>${esc(p.alumno?.nombres)}</dd>
        <dt>RUT</dt><dd class="mono">${esc(p.alumno?.rut)}</dd>
        <dt>Nacimiento</dt><dd>${esc(p.alumno?.fechaNacimiento)}</dd>
        <dt>Vive con</dt><dd>${esc(p.alumno?.viveCon)}</dd>
        <dt>Fono</dt><dd>${esc(p.alumno?.fono)}</dd>
        <dt>Domicilio</dt><dd>${esc(p.alumno?.domicilio)}</dd>
        <dt>Establecimiento anterior</dt><dd>${esc(p.alumno?.establecimientoAnterior) || "—"}</dd>
        <dt>Padre</dt><dd>${esc(p.alumno?.padre) || "—"}</dd>
        <dt>Madre</dt><dd>${esc(p.alumno?.madre) || "—"}</dd>
        <dt>Antecedentes médicos</dt><dd>${esc(p.alumno?.antecedentesMedicos) || "—"}</dd>
      </dl>
    </div>
    <div>
      <h3>Apoderado titular</h3>
      <dl class="dl">
        <dt>Nombre</dt><dd>${esc(p.apoderadoTitular?.nombre)}</dd>
        <dt>RUT</dt><dd class="mono">${esc(p.apoderadoTitular?.rut)}</dd>
        <dt>Fono</dt><dd>${esc(p.apoderadoTitular?.fono)}</dd>
        <dt>Domicilio</dt><dd>${esc(p.apoderadoTitular?.domicilio)}</dd>
      </dl>
    </div>
    <div>
      <h3>Apoderado suplente</h3>
      <dl class="dl">
        <dt>Nombre</dt><dd>${esc(p.apoderadoSuplente?.nombre)}</dd>
        <dt>RUT</dt><dd class="mono">${esc(p.apoderadoSuplente?.rut)}</dd>
        <dt>Fono</dt><dd>${esc(p.apoderadoSuplente?.fono)}</dd>
        <dt>Domicilio</dt><dd>${esc(p.apoderadoSuplente?.domicilio)}</dd>
      </dl>
    </div>
    <div>
      <h3>Documentos recibidos</h3>
      <span class="doc-line ${chk(docs.certificadoNacimiento)}">a) Nacimiento</span>
      <span class="doc-line ${chk(docs.certificadoEstudio)}">b) Estudio</span>
      <span class="doc-line ${chk(docs.informePersonalidad)}">c) Personalidad</span>
      <span class="doc-line ${chk(docs.fichaEscolar)}">d) Ficha</span>
      <span class="doc-line ${chk(docs.carpetaPIE)}">e) PIE</span>
    </div>
  `;
  qs("#modal").classList.add("on");
  if (window.lucide) lucide.createIcons();
}

function cerrarModal() {
  qs("#modal").classList.remove("on");
  idActual = null;
}

qs("#m-cerrar").addEventListener("click", cerrarModal);
qs("#m-cerrar-2").addEventListener("click", cerrarModal);
qs("#modal").addEventListener("click", e => { if (e.target === qs("#modal")) cerrarModal(); });

qs("#m-guardar").addEventListener("click", async () => {
  if (!idActual) return;
  try {
    const nuevo = qs("#m-estado").value;
    await BD.actualizarPostulante(idActual, { estado: nuevo });
    toast("Cambios guardados.", "ok");
    cerrarModal();
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

/* =============================================================
   EXCEL GLOBAL
   ============================================================= */
function exportarExcel() {
  if (!BD.conectado) { toast("Conecta la carpeta primero.", "error"); return; }
  if (typeof XLSX === "undefined") {
    toast("No se cargó la librería de Excel. Revisa la conexión a internet.", "error");
    return;
  }
  if (!BD.postulantes.length) { toast("No hay postulantes para exportar.", "info"); return; }

  const filas = BD.postulantes.map(p => ({
    "N° Matrícula": p.numeroMatricula || "",
    "Año": p.anio || "",
    "Estado": p.estado || "",
    "Apellido Paterno": p.alumno?.apellidoPaterno || "",
    "Apellido Materno": p.alumno?.apellidoMaterno || "",
    "Nombres": p.alumno?.nombres || "",
    "RUT": p.alumno?.rut || "",
    "Fecha Nacimiento": p.alumno?.fechaNacimiento || "",
    "Vive Con": p.alumno?.viveCon || "",
    "Fono Alumno": p.alumno?.fono || "",
    "Domicilio": p.alumno?.domicilio || "",
    "Establecimiento Anterior": p.alumno?.establecimientoAnterior || "",
    "Padre": p.alumno?.padre || "",
    "Madre": p.alumno?.madre || "",
    "Antecedentes Médicos": p.alumno?.antecedentesMedicos || "",
    "Apoderado Titular": p.apoderadoTitular?.nombre || "",
    "RUT Titular": p.apoderadoTitular?.rut || "",
    "Fono Titular": p.apoderadoTitular?.fono || "",
    "Domicilio Titular": p.apoderadoTitular?.domicilio || "",
    "Apoderado Suplente": p.apoderadoSuplente?.nombre || "",
    "RUT Suplente": p.apoderadoSuplente?.rut || "",
    "Fono Suplente": p.apoderadoSuplente?.fono || "",
    "Domicilio Suplente": p.apoderadoSuplente?.domicilio || "",
    "Doc. Nacimiento": p.documentos?.certificadoNacimiento ? "Sí" : "No",
    "Doc. Estudio": p.documentos?.certificadoEstudio ? "Sí" : "No",
    "Doc. Personalidad": p.documentos?.informePersonalidad ? "Sí" : "No",
    "Doc. Ficha": p.documentos?.fichaEscolar ? "Sí" : "No",
    "Doc. PIE": p.documentos?.carpetaPIE ? "Sí" : "No",
    "Fecha Retiro": p.retiro || "",
    "Fecha Registro": (p.creado || "").slice(0, 19)
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const anchos = Object.keys(filas[0]).map(k => ({
    wch: Math.max(10, Math.min(40, k.length + 2,
      ...filas.op(f => String(f[k] || "").length + 2))) // Nota: Se conserva exactamente el código original
  }));
  ws["!cols"] = anchos;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Postulantes");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `matriculas-charme-${fecha}.xlsx`);
  toast(`${filas.length} postulantes exportados a Excel.`, "ok", 6000);
}

/* =============================================================
   PDF POR ALUMNO (impresión nativa → Guardar como PDF)
   ============================================================= */
function generarPDFEstudiante(p) {
  const w = window.open("", "_blank", "width=860,height=1000");
  if (!w) {
    toast("Permite ventanas emergentes para generar el PDF.", "error", 6000);
    return;
  }

  const docs = p.documentos || {};
  const si = v => v ? "☑" : "☐";
  const fmt = iso => {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return iso;
    const meses = ["enero","febrero","marzo","abril","mayo","junio",
      "julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`;
  };
  const fechaCierre = fmt(p.fechaChile || (p.creado || "").slice(0, 10));

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Matrícula ${esc(p.numeroMatricula)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#111;line-height:1.45;
    padding:18mm 16mm}
  h1{font-size:15pt;text-align:center;color:#1e3a8a;letter-spacing:.02em}
  .sub{text-align:center;font-size:9pt;color:#555;margin:2px 0 16px}
  .mat-num{text-align:center;font-family:'Consolas',monospace;font-size:11pt;
    color:#92400e;font-weight:700;margin-bottom:14px}
  h2{font-size:10.5pt;color:#1e3a8a;border-bottom:1px solid #94a3b8;
    padding-bottom:3px;margin:14px 0 6px;text-transform:uppercase;letter-spacing:.05em}
  .row{display:grid;grid-template-columns:48mm 1fr;gap:3px 8px;font-size:10pt}
  .row dt{color:#475569;font-weight:600}
  .row dd{color:#0f172a;word-break:break-word}
  .doc{display:inline-block;margin-right:14px;font-size:9.5pt;white-space:nowrap}
  .declaracion{background:#eff6ff;border-left:3px solid #3b82f6;
    padding:7px 10px;margin:12px 0;font-style:italic;font-size:10pt;color:#1e3a8a}
  .cierre{text-align:right;margin-top:10mm;font-size:10pt}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:30mm;margin-top:20mm}
  .firma{text-align:center}
  .linea{border-bottom:1px solid #111;height:16mm}
  .firma strong{display:block;font-size:9pt;margin-top:5px}
  .firma span{font-size:8.5pt;color:#555}
  @media print{
    body{padding:12mm 10mm}
    @page{size:A4;margin:0}
  }
</style></head>
<body>
<h1>Liceo Eduardo Charme</h1>
<div class="sub">San Fernando · Ficha de Matrícula</div>
<div class="mat-num">N° ${esc(p.numeroMatricula)}</div>

<h2>Datos de matrícula</h2>
<dl class="row">
  <dt>Año escolar</dt><dd>${esc(p.anio)}</dd>
  <dt>Curso</dt><dd>${esc(p.curso)}</dd>
  <dt>Fecha de registro</dt><dd>${esc(fechaCierre)}</dd>
  <dt>Estado</dt><dd>${esc(p.estado)}</dd>
</dl>

<h2>Datos del alumno</h2>
<dl class="row">
  <dt>Apellidos</dt><dd>${esc(p.alumno?.apellidoPaterno || "")} ${esc(p.alumno?.apellidoMaterno || "")}</dd>
  <dt>Nombres</dt><dd>${esc(p.alumno?.nombres || "")}</dd>
  <dt>R.U.T.</dt><dd>${esc(p.alumno?.rut || "")}</dd>
  <dt>Fecha de nacimiento</dt><dd>${esc(p.alumno?.fechaNacimiento || "")}</dd>
  <dt>Vive con</dt><dd>${esc(p.alumno?.viveCon || "")}</dd>
  <dt>Fono</dt><dd>${esc(p.alumno?.fono || "")}</dd>
  <dt>Domicilio</dt><dd>${esc(p.alumno?.domicilio || "")}</dd>
  <dt>Establecimiento anterior</dt><dd>${esc(p.alumno?.establecimientoAnterior) || "—"}</dd>
  <dt>Padre</dt><dd>${esc(p.alumno?.padre) || "—"}</dd>
  <dt>Madre</dt><dd>${esc(p.alumno?.madre) || "—"}</dd>
  <dt>Antecedentes médicos</dt><dd>${esc(p.alumno?.antecedentesMedicos) || "—"}</dd>
</dl>

<h2>Apoderado titular</h2>
<dl class="row">
  <dt>Nombre</dt><dd>${esc(p.apoderadoTitular?.nombre || "")}</dd>
  <dt>R.U.T.</dt><dd>${esc(p.apoderadoTitular?.rut || "")}</dd>
  <dt>Fono</dt><dd>${esc(p.apoderadoTitular?.fono || "")}</dd>
  <dt>Domicilio</dt><dd>${esc(p.apoderadoTitular?.domicilio || "")}</dd>
</dl>

<h2>Apoderado suplente</h2>
<dl class="row">
  <dt>Nombre</dt><dd>${esc(p.apoderadoSuplente?.nombre || "")}</dd>
  <dt>R.U.T.</dt><dd>${esc(p.apoderadoSuplente?.rut || "")}</dd>
  <dt>Fono</dt><dd>${esc(p.apoderadoSuplente?.fono || "")}</dd>
  <dt>Domicilio</dt><dd>${esc(p.apoderadoSuplente?.domicilio || "")}</dd>
</dl>

<h2>Documentos recibidos</h2>
<div>
  <span class="doc">${si(docs.certificadoNacimiento)} Certificado de nacimiento</span>
  <span class="doc">${si(docs.certificadoEstudio)} Certificado de estudio</span>
  <span class="doc">${si(docs.informePersonalidad)} Informe de personalidad</span>
  <span class="doc">${si(docs.fichaEscolar)} Ficha escolar</span>
  <span class="doc">${si(docs.carpetaPIE)} Carpeta PIE</span>
</div>

<div class="declaracion">Declaro haber recibido los documentos antes señalados.</div>

<div class="cierre">San Fernando, ${esc(fechaCierre)}</div>

<div class="firmas">
  <div class="firma">
    <div class="linea"></div>
    <strong>Firma del Apoderado</strong>
    <span>${esc(p.apoderadoTitular?.nombre || "")}</span>
  </div>
  <div class="firma">
    <div class="linea"></div>
    <strong>Firma del Director</strong>
    <span>Liceo Eduardo Charme</span>
  </div>
</div>

<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});<\/script>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

if (window.lucide) lucide.createIcons();
