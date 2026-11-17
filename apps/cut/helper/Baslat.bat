@echo off
chcp 65001 >nul
title JinjaCut Helper
cd /d "%~dp0"
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo Python bulunamadi. / Python was not found.
  echo Kurmak icin bir tusa bas ^(winget^). / Press a key to install it ^(winget^).
  pause >nul
  winget install -e --id Python.Python.3.12
  echo Kurulum bitti. Bu pencereyi kapatip Baslat.bat dosyasini yeniden ac.
  echo Done. Close this window and open Baslat.bat again.
  pause
  exit /b
)
echo.
echo   1^) Bu bilgisayar / This computer
echo   2^) Telefon ^(QR kod^) / Phone ^(QR code^)
echo.
set /p M=Secim / Choice [1]: 
if "%M%"=="2" (%PY% jinjacut_helper.py --phone) else (%PY% jinjacut_helper.py)
pause
