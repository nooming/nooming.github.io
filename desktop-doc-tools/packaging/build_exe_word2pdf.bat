@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo 正在打包 word2pdf.exe ...
pyinstaller --onefile --console --name word2pdf --clean --noconfirm ^
  --distpath dist --workpath build --specpath packaging ^
  --paths tools\word ^
  --exclude-module torch --exclude-module torchvision --exclude-module torio --exclude-module torchaudio ^
  --exclude-module tensorflow --exclude-module pandas --exclude-module numpy --exclude-module scipy ^
  --exclude-module matplotlib --exclude-module cv2 ^
  --hidden-import win32com.client --hidden-import pythoncom --hidden-import pywintypes ^
  tools\word\word_to_pdf.py
if errorlevel 1 (
  echo 打包失败。
  pause
  exit /b 1
)
echo.
echo 完成: %cd%\dist\word2pdf.exe
pause
