@echo off
setlocal
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "%~dp0launch.mjs" --no-browser
if errorlevel 1 (
  start "" notepad.exe "%~dp0..\tmp\launcher\launcher.log"
  exit /b 1
)
start "" "http://127.0.0.1:5173/"
if errorlevel 1 (
  echo O Windows nao conseguiu abrir o navegador. Acesse http://127.0.0.1:5173/
  pause
  exit /b 1
)
>> "%~dp0..\tmp\launcher\launcher.log" echo [%date% %time%] Navegador solicitado pelo atalho.
exit /b 0
