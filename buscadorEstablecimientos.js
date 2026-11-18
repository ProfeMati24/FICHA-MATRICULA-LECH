// buscadorEstablecimientos.js
// Lectura, filtrado y búsqueda de establecimientos. Sin interfaz visual.

export const RUTA_BD = "BD_CARGABLE/establecimientos.json";

export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const BuscadorEstablecimientos = {
  datos: [],
  cargado: false,

  async cargar(ruta = RUTA_BD) {
    const res = await fetch(ruta, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo leer ${ruta} (estado ${res.status})`);

    const json = await res.json();
    if (!Array.isArray(json)) throw new Error("El archivo debe contener un arreglo");

    this.datos = json;
    this.cargado = true;
    return this.datos.length;
  },

  obtenerTodos() {
    return this.datos;
  },

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

export default BuscadorEstablecimientos;