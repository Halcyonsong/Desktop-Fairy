@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set APP_HOME=%LOCALAPPDATA%\DesktopFairy
set RUN_DIR=%APP_HOME%\run
set PID_FILE=%RUN_DIR%\local-test-model.pid
set PORT=18080

if exist "%PID_FILE%" (
    set /p TARGET_PID=<"%PID_FILE%"
    if defined TARGET_PID (
        tasklist /FI "PID eq !TARGET_PID!" | findstr /R /C:"[0-9][0-9]*" >nul 2>nul
        if not errorlevel 1 (
            echo Stopping PID=!TARGET_PID! from pid file
            taskkill /PID !TARGET_PID! /F >nul 2>nul
            if not errorlevel 1 (
                del "%PID_FILE%" >nul 2>nul
                echo Local model service stopped
                exit /b 0
            )
        )
    )
)

set LISTEN_PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
    set LISTEN_PID=%%a
)

if not defined LISTEN_PID (
    if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>nul
    echo No local model service found on port %PORT%
    exit /b 0
)

curl.exe -s http://127.0.0.1:%PORT%/v1/models >nul 2>nul
if errorlevel 1 (
    echo Port %PORT% is occupied by another service, skip stop to avoid killing unrelated process
    exit /b 1
)

echo Stopping PID=%LISTEN_PID% from verified port %PORT%
taskkill /PID %LISTEN_PID% /F >nul 2>nul
if errorlevel 1 (
    echo Failed to stop local model service
    exit /b 1
)

if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>nul
echo Local model service stopped
exit /b 0
