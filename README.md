# MiniSumosRC_HTML

Primer prototipo HTML para la nueva interfaz web de MiniSumos RC.

## Vista previa

Descarga el repositorio y abre `index.html` en el navegador. GitHub muestra el código fuente del archivo, no ejecuta la vista previa interactiva directamente en la página del repositorio.

## Qué incluye

- Panel de resumen.
- Registro, edición y eliminación de participantes.
- Validación de peso (mayor que 0 y máximo 500 g) y cinco requisitos reglamentarios.
- Tablas de ganadores y perdedores.
- Registro interactivo de resultados por batalla individual.
- Series al mejor de tres: se detienen al conseguir dos victorias.
- Historial de series y miniclasificaciones por porcentaje de ataques, tiempo promedio y cantidad de enfrentamientos.
- Confirmación antes de modificar participantes cuando ya se inició el torneo.
- Persistencia de la demostración en `localStorage` del navegador.

## Importante: alcance de este primer preview

Este archivo es un **prototipo de interfaz**. Los nombres, ataques y tiempos de ejemplo no son datos oficiales, y los botones de resultado simulan la recepción de un resultado. Todavía no se conecta a Flask, SQLite ni al ESP32; tampoco sincroniza varios navegadores o computadores.

Para la versión operativa, la interfaz HTML debe consumir una API del backend Python. El backend conservará la base de datos y la lógica oficial del torneo, y seguirá siendo el responsable de la comunicación serial con el ESP32. Para que los cambios aparezcan en otras pantallas en tiempo real, se puede ampliar el mecanismo de eventos/SSE que ya existe en el repositorio original.

## Reglas que falta validar antes de cerrar la lógica

1. Política exacta de emparejamiento cuando queda un número impar en una tabla.
2. Cómo se calcula oficialmente el porcentaje de ataques y qué se hace cuando aún no hay ataques registrados.
3. Orden preciso entre la nueva ronda de ganadores y los cruces de perdedores, para equilibrar los combates sin dejar robots esperando demasiado.
4. Reglas de la gran final y su serie de reinicio.

Este prototipo sirve para revisar primero la experiencia visual y los pasos del flujo. La lógica de programación del torneo debe validarse con casos de 2, 3, 5, 6, 7 y 8 participantes antes de usarla en competencia.
