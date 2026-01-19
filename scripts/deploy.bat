@echo off
REM ============================================================
REM Adora Hotel Management System - Windows Deployment Script
REM ============================================================

setlocal EnableDelayedExpansion

echo.
echo ========================================================
echo          ADORA HOTEL MANAGEMENT SYSTEM
echo              Deployment Script v3.0
echo ========================================================
echo.

set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

echo [*] Environment: %ENVIRONMENT%
echo.

REM Step 1: Pre-flight checks
echo [1/5] Pre-flight Checks...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [OK] Node.js: %%i

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo [OK] npm: %%i

where firebase >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Firebase CLI not found. Installing...
    npm install -g firebase-tools
)
for /f "tokens=*" %%i in ('firebase --version') do echo [OK] Firebase CLI: %%i

echo.

REM Step 2: Install dependencies
echo [2/5] Installing Dependencies...
call npm ci --silent
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Step 3: Code Quality Check
echo [3/5] Code Quality Check...
echo [SKIP] Using build-time TypeScript check
echo.

REM Step 4: Build
echo [4/5] Building for %ENVIRONMENT%...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed
    exit /b 1
)

if not exist "dist" (
    echo [ERROR] Build failed - dist folder not found
    exit /b 1
)

echo [OK] Build complete
echo.

REM Step 5: Deploy
echo [5/5] Deploying to Firebase...
if "%ENVIRONMENT%"=="production" (
    call firebase deploy --only hosting
) else if "%ENVIRONMENT%"=="staging" (
    call firebase deploy --only hosting:staging
) else (
    call firebase deploy --only hosting:dev
)

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Deployment failed
    exit /b 1
)

echo.
echo ========================================================
echo        PROJECT ADORA IS LIVE!
echo ========================================================
echo.
echo   Environment: %ENVIRONMENT%
echo   Deployed at: %date% %time%
echo.
echo   All done! Adora is ready to serve guests
echo.

endlocal
