# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

_SPECDIR = Path(SPECPATH).resolve()
_ROOT = _SPECDIR.parent
_PDF = str(_ROOT / "tools" / "pdf")

a = Analysis(
    [str(_ROOT / "tools" / "pdf" / "pdf_to_ppt.py")],
    pathex=[_PDF],
    binaries=[],
    datas=[],
    hiddenimports=[],
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
    name='pdf2ppt',
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
