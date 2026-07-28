@echo off
title OndaAmp - Servidor para probar en el telefono
echo.
echo   Arrancando OndaAmp para tu telefono...
echo   (deja esta ventana abierta mientras lo pruebas)
echo.
node "%~dp0servir.cjs"
if errorlevel 1 (
  echo.
  echo   No se pudo arrancar. Comprueba que Node.js este instalado:
  echo   abre una terminal y escribe:  node -v
  echo.
)
pause
