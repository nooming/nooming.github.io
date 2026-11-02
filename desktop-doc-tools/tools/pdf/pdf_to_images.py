# -*- coding: utf-8 -*-
"""将 PDF 每一页转为 PNG 图片，或整页渲染后生成 PPTX。

支持拖放到本脚本/exe，或无参数时弹出文件选择框。
模式：默认转图片；exe 名含 ppt，或传入 --ppt，则转 PPT。
"""

from __future__ import annotations

import io
import sys
from pathlib import Path


def convert_pdf(pdf_path: Path, zoom: float = 2.0) -> Path:
    """将单个 PDF 转为 PNG，输出到「原文件名_images」文件夹。"""
    import fitz  # PyMuPDF

    if not pdf_path.is_file():
        raise FileNotFoundError(f"文件不存在: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(f"不是 PDF 文件: {pdf_path}")

    out_dir = pdf_path.parent / f"{pdf_path.stem}_images"
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    try:
        matrix = fitz.Matrix(zoom, zoom)
        total = len(doc)
        if total == 0:
            raise ValueError(f"PDF 没有页面: {pdf_path}")

        for i, page in enumerate(doc, start=1):
            pix = page.get_pixmap(matrix=matrix)
            out_file = out_dir / f"page_{i}.png"
            pix.save(str(out_file))
            print(f"  [{i}/{total}] 已保存: {out_file.name}")
    finally:
        doc.close()

    return out_dir


def convert_pdf_to_ppt(pdf_path: Path, zoom: float = 2.0) -> Path:
    """将单个 PDF 每页渲染为图片并放入幻灯片，输出同目录 .pptx。

    每页一张幻灯片，图片铺满幻灯片；幻灯片尺寸按首页比例设定。
    注意：文字不可编辑，本质是整页位图嵌入。
    """
    import fitz  # PyMuPDF
    from pptx import Presentation
    from pptx.util import Emu, Inches

    if not pdf_path.is_file():
        raise FileNotFoundError(f"文件不存在: {pdf_path}")
    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError(f"不是 PDF 文件: {pdf_path}")

    out_file = pdf_path.parent / f"{pdf_path.stem}.pptx"
    doc = fitz.open(pdf_path)
    try:
        total = len(doc)
        if total == 0:
            raise ValueError(f"PDF 没有页面: {pdf_path}")

        # PDF 点 = 1/72 英寸；用首页设定幻灯片尺寸，图片铺满
        first = doc[0].rect
        prs = Presentation()
        prs.slide_width = Inches(first.width / 72.0)
        prs.slide_height = Inches(first.height / 72.0)
        blank = prs.slide_layouts[6]  # 空白版式
        matrix = fitz.Matrix(zoom, zoom)

        for i, page in enumerate(doc, start=1):
            pix = page.get_pixmap(matrix=matrix)
            img_stream = io.BytesIO(pix.tobytes("png"))
            slide = prs.slides.add_slide(blank)
            slide.shapes.add_picture(
                img_stream,
                Emu(0),
                Emu(0),
                width=prs.slide_width,
                height=prs.slide_height,
            )
            print(f"  [{i}/{total}] 已加入幻灯片")

        prs.save(str(out_file))
    finally:
        doc.close()

    return out_file


def pick_pdfs_with_dialog(title: str = "选择要转换的 PDF 文件") -> list[Path]:
    """无命令行参数时，用 tkinter 选择一个或多个 PDF。"""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("未安装 tkinter，且未通过命令行传入 PDF 路径。")
        print("用法: 将 PDF 拖到本程序上，或运行:")
        print('  pdf2img.exe "文件.pdf"')
        print('  pdf2ppt.exe "文件.pdf"')
        return []

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title=title,
        filetypes=[("PDF 文件", "*.pdf"), ("所有文件", "*.*")],
    )
    root.destroy()
    return [Path(p) for p in paths]


def collect_pdf_args(argv: list[str]) -> list[Path]:
    """从命令行参数收集 PDF 路径（支持一次拖多个）。忽略模式开关。"""
    paths: list[Path] = []
    for arg in argv:
        if arg.lower() in ("--ppt", "--img", "--image", "-h", "--help"):
            continue
        p = Path(arg).expanduser().resolve()
        if p.is_file() and p.suffix.lower() == ".pdf":
            paths.append(p)
        elif p.is_file():
            print(f"跳过非 PDF 文件: {p}")
        else:
            print(f"跳过无效路径: {arg}")
    return paths


def detect_ppt_mode(argv: list[str], force_ppt: bool | None = None) -> bool:
    """根据参数或可执行文件名判断是否为转 PPT 模式。"""
    if force_ppt is not None:
        return force_ppt
    flags = {a.lower() for a in argv}
    if "--ppt" in flags:
        return True
    if "--img" in flags or "--image" in flags:
        return False
    name = Path(sys.argv[0]).stem.lower()
    return "ppt" in name


def main(force_ppt: bool | None = None) -> int:
    args = sys.argv[1:]
    if any(a.lower() in ("-h", "--help") for a in args):
        print("用法（在仓库根目录执行）:")
        print('  python tools/pdf/pdf_to_images.py [选项] "文件.pdf" ...')
        print('  python tools/pdf/pdf_to_ppt.py "文件.pdf" ...')
        print("选项: --ppt  输出 PPTX；--img  输出 PNG（默认）")
        print("也可将 PDF 拖到对应 exe 上，或无参数时弹出选择框。")
        return 0

    ppt_mode = detect_ppt_mode(args, force_ppt=force_ppt)
    if ppt_mode:
        print("PDF 转 PPT 工具 (PyMuPDF + python-pptx)")
    else:
        print("PDF 转图片工具 (PyMuPDF)")
    print("-" * 40)

    title = "选择要转为 PPT 的 PDF 文件" if ppt_mode else "选择要转换的 PDF 文件"
    pdfs = collect_pdf_args(args) if args else pick_pdfs_with_dialog(title=title)

    if not pdfs:
        print("没有可转换的 PDF。")
        print("用法: 将一个或多个 PDF 拖到本程序上即可。")
        return 1

    ok, fail = 0, 0
    for pdf in pdfs:
        print(f"\n正在转换: {pdf}")
        try:
            if ppt_mode:
                out = convert_pdf_to_ppt(pdf)
                print(f"成功！PPT 已保存:\n  {out}")
            else:
                out = convert_pdf(pdf)
                print(f"成功！共处理完成，图片保存在:\n  {out}")
            ok += 1
        except Exception as e:
            print(f"转换失败: {e}")
            fail += 1

    print("\n" + "-" * 40)
    print(f"完成：成功 {ok} 个，失败 {fail} 个。")
    return 0 if fail == 0 else 2


def _run_with_pause(force_ppt: bool | None = None) -> None:
    exit_code = 1
    try:
        exit_code = main(force_ppt=force_ppt)
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
