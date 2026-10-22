# MiniSumosRC_HTML

Prototipo web del dashboard MiniSumos RC basado en el HTML original. Conserva Home, el marcador, el cronómetro, las pantallas de ganador/próxima batalla, las páginas de Ataques 1 y Ataques 2, las imágenes y los audios.

## Ejecutar en modo desarrollo

Requiere Python 3.10 o superior.

1. Instala las dependencias:
   ```powershell
   python -m pip install -r requirements.txt
   ```
2. Inicia el servidor:
   ```powershell
   python app.py
   ```
3. Abre http://127.0.0.1:8000.

No abras `index.html` directamente con doble clic: las rutas `/api/...`, las imágenes y los audios necesitan el servidor activo.

Rutas principales: `/`, `/battles`, `/attacks/1`, `/attacks/2` y `/api/database-status`.

## Compilar el ejecutable para Windows

El repositorio incluye el flujo de GitHub Actions **Build MiniSumos RC for Windows**, que compila un paquete portátil de 64 bits. En el PC de destino no hace falta instalar Python.

1. Abre la pestaña **Actions** del repositorio.
2. Selecciona **Build MiniSumos RC for Windows** y pulsa **Run workflow**.
3. Cuando finalice correctamente, descarga el artefacto **MiniSumosRC-Windows-x64**.
4. Extrae el ZIP en una carpeta con permisos de escritura, por ejemplo Documentos o el Escritorio.
5. Activa el hotspot de Windows y ejecuta `iniciar_ejecutable.bat`.
6. Acepta el permiso de administrador cuando Windows lo solicite para configurar el acceso del firewall.

El lanzador abre el dashboard en el PC mediante `http://127.0.0.1:8000` y muestra la dirección que deben abrir los celulares conectados al hotspot. Mantén abierta la ventana del servidor mientras se usa la aplicación.

El script de firewall crea una regla de entrada para `MiniSumosRC.exe`, TCP 8000, la IP detectada del PC y la interfaz del hotspot. No desactiva el firewall completo ni modifica los bloqueos generales de Python. Si detecta un bloqueo explícito para el propio ejecutable, informa del conflicto en vez de anularlo automáticamente.

También puedes crear una etiqueta Git que empiece por `v` (por ejemplo, `v1.0.0`) para ejecutar la compilación y adjuntar el ZIP a un GitHub Release.

## Estructura y recursos

- `app.py`: servidor Flask y API.
- `index.html`: dashboard principal.
- `templates/`: vistas de batallas y ataques.
- `Imagenes/` y `Audios/`: recursos visuales y de sonido.
- `BasesDeDatos/competencia.db`: base SQLite propia de este proyecto.
- `iniciar_minisumos.bat` y `permitir_hotspot.ps1`: herramientas del modo de desarrollo con Python.
- `iniciar_ejecutable.bat` y `permitir_hotspot_exe.ps1`: lanzamiento y configuración de firewall del paquete compilado.
- `.github/workflows/build-windows.yml`: compilación automatizada para Windows x64.

## Base de datos

La aplicación HTML utiliza exclusivamente `MiniSumosRC_HTML/BasesDeDatos/competencia.db`. No busca ni usa la base de datos del proyecto de escritorio `MiniSumosRC`. El endpoint `GET /api/database-status` permite comprobar qué archivo SQLite está utilizando el servidor.

Para conservar los datos del paquete portátil, mantén la carpeta extraída y haz una copia de seguridad antes de reemplazarla por una versión nueva. Evita ejecutar el paquete desde el ZIP o desde una carpeta protegida como `Archivos de programa`, ya que la base SQLite necesita permisos de escritura.

## Alcance funcional

La interfaz incluye el dashboard, páginas de ataques, marcador y vistas de gestión. La vista **Ganadores / Perdedores** incluye una simulación provisional de doble eliminación: índices promedio con tres decimales, ajuste de índices repetidos, rondas Winners/Lossers, byes, final y final decisiva, historial y consola de eventos. Su estado de prueba se guarda en la tabla `torneo_debug` de esta misma base SQLite. Esta simulación no registra combates oficiales ni controla el ESP32; valida el flujo completo antes de usarlo en una competencia real.
