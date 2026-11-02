# -*- coding: utf-8 -*-
"""PPT 转图片入口：强制图片模式，复用 ppt_convert 中的逻辑。"""

from ppt_convert import _run_with_pause

if __name__ == "__main__":
    _run_with_pause(force_pdf=False)
