@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo 正在打包 ppt2pdf.exe ...
pyinstaller --onefile --console --name ppt2pdf --clean --noconfirm ^
  --distpath dist --workpath build --specpath packaging ^
  --paths tools\ppt --paths tools\pdf ^
  --exclude-module torch --exclude-module torchvision --exclude-module torio --exclude-module torchaudio ^
  --exclude-module tensorflow --exclude-module pandas --exclude-module numpy --exclude-module scipy ^
  --exclude-module matplotlib --exclude-module cv2 ^
  --hidden-import win32com.client --hidden-import pythoncom --hidden-import pywintypes ^
  tools\ppt\ppt_to_pdf.py
if errorlevel 1 (
  echo 打包失败。
  pause
  exit /b 1
)
echo.
echo 完成: %cd%\dist\ppt2pdf.exe
pause
