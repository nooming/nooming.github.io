# -*- coding: utf-8 -*-
"""将 Word 文档（.doc / .docx）转为 PDF。

通过本机 Microsoft Word / WPS 文字的 COM 接口导出（不使用 LibreOffice）。
支持拖放到本脚本/exe，或无参数时弹出文件选择框。
"""

from __future__ import annotations

import gc
import sys
import time
from pathlib import Path

# Word 导出为 PDF
_WD_EXPORT_FORMAT_PDF = 17
_WD_FORMAT_PDF = 17

_WORD_PROG_IDS = (
    "Word.Application",
    "Kwps.Application",
    "wps.Application",
    "WPS.Application",
)

_WORD_SUFFIXES = {".doc", ".docx", ".docm"}


class OfficeNotFoundError(RuntimeError):
    """本机未安装可用的 Word / WPS 文字。"""


def _ensure_win32() -> None:
    if sys.platform != "win32":
        raise RuntimeError("Word 转 PDF 依赖 Windows 上的 Word 或 WPS COM，当前系统不支持。")


def _create_word_app():
    """按顺序尝试 ProgID，返回 (app, prog_id)。"""
    _ensure_win32()
    try:
        import win32com.client  # type: ignore
        import pythoncom  # type: ignore
    except ImportError as e:
        raise RuntimeError("缺少 pywin32 依赖。请执行: pip install pywin32") from e

    pythoncom.CoInitialize()
    errors: list[str] = []
    for prog_id in _WORD_PROG_IDS:
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
        "未检测到可用的 Microsoft Word 或 WPS 文字。\n"
        "请安装 Microsoft Word（Microsoft Office）或 WPS，然后重试。\n"
        "尝试过的接口:\n  - " + "\n  - ".join(errors)
    )


def _configure_app(app) -> None:
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


def _open_document(app, abs_doc: str):
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            return app.Documents.Open(
                abs_doc,
                ConfirmConversions=False,
                ReadOnly=True,
                AddToRecentFiles=False,
                Visible=False,
            )
        except TypeError:
            try:
                return app.Documents.Open(abs_doc)
            except Exception as e:
                last_err = e
        except Exception as e:
            last_err = e
        time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"无法打开文档: {abs_doc}\n原因: {last_err}") from last_err


def _release_com(document, app) -> None:
    if document is not None:
        try:
            document.Close(SaveChanges=False)
        except Exception:
            try:
                document.Close()
            except Exception:
                pass
    if app is not None:
        try:
            app.Quit()
        except Exception:
            pass
    del document
    del app
    gc.collect()
    time.sleep(0.6)
    try:
        import pythoncom  # type: ignore

        pythoncom.CoUninitialize()
    except Exception:
        pass


def _export_document_to_pdf(document, pdf_path: Path) -> None:
    out = str(pdf_path.resolve())
    try:
        document.ExportAsFixedFormat(
            OutputFileName=out,
            ExportFormat=_WD_EXPORT_FORMAT_PDF,
            OpenAfterExport=False,
        )
        return
    except Exception:
        pass
    try:
        document.SaveAs2(out, FileFormat=_WD_FORMAT_PDF)
        return
    except Exception as e:
        raise RuntimeError(f"导出 PDF 失败: {e}") from e


def convert_word_to_pdf(word_path: Path, pdf_path: Path | None = None) -> Path:
    """将单个 Word 文档经 COM 导出为 PDF，默认输出到同目录「原文件名.pdf」。"""
    if not word_path.is_file():
        raise FileNotFoundError(f"文件不存在: {word_path}")
    if word_path.suffix.lower() not in _WORD_SUFFIXES:
        raise ValueError(f"不是 Word 文档: {word_path}")

    out_pdf = pdf_path if pdf_path is not None else word_path.parent / f"{word_path.stem}.pdf"
    out_pdf = out_pdf.resolve()
    out_pdf.parent.mkdir(parents=True, exist_ok=True)

    app = None
    document = None
    try:
        app, prog_id = _create_word_app()
        print(f"  使用: {prog_id}")
        _configure_app(app)

        abs_doc = str(word_path.resolve())
        document = _open_document(app, abs_doc)

        print("  正在导出 PDF ...")
        _export_document_to_pdf(document, out_pdf)
    finally:
        _release_com(document, app)

    if not out_pdf.is_file():
        raise RuntimeError(f"导出完成但未找到 PDF: {out_pdf}")
    return out_pdf


def pick_words_with_dialog(title: str = "选择要转换的 Word 文档") -> list[Path]:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("未安装 tkinter，且未通过命令行传入文档路径。")
        print("用法: 将 Word 文档拖到本程序上，或运行:")
        print('  word2pdf.exe "文件.docx"')
        return []

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title=title,
        filetypes=[
            ("Word 文档", "*.docx;*.doc;*.docm"),
            ("DOCX", "*.docx"),
            ("DOC", "*.doc"),
            ("所有文件", "*.*"),
        ],
    )
    root.destroy()
    return [Path(p) for p in paths]


def collect_word_args(argv: list[str]) -> list[Path]:
    paths: list[Path] = []
    for arg in argv:
        if arg.lower() in ("-h", "--help"):
            continue
        p = Path(arg).expanduser().resolve()
        if p.is_file() and p.suffix.lower() in _WORD_SUFFIXES:
            paths.append(p)
        elif p.is_file():
            print(f"跳过非 Word 文件: {p}")
        else:
            print(f"跳过无效路径: {arg}")
    return paths


def main() -> int:
    args = sys.argv[1:]
    if any(a.lower() in ("-h", "--help") for a in args):
        print("用法（在仓库根目录执行）:")
        print('  python tools/word/word_to_pdf.py "文件.docx" ...')
        print("也可将 Word 文档拖到 word2pdf.exe 上，或无参数时弹出选择框。")
        print("依赖本机已安装 Microsoft Word 或 WPS 文字。")
        return 0

    print("Word 转 PDF 工具 (Word / WPS COM)")
    print("-" * 40)

    if sys.platform != "win32":
        print("错误: 仅支持 Windows。")
        return 1

    docs = collect_word_args(args) if args else pick_words_with_dialog()

    if not docs:
        print("没有可转换的 Word 文档。")
        print("用法: 将一个或多个 .doc / .docx 拖到本程序上即可。")
        return 1

    ok, fail = 0, 0
    for doc in docs:
        print(f"\n正在转换: {doc}")
        try:
            out = convert_word_to_pdf(doc)
            print(f"成功！PDF 已保存:\n  {out}")
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
