@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Node.js LTS nao encontrado. Instale em https://nodejs.org/ ^& pause ^& exit /b 1)
if not exist "node_modules\electron" (echo Instalando dependencias do projeto... ^& call npm install --no-audit --no-fund)
if errorlevel 1 (echo Falha ao instalar dependencias. ^& pause ^& exit /b 1)
call npm start
if errorlevel 1 pause
