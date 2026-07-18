@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set APP_HOME=%LOCALAPPDATA%\DesktopFairy
set MODEL_DIR=%APP_HOME%\models\qwen35_4b_ud_iq2_xxs
set LOG_DIR=%APP_HOME%\logs
set RUN_DIR=%APP_HOME%\run
set MODEL_FILE=%MODEL_DIR%\Qwen3.5-4B-UD-IQ2_XXS.gguf
set LOG_FILE_OUT=%LOG_DIR%\local-test-model.out.log
set LOG_FILE_ERR=%LOG_DIR%\local-test-model.err.log
set PID_FILE=%RUN_DIR%\local-test-model.pid
set PORT=18080

if not exist "%MODEL_FILE%" (
    echo Model file not found:
    echo %MODEL_FILE%
    echo Please run install-local-test-model.bat first
    exit /b 1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"

set "LLAMA_SERVER="
for /f "delims=" %%i in ('where.exe llama-server.exe 2^>nul') do (
    set "LLAMA_SERVER=%%i"
    goto :found_llama
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$packages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'; if (Test-Path $packages) { Get-ChildItem -Path $packages -Recurse -Filter 'llama-server.exe' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }"`) do (
    set "LLAMA_SERVER=%%i"
    goto :found_llama
)

:found_llama
if not defined LLAMA_SERVER (
    echo llama-server.exe not found
    echo Please install llama.cpp first
    exit /b 1
)
if not exist "%LLAMA_SERVER%" (
    echo Located llama-server path is invalid: %LLAMA_SERVER%
    exit /b 1
)

set LISTEN_PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
    set LISTEN_PID=%%a
)

if defined LISTEN_PID (
    curl.exe -s http://127.0.0.1:%PORT%/v1/models >nul 2>nul
    if errorlevel 1 (
        echo Port %PORT% is occupied by another service, or target OpenAI-compatible service is unavailable
        exit /b 1
    )
    > "%PID_FILE%" echo %LISTEN_PID%
    echo Target local model service already running on port %PORT%
    exit /b 0
)

echo Starting local model service...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%LLAMA_SERVER%' -ArgumentList @('-m','%MODEL_FILE%','--host','127.0.0.1','--port','%PORT%','-c','4096') -RedirectStandardOutput '%LOG_FILE_OUT%' -RedirectStandardError '%LOG_FILE_ERR%' -WindowStyle Hidden -PassThru; Set-Content -Path '%PID_FILE%' -Value $p.Id"
if errorlevel 1 (
    echo Failed to start local model service.
    exit /b 1
)

set READY=
for /l %%i in (1,1,30) do (
    curl.exe -s http://127.0.0.1:%PORT%/v1/models >nul 2>nul
    if not errorlevel 1 (
        set READY=1
        goto :ready_ok
    )
    timeout /t 2 /nobreak >nul
)

:ready_ok
if not defined READY (
    echo Service failed to start
    echo Check log: %LOG_FILE_OUT%
    echo Check error log: %LOG_FILE_ERR%
    exit /b 1
)

echo Local model service started: http://127.0.0.1:%PORT%
exit /b 0
