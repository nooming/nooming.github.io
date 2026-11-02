# -*- coding: utf-8 -*-
"""PPT 转 PDF 入口：强制 PDF 模式，复用 ppt_convert 中的逻辑。"""

from ppt_convert import _run_with_pause

if __name__ == "__main__":
    _run_with_pause(force_pdf=True)
