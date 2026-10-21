@echo off
setlocal
title MiniSumos RC - Dashboard
cd /d "%~dp0"

set "EXE=%~dp0MiniSumosRC.exe"
set "FIREWALL_SCRIPT=%~dp0permitir_hotspot_exe.ps1"

echo ==========================================
echo       MINISUMOS RC - DASHBOARD
echo ==========================================
echo.

if not exist "%EXE%" goto error_exe
if not exist "%FIREWALL_SCRIPT%" goto error_script

echo Comprobando acceso del firewall...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%FIREWALL_SCRIPT%" -CheckOnly >nul 2>&1
if errorlevel 1 goto configurar
goto iniciar

:configurar
echo Se necesita configurar el acceso del hotspot.
echo Windows solicitara permiso de administrador una sola vez
echo (o cuando cambie la ubicacion de esta carpeta o la red).
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0permitir_hotspot_exe.ps1""'; exit $p.ExitCode"
if errorlevel 1 goto error_firewall

:iniciar
echo Iniciando MiniSumos RC...
echo En este PC: http://127.0.0.1:8000
echo.
echo La ventana del servidor debe permanecer abierta.
echo.

start "MiniSumos RC" "%EXE%"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000"

set "HOTSPOT_IP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -Command "$x=Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue; $h=$x | Where-Object { $_.IPAddress -eq '192.168.137.1' } | Select-Object -First 1; if(-not $h){$h=$x | Where-Object { $_.IPAddress -match '^192\.168\.137\.' } | Select-Object -First 1}; if(-not $h){$h=$x | Where-Object { $_.InterfaceAlias -match '(?i)Local Area Connection|Conexión de área local' } | Select-Object -First 1}; if($h){$h.IPAddress}"`) do set "HOTSPOT_IP=%%I"

echo.
if defined HOTSPOT_IP (
    echo Desde los celulares conectados al hotspot:
    echo http://%HOTSPOT_IP%:8000
) else (
    echo Para celulares, consulta la IP de la interfaz del hotspot en Windows.
)
echo.
echo Para detener el servidor, cierra la ventana de MiniSumos RC.
echo ==========================================
pause
goto fin

:error_exe
echo ERROR: No se encontro MiniSumosRC.exe.
echo Este lanzador se incluye en el paquete compilado de Windows.
echo Descarga el ZIP compilado desde GitHub Actions o Releases.
pause
exit /b 1

:error_script
echo ERROR: No se encontro permitir_hotspot_exe.ps1.
echo Mantén ambos archivos en la misma carpeta que MiniSumosRC.exe.
pause
exit /b 1

:error_firewall
echo.
echo ERROR: No se pudo configurar el firewall.
echo Comprueba que aceptaste el permiso de administrador y que el hotspot
echo de Windows este activado. No desactives el firewall completo.
pause
exit /b 1

:fin
endlocal
