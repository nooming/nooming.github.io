# -*- coding: utf-8 -*-
"""PDF 转 PPT 入口：强制 PPT 模式，复用 pdf_to_images 中的逻辑。"""

from pdf_to_images import _run_with_pause

if __name__ == "__main__":
    _run_with_pause(force_ppt=True)
