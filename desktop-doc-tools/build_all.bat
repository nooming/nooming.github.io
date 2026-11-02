@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PYI_EXCLUDE=--exclude-module torch --exclude-module torchvision --exclude-module torio --exclude-module torchaudio --exclude-module tensorflow --exclude-module pandas --exclude-module numpy --exclude-module scipy --exclude-module matplotlib --exclude-module cv2"
set "PYI_COMMON=--distpath dist --workpath build --specpath packaging"

echo ===== 打包 pdf2img.exe =====
pyinstaller --onefile --console --name pdf2img --clean --noconfirm %PYI_COMMON% --paths tools\pdf %PYI_EXCLUDE% tools\pdf\pdf_to_images.py
if errorlevel 1 goto :fail

echo.
echo ===== 打包 pdf2ppt.exe =====
pyinstaller --onefile --console --name pdf2ppt --noconfirm %PYI_COMMON% --paths tools\pdf %PYI_EXCLUDE% tools\pdf\pdf_to_ppt.py
if errorlevel 1 goto :fail

echo.
echo ===== 打包 ppt2pdf.exe =====
pyinstaller --onefile --console --name ppt2pdf --noconfirm %PYI_COMMON% --paths tools\ppt --paths tools\pdf %PYI_EXCLUDE% --hidden-import win32com.client --hidden-import pythoncom --hidden-import pywintypes tools\ppt\ppt_to_pdf.py
if errorlevel 1 goto :fail

echo.
echo ===== 打包 ppt2img.exe =====
pyinstaller --onefile --console --name ppt2img --noconfirm %PYI_COMMON% --paths tools\ppt --paths tools\pdf %PYI_EXCLUDE% --hidden-import win32com.client --hidden-import pythoncom --hidden-import pywintypes tools\ppt\ppt_to_images.py
if errorlevel 1 goto :fail

echo.
echo ===== 打包 img2pdf.exe =====
pyinstaller --onefile --console --name img2pdf --noconfirm %PYI_COMMON% --paths tools\img %PYI_EXCLUDE% tools\img\images_to_pdf.py
if errorlevel 1 goto :fail

echo.
echo ===== 打包 word2pdf.exe =====
pyinstaller --onefile --console --name word2pdf --noconfirm %PYI_COMMON% --paths tools\word %PYI_EXCLUDE% --hidden-import win32com.client --hidden-import pythoncom --hidden-import pywintypes tools\word\word_to_pdf.py
if errorlevel 1 goto :fail

echo.
echo 完成:
echo   %~dp0dist\pdf2img.exe
echo   %~dp0dist\pdf2ppt.exe
echo   %~dp0dist\ppt2pdf.exe
echo   %~dp0dist\ppt2img.exe
echo   %~dp0dist\img2pdf.exe
echo   %~dp0dist\word2pdf.exe
echo.
echo nbopen 请单独运行: packaging\build_nbopen.bat
pause
exit /b 0

:fail
echo 打包失败。
pause
exit /b 1
