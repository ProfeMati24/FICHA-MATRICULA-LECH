/* =============================================================
   ScriptBD.js — ÚNICA capa de acceso a datos.
   Adaptador actual: File System Access API.
   ============================================================= */

export const ARCHIVO_POSTULANTES = "postulantes.json";
export const ARCHIVO_CONFIG      = "config.json";
export const VERSION_ESQUEMA     = 2; // sube al quitar secciones

export const CONFIG_POR_DEFECTO = {
  version: VERSION_ESQUEMA,
  anioActivo: null,
  estados: ["postulante", "recibido", "aceptado", "matriculado", "rechazado"]
};

/* ---------- IndexedDB: recuerda la carpeta elegida ---------- */
const IDB_NOMBRE="charme-matriculas", IDB_STORE="handles", IDB_CLAVE="carpetaDatos";
function idbAbrir(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open(IDB_NOMBRE,1);
    req.onupgradeneeded=()=>{const db=req.result;
      if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);};
    req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error);
  });
}
async function idbGet(k){
  const db=await idbAbrir();
  return new Promise((res,rej)=>{
    const q=db.transaction(IDB_STORE,"readonly").objectStore(IDB_STORE).get(k);
    q.onsuccess=()=>{db.close();res(q.result??null);}; q.onerror=()=>{db.close();rej(q.error);};
  });
}
async function idbSet(k,v){
  const db=await idbAbrir();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,"readwrite");
    tx.objectStore(IDB_STORE).put(v,k);
    tx.oncomplete=()=>{db.close();res(true);}; tx.onerror=()=>{db.close();rej(tx.error);};
  });
}
async function idbDel(k){
  const db=await idbAbrir();
  return new Promise((res,rej)=>{
    const tx=db.transaction(IDB_STORE,"readwrite");
    tx.objectStore(IDB_STORE).delete(k);
    tx.oncomplete=()=>{db.close();res(true);}; tx.onerror=()=>{db.close();rej(tx.error);};
  });
}

/* ---------- Adaptador File System Access API ---------- */
function crearAdaptadorFS(){
  let carpeta=null, pendiente=null;
  return {
    tipo:"filesystem",
    soportado: typeof window!=="undefined" && "showDirectoryPicker" in window,
    get conectado(){return !!carpeta;},
    get nombreCarpeta(){return carpeta?carpeta.name:null;},
    get tienePendiente(){return !!pendiente;},
    usar(h){carpeta=h;pendiente=null;},
    recordar(h){pendiente=h;},
    async elegir(){
      const h=await window.showDirectoryPicker({id:"charme-datos",mode:"readwrite",startIn:"documents"});
      carpeta=h; pendiente=null; await idbSet(IDB_CLAVE,h); return h.name;
    },
    async obtenerGuardado(){ try{return await idbGet(IDB_CLAVE);}catch{return null;} },
    async autorizarPendiente(){
      if(!pendiente) return false;
      const p=await pendiente.requestPermission({mode:"readwrite"});
      if(p==="granted"){carpeta=pendiente;pendiente=null;await idbSet(IDB_CLAVE,carpeta);return true;}
      return false;
    },
    async leer(nombre){
      let fh;
      try{fh=await carpeta.getFileHandle(nombre);}
      catch(e){if(e.name==="NotFoundError") return null; throw e;}
      const t=await (await fh.getFile()).text();
      if(!t.trim()) return null;
      try{return JSON.parse(t);}catch{throw new Error(`${nombre} no contiene JSON válido.`);}
    },
    async escribir(nombre,obj){
      const fh=await carpeta.getFileHandle(nombre,{create:true});
      const w=await fh.createWritable();
      await w.write(JSON.stringify(obj,null,2)); await w.close();
    },
    async olvidar(){carpeta=null;pendiente=null;await idbDel(IDB_CLAVE);}
  };
}

/* ---------- Núcleo ---------- */
const adaptador = crearAdaptadorFS();
const oyentes   = new Set();
let   cola      = Promise.resolve();
function enCola(t){const r=cola.then(t,t);cola=r.then(()=>{},()=>{});return r;}
function emitir(tipo,d){for(const fn of oyentes){try{fn(tipo,d);}catch(e){console.error(e);}}}

/* ---------- API pública ---------- */
export const BD = {
  config:{...CONFIG_POR_DEFECTO},
  postulantes:[],
  ultimaCarga:null,

  get soportado(){return adaptador.soportado;},
  get conectado(){return adaptador.conectado;},
  get carpeta(){return adaptador.nombreCarpeta;},
  get tienePendiente(){return adaptador.tienePendiente;},

  suscribir(fn){oyentes.add(fn);return ()=>oyentes.delete(fn);},

  async intentarRestaurar(){
    if(!this.soportado) return {ok:false,motivo:"no-soportado"};
    const h=await adaptador.obtenerGuardado();
    if(!h) return {ok:false,motivo:"sin-handle"};
    try{
      const p=await h.queryPermission({mode:"readwrite"});
      if(p==="granted"){adaptador.usar(h);await this.cargar();return {ok:true,carpeta:adaptador.nombreCarpeta};}
      adaptador.recordar(h);
      return {ok:false,motivo:"permiso-pendiente"};
    }catch(e){return {ok:false,motivo:"error",error:e.message};}
  },

  async reconectar(){
    if(!this.soportado) throw new Error("Usa Chrome o Edge: File System Access API no disponible.");
    if(!(await adaptador.autorizarPendiente())) await adaptador.elegir();
    await this.cargar();
    emitir("conexion",{carpeta:adaptador.nombreCarpeta});
    return adaptador.nombreCarpeta;
  },
  async conectar(){return this.reconectar();},

  async desconectar(){
    await adaptador.olvidar();
    this.postulantes=[]; this.config={...CONFIG_POR_DEFECTO};
    emitir("desconexion");
  },

  async cargar(){
    if(!this.conectado) return {ok:false,motivo:"sin-conexion"};

    const cfg=await adaptador.leer(ARCHIVO_CONFIG);
    if(cfg&&typeof cfg==="object"){
      // descartar campos obsoletos de versiones anteriores
      const limpio = { ...cfg };
      delete limpio.capacidadPorSeccion;
      delete limpio.seccionesHabilitadas;
      this.config={...CONFIG_POR_DEFECTO,...limpio,version:VERSION_ESQUEMA};
    }else{
      this.config={...CONFIG_POR_DEFECTO};
      await adaptador.escribir(ARCHIVO_CONFIG,this.config);
    }

    const d=await adaptador.leer(ARCHIVO_POSTULANTES);
    if(Array.isArray(d)) this.postulantes=d;
    else if(d&&Array.isArray(d.postulantes)) this.postulantes=d.postulantes;
    else{this.postulantes=[];await this._guardarPostulantes();}

    this.ultimaCarga=new Date().toISOString();
    emitir("cargado",{total:this.postulantes.length});
    return {ok:true,total:this.postulantes.length,config:this.config};
  },

  async _recargar(){
    const d=await adaptador.leer(ARCHIVO_POSTULANTES);
    if(Array.isArray(d)) this.postulantes=d;
    else if(d&&Array.isArray(d.postulantes)) this.postulantes=d.postulantes;
    else this.postulantes=[];
    return this.postulantes;
  },
  async _guardarPostulantes(){
    await adaptador.escribir(ARCHIVO_POSTULANTES,{
      version:VERSION_ESQUEMA,
      actualizado:new Date().toISOString(),
      total:this.postulantes.length,
      postulantes:this.postulantes
    });
  },

  async guardarConfig(parcial={}){
    return enCola(async()=>{
      if(!this.conectado) throw new Error("No hay carpeta conectada.");
      this.config={...this.config,...parcial,version:VERSION_ESQUEMA};
      await adaptador.escribir(ARCHIVO_CONFIG,this.config);
      emitir("config",this.config);
      return this.config;
    });
  },

  postulantesDe(anio){return this.postulantes.filter(p=>Number(p.anio)===Number(anio));},

  siguienteNumero(anio){
    const a=Number(anio); let max=0;
    for(const p of this.postulantes){
      if(Number(p.anio)!==a) continue;
      const m=/^(\d{4})-(\d+)$/.exec(String(p.numeroMatricula||""));
      if(m) max=Math.max(max,Number(m[2]));
      else if(Number(p.numeroCorrelativo)>max) max=Number(p.numeroCorrelativo);
    }
    return `${a}-${max+1}`;
  },

  async agregarPostulante(entrada){
    return enCola(async()=>{
      if(!this.conectado) throw new Error("Conecta la carpeta de datos antes de guardar.");
      await this._recargar();

      const anio=Number(entrada?.anio);
      if(!anio) throw new Error("Falta el año escolar.");

      const numeroMatricula=this.siguienteNumero(anio);
      const correlativo=Number(String(numeroMatricula).split("-")[1]);

      const reg={
        id:(crypto.randomUUID?.() || "id-"+Date.now()),
        creado:new Date().toISOString(),
        estado:"matriculado",
        curso:"Primero Medio",
        ...entrada,
        anio,
        numeroMatricula,
        numeroCorrelativo:correlativo
        // sin seccion: agrupación manual fuera del sistema
      };

      this.postulantes.push(reg);
      try{await this._guardarPostulantes();}
      catch(e){this.postulantes=this.postulantes.filter(p=>p.id!==reg.id);throw e;}

      emitir("alta",reg);
      return reg;
    });
  },

  async actualizarPostulante(id,cambios={}){
    return enCola(async()=>{
      if(!this.conectado) throw new Error("No hay carpeta conectada.");
      await this._recargar();
      const i=this.postulantes.findIndex(p=>p.id===id);
      if(i===-1) throw new Error("El postulante ya no existe.");
      const antes={...this.postulantes[i]};
      this.postulantes[i]={...antes,...cambios,id};
      try{await this._guardarPostulantes();}
      catch(e){this.postulantes[i]=antes;throw e;}
      emitir("cambio",this.postulantes[i]);
      return this.postulantes[i];
    });
  },

  async eliminarPostulante(id){
    return enCola(async()=>{
      if(!this.conectado) throw new Error("No hay carpeta conectada.");
      await this._recargar();
      const antes=this.postulantes;
      this.postulantes=this.postulantes.filter(p=>p.id!==id);
      try{await this._guardarPostulantes();}
      catch(e){this.postulantes=antes;throw e;}
      emitir("baja",{id});
      return true;
    });
  },

  exportarTodo(){
    return {version:VERSION_ESQUEMA,exportado:new Date().toISOString(),
      config:this.config,postulantes:this.postulantes};
  }
};

export default BD;