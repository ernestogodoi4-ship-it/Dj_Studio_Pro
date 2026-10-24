@echo off
setlocal
cd /d "%~dp0"
echo DJ Studio PRO - gerando instalador para Windows
where node >nul 2>nul
if errorlevel 1 (echo Node.js LTS nao encontrado. Instale em https://nodejs.org/ ^& pause ^& exit /b 1)
echo Instalando dependencias do projeto...
call npm install --no-audit --no-fund
if errorlevel 1 (echo Falha ao instalar dependencias. ^& pause ^& exit /b 1)
echo Compilando o instalador NSIS...
call npm run dist
if errorlevel 1 (echo Falha ao gerar o instalador. ^& pause ^& exit /b 1)
echo.
echo Instalador criado na pasta dist.
pause
