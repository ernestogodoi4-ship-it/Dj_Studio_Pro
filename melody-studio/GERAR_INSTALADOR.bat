@echo off
cd /d "%~dp0"
echo Instalando dependencias e compilando o Melody Studio...
npm install
if errorlevel 1 (pause & exit /b 1)
npm run dist
if errorlevel 1 (pause & exit /b 1)
echo Instalador disponivel na pasta dist.
pause
