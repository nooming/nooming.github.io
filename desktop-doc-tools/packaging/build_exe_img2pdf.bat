@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo 正在打包 img2pdf.exe ...
pyinstaller --onefile --console --name img2pdf --clean --noconfirm ^
  --distpath dist --workpath build --specpath packaging ^
  --paths tools\img ^
  --exclude-module torch --exclude-module torchvision --exclude-module torio --exclude-module torchaudio ^
  --exclude-module tensorflow --exclude-module pandas --exclude-module numpy --exclude-module scipy ^
  --exclude-module matplotlib --exclude-module cv2 ^
  tools\img\images_to_pdf.py
if errorlevel 1 (
  echo 打包失败。
  pause
  exit /b 1
)
echo.
echo 完成: %cd%\dist\img2pdf.exe
pause
