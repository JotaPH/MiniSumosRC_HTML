# MiniSumosRC_HTML

Prototipo de nuevas vistas **integradas sobre el HTML original del dashboard MiniSumos RC**. No es un dashboard independiente: conserva Home, el marcador, las imágenes de robots, el cronómetro, las pantallas de ganador/próxima batalla y las páginas existentes de Ataques 1 y Ataques 2 como base visual.

## Ejecutar el proyecto

Este repositorio incluye ahora un servidor Flask para servir el dashboard, las páginas de ataques y los recursos de `Imagenes/` y `Audios/`.

1. Instala Python 3.10 o superior.
2. En una terminal, dentro de la carpeta del repositorio, ejecuta `python -m pip install -r requirements.txt`.
3. Inicia el servidor con `python app.py`.
4. Abre `http://127.0.0.1:8000`.

Las rutas de ataques son `/attacks/1` y `/attacks/2`. No abras `index.html` directamente con doble clic: las rutas `/api/...`, las imágenes y los audios necesitan el servidor activo.

## Archivo principal

- [index.html](./index.html): base del dashboard con las opciones nuevas añadidas al menú de la tuerca ⚙️:
  - **ATAQUES 1** y **ATAQUES 2**: conservan el comportamiento y las rutas existentes.
  - **PARTICIPANTES**: formulario web con piloto, robot, peso máximo de 500 g y cinco requisitos reglamentarios; permite agregar, editar y eliminar participantes.
  - **GANADORES / PERDEDORES**: muestra ambas tablas, serie actual al mejor de tres, historial y miniclasificación de demostración.

## Qué es funcional en este preview

Las dos nuevas pantallas tienen interacciones locales para revisar el diseño y el flujo: validación de participantes, confirmación antes de reiniciar las llaves, registro de resultados de ejemplo, movimiento entre tablas según las derrotas y una gran final con serie de reinicio.

## Alcance y limitaciones

- Los resultados de las nuevas pantallas son **demostrativos** y se mantienen solo en memoria mientras la página está abierta.
- La nueva gestión aún no está conectada con la base SQLite, el módulo de torneos Python ni el ESP32.
- El servidor incluido permite probar la interfaz, rutas, recursos y contadores en el navegador; todavía no está conectado al ESP32 ni a la base SQLite de la aplicación principal.
- La lógica de emparejamientos, especialmente con números impares, debe validarse con casos de 2, 3, 5, 6, 7 y 8 robots antes de usarla en competencia.

## Siguiente paso

Después de revisar y corregir el diseño y las reglas, conectar estas pantallas al backend Python existente, reutilizando SQLite para los participantes/resultados y el mecanismo de eventos del dashboard para reflejar cambios en tiempo real. La comunicación serial con el ESP32 debe continuar centralizada en Python.
