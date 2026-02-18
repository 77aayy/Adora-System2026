@echo off
chcp 65001 >nul
title Adora - تشغيل السيرفر
cd /d "%~dp0"

echo.
echo  [Adora] تشغيل سيرفر التطوير...
echo.
start "Adora Dev Server" cmd /k "npm run dev"

echo  انتظار 5 ثوانٍ حتى يبدأ السيرفر...
timeout /t 5 /nobreak >nul

echo  فتح صفحة الدخول في المتصفح...
start "" "http://localhost:5175/login"

echo.
echo  تم. السيرفر يعمل في النافذة الأخرى.
echo  صفحة الدخول: http://localhost:5175/login
echo.
pause
