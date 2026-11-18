# Bitácora del Proyecto

> **Nota de lectura:** esta bitácora es la fuente más relevante para entender la dirección actual del proyecto. Los documentos de requerimientos (como `Matricula(1).txt`) son valiosos para conocer las reglas del negocio, pero son antiguos y no deben seguirse al pie de la letra. Cuando haya contradicción, lo que aquí figura por fecha más reciente tiene prioridad.
>
> Orden de lectura recomendado: primero `Matricula(1).txt` para los requerimientos base, y luego esta bitácora para saber qué se usará, qué cambió y qué no se utilizará.

## 21-10-2026

- Se crea el documento guía para la construcción del proyecto, junto con el primer mockup.
- Se arma el documento de requerimientos `Matricula(1).txt` (v0.4). Es una fuente importante para los requerimientos, pero antigua. Algunas de sus decisiones fueron reemplazadas posteriormente.

<img width="1348" height="604" alt="image" src="https://github.com/user-attachments/assets/a2ac8a29-2d73-406e-831b-40e3ba49131f" />


## 17-11-2026

- Se crea el archivo `buscadorEstablecimientos.js` y se discuten decisiones de diseño.
- Se crea el archivo `establecimientos.json`.
- **Decisión de alcance:**
  - El sistema **no asigna cursos** a los alumnos. El proceso es minucioso y no puede automatizarse.
  - El sistema solo **guarda datos**. La conformación de cursos la realiza manualmente el personal encargado.
- **Decisión de almacenamiento:**
  - La versión final usará **GitHub como base de datos**.
  - **ApiFileSystem** se elige únicamente para mejorar la experiencia de testeo y detectar bugs y errores más rápido. No es la apuesta final.
- **Decisión de datos:**
  - Se agrega el campo **establecimiento** de procedencia, ya que facilita a quienes arman los cursos manualmente, al ser un factor determinante.

## 18-11-2026

- Se crea el primer prototipo real del proyecto utilizando **ApiFileSystem** (entorno de pruebas, no producción).
- Se desarrolla la primera versión funcional del formulario de matrículas y del panel de administración.
- A pesar de los fallos iniciales, se mejoró gran parte del estilo visual general del sistema.
- **Pendientes visuales (eliminar interfaces nativas de Windows):**
  - **Scrollbars:** personalizar las barras de desplazamiento para mejorar su estética.
  - **Selector de fechas:** reemplazar el calendario nativo (muy antiintuitivo) por un componente propio.
  - **Selector de establecimiento:** sustituir la lista desplegable por defecto por una interfaz personalizada más atractiva.
- **Pendientes de funcionalidad y documentos:**
  - **Logo del establecimiento:** incluir el logotipo oficial en las interfaces y documentos generados.
  - **Firma real del director:** incorporar la firma digitalizada/real del director en la documentación correspondiente.
  - **PDF de condiciones:** adjuntar e integrar el documento formal de condiciones del establecimiento.
  - **Mejora del archivo Excel:** optimizar la estructura y formato de exportación global.
  - **Ampliación de niveles (Post-habilitación):** una vez que todo el sistema base esté operativo, añadir el soporte e inscripción para los cursos de **2°, 3° y 4° Medio**.
 
  <img width="1349" height="606" alt="image" src="https://github.com/user-attachments/assets/cbf0580f-9a30-4d47-9e18-bda9a99c9786" />
