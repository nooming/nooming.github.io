# 本地文档小工具集

Windows 下一组可拖放使用的转换/打开工具，源码在 `tools/`，打包脚本在 `packaging/`。

**网页版（noomings.com）**：[`app/tools/doc-tools/`](../app/tools/doc-tools/) — PDF↔图、PDF→PPT、只读 ipynb 在浏览器内完成；Word/PPT→PDF 等仍用本目录桌面工具。

| 工具 | 功能 | 依赖 |
|------|------|------|
| **pdf2img** | PDF → PNG（每页一张） | PyMuPDF |
| **pdf2ppt** | PDF → PPTX（整页位图） | PyMuPDF + python-pptx |
| **ppt2pdf** | PPT/PPTX → PDF | 本机 PowerPoint 或 WPS（COM） |
| **ppt2img** | PPT/PPTX → PNG | COM + PyMuPDF |
| **img2pdf** | 多张图片 → 一个 PDF（按文件名数字 1、2、3… 排序） | PyMuPDF |
| **word2pdf** | Word（.doc / .docx）→ PDF | 本机 Word 或 WPS（COM） |
| **nbopen** | 拖放打开 `.ipynb`（Jupyter） | 本机已安装 Jupyter |

## 目录结构

```
desktop-doc-tools/
  README.md
  requirements.txt
  build_all.bat          打包 pdf/ppt/img 五个 exe（不含 nbopen）
  tools/
    pdf/                 pdf_to_images.py、pdf_to_ppt.py
    ppt/                 ppt_convert.py、ppt_to_pdf.py、ppt_to_images.py
    img/                 images_to_pdf.py
    word/                word_convert.py、word_to_pdf.py
    nbopen/              open_ipynb.py（见 tools/nbopen/README.md）
  packaging/             *.spec、build_exe*.bat
  dist/                  打包产物 *.exe（本地生成，不提交）
  build/                 PyInstaller 中间文件（可删）
```

## 获取源码

- 在线浏览：[github.com/nooming/nooming.github.io/tree/main/desktop-doc-tools](https://github.com/nooming/nooming.github.io/tree/main/desktop-doc-tools)
- 克隆本仓库后进入 `desktop-doc-tools/`；或在 GitHub 对该目录使用 **Download ZIP**。

本站 **不提供预编译 exe**，需自行打包（见下）。

## 环境

在本目录（`desktop-doc-tools/`）：

```bat
pip install -r requirements.txt
```

**PPT / Word 相关**需本机 **Microsoft Office** 或 **WPS**（演示 / 文字）。**nbopen** 需本机 **Jupyter**，不会打进 exe。

## 运行（开发）

均在本目录执行。

```bat
python tools/pdf/pdf_to_images.py "文件.pdf"
python tools/pdf/pdf_to_ppt.py "文件.pdf"
python tools/ppt/ppt_to_pdf.py "文件.pptx"
python tools/ppt/ppt_to_images.py "文件.pptx"
python tools/img/images_to_pdf.py "含 1.png 2.png 的文件夹"
python tools/word/word_to_pdf.py "文件.docx"
python tools/nbopen/open_ipynb.py "笔记.ipynb"
```

无参数时多数工具会弹出文件/文件夹选择框；也可拖到脚本或 exe 上。

### img2pdf 说明

- 文件夹内图片主文件名为 **1、2、3、4…**（如 `1.png`、`2.jpg`）时，PDF 页顺序为 **1 → 2 → 3 → …**（按数值，不是 `1,10,2` 这种字符串序）。
- 输出默认：所选文件夹内的 `{文件夹名}.pdf`。
- 支持 png / jpg / jpeg / bmp / gif / webp / tif。

## 打包 exe

```bat
build_all.bat
```

或单独：

```bat
packaging\build_exe.bat
packaging\build_exe_ppt.bat
packaging\build_exe_ppt2pdf.bat
packaging\build_exe_ppt2img.bat
packaging\build_exe_img2pdf.bat
packaging\build_exe_word2pdf.bat
packaging\build_nbopen.bat
```

产物在 `dist\`：`pdf2img.exe`、`pdf2ppt.exe`、`ppt2pdf.exe`、`ppt2img.exe`、`img2pdf.exe`、`word2pdf.exe`、`nbopen.exe`。

## 使用说明（exe）

1. 双击 exe 选文件/文件夹，或拖到 exe 上。
2. **pdf2img**：`xxx_images\page_1.png` …
3. **pdf2ppt**：同目录 `xxx.pptx`
4. **ppt2pdf**：同目录 `xxx.pdf`
5. **ppt2img**：`xxx_images\page_1.png` …
6. **img2pdf**：文件夹内 `{文件夹名}.pdf`
7. **word2pdf**：同目录 `xxx.pdf`
8. **nbopen**：浏览器打开对应笔记本

控制台显示进度；结束后按回车关闭。

## 已知限制

### PDF → PPT

- 幻灯片为整页位图，文字不可编辑。

### PPT / Word → PDF

- 依赖 Office/WPS COM；转换期间请勿强杀 Word/WPS 相关进程。

### img2pdf

- 只处理**当前文件夹一层**内的图片，不递归子目录。
- 非纯数字文件名的图片会排在数字文件名之后。
