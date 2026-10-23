# Prueba de Json · MiniSumosRC_HTML

Aplicación aislada para validar el JSON de la competencia sin modificar el dashboard principal.

## Qué hace

- Lee la llave guardada en `../BasesDeDatos/competencia.db`, en la tabla `torneo_debug`.
- Consulta el estado vivo del dashboard principal en `http://127.0.0.1:8000` para recuperar ataques y cronómetro cuando el servidor principal esté activo.
- Convierte la estructura de la llave guardada a un JSON pensado para visualización: categoría, batalla actual, historial de la serie, cronómetro, próxima batalla, llaves de ganadores/perdedores, destinos y gran final.
- Envía el JSON mediante HTTP POST a `/api/receive`.
- Abre `/visor` para interpretar el JSON recibido y mostrar una vista de batalla, cronómetro, llaves y el JSON original recibido.

**No cifra el contenido**: “deserializador” aquí significa que lee el JSON recibido y lo convierte en componentes de interfaz. No modifica ni escribe en la base de datos.

## Cómo ejecutar en Windows

1. Abre MiniSumosRC_HTML como normalmente lo haces, para que Flask esté disponible en el puerto 8000 y tenga la llave actualizada en SQLite.
2. Abre PowerShell en la carpeta raíz del repositorio.
3. Ejecuta:

   ```powershell
   python ".\prueba de Json\app.py"
   ```

4. En el mismo computador abre:
   - Emisor y vista previa: http://127.0.0.1:8001/
   - Visor/deserializador: http://127.0.0.1:8001/visor

5. Pulsa **POSTEAR JSON** en el emisor. Después abre o recarga `/visor`.

Si el servidor principal usa otra dirección, define `MINISUMOS_SOURCE_URL` antes de iniciar la prueba. Para cambiar el puerto de prueba, define `JSON_TEST_PORT`.

## Nota sobre el estado

La llave debe haberse generado y guardado en MiniSumosRC_HTML > Tablas. El JSON se construye a partir de la llave persistida. Si el dashboard principal no está activo, se podrá leer la llave de SQLite, pero el estado en vivo del cronómetro y los ataques puede no estar disponible.

## Seguridad / aislamiento

El endpoint receptor mantiene el último JSON únicamente en memoria; al reiniciar esta app se borra. La app escucha en todas las interfaces para permitir pruebas en red local. No la expongas a Internet.
