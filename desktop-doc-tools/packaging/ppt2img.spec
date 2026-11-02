# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

_SPECDIR = Path(SPECPATH).resolve()
_ROOT = _SPECDIR.parent
_PPT = str(_ROOT / "tools" / "ppt")
_PDF = str(_ROOT / "tools" / "pdf")

a = Analysis(
    [str(_ROOT / "tools" / "ppt" / "ppt_to_images.py")],
    pathex=[_PPT, _PDF],
    binaries=[],
    datas=[],
    hiddenimports=['win32com.client', 'pythoncom', 'pywintypes'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['torch', 'torchvision', 'torio', 'torchaudio', 'tensorflow', 'pandas', 'numpy', 'scipy', 'matplotlib', 'cv2'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ppt2img',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
