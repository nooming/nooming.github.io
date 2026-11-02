# -*- coding: utf-8 -*-
"""将 PPT/PPTX 转为 PDF，或先转 PDF 再渲染为 PNG。

通过本机 PowerPoint / WPS 的 COM 接口导出 PDF（不使用 LibreOffice）。
支持拖放到本脚本/exe，或无参数时弹出文件选择框。
模式：默认转图片；exe 名含 pdf（如 ppt2pdf），或传入 --pdf，则只转 PDF。
"""

from __future__ import annotations

import gc
import shutil
import sys
import tempfile
import time
from pathlib import Path

# 允许从 tools/ppt 运行时导入 tools/pdf/pdf_to_images
_PDF_DIR = Path(__file__).resolve().parent.parent / "pdf"
if str(_PDF_DIR) not in sys.path:
    sys.path.insert(0, str(_PDF_DIR))

from pdf_to_images import convert_pdf

# PowerPoint 固定格式：PDF
_PP_FIXED_FORMAT_TYPE_PDF = 2
# PowerPoint 另存为 PDF（部分环境可用）
_PP_SAVE_AS_PDF = 32

# 常见 ProgID：优先 Microsoft PowerPoint，再尝试 WPS
_PPT_PROG_IDS = (
    "PowerPoint.Application",
    "KWPP.Application",
    "wpp.Application",
    "WPP.Application",
)

_PPT_SUFFIXES = {".ppt", ".pptx"}


class OfficeNotFoundError(RuntimeError):
    """本机未安装可用的 PowerPoint / WPS。"""


def _ensure_win32() -> None:
    if sys.platform != "win32":
        raise RuntimeError("PPT 转换依赖 Windows 上的 PowerPoint 或 WPS COM，当前系统不支持。")


def _create_ppt_app():
    """按顺序尝试 ProgID，优先 DispatchEx 独立实例，返回 (app, prog_id)。"""
    _ensure_win32()
    try:
        import win32com.client  # type: ignore
        import pythoncom  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "缺少 pywin32 依赖。请执行: pip install pywin32"
        ) from e

    pythoncom.CoInitialize()
    errors: list[str] = []
    for prog_id in _PPT_PROG_IDS:
        for factory_name, factory in (
            ("DispatchEx", win32com.client.DispatchEx),
            ("Dispatch", win32com.client.Dispatch),
        ):
            try:
                app = factory(prog_id)
                return app, prog_id
            except Exception as e:
                errors.append(f"{prog_id} ({factory_name}): {e}")

    raise OfficeNotFoundError(
        "未检测到可用的 PowerPoint 或 WPS。\n"
        "请安装 Microsoft PowerPoint（Microsoft Office）或 WPS 演示，然后重试。\n"
        "尝试过的接口:\n  - " + "\n  - ".join(errors)
    )


def _configure_app(app) -> None:
    """隐藏窗口、减少弹窗。"""
    try:
        app.Visible = 0
    except Exception:
        try:
            app.Visible = False
        except Exception:
            pass
    try:
        app.DisplayAlerts = 0
    except Exception:
        pass


def _open_presentation(app, abs_ppt: str):
    """打开演示文稿；兼容不同 COM 签名，失败时短暂重试。"""
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            return app.Presentations.Open(abs_ppt, True, False, False)
        except TypeError:
            try:
                return app.Presentations.Open(
                    abs_ppt, ReadOnly=True, Untitled=False, WithWindow=False
                )
            except Exception as e:
                last_err = e
        except Exception as e:
            last_err = e
        time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"无法打开演示文稿: {abs_ppt}\n原因: {last_err}") from last_err


def _release_com(presentation, app) -> None:
    """关闭文档、退出应用并释放 COM，减轻连续转换时的残留进程问题。"""
    if presentation is not None:
        try:
            presentation.Close()
        except Exception:
            pass
    if app is not None:
        try:
            app.Quit()
        except Exception:
            pass
    # 打断 COM 引用，给 Office 进程退出时间
    del presentation
    del app
    gc.collect()
    time.sleep(0.6)
    try:
        import pythoncom  # type: ignore

        pythoncom.CoUninitialize()
    except Exception:
        pass


def _export_presentation_to_pdf(presentation, pdf_path: Path) -> None:
    """用 ExportAsFixedFormat 或 SaveAs 导出 PDF。"""
    out = str(pdf_path.resolve())
    try:
        presentation.ExportAsFixedFormat(out, _PP_FIXED_FORMAT_TYPE_PDF)
        return
    except Exception:
        pass
    try:
        presentation.SaveAs(out, _PP_SAVE_AS_PDF)
        return
    except Exception as e:
        raise RuntimeError(f"导出 PDF 失败: {e}") from e


def convert_ppt_to_pdf(ppt_path: Path, pdf_path: Path | None = None) -> Path:
    """将单个 PPT/PPTX 经 COM 导出为 PDF。

    默认输出到同目录「原文件名.pdf」。
    """
    if not ppt_path.is_file():
        raise FileNotFoundError(f"文件不存在: {ppt_path}")
    if ppt_path.suffix.lower() not in _PPT_SUFFIXES:
        raise ValueError(f"不是 PPT/PPTX 文件: {ppt_path}")

    out_pdf = pdf_path if pdf_path is not None else ppt_path.parent / f"{ppt_path.stem}.pdf"
    out_pdf = out_pdf.resolve()
    out_pdf.parent.mkdir(parents=True, exist_ok=True)

    app = None
    presentation = None
    try:
        app, prog_id = _create_ppt_app()
        print(f"  使用: {prog_id}")
        _configure_app(app)

        abs_ppt = str(ppt_path.resolve())
        presentation = _open_presentation(app, abs_ppt)

        print("  正在导出 PDF ...")
        _export_presentation_to_pdf(presentation, out_pdf)
    finally:
        _release_com(presentation, app)

    if not out_pdf.is_file():
        raise RuntimeError(f"导出完成但未找到 PDF: {out_pdf}")
    return out_pdf



def convert_ppt_to_images(ppt_path: Path, zoom: float = 2.0) -> Path:
    """PPT → 临时 PDF → PNG，输出到「原文件名_images」。

    中间 PDF 写入临时目录，转换结束后删除（不强制保留）。
    """
    if not ppt_path.is_file():
        raise FileNotFoundError(f"文件不存在: {ppt_path}")
    if ppt_path.suffix.lower() not in _PPT_SUFFIXES:
        raise ValueError(f"不是 PPT/PPTX 文件: {ppt_path}")

    tmp_dir = Path(tempfile.mkdtemp(prefix="ppt2img_"))
    tmp_pdf = tmp_dir / f"{ppt_path.stem}.pdf"
    try:
        print("  [1/2] PPT → PDF ...")
        convert_ppt_to_pdf(ppt_path, pdf_path=tmp_pdf)
        print("  [2/2] PDF → 图片 ...")
        # convert_pdf 会在 PDF 同目录建「stem_images」；先转完再挪到 PPT 旁
        tmp_images = convert_pdf(tmp_pdf, zoom=zoom)
        out_dir = ppt_path.parent / f"{ppt_path.stem}_images"
        if out_dir.resolve() != tmp_images.resolve():
            if out_dir.exists():
                shutil.rmtree(out_dir)
            shutil.move(str(tmp_images), str(out_dir))
        return out_dir
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def pick_ppts_with_dialog(title: str = "选择要转换的 PPT 文件") -> list[Path]:
    """无命令行参数时，用 tkinter 选择一个或多个 PPT/PPTX。"""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("未安装 tkinter，且未通过命令行传入 PPT 路径。")
        print("用法: 将 PPT 拖到本程序上，或运行:")
        print('  ppt2pdf.exe "文件.pptx"')
        print('  ppt2img.exe "文件.pptx"')
        return []

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title=title,
        filetypes=[
            ("PowerPoint 文件", "*.pptx;*.ppt"),
            ("PPTX", "*.pptx"),
            ("PPT", "*.ppt"),
            ("所有文件", "*.*"),
        ],
    )
    root.destroy()
    return [Path(p) for p in paths]


def collect_ppt_args(argv: list[str]) -> list[Path]:
    """从命令行参数收集 PPT 路径（支持一次拖多个）。忽略模式开关。"""
    paths: list[Path] = []
    for arg in argv:
        if arg.lower() in ("--pdf", "--img", "--image", "-h", "--help"):
            continue
        p = Path(arg).expanduser().resolve()
        if p.is_file() and p.suffix.lower() in _PPT_SUFFIXES:
            paths.append(p)
        elif p.is_file():
            print(f"跳过非 PPT/PPTX 文件: {p}")
        else:
            print(f"跳过无效路径: {arg}")
    return paths


def detect_pdf_mode(argv: list[str], force_pdf: bool | None = None) -> bool:
    """根据参数或可执行文件名判断是否为转 PDF 模式。

    - force_pdf 非空时直接采用
    - --pdf → True；--img/--image → False
    - exe/脚本名含 pdf（如 ppt2pdf、ppt_to_pdf）→ True
    - 默认 False（转图片）
    """
    if force_pdf is not None:
        return force_pdf
    flags = {a.lower() for a in argv}
    if "--pdf" in flags:
        return True
    if "--img" in flags or "--image" in flags:
        return False
    name = Path(sys.argv[0]).stem.lower().replace("_", "").replace("-", "")
    # ppt2pdf / ppttopdf
    if "pdf" in name and "img" not in name and "image" not in name:
        return True
    return False


def main(force_pdf: bool | None = None) -> int:
    args = sys.argv[1:]
    if any(a.lower() in ("-h", "--help") for a in args):
        print("用法（在仓库根目录执行）:")
        print('  python tools/ppt/ppt_convert.py [选项] "文件.pptx" ...')
        print('  python tools/ppt/ppt_to_pdf.py "文件.pptx" ...')
        print('  python tools/ppt/ppt_to_images.py "文件.pptx" ...')
        print("选项: --pdf  输出 PDF；--img  输出 PNG（默认）")
        print("也可将 PPT 拖到对应 exe 上，或无参数时弹出选择框。")
        print("依赖本机已安装 Microsoft PowerPoint 或 WPS 演示。")
        return 0

    pdf_mode = detect_pdf_mode(args, force_pdf=force_pdf)
    if pdf_mode:
        print("PPT 转 PDF 工具 (PowerPoint / WPS COM)")
    else:
        print("PPT 转图片工具 (COM → PDF → PyMuPDF)")
    print("-" * 40)

    if sys.platform != "win32":
        print("错误: 仅支持 Windows。")
        return 1

    title = "选择要转为 PDF 的 PPT 文件" if pdf_mode else "选择要转为图片的 PPT 文件"
    ppts = collect_ppt_args(args) if args else pick_ppts_with_dialog(title=title)

    if not ppts:
        print("没有可转换的 PPT/PPTX。")
        print("用法: 将一个或多个 PPT 拖到本程序上即可。")
        return 1

    ok, fail = 0, 0
    for ppt in ppts:
        print(f"\n正在转换: {ppt}")
        try:
            if pdf_mode:
                out = convert_ppt_to_pdf(ppt)
                print(f"成功！PDF 已保存:\n  {out}")
            else:
                out = convert_ppt_to_images(ppt)
                print(f"成功！共处理完成，图片保存在:\n  {out}")
            ok += 1
        except OfficeNotFoundError as e:
            print(f"转换失败: {e}")
            fail += 1
        except Exception as e:
            print(f"转换失败: {e}")
            fail += 1

    print("\n" + "-" * 40)
    print(f"完成：成功 {ok} 个，失败 {fail} 个。")
    return 0 if fail == 0 else 2


def _run_with_pause(force_pdf: bool | None = None) -> None:
    exit_code = 1
    try:
        exit_code = main(force_pdf=force_pdf)
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
