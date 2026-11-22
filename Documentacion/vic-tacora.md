# 🎓 Bitácora del Proyecto — Sistema de Matrículas

> **📌 Nota de lectura:** Esta bitácora es la fuente más relevante para entender la dirección actual del proyecto. Los documentos de requerimientos (como `Matricula(1).txt`) son valiosos para conocer las reglas del negocio, pero son antiguos y no deben seguirse al pie de la letra. Cuando haya contradicción, lo que aquí figura por fecha más reciente tiene prioridad.
>
> **Orden de lectura recomendado:** Primero `Matricula(1).txt` para los requerimientos base, y luego esta bitácora para saber qué se usará, qué cambió y qué no se utilizará.

---

## 📅 21-10-2026
- Se crea el documento guía para la construcción del proyecto, junto con el primer mockup.
- Se arma el documento de requerimientos `Matricula(1).txt` (v0.4). Es una fuente importante para los requerimientos, pero antigua. Algunas de sus decisiones fueron reemplazadas posteriormente.

---

## 🚀 17-11-2026 — *Inicio de la práctica*
- **Inicio formal de la práctica profesional (Técnico de Nivel Medio):** Antes de esta fecha solo existían definiciones teóricas y avances leves. A partir de hoy se da el puntapié inicial al desarrollo real y estructurado del sistema.
- Se crea el archivo `buscadorEstablecimientos.js` y se discuten decisiones de diseño.
- Se crea el archivo `establecimientos.json`.
- **⚖️ Decisión de alcance:**
  - El sistema **no asigna cursos** a los alumnos. El proceso es minucioso y no puede automatizarse.
  - El sistema solo **guarda datos**. La conformación de cursos la realiza manualmente el personal encargado.
- **💾 Decisión de almacenamiento:**
  - La versión final usará **GitHub como base de datos**.
  - **ApiFileSystem** se elige únicamente para mejorar la experiencia de testeo y detectar bugs y errores más rápido. No es la apuesta final.
- **📊 Decisión de datos:**
  - Se agrega el campo **establecimiento** de procedencia, ya que facilita a quienes arman los cursos manualmente, al ser un factor determinante.

---

## 🛠️ 18-11-2026
- Se crea el primer prototipo real del proyecto utilizando **ApiFileSystem** (entorno de pruebas, no producción).
- Se desarrolla la primera versión funcional del formulario de matrículas y del panel de administración.
- A pesar de los fallos iniciales, se mejoró gran parte del estilo visual general del sistema.
- **⏳ Pendientes visuales (eliminar interfaces nativas de Windows):**
  - **Scrollbars:** Personalizar las barras de desplazamiento para mejorar su estética.
  - **Selector de fechas:** Reemplazar el calendario nativo por un componente propio.
  - **Selector de establecimiento:** Sustituir la lista desplegable por defecto por una interfaz personalizada.
- **⏳ Pendientes de funcionalidad y documentos:**
  - **Logo:** Incluir el logotipo oficial en las interfaces y documentos generados.
  - **Firma real del director:** Incorporar la firma digitalizada en la documentación.
  - **PDF de condiciones:** Adjuntar e integrar el documento formal de condiciones.
  - **Excel:** Optimizar la estructura y formato de exportación global.
  - **Ampliación de niveles:** Añadir el soporte para **2°, 3° y 4° Medio**.

---

## ⚙️ 19-11-2026
- **Migración de base de datos a GitHub (`ScriptBD.js`):**
  - Se reemplaza el almacenamiento local (`ApiFileSystem`) por la API de contenidos de GitHub (`VicHehe/LEC-DATA`, rama `main`), manteniendo la misma interfaz pública `window.BD` para `Form.js`, `start.js` y `admin.js`.
  - Se estructura el repositorio bajo `MatriculaDatabase/` con `meta.json` (versión `2`, `anioActual`, `ultimoNumero`, `years`), `{year}.json` para el año activo y archivado automático de años anteriores en `MatriculaDatabase/Archivo/{year}.json`.
  - Se incluye manejo de conflictos de escritura concurrente (reintentos ante error `409`) y cálculo de correlativos sin reutilizar huecos.
- **🔒 Seguridad y cifrado de datos y token (`ScriptBD.js` + `cifrar-token.html`):**
  - Se implementa cifrado **AES-GCM (256 bits)** con derivación `PBKDF2`, *salt* e *IV* aleatorios por guardado (`SIDER-ENC:v2:`) para proteger todos los archivos almacenados en GitHub, manteniendo compatibilidad de lectura y migración (`BD.encriptarNoEncriptados()`) desde el formato previo (`SIDER-ENC:v1:`).
  - Se agrega soporte para almacenar el PAT de GitHub cifrado (`SIDER-TOK:v1:`) en `CONFIG.token` mediante la herramienta auxiliar `cifrar-token.html`.
- **📚 Ampliación de niveles (2°, 3° y 4° Medio) y nuevo Lobby (`start.js`):**
  - Se crea `start.js` como pantalla previa al formulario para seleccionar el nivel de ingreso (**1°, 2°, 3° o 4° Medio**).
  - Para **2° a 4° Medio**, el sistema consulta si el alumno ya estudiaba en el Liceo Eduardo Charme.
  - Si ya estudiaba en el liceo, solicita el **R.U.T** y busca el registro histórico más reciente en toda la BD (`BD.buscarPorRUT`), precargando datos del alumno, apoderados y documentos, y dejando el establecimiento anterior bloqueado como `"Liceo Eduardo Charme"`. Incluye manejo de errores y opción de llenado manual si no se encuentra el RUT o no hay conexión con la BD.
- **📈 Exportación global a Excel mejorada (`admin/admin.js` + ExcelJS):**
  - Se reemplaza la exportación plana por un libro `.xlsx` estilizado (`matriculas-charme-{fecha}.xlsx`) con una hoja **Resumen** (conteo por curso y estado con totales dinámicos) y una hoja individual por cada curso, con encabezados congelados, autofiltros y formato condicional por estado y documentos.
- **🎨 Integración de documentos y branding:**
  - **Logo oficial:** Se incorpora `BD_CARGABLE/logo.png` como favicon, en la barra superior del formulario y del panel admin, en el membrete de impresión y en el comprobante PDF.
  - **PDF de condiciones:** Se integra `BD_CARGABLE/reglas.pdf` mediante un visor modal flotante (*"Ver declaración"*) que no ocupa espacio en el formulario y muestra aviso si falta el archivo.
  - **Comprobante PDF / Impresión A4:** Se unifica el comprobante formal de matrícula (1 hoja A4) impreso vía `<iframe>` oculto tanto desde el formulario (*"Guardar como PDF"*) como desde el detalle de cada estudiante en el panel admin (*"Descargar PDF"*).
- **✨ Mejoras visuales y de UX:**
  - **Scrollbars personalizadas:** Se implementan barras de desplazamiento estilizadas en `style.css` (con `topbar` fija) y en `admin/admin.css` (ventana, tabla y modal).
  - **Tema claro/oscuro unificado:** Se sincroniza el selector de tema entre el formulario y el panel admin usando la clave compartida `charme-tema`.
  - Al finalizar y guardar una matrícula (*"Guardar datos y salir"*), el sistema regresa automáticamente al *lobby* inicial.
- **👤 Panel admin: edición de postulantes:**
  - Se agrega el botón **Editar** junto a **Eliminar** en el detalle de cada postulante.
  - Los datos del alumno, apoderados, documentos y estado pasan a modo edición. **Guardar** solo se habilita al editar, y **Cancelar** descarta los cambios.
- **👁️ Visualizador de tablas en ventana (iframe):**
  - *Visualizar Tablas* se abre como una ventana superpuesta dentro del panel, no como una página aparte.
  - *Volver al Admin* dentro de la ventana la cierra y no vuelve a pedir contraseña.

---

## 🚀 20-11-2026
- **🗂️ Nuevo panel: Gestión de años (`FuncionesComp/gestionar-anios.html`):**
  - Se crea una nueva herramienta accesible desde el Panel de Admin que permite administrar el histórico de años de matrícula.
  - **Lógica de antigüedad y prioridad:** Calcula automáticamente los años de antigüedad de los registros y los clasifica por colores (Verde: 1-4 años, conservar; Amarillo: 5-6 años, considerar eliminar; Rojo: 7+ años, eliminar para optimizar rendimiento).
  - **Seguridad de eliminación:** Bloquea la eliminación del año activo y exige escribir el año manualmente para confirmar la eliminación. Borra los registros año por año.
  - **Exportación por año:** Permite descargar el Excel y un Informe PDF estadístico específico de un año en particular.

- **🎓 Nuevo campo: Especialidad (3° y 4° Medio):**
  - Se agrega el campo **"Especialidad"** (Administración, Enfermería, Programación, Turismo) que aparece dinámicamente en el formulario **solo si el alumno ingresa a 3° o 4° Medio**.
  - Es obligatorio para dichos niveles y se guarda dentro del objeto `alumno`.
  - **Integración:** Se incluye en el comprobante A4, en el modal de edición del admin, en la tabla de `visualizar-tablas.html`, en el Excel global y en el Excel/Informe PDF de "Gestión de años".
  - **Nuevo gráfico en Informe PDF:** Se añade un gráfico de barras al informe estadístico de "Gestión de años" que muestra la distribución de alumnos por especialidad ("Especialidad que ganó más alumnos").

- **⚡ Optimización de rendimiento en la base de datos (`ScriptBD.js`):**
  - **Paralelismo (`Promise.all`):** Se reescribe la carga inicial y las operaciones de guardado/edición para hacer las peticiones a la API de GitHub en paralelo (meta, archivos del año, carpeta de archivo), reduciendo el tiempo de carga de varios segundos a milisegundos.
  - **Caché del Token:** Se implementa `_tokenCache` para descifrar el token de GitHub una sola vez por sesión (antes, el costoso algoritmo PBKDF2 se ejecutaba en cada petición).
  - Se optimizan las búsquedas de archivos (root y archivo) al actualizar o eliminar postulantes para evitar peticiones secuenciales.

- **🛡️ Sistema Anti-Colisiones (Anti-pisón) para matrículas presenciales simultáneas:**
  - **Problema:** Múltiples funcionarios usando el sistema a la vez podían generar el mismo número correlativo (ej. `0002` y `0002`).
  - **Solución en `Form.js`:** El número en el formulario ahora se muestra como **`(est.)`** (estimado), indicando que el número definitivo se asigna al presionar guardar.
  - **Solución en `ScriptBD.js` (Bloqueo Optimista):** Al guardar, el sistema lee el archivo, calcula el número y usa el `SHA` de GitHub para verificar que nadie más haya escrito. Si GitHub devuelve **Error 409 (Conflicto)**, el sistema espera milisegundos, vuelve a leer, recalcula el siguiente número disponible y guarda automáticamente sin perder datos.
  - **Escudo Anti-Duplicados:** Se verifica el R.U.T. en el guardado; si dos intentan matricular al mismo alumno, el segundo recibe una alerta de que el RUT ya fue ingresado.

- **🎤 Se definen las estrategias y el discurso para la presentación del proyecto (Reunión con funcionarios 23-11-2026):**
  - **Sistema de auto relleno escalable:** *"Este año se registran todos los datos, pero el próximo año todo será mucho más rápido: solo pondrán el RUT y el sistema rellenará el resto automáticamente. Mientras más se use, más rápido se vuelve."*
  - **Seguridad y Anti-pisón:** *"Los datos están protegidos con cifrado de nivel bancario (AES de 256 bits), así que la información de los menores está segura. Además, el sistema está hecho para aguantar el caos del día de la matrícula: podrán tener a 4 personas matriculando a la vez y el sistema no se romperá ni duplicará números."*
  - **Adiós a los errores del papel:** *"Se acaban las letras ilegibles, las hojas perdidas y los errores de tipeo. El sistema valida los RUT, formatea los teléfonos y ordena todo automáticamente."*
  - **Reportes mágicos:** *"Lo que antes significaba horas de armar planillas en Excel y sumar datos a mano, ahora se hace con 2 clics: el sistema genera el Excel estilizado y los informes con gráficos al instante."*
  - **Costo $0:** *"Cero gastos en servidores o licencias mensuales, todo el presupuesto del liceo se ahorra usando la infraestructura gratuita y robusta de GitHub."*

- **✅ Cosas pendientes ya resueltas (arrastradas de días anteriores):**

| Tarea Pendiente | Estado | Detalle de la Solución |
| :--- | :---: | :--- |
| **Scrollbars personalizadas** | ✅ | Implementadas en CSS para una apariencia limpia y moderna. |
| **Selector de fechas nativo** | ✅ | Reemplazado por el componente propio `selectorFecha.js`. |
| **Buscador de establecimientos** | ✅ | Implementado `buscadorEstablecimientos.js` con autocompletado. |
| **Logo del establecimiento** | ✅ | Integrado en formularios, panel admin, impresión y PDF. |
| **PDF de condiciones** | ✅ | El visor modal está implementado, pero falta el PDF real. |
| **Mejora del archivo Excel** | ✅ | Renovado con hojas estilizadas, resúmenes y división por años. |
| **Ampliación de niveles** | ✅ | Soporte completo para 1° a 4° Medio y auto-relleno histórico. |
| **Limpieza de código** | ✅ | Retiro de indicadores residuales y textos actualizados a GitHub. |
| **Firma real del director** | ❌ | *Pendiente: Se usa fuente de texto simulando la firma.* |
---

## 📘 21-11-2026
- **📖 Manual de usuario (`Manual_Usuario_Sistema_Matriculas_v0.3.pdf`):**
  - Se redacta el manual de usuario (versión v0.3) dirigido a personal administrativo, secretaría y equipo de matrículas. Cubre el formulario de matrícula (lobby, bloques 1 a 5, guardado, comprobante y cancelación), el Panel de Administración (login, listado y filtros, detalle, edición, eliminación, comprobante, visualizador de tablas, gestión de años y Excel global), tema claro/oscuro, preguntas frecuentes, problemas y soluciones, glosario y notas finales.
  - Se integran capturas reales del sistema (11 imágenes), eligiendo las que aportan información que el texto no entrega y omitiendo las redundantes.
  - **Maquetación del PDF:** cortes de página ajustados: portada e índice juntos, sección 1 en la página 2, saltos antes de las secciones 4, 5, 7 y 8 y en los puntos donde un título quedaba suelto al final de página. Los bloques de advertencia, listas y tablas no se parten entre páginas.
  - **Sección 5.10 "Manual de usuario"** agregada al manual: cómo abrir el manual desde el panel, búsqueda con Ctrl + F, navegación por página, descarga, impresión, cierre y aviso si el archivo no está. Se actualizaron el índice y la tabla de botones de la barra superior (5.2) con el botón "Manual".

- **🧩 Manual conectado al Panel de Administración:**
  - Se agrega el botón **"Manual"** en la barra superior de `admin/index.html`, junto a "Gestionar años".
  - Se registra la ventana `manual` en `admin/admin.js` con el mismo patrón que "Visualizar Tablas" y "Gestionar años" (overlay, iframe, cierre con X, clic fuera y mensaje `cerrar-visor`).
  - La ventana carga `FuncionesComp/manual-usuario.html`, que muestra el PDF desde `../../BD_CARGABLE/` con el visor nativo del navegador, a zoom 80 % (`#zoom=80`). Si el archivo no existe, muestra un aviso con el nombre esperado.

## 22-11-2026

- **Gestionar años:** antes de eliminar un año, el sistema exige haber descargado el Excel de ese año en la sesión actual.
  - Si no se descargó, la ventana de eliminación muestra el aviso y no permite escribir el año ni confirmar.
  - Al descargar el Excel del año, se habilita la confirmación.
  - La condición se pierde al recargar la herramienta, por lo que hay que volver a descargar el Excel en cada sesión.
  - Archivo: `gestion/gestionar-anios.html`.

- **Panel admin · Documentos recibidos (modo edición):** cada documento mostraba dos casillas (una falsa y una nativa). Ahora solo se ve la casilla nativa, con el color del sistema.
  - Archivo: `admin_corregido/admin.css`.
  - Además, el color de cada documento ahora cambia al marcar o desmarcar la casilla (antes solo se actualizaba al abrir el panel).

- **Gestionar años · botón eliminar bloqueado:** el botón del año activo ya no se apaga por completo. Se ve atenuado y, al hacer clic, la línea de estado explica por qué no se puede eliminar.
  - Archivo: `gestion/gestionar-anios.html`.

- **Visualizar Tablas · selectores de filtro:** la flecha de los selectores (Año, Estado, Filas por página) quedaba pegada al borde derecho. Ahora usa la misma flecha y el mismo espacio que el panel de postulantes.
  - Archivo: `visualizar/visualizar-tablas.html`.

- **Manual de usuario (v0.3):** se actualizaron las capturas.
  - Sección 5.2: la captura del panel ahora muestra el botón "Manual" en la barra superior.
  - Sección 5.10: se agregó la captura del manual abierto dentro del panel.
