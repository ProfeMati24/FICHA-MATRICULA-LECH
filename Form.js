/* =============================================================
   Form.js — Orquestador del formulario (5 bloques en un archivo)
   Toda lectura/escritura de datos va por ScriptBD.js (BD).
   ============================================================= */
import { BD } from "./ScriptBD.js";
import { BuscadorEstablecimientos } from "./buscadorEstablecimientos.js";

/* ---------- helpers ---------- */
const qs  = (s,r=document)=>r.querySelector(s);
const qsa = (s,r=document)=>Array.from(r.querySelectorAll(s));
const MESES=["enero","febrero","marzo","abril","mayo","junio","julio",
             "agosto","septiembre","octubre","noviembre","diciembre"];

function formatearRUT(v){
  const l=String(v||"").replace(/[^0-9kK]/g,"").toUpperCase();
  if(l.length<2) return l;
  return l.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,".")+"-"+l.slice(-1);
}
function validarRUT(v){
  const l=String(v||"").replace(/[^0-9kK]/g,"").toUpperCase();
  if(l.length<8||l.length>9) return false;
  const c=l.slice(0,-1), dv=l.slice(-1);
  if(!/^\d+$/.test(c)) return false;
  let s=0,m=2;
  for(let i=c.length-1;i>=0;i--){s+=Number(c[i])*m;m=m===7?2:m+1;}
  const r=s%11, esp=r===0?"0":r===1?"K":String(11-r);
  return dv===esp;
}
function marcarError(input,msg){
  if(!input) return;
  input.classList.add("campo-invalido");
  const campo=input.closest(".campo");
  if(!campo) return;
  let a=campo.querySelector(".campo-error");
  if(!a){a=document.createElement("div");a.className="campo-error";campo.appendChild(a);}
  a.textContent=msg||"Revisa este campo";
}
function limpiarErrores(raiz){
  if(!raiz) return;
  qsa(".campo-invalido",raiz).forEach(el=>el.classList.remove("campo-invalido"));
  qsa(".campo-error",raiz).forEach(el=>el.remove());
}
function toast(msg,tipo="info",ms=4500){
  let cont=qs("#toast-cont");
  if(!cont){cont=document.createElement("div");cont.id="toast-cont";
    cont.className="toast-cont";document.body.appendChild(cont);}
  const el=document.createElement("div");
  el.className=`toast toast-${tipo}`; el.textContent=msg;
  cont.appendChild(el);
  setTimeout(()=>el.remove(),ms);
}

/* ---------- fecha oficial de Chile ---------- */
async function obtenerFechaChile(){
  const intentos=[
    ["https://worldtimeapi.org/api/timezone/America/Santiago",j=>j?.datetime],
    ["https://timeapi.io/api/Time/current/zone?timeZone=America/Santiago",j=>j?.dateTime]
  ];
  for(const [url,extraer] of intentos){
    try{
      const ctrl=new AbortController();
      const t=setTimeout(()=>ctrl.abort(),6000);
      const res=await fetch(url,{cache:"no-store",signal:ctrl.signal});
      clearTimeout(t);
      if(!res.ok) continue;
      const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(extraer(await res.json())));
      if(m) return {ok:true,anio:+m[1],mes:+m[2],dia:+m[3],iso:`${m[1]}-${m[2]}-${m[3]}`};
    }catch{}
  }
  return {ok:false};
}

/* ============================================================
   ESTADO
   ============================================================ */
let fechaChile=null;

/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener("DOMContentLoaded", async()=>{
  if(window.lucide) lucide.createIcons();
  engancharConexion();
  await prepararFechaYAnio();
  prepararEstablecimientos();
  engancharRUTs();
  inicializarReglas();
  actualizarIndicadorConexion();
  await arrancarBD();
  actualizarNumeroMatricula();
  qs("#form-matricula")?.addEventListener("submit", manejarEnvio);
  qs("#r-acepto")?.addEventListener("change", validarBotonEnvio);
  qs("#btn-cancelar")?.addEventListener("click", ()=>{
    if(confirm("¿Limpiar el formulario?")) qs("#form-matricula")?.reset();
  });
  BD.suscribir(tipo=>{
    if(tipo==="alta"||tipo==="cambio"||tipo==="cargado"||tipo==="conexion"||tipo==="desconexion"){
      actualizarIndicadorConexion();
      actualizarNumeroMatricula();
      validarBotonEnvio();
    }
  });
});

/* ============================================================
   CONEXIÓN
   ============================================================ */
function engancharConexion(){
  qs("#btn-conectar")?.addEventListener("click", async()=>{
    try{
      const carpeta=await BD.conectar();
      toast(`Carpeta conectada: ${carpeta}`,"ok");
    }catch(e){
      if(e.name!=="AbortError") toast("Error al conectar: "+e.message,"error");
    }
  });
}
async function arrancarBD(){
  if(!BD.soportado){
    toast("Este navegador no soporta File System Access API. Usa Chrome o Edge.","error",8000);
    return;
  }
  const r=await BD.intentarRestaurar();
  if(r.ok) toast(`Carpeta restaurada: ${BD.carpeta}`,"ok");
  else if(r.motivo==="permiso-pendiente")
    toast("Pulsa «Reconectar» para confirmar el permiso de la carpeta.","info",7000);
}
function actualizarIndicadorConexion(){
  const el=qs("#estado-conexion"); if(!el) return;
  el.className="estado-conexion";
  if(BD.conectado){
    el.classList.add("ok");
    el.innerHTML=`<i data-lucide="database"></i> ${BD.carpeta}`;
    const b=qs("#btn-conectar"); if(b) b.innerHTML=`<i data-lucide="refresh-cw"></i> Reconectar`;
  }else if(BD.tienePendiente){
    el.classList.add("pendiente");
    el.innerHTML=`<i data-lucide="alert-triangle"></i> Permiso pendiente`;
    const b=qs("#btn-conectar"); if(b) b.innerHTML=`<i data-lucide="refresh-cw"></i> Reconectar`;
  }else{
    el.innerHTML=`<i data-lucide="database"></i> Sin carpeta`;
    const b=qs("#btn-conectar"); if(b) b.innerHTML=`<i data-lucide="folder-open"></i> Conectar carpeta`;
  }
  if(window.lucide) lucide.createIcons();
}

/* ============================================================
   BLOQUE 1 · preparación
   ============================================================ */
async function prepararFechaYAnio(){
  fechaChile=await obtenerFechaChile();
  const sel=qs("#a-anio"); if(!sel) return;
  sel.innerHTML="";
  if(!fechaChile.ok){
    toast("No se pudo obtener la fecha oficial de Chile.","error",8000);
    const op=document.createElement("option");
    op.textContent="Error de fecha"; sel.appendChild(op); sel.disabled=true; return;
  }
  for(let i=0;i<4;i++){
    const a=fechaChile.anio+i;
    const op=document.createElement("option");
    op.value=a; op.textContent=a; sel.appendChild(op);
  }
  const ft=qs("#mat-fecha-texto");
  if(ft) ft.textContent=`${fechaChile.dia} de ${MESES[fechaChile.mes-1]} de ${fechaChile.anio}`;
  const cierre=qs("#mat-cierre");
  if(cierre) cierre.innerHTML=`San Fernando, <strong>${fechaChile.dia}</strong> de <strong>${MESES[fechaChile.mes-1]}</strong> de <strong>${fechaChile.anio}</strong>`;
}
function prepararEstablecimientos(){
  const input=qs("#a-establecimiento"), lista=qs("#lista-establecimientos");
  if(!input||!lista) return;
  const refrescar=()=>{
    const todos=BuscadorEstablecimientos.obtenerTodos();
    if(!todos.length) return;
    const txt=input.value;
    let items=txt?BuscadorEstablecimientos.buscar(txt):todos;
    if(!items.length) items=todos;
    lista.innerHTML="";
    for(const e of items.slice(0,30)){
      const op=document.createElement("option");
      op.value=e.nombre; op.label=`${e.categoria} · ${e.ciudad}`;
      lista.appendChild(op);
    }
  };
  BuscadorEstablecimientos.cargar().catch(err=>console.warn("Establecimientos:",err.message));
  input.addEventListener("focus",refrescar);
  input.addEventListener("input",refrescar);
  refrescar();
}
function engancharRUTs(){
  ["a-rut","t-rut","s-rut"].forEach(id=>{
    const el=qs("#"+id);
    el?.addEventListener("blur",()=>{if(el.value.trim()) el.value=formatearRUT(el.value);});
  });
  qs("#a-anio")?.addEventListener("change",actualizarNumeroMatricula);
}
function actualizarNumeroMatricula(){
  const campo=qs("#a-numero"); if(!campo) return;
  if(!BD.conectado){campo.value="—";return;}
  const anio=Number(qs("#a-anio")?.value);
  if(!anio){campo.value="—";return;}
  try{campo.value=BD.siguienteNumero(anio);}catch{campo.value="—";}
}

/* ============================================================
   BLOQUE 4 · reglas
   ============================================================ */
function inicializarReglas(){
  const cont=qs("#pdf-contenedor"); if(!cont) return;
  fetch("assets/reglas.pdf",{method:"HEAD"}).then(r=>{
    if(!r.ok) throw new Error();
    const iframe=document.createElement("iframe");
    iframe.src="assets/reglas.pdf"; iframe.className="pdf-iframe";
    cont.innerHTML="";
    const barra=document.createElement("div");
    barra.className="pdf-toolbar";
    barra.innerHTML=`<i data-lucide="file-text"></i><strong>reglas.pdf</strong><span class="pdf-paginas">assets/</span>`;
    cont.appendChild(barra);
    cont.appendChild(iframe);
    if(window.lucide) lucide.createIcons();
  }).catch(()=>{
    cont.innerHTML=`<div class="pdf-error">No está cargada la declaración de compromiso al juramento.</div>`;
  });
}

/* ============================================================
   VALIDACIÓN
   ============================================================ */
function validarBloqueAlumno(){
  const raiz=qs("#bloque-alumno"); limpiarErrores(raiz); let ok=true;
  const req=[
    ["a-apellido-paterno","Ingresa el apellido paterno"],
    ["a-apellido-materno","Ingresa el apellido materno"],
    ["a-nombres","Ingresa los nombres"],
    ["a-nacimiento","Selecciona la fecha de nacimiento"],
    ["a-vive-con","Selecciona con quién vive"],
    ["a-fono","Ingresa el fono"],
    ["a-domicilio","Ingresa el domicilio"]
  ];
  for(const [id,msg] of req){
    const el=qs("#"+id);
    if(!String(el?.value||"").trim()){marcarError(el,msg);ok=false;}
  }
  const rut=qs("#a-rut");
  if(!rut.value.trim()){marcarError(rut,"Ingresa el R.U.T");ok=false;}
  else if(!validarRUT(rut.value)){marcarError(rut,"R.U.T inválido");ok=false;}

  const nac=qs("#a-nacimiento");
  const anio=Number(qs("#a-anio")?.value);
  if(nac.value&&anio&&Number(nac.value.slice(0,4))>=anio){
    marcarError(nac,"La fecha no puede ser posterior al año de ingreso"); ok=false;
  }
  const fono=qs("#a-fono");
  if(fono.value.trim()&&fono.value.replace(/\D/g,"").length<8){
    marcarError(fono,"Fono incompleto"); ok=false;
  }
  return ok;
}
function validarApoderado(raizSel,pref){
  const raiz=qs(raizSel); limpiarErrores(raiz); let ok=true;
  if(!qs(`#${pref}-nombre`).value.trim()){marcarError(qs(`#${pref}-nombre`),"Ingresa el nombre");ok=false;}
  if(!qs(`#${pref}-domicilio`).value.trim()){marcarError(qs(`#${pref}-domicilio`),"Ingresa el domicilio");ok=false;}
  const rut=qs(`#${pref}-rut`);
  if(!rut.value.trim()){marcarError(rut,"Ingresa el R.U.T");ok=false;}
  else if(!validarRUT(rut.value)){marcarError(rut,"R.U.T inválido");ok=false;}
  const fono=qs(`#${pref}-fono`);
  if(!fono.value.trim()){marcarError(fono,"Ingresa el fono");ok=false;}
  else if(fono.value.replace(/\D/g,"").length<8){marcarError(fono,"Fono incompleto");ok=false;}
  return ok;
}
function validarReglas(){return qs("#r-acepto")?.checked===true;}
function validarBotonEnvio(){
  const b=qs("#btn-enviar"); if(!b) return;
  b.disabled = !BD.conectado || !validarReglas();
}

/* ============================================================
   ENVÍO
   ============================================================ */
function recolectar(){
  const v=id=>String(qs("#"+id)?.value??"").trim();
  return {
    anio:Number(qs("#a-anio")?.value),
    curso:"Primero Medio",
    alumno:{
      apellidoPaterno:v("a-apellido-paterno"),
      apellidoMaterno:v("a-apellido-materno"),
      nombres:v("a-nombres"),
      rut:formatearRUT(qs("#a-rut").value),
      fechaNacimiento:v("a-nacimiento"),
      viveCon:v("a-vive-con"),
      fono:v("a-fono"),
      domicilio:v("a-domicilio"),
      antecedentesMedicos:v("a-medicos"),
      padre:v("a-padre"),
      madre:v("a-madre"),
      establecimientoAnterior:v("a-establecimiento")
    },
    apoderadoTitular:{
      nombre:v("t-nombre"),
      rut:formatearRUT(qs("#t-rut").value),
      fono:v("t-fono"),
      domicilio:v("t-domicilio")
    },
    apoderadoSuplente:{
      nombre:v("s-nombre"),
      rut:formatearRUT(qs("#s-rut").value),
      fono:v("s-fono"),
      domicilio:v("s-domicilio")
    },
    documentos:{
      certificadoNacimiento:qs("#d-nacimiento").checked,
      certificadoEstudio:qs("#d-estudio").checked,
      informePersonalidad:qs("#d-personalidad").checked,
      fichaEscolar:qs("#d-ficha").checked,
      carpetaPIE:qs("#d-pie").checked
    },
    retiro:v("m-retiro"),
    fechaChile:fechaChile?.iso||null,
    aceptoTerminos:true
  };
}
async function manejarEnvio(ev){
  ev.preventDefault();
  if(!BD.conectado){toast("Conecta la carpeta de datos.","error");return;}

  const ok1=validarBloqueAlumno();
  const ok2=validarApoderado("#bloque-titular","t");
  const ok3=validarApoderado("#bloque-suplente","s");
  const ok4=validarReglas();
  if(!ok1||!ok2||!ok3||!ok4){
    toast("Revisa los campos marcados en rojo.","error");
    qs(".campo-invalido")?.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }

  const btn=qs("#btn-enviar");
  const htmlOrig=btn.innerHTML;
  btn.disabled=true;
  btn.innerHTML=`<i data-lucide="loader"></i> Guardando…`;
  if(window.lucide) lucide.createIcons();

  try{
    const reg=await BD.agregarPostulante(recolectar());
    qs("#mat-numero").textContent=reg.numeroMatricula;
    qs("#mat-seccion").textContent = reg.seccion || "—";
    qs("#mat-anio").textContent=reg.anio;
    toast(`Matrícula registrada: ${reg.numeroMatricula}`,"ok",6000);
    if(confirm("¿Imprimir el comprobante ahora?")) window.print();
  }catch(e){
    toast("No se pudo guardar: "+e.message,"error",8000);
  }finally{
    btn.disabled=false;
    btn.innerHTML=htmlOrig;
    if(window.lucide) lucide.createIcons();
    actualizarNumeroMatricula();
    validarBotonEnvio();
  }
}