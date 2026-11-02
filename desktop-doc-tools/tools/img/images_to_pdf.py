# -*- coding: utf-8 -*-
"""将文件夹内按数字命名的图片（1、2、3…）合并为一个 PDF。

页顺序按文件名中的数字升序（1 → 2 → … → 10，不是字符串排序）。
支持拖放文件夹、拖放多张图片，或无参数时选择文件夹。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff"}


def numeric_sort_key(path: Path) -> tuple[int, int, str]:
    """纯数字主文件名按数值排序；否则排在后面并按名称排序。"""
    stem = path.stem
    if stem.isdigit():
        return (0, int(stem), stem)
    m = re.match(r"^(\d+)", stem)
    if m:
        return (0, int(m.group(1)), stem)
    return (1, 0, stem.lower())


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES


def collect_images_from_dir(folder: Path) -> list[Path]:
    if not folder.is_dir():
        raise NotADirectoryError(f"不是文件夹: {folder}")
    images = [p for p in folder.iterdir() if is_image_file(p)]
    return sorted(images, key=numeric_sort_key)


def collect_images_from_args(paths: list[Path]) -> tuple[list[Path], Path | None]:
    """从命令行/拖放路径收集图片；若只有一个目录则扫描该目录。"""
    if len(paths) == 1 and paths[0].is_dir():
        folder = paths[0]
        return collect_images_from_dir(folder), folder

    images: list[Path] = []
    for p in paths:
        if p.is_dir():
            images.extend(collect_images_from_dir(p))
        elif is_image_file(p):
            images.append(p)
        elif p.is_file():
            print(f"跳过非图片文件: {p}")
        else:
            print(f"跳过无效路径: {p}")

    unique: dict[str, Path] = {}
    for img in images:
        unique[str(img.resolve())] = img
    ordered = sorted(unique.values(), key=numeric_sort_key)
    base = ordered[0].parent if ordered else None
    return ordered, base


def default_output_pdf(images: list[Path], source_folder: Path | None) -> Path:
    if source_folder is not None:
        return source_folder / f"{source_folder.name}.pdf"
    if images:
        return images[0].parent / "合并.pdf"
    return Path.cwd() / "合并.pdf"


def convert_images_to_pdf(images: list[Path], out_pdf: Path) -> Path:
    import fitz  # PyMuPDF

    if not images:
        raise ValueError("没有找到可合并的图片")

    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open()
    try:
        total = len(images)
        for i, img_path in enumerate(images, start=1):
            img_doc = fitz.open(img_path)
            try:
                if len(img_doc) == 0:
                    raise ValueError(f"无法读取图片: {img_path}")
                rect = img_doc[0].rect
                page = doc.new_page(width=rect.width, height=rect.height)
                page.insert_image(rect, filename=str(img_path))
            finally:
                img_doc.close()
            print(f"  [{i}/{total}] 已加入: {img_path.name}")

        doc.save(str(out_pdf))
    finally:
        doc.close()

    return out_pdf


def pick_folder_with_dialog(title: str = "选择包含图片的文件夹") -> Path | None:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("未安装 tkinter，请拖放文件夹到本程序，或传入文件夹路径。")
        return None

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.askdirectory(title=title, mustexist=True)
    root.destroy()
    return Path(path) if path else None


def collect_input_paths(argv: list[str]) -> list[Path]:
    paths: list[Path] = []
    for arg in argv:
        if arg.lower() in ("-h", "--help"):
            continue
        paths.append(Path(arg).expanduser().resolve())
    return paths


def main() -> int:
    args = sys.argv[1:]
    if any(a.lower() in ("-h", "--help") for a in args):
        print("图片合并为 PDF（按文件名数字 1、2、3… 排序）")
        print('用法: img2pdf.exe "图片文件夹"')
        print('      img2pdf.exe "1.png" "2.png" ...')
        print("也可将文件夹拖到 exe 上，或无参数时弹出文件夹选择框。")
        print("支持: png, jpg, jpeg, bmp, gif, webp, tif/tiff")
        return 0

    print("图片转 PDF 工具 (PyMuPDF)")
    print("-" * 40)

    if args:
        inputs = collect_input_paths(args)
    else:
        folder = pick_folder_with_dialog()
        inputs = [folder] if folder else []

    if not inputs:
        print("未选择文件夹或图片。")
        return 1

    try:
        images, source_folder = collect_images_from_args(inputs)
    except Exception as e:
        print(f"收集图片失败: {e}")
        return 1

    if not images:
        print("文件夹内没有可识别的图片（需扩展名为 png/jpg 等）。")
        return 1

    non_numeric = [p for p in images if not p.stem.isdigit() and not re.match(r"^\d+", p.stem)]
    if non_numeric:
        print("提示: 以下文件名不是纯数字开头，将排在数字文件之后:")
        for p in non_numeric:
            print(f"  - {p.name}")

    out_pdf = default_output_pdf(images, source_folder)
    print(f"\n共 {len(images)} 张，输出: {out_pdf}")
    try:
        convert_images_to_pdf(images, out_pdf)
        print(f"\n成功！PDF 已保存:\n  {out_pdf}")
        return 0
    except Exception as e:
        print(f"转换失败: {e}")
        return 2


def _run_with_pause() -> None:
    exit_code = 1
    try:
        exit_code = main()
    except Exception as e:
        print(f"发生未预期错误: {e}")
        exit_code = 1
    finally:
        if sys.platform == "win32":
            try:
                input("\n按回车退出...")
            except EOFError:
                pass
    sys.exit(exit_code)


if __name__ == "__main__":
    _run_with_pause()
