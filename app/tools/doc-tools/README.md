# 文档转换（doc-tools）

与仓库根目录 [`desktop-doc-tools/`](../../../desktop-doc-tools/) 对应（Windows 本地小工具集）。

| 功能 | 网页路径 | 桌面 exe |
|------|----------|----------|
| PDF → PNG | `pdf-to-images/` | pdf2img |
| 图片 → PDF | `images-to-pdf/` | img2pdf |
| PDF → PPTX | `pdf-to-ppt/` | pdf2ppt |
| 读 ipynb | `ipynb-read/` | — |
| Word/PPT → PDF 等 | `windows/` 说明 | word2pdf / ppt2pdf / ppt2img / nbopen（在 `desktop-doc-tools/` 自行打包） |

网页版在浏览器端处理 · 文件不发送至服务器。依赖 jsDelivr 加载 pdf.js、pdf-lib、JSZip、PptxGenJS。
