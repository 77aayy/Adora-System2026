@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
echo ========================================
echo   تحديث Git و Firebase CLI
echo ========================================
echo.

:: --- تحديث Git (عبر winget) ---
echo [1/2] تحديث Git...
where winget >nul 2>&1
if %errorlevel% equ 0 (
    winget upgrade --id Git.Git -e --accept-source-agreements --accept-package-agreements 2>nul
    if !errorlevel! equ 0 (
        echo Git: تم التحديث أو النسخة الحالية هي الأحدث.
    ) else (
        echo Git: winget لم يجد التحديث أو Git غير مثبت عبر winget.
    )
) else (
    echo Git: winget غير متوفر. ثبّت Git يدوياً من https://git-scm.com
)
echo.

:: --- تحديث Firebase CLI (عبر npm) ---
echo [2/2] تحديث Firebase CLI...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    call npm install -g firebase-tools
    if !errorlevel! equ 0 (
        echo Firebase CLI: تم التحديث.
        firebase --version
    ) else (
        echo Firebase CLI: فشل التحديث. جرّب: npm install -g firebase-tools
    )
) else (
    echo Firebase CLI: npm غير موجود. ثبّت Node.js من https://nodejs.org
)
echo.

echo ========================================
echo   انتهى.
echo ========================================
pause
