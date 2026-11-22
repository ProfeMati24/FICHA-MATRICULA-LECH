/* =============================================================
   ScriptBD.js — Capa de datos sobre GitHub (Anti-Colisiones)

   CÓMO USAR ESTE ARCHIVO EN OTRA INSTITUCIÓN
   1. Cree un repositorio PRIVADO en GitHub para guardar los datos.
   2. Complete los valores marcados con CAMBIAR_ en CONFIG (abajo).
   3. Genere un token de GitHub con permiso solo sobre ese repositorio
      y péguelo en CONFIG.token (o guárdelo cifrado con cifrar-token.html).
   4. Use claves propias y largas para cifrar los datos.

   NUNCA suba a un repositorio público su token ni sus claves.
   ============================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     CONFIGURACIÓN · reemplace los valores CAMBIAR_... con los datos
     de su institución. Mientras queden marcados, el sistema no
     guardará ni leerá datos.
     --------------------------------------------------------------- */
  const CONFIG = {
    owner:  "CAMBIAR_usuario-github",      // dueño del repositorio de DATOS
    repo:   "CAMBIAR_nombre-repo-datos",   // repositorio PRIVADO donde se guardan las matrículas
    branch: "main",
    token:  "",                            // Token de GitHub (o SIDER-TOK:v1:... si está cifrado)
    carpetaRaiz:    "MatriculaDatabase",
    carpetaArchivo: "MatriculaDatabase/Archivo",

    // Claves para cifrar los datos y el token. Use frases largas y propias.
    claveDatos: "CAMBIAR_clave-datos",
    claveToken: "CAMBIAR_clave-token",
    claveV1:    "CAMBIAR_clave-v1"         // solo para leer datos del formato antiguo SIDER-ENC:v1:
  };

  const MARCADOR_V2   = "SIDER-ENC:v2:";
  const MARCADOR_V1   = "SIDER-ENC:v1:";
  const MARCADOR_TOK  = "SIDER-TOK:v1:";

  const SALT_LEN = 16;
  const IV_LEN   = 12;

  function claveConfigurada(clave, nombre) {
    if (!clave || String(clave).startsWith("CAMBIAR")) {
      throw new Error(`Falta configurar ${nombre} en ScriptBD.js.`);
    }
    return clave;
  }

  function bytesToB64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    const bin = atob(String(b64 || "").replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function b64Encode(str) { return bytesToB64(new TextEncoder().encode(str)); }
  function b64Decode(b64) { return new TextDecoder().decode(b64ToBytes(b64)); }

  function xorConClave(bytes, claveStr) {
    const key = new TextEncoder().encode(claveStr);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
    return out;
  }

  function tieneWebCrypto() {
    return !!(typeof window !== "undefined" && window.crypto && window.crypto.subtle);
  }

  async function derivarClaveAES(secreto, salt) {
    const enc = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
      "raw", enc.encode(secreto), "PBKDF2", false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }

  async function cifrarConGCM(textoPlano, secreto, marcador) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv   = window.crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key  = await derivarClaveAES(secreto, salt);
    const cipherBuf = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(textoPlano));

    const cipherBytes = new Uint8Array(cipherBuf);
    const pack = new Uint8Array(SALT_LEN + IV_LEN + cipherBytes.length);
    pack.set(salt, 0); pack.set(iv, SALT_LEN); pack.set(cipherBytes, SALT_LEN + IV_LEN);

    return marcador + bytesToB64(pack);
  }

  async function descifrarConGCM(contenidoCrudo, secreto, marcador) {
    const rawB64 = contenidoCrudo.slice(marcador.length);
    const pack = b64ToBytes(rawB64);
    if (pack.length <= SALT_LEN + IV_LEN) throw new Error("Paquete cifrado corrupto.");

    const salt = pack.slice(0, SALT_LEN);
    const iv   = pack.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const data = pack.slice(SALT_LEN + IV_LEN);

    const key = await derivarClaveAES(secreto, salt);
    const plainBuf = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plainBuf);
  }

  async function encriptar(textoPlano) {
    if (tieneWebCrypto()) {
      return cifrarConGCM(textoPlano, claveConfigurada(CONFIG.claveDatos, "claveDatos"), MARCADOR_V2);
    }
    const cifrado = xorConClave(new TextEncoder().encode(textoPlano), claveConfigurada(CONFIG.claveV1, "claveV1"));
    return MARCADOR_V1 + bytesToB64(cifrado);
  }

  async function desencriptar(contenidoCrudo) {
    if (typeof contenidoCrudo !== "string") return contenidoCrudo;
    if (contenidoCrudo.startsWith(MARCADOR_V2)) {
      if (!tieneWebCrypto()) throw new Error("Web Crypto no disponible para v2.");
      return descifrarConGCM(contenidoCrudo, claveConfigurada(CONFIG.claveDatos, "claveDatos"), MARCADOR_V2);
    }
    if (contenidoCrudo.startsWith(MARCADOR_V1)) {
      const b64 = contenidoCrudo.slice(MARCADOR_V1.length);
      const bytes = xorConClave(b64ToBytes(b64), claveConfigurada(CONFIG.claveV1, "claveV1"));
      return new TextDecoder().decode(bytes);
    }
    return contenidoCrudo;
  }

  let _tokenCache = null;
  async function resolverToken() {
    if (_tokenCache) return _tokenCache;
    const raw = String(CONFIG.token || "").trim();
    if (!raw) return "";
    if (!raw.startsWith(MARCADOR_TOK)) { _tokenCache = raw; return _tokenCache; }
    if (!tieneWebCrypto()) throw new Error("Web Crypto requerido para el token.");
    const plano = await descifrarConGCM(raw, claveConfigurada(CONFIG.claveToken, "claveToken"), MARCADOR_TOK);
    _tokenCache = plano.trim();
    return _tokenCache;
  }

  async function ghRequest(url, options = {}) {
    const tokenPlano = await resolverToken();
    if (!tokenPlano) throw new Error("Token de GitHub no configurado en ScriptBD.js.");

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenPlano}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers, cache: "no-store" });

    if (res.status === 401) throw new Error("Token inválido o expirado.");
    if (res.status === 403) throw new Error("Sin permisos sobre el repositorio.");
    if (res.status === 404) return null;
    if (res.status === 409 || res.status === 422) {
      const err = new Error("Conflicto de escritura: Otro usuario guardó datos al mismo tiempo.");
      err.code = 409;
      throw err;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
  }

  function ghUrl(path) {
    const limpio = String(path || "").replace(/^\/+/, "");
    return `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${limpio}`;
  }

  async function ghLeerCrudo(path) {
    const data = await ghRequest(`${ghUrl(path)}?ref=${CONFIG.branch}`);
    if (!data) return null;
    if (Array.isArray(data)) return data;
    if (!data.content) {
      if (data.git_url) {
        const blob = await ghRequest(data.git_url);
        return b64Decode(String(blob.content || "").replace(/\s/g, ""));
      }
      return null;
    }
    return b64Decode(String(data.content).replace(/\s/g, ""));
  }

  async function ghLeerJSON(path) {
    const crudo = await ghLeerCrudo(path);
    if (crudo === null || typeof crudo !== "string") return null;
    const plano = await desencriptar(crudo);
    try { return JSON.parse(plano); } catch { return null; }
  }

  async function ghListar(path) {
    const data = await ghRequest(`${ghUrl(path)}?ref=${CONFIG.branch}`);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }

  // Guardado estricto: falla rápido con error 409 si hay conflicto (para el bucle de reintento)
  async function ghGuardarEstricto(path, data, mensaje) {
    const plano = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    const contenido = await encriptar(plano);

    let sha = null;
    try {
      const actual = await ghRequest(`${ghUrl(path)}?ref=${CONFIG.branch}`);
      if (actual && actual.sha) sha = actual.sha;
    } catch (_) {}

    const body = {
      message: mensaje || `Actualizar ${path}`,
      content: b64Encode(contenido),
      branch:  CONFIG.branch,
      ...(sha ? { sha } : {})
    };

    return await ghRequest(ghUrl(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  // Guardado normal (para cosas que no colisionan, como meta.json)
  async function ghGuardar(path, data, mensaje, intentos = 3) {
    for (let i = 0; i < intentos; i++) {
      try {
        return await ghGuardarEstricto(path, data, mensaje);
      } catch (e) {
        if (e.code === 409 && i < intentos - 1) {
          await new Promise(r => setTimeout(r, 400 * (i + 1)));
          continue;
        }
        throw e;
      }
    }
  }

  async function ghEliminar(path, mensaje) {
    const actual = await ghRequest(`${ghUrl(path)}?ref=${CONFIG.branch}`);
    if (!actual || !actual.sha) return null;
    return ghRequest(ghUrl(path), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: mensaje || `Eliminar ${path}`,
        sha:     actual.sha,
        branch:  CONFIG.branch
      })
    });
  }

  async function ghExiste(path) {
    const d = await ghRequest(`${ghUrl(path)}?ref=${CONFIG.branch}`);
    if (!d || Array.isArray(d)) return false;
    return !!d.sha;
  }

  function formatearRUT(v) {
    const l = String(v || "").replace(/[^0-9kK]/g, "").toUpperCase();
    if (l.length < 2) return l;
    return l.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + l.slice(-1);
  }

  function nuevoId() {
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function numeroDeMatricula(p) {
    const n = parseInt(String(p?.numeroMatricula || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  function padNum(n) { return String(n).padStart(4, "0"); }

  function esRegistroValido(p) {
    return !!(p && typeof p === "object" && typeof p.id === "string" && p.id.trim());
  }

  const ESTADOS = ["postulante", "recibido", "aceptado", "matriculado", "rechazado"];
  const suscriptores = [];

  const BD = {
    soportado: true,
    conectado: false,
    carpeta: `${CONFIG.owner}/${CONFIG.repo}`,
    tienePendiente: false,
    ultimaCarga: null,
    postulantes: [],
    config: {
      estados: ESTADOS,
      anioActual: new Date().getFullYear(),
      ultimoNumero: {},
      version: 2
    },
    _aniosEnRoot: new Set(),

    async _leerMeta() {
      const meta = await ghLeerJSON(`${CONFIG.carpetaRaiz}/meta.json`);
      if (meta && typeof meta === "object") {
        if (!meta.ultimoNumero) meta.ultimoNumero = {};
        if (!Array.isArray(meta.years)) meta.years = [];
        return meta;
      }
      return { version: 2, anioActual: new Date().getFullYear(), ultimoNumero: {}, years: [] };
    },

    async _guardarMeta(meta) {
      await ghGuardar(`${CONFIG.carpetaRaiz}/meta.json`, meta, "Actualizar meta de matrículas");
    },

    async _cargarTodo() {
      try {
        await Promise.all([
          ghExiste(`${CONFIG.carpetaRaiz}/.gitkeep`).then(e => e ? null : ghGuardar(`${CONFIG.carpetaRaiz}/.gitkeep`, "", "Crear MatriculaDatabase/")),
          ghExiste(`${CONFIG.carpetaArchivo}/.gitkeep`).then(e => e ? null : ghGuardar(`${CONFIG.carpetaArchivo}/.gitkeep`, "", "Crear Archivo/"))
        ]);
      } catch (_) {}

      const [meta, rootItems, archItems] = await Promise.all([
        this._leerMeta(),
        ghListar(CONFIG.carpetaRaiz),
        ghListar(CONFIG.carpetaArchivo)
      ]);

      const archivosRoot = rootItems.filter(i => i && i.type === "file" && /^\d{4}\.json$/.test(i.name));
      const archivosArch = archItems.filter(i => i && i.type === "file" && /^\d{4}\.json$/.test(i.name));

      const [datosRoot, datosArch] = await Promise.all([
        Promise.all(archivosRoot.map(i => ghLeerJSON(i.path).then(d => ({ anio: Number(i.name.slice(0,4)), data: d })))),
        Promise.all(archivosArch.map(i => ghLeerJSON(i.path).then(d => ({ anio: Number(i.name.slice(0,4)), data: d }))))
      ]);

      const vistos = new Set();
      const todos = [];

      const absorber = (lista) => {
        if (!Array.isArray(lista)) return;
        for (const p of lista) {
          if (!esRegistroValido(p) || vistos.has(p.id)) continue;
          vistos.add(p.id);
          todos.push(p);
        }
      };

      datosRoot.forEach(item => { if (item.data?.postulantes) absorber(item.data.postulantes); });
      datosArch.forEach(item => { if (item.data?.postulantes) absorber(item.data.postulantes); });

      BD.postulantes = todos;
      BD.config.anioActual = Number(meta.anioActual) || new Date().getFullYear();
      BD.config.ultimoNumero = meta.ultimoNumero || {};
      BD._aniosEnRoot = new Set(datosRoot.map(d => d.anio));

      if (BD._aniosEnRoot.size > 1) {
        const maxAnio = Math.max(...BD._aniosEnRoot);
        const porArchivar = [...BD._aniosEnRoot].filter(a => a < maxAnio);
        await Promise.all(porArchivar.map(a => this._archivarAnio(a).then(() => BD._aniosEnRoot.delete(a)).catch(() => {})));
      }

      BD.ultimaCarga = Date.now();
      BD.conectado = true;
    },

    async _archivarAnio(anio) {
      const src = `${CONFIG.carpetaRaiz}/${anio}.json`;
      const dst = `${CONFIG.carpetaArchivo}/${anio}.json`;
      const srcData = await ghLeerJSON(src);
      if (!srcData) return;
      await ghGuardar(dst, srcData, `Archivar matrículas ${anio}`);
      await ghEliminar(src, `Mover ${anio} a Archivo/`);
    },

    async probarConexion() {
      try {
        if (String(CONFIG.owner).startsWith("CAMBIAR")) return { ok: false, error: "Falta configurar owner/repo en ScriptBD.js." };
        if (!(await resolverToken())) return { ok: false, error: "Token de GitHub no configurado." };
        const data = await ghRequest(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`);
        if (!data) return { ok: false, error: "Repositorio no encontrado." };
        return { ok: true, repo: data.full_name, privado: data.private };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    async conectar() {
      const r = await this.probarConexion();
      if (!r.ok) throw new Error(r.error || "No se pudo conectar.");
      await this._cargarTodo();
      this._notificar("conexion");
      return BD.carpeta;
    },

    async intentarRestaurar() {
      try {
        if (String(CONFIG.owner).startsWith("CAMBIAR")) return { ok: false, motivo: "sin-configurar" };
        if (!(await resolverToken())) return { ok: false, motivo: "sin-token" };
        const r = await this.probarConexion();
        if (!r.ok) return { ok: false, motivo: "error", error: r.error };
        await this._cargarTodo();
        this._notificar("cargado");
        return { ok: true };
      } catch (e) {
        return { ok: false, motivo: "error", error: e.message };
      }
    },

    buscarPorRUT(rutRaw) {
      if (!rutRaw) return null;
      const rut = formatearRUT(rutRaw);
      const matches = BD.postulantes.filter(p => formatearRUT(p.alumno?.rut) === rut);
      if (!matches.length) return null;
      matches.sort((a, b) => (Number(b.anio) - Number(a.anio)) || String(b.creado || "").localeCompare(String(a.creado || "")));
      return matches[0];
    },

    siguienteNumero(anio) {
      const y = Number(anio);
      if (!y) return "—";
      let max = 0;
      for (const p of BD.postulantes) {
        if (Number(p.anio) === y) max = Math.max(max, numeroDeMatricula(p));
      }
      const cacheado = Number(BD.config.ultimoNumero?.[y]) || 0;
      return padNum(Math.max(max, cacheado) + 1);
    },

    async agregarPostulante(data) {
      if (!BD.conectado) throw new Error("No conectado a GitHub.");
      if (!data || typeof data !== "object") throw new Error("Datos inválidos.");

      const y = Number(data.anio) || new Date().getFullYear();
      const path = `${CONFIG.carpetaRaiz}/${y}.json`;

      let intentos = 0;
      const maxIntentos = 5;

      while (intentos < maxIntentos) {
        try {
          // 1. Leer datos frescos
          const [archivoData, meta] = await Promise.all([ghLeerJSON(path), this._leerMeta()]);
          let archivo = archivoData || { anio: y, postulantes: [] };
          if (!Array.isArray(archivo.postulantes)) archivo.postulantes = [];

          // 2. Escudo anti-duplicados (verificar RUT en este instante)
          const rutNuevo = formatearRUT(data.alumno?.rut);
          if (rutNuevo) {
            const yaExiste = archivo.postulantes.find(p => formatearRUT(p.alumno?.rut) === rutNuevo);
            if (yaExiste) throw new Error(`El RUT ${rutNuevo} ya fue matriculado por otro usuario (N° ${yaExiste.numeroMatricula}).`);
          }

          // 3. Calcular el número real AHORA
          let maxN = 0;
          for (const p of archivo.postulantes) maxN = Math.max(maxN, numeroDeMatricula(p));
          const cacheado = Number(meta.ultimoNumero?.[y]) || 0;
          const num = Math.max(maxN, cacheado) + 1;

          const registro = {
            ...data,
            id: nuevoId(),
            numeroMatricula: padNum(num),
            estado: data.estado || "postulante",
            creado: new Date().toISOString()
          };

          archivo.postulantes.push(registro);

          meta.ultimoNumero = meta.ultimoNumero || {};
          meta.ultimoNumero[y] = num;
          meta.anioActual = Math.max(Number(meta.anioActual) || 0, y);
          if (!Array.isArray(meta.years)) meta.years = [];
          if (!meta.years.includes(y)) meta.years.push(y);

          // 4. Guardar de forma estricta
          await ghGuardarEstricto(path, archivo, `Matrícula ${registro.numeroMatricula} (${y})`);
          await this._guardarMeta(meta);

          // 5. Éxito
          BD.config.ultimoNumero = meta.ultimoNumero;
          BD.config.anioActual = meta.anioActual;

          if (!BD._aniosEnRoot.has(y)) {
            BD._aniosEnRoot.add(y);
            const maxAnio = Math.max(...BD._aniosEnRoot);
            for (const a of [...BD._aniosEnRoot]) {
              if (a >= maxAnio) continue;
              try { await this._archivarAnio(a); BD._aniosEnRoot.delete(a); } catch (_) {}
            }
          }

          BD.postulantes.push(registro);
          this._notificar("alta", registro);
          return registro;

        } catch (e) {
          if (e.code === 409) {
            // Alguien más guardó: esperar un momento y reintentar
            intentos++;
            await new Promise(r => setTimeout(r, 600 * intentos + Math.random() * 500));
            continue;
          }
          throw e; // RUT duplicado u otro error grave
        }
      }
      throw new Error("El sistema está saturado por múltiples guardados simultáneos. Por favor, presiona 'Guardar' de nuevo.");
    },

    async actualizarPostulante(id, cambios) {
      if (!BD.conectado) throw new Error("No conectado a GitHub.");
      let intentos = 0;

      while (intentos < 5) {
        try {
          const p = BD.postulantes.find(x => x.id === id);
          if (!p) throw new Error("Postulante no encontrado.");
          const y = Number(p.anio);

          const [rootData, archData] = await Promise.all([
            ghLeerJSON(`${CONFIG.carpetaRaiz}/${y}.json`),
            ghLeerJSON(`${CONFIG.carpetaArchivo}/${y}.json`)
          ]);

          let archivo = rootData || archData;
          let path = rootData ? `${CONFIG.carpetaRaiz}/${y}.json` : `${CONFIG.carpetaArchivo}/${y}.json`;
          if (!archivo || !Array.isArray(archivo.postulantes)) throw new Error("Archivo no encontrado.");

          const idx = archivo.postulantes.findIndex(x => x.id === id);
          if (idx < 0) throw new Error("Postulante no encontrado en el archivo.");

          Object.assign(archivo.postulantes[idx], cambios);
          await ghGuardarEstricto(path, archivo, `Actualizar postulante ${id}`);

          Object.assign(p, cambios);
          this._notificar("cambio", p);
          return p;

        } catch (e) {
          if (e.code === 409) {
            intentos++;
            await new Promise(r => setTimeout(r, 600 * intentos));
            continue;
          }
          throw e;
        }
      }
      throw new Error("No se pudo guardar por múltiples conflictos. Intente de nuevo.");
    },

    async eliminarPostulante(id) {
      if (!BD.conectado) throw new Error("No conectado a GitHub.");
      let intentos = 0;

      while (intentos < 5) {
        try {
          const p = BD.postulantes.find(x => x.id === id);
          if (!p) throw new Error("Postulante no encontrado.");
          const y = Number(p.anio);

          const [rootData, archData] = await Promise.all([
            ghLeerJSON(`${CONFIG.carpetaRaiz}/${y}.json`),
            ghLeerJSON(`${CONFIG.carpetaArchivo}/${y}.json`)
          ]);

          let archivo = rootData || archData;
          let path = rootData ? `${CONFIG.carpetaRaiz}/${y}.json` : `${CONFIG.carpetaArchivo}/${y}.json`;
          if (!archivo || !Array.isArray(archivo.postulantes)) throw new Error("Archivo no encontrado.");

          const idx = archivo.postulantes.findIndex(x => x.id === id);
          if (idx < 0) throw new Error("Postulante ya eliminado por otro usuario.");

          archivo.postulantes.splice(idx, 1);
          await ghGuardarEstricto(path, archivo, `Eliminar postulante ${id}`);

          BD.postulantes = BD.postulantes.filter(x => x.id !== id);
          this._notificar("baja", p);
          return true;

        } catch (e) {
          if (e.code === 409) {
            intentos++;
            await new Promise(r => setTimeout(r, 600 * intentos));
            continue;
          }
          throw e;
        }
      }
      throw new Error("No se pudo eliminar por múltiples conflictos.");
    },

    suscribir(fn) {
      if (typeof fn === "function") suscriptores.push(fn);
    },

    _notificar(tipo, payload) {
      for (const fn of suscriptores) {
        try { fn(tipo, payload); } catch (_) {}
      }
    },

    async encriptarNoEncriptados(paths = null) {
      let lista = paths;
      if (!lista) {
        const items = await ghListar(CONFIG.carpetaRaiz);
        lista = items.filter(i => i.type === "file" && i.name.endsWith(".json") && i.name !== "meta.json").map(i => i.path);
      }
      const resultados = [];
      for (const path of lista) {
        if (!String(path).toLowerCase().endsWith(".json")) continue;
        try {
          const crudo = await ghLeerCrudo(path);
          if (crudo === null) { resultados.push({ path, estado: "no-existe" }); continue; }
          if (typeof crudo === "string" && crudo.startsWith(MARCADOR_V2)) { resultados.push({ path, estado: "ya-encriptado" }); continue; }
          const planoTexto = await desencriptar(crudo);
          let plano; try { plano = JSON.parse(planoTexto); } catch { plano = planoTexto; }
          await ghGuardar(path, plano, `Encriptar ${path}`);
          resultados.push({ path, estado: "encriptado" });
        } catch (e) {
          resultados.push({ path, estado: "error", error: e.message });
        }
      }
      return resultados;
    }
  };

  window.BD = BD;
})();
