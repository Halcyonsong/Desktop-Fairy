@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set HF_ENDPOINT=https://hf-mirror.com

set APP_HOME=%LOCALAPPDATA%\DesktopFairy
set MODEL_DIR=%APP_HOME%\models\qwen35_4b_ud_iq2_xxs
set LOG_DIR=%APP_HOME%\logs
set RUN_DIR=%APP_HOME%\run
set HF_CACHE_DIR=%APP_HOME%\hf-cache
set MODEL_FILE=%MODEL_DIR%\Qwen3.5-4B-UD-IQ2_XXS.gguf
set LOG_FILE_OUT=%LOG_DIR%\local-test-model.out.log
set LOG_FILE_ERR=%LOG_DIR%\local-test-model.err.log
set PID_FILE=%RUN_DIR%\local-test-model.pid

set PORT=18080
set DISPLAY_NAME=Local Qwen3.5 4B
set PROVIDER=local-llamacpp
set API_KEY=local
set MODEL_NAME=Qwen3.5-4B-UD-IQ2_XXS

curl.exe -s http://127.0.0.1:%PORT%/v1/models >nul 2>nul
if not errorlevel 1 (
    echo Local model service already running, skip install and startup.
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
        if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"
        > "%PID_FILE%" echo %%a
        goto :already_running_success
    )
)

echo [1/8] Check Python...
where python >nul 2>nul
if errorlevel 1 (
    echo Python not found.
    echo Please install Python first, then run this script again.
    exit /b 1
)

echo [2/8] Check huggingface_hub...
python -c "import huggingface_hub" >nul 2>nul
if errorlevel 1 (
    echo huggingface_hub not found, installing...
    python -m pip install -U huggingface_hub
    if errorlevel 1 (
        echo Failed to install huggingface_hub.
        exit /b 1
    )
)

python -c "import huggingface_hub" >nul 2>nul
if errorlevel 1 (
    echo huggingface_hub still not available after installation.
    exit /b 1
)

echo [3/8] Create directories...
if not exist "%APP_HOME%" mkdir "%APP_HOME%"
if not exist "%MODEL_DIR%" mkdir "%MODEL_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"
if not exist "%HF_CACHE_DIR%" mkdir "%HF_CACHE_DIR%"

echo [4/8] Check llama-server...
set "LLAMA_SERVER="
for /f "delims=" %%i in ('where.exe llama-server.exe 2^>nul') do (
    set "LLAMA_SERVER=%%i"
    goto :found_llama
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$packages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'; if (Test-Path $packages) { Get-ChildItem -Path $packages -Recurse -Filter 'llama-server.exe' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }"`) do (
    set "LLAMA_SERVER=%%i"
    goto :found_llama
)

where winget >nul 2>nul
if errorlevel 1 (
    echo llama-server not found, and winget is unavailable.
    echo Please install llama.cpp manually or add llama-server.exe to PATH.
    exit /b 1
)

echo llama-server not found, try installing llama.cpp ...
winget install --id ggml.llamacpp -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo Failed to install llama.cpp with winget.
    exit /b 1
)

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
    echo llama-server.exe still not found after install.
    exit /b 1
)
if not exist "%LLAMA_SERVER%" (
    echo Located llama-server path is invalid: %LLAMA_SERVER%
    exit /b 1
)

echo Using llama-server: %LLAMA_SERVER%

echo [5/8] Download model if needed...
if exist "%MODEL_FILE%" (
    echo Model file already exists, skip download.
) else (
    python -c "from huggingface_hub import hf_hub_download; import shutil; import os; p = hf_hub_download(repo_id='unsloth/Qwen3.5-4B-GGUF', filename='Qwen3.5-4B-UD-IQ2_XXS.gguf', cache_dir=r'%HF_CACHE_DIR%'); os.makedirs(r'%MODEL_DIR%', exist_ok=True); shutil.copyfile(p, r'%MODEL_FILE%')"
    if errorlevel 1 (
        echo Model download failed.
        exit /b 1
    )
)

if not exist "%MODEL_FILE%" (
    echo Model file not found after download.
    exit /b 1
)

for %%I in ("%MODEL_FILE%") do set MODEL_SIZE=%%~zI
echo Model file size: %MODEL_SIZE% bytes

if "%MODEL_SIZE%"=="0" (
    echo Model file is empty.
    exit /b 1
)

if %MODEL_SIZE% LSS 1000000 (
    echo Model file looks too small, maybe download is invalid.
    exit /b 1
)

echo [6/8] Check port %PORT% ...
set LISTEN_PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
    set LISTEN_PID=%%a
)

if not defined LISTEN_PID (
    echo Starting local model service...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%LLAMA_SERVER%' -ArgumentList @('-m','%MODEL_FILE%','--host','127.0.0.1','--port','%PORT%','-c','4096') -RedirectStandardOutput '%LOG_FILE_OUT%' -RedirectStandardError '%LOG_FILE_ERR%' -WindowStyle Hidden -PassThru; Set-Content -Path '%PID_FILE%' -Value $p.Id"
    if errorlevel 1 (
        echo Failed to start local model service.
        exit /b 1
    )
) else (
    echo Port %PORT% already in use, verify target model service...
    curl.exe -s http://127.0.0.1:%PORT%/v1/models >nul 2>nul
    if errorlevel 1 (
        echo Port %PORT% is occupied by another service, or target OpenAI-compatible service is unavailable.
        exit /b 1
    )
    > "%PID_FILE%" echo %LISTEN_PID%
)

echo [7/8] Wait for service ready...
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
    echo Service failed to start or target model is unavailable.
    echo Check log: %LOG_FILE_OUT%
    echo Check error log: %LOG_FILE_ERR%
    exit /b 1
)

:already_running_success
echo {"name":"%DISPLAY_NAME%","provider":"%PROVIDER%","baseUrl":"http://127.0.0.1:%PORT%","apiKey":"%API_KEY%","models":[{"modelName":"%MODEL_NAME%"}]}
exit /b 0
