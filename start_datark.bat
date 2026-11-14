@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "ROOT=%~dp0"
set "API_DIR=%ROOT%rf-engine"
set "WEB_DIR=%ROOT%frontend"
set "PY_EXE=%API_DIR%\.venv\Scripts\python.exe"

if /I "%~1"=="--api" goto RUN_API
if /I "%~1"=="--web" goto RUN_WEB

echo =========================================
echo    DATARK RF GUARDIAN - START
echo =========================================

if not exist "%API_DIR%\requirements.txt" goto MISSING_API
if not exist "%WEB_DIR%\package.json" goto MISSING_WEB
where npm >nul 2>&1
if errorlevel 1 goto MISSING_NPM

if exist "%PY_EXE%" goto PY_READY
echo [1/4] Creating Python environment...
where py >nul 2>&1
if errorlevel 1 goto USE_PYTHON
py -3 -m venv "%API_DIR%\.venv"
if errorlevel 1 goto INSTALL_ERROR
goto PY_READY

:USE_PYTHON
where python >nul 2>&1
if errorlevel 1 goto MISSING_PYTHON
python -m venv "%API_DIR%\.venv"
if errorlevel 1 goto INSTALL_ERROR

:PY_READY
echo [1/4] Python environment ready.
if /I "%~1"=="--install" goto INSTALL_PIP
if exist "%API_DIR%\.deps-ok" goto PIP_READY

:INSTALL_PIP
echo [2/4] Installing Python dependencies...
"%PY_EXE%" -m pip install -r "%API_DIR%\requirements.txt"
if errorlevel 1 goto INSTALL_ERROR
>"%API_DIR%\.deps-ok" echo ready

:PIP_READY
echo [2/4] Python dependencies ready.
if /I "%~1"=="--install" goto INSTALL_NPM
if not exist "%WEB_DIR%\node_modules\.bin\vite.cmd" goto INSTALL_NPM
if exist "%WEB_DIR%\.npm-ready" goto NPM_READY

:INSTALL_NPM
echo [3/4] Installing frontend dependencies...
pushd "%WEB_DIR%"
call npm install --no-audit --no-fund
if errorlevel 1 goto NPM_ERROR
popd
>"%WEB_DIR%\.npm-ready" echo ready

:NPM_READY
echo [3/4] Frontend dependencies ready.
echo [4/4] Starting servers in separate windows...
start "Datark API" cmd /k ""%~f0" --api"
start "Datark WEB" cmd /k ""%~f0" --web"
echo.
echo API: http://127.0.0.1:8000/docs
echo UI:  http://127.0.0.1:5173/
echo Close the API and WEB windows to stop the servers.
exit /b 0

:RUN_API
cd /d "%API_DIR%"
"%PY_EXE%" -m uvicorn main:app --host 127.0.0.1 --port 8000
exit /b %errorlevel%

:RUN_WEB
cd /d "%WEB_DIR%"
call npm run dev
exit /b %errorlevel%

:NPM_ERROR
popd
goto INSTALL_ERROR

:MISSING_API
echo [ERROR] Missing rf-engine\requirements.txt
pause
exit /b 1

:MISSING_WEB
echo [ERROR] Missing frontend\package.json
pause
exit /b 1

:MISSING_NPM
echo [ERROR] npm not found. Install Node.js LTS and reopen the terminal.
pause
exit /b 1

:MISSING_PYTHON
echo [ERROR] Python not found. Install Python and reopen the terminal.
pause
exit /b 1

:INSTALL_ERROR
echo [ERROR] Installation failed. Check the message above.
pause
exit /b 1
