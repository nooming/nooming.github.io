# 文档转换（doc-tools）

与 `noomings/desktop-doc-tools/`（原「2s」本地工具集）对应。

| 功能 | 网页路径 | 桌面 exe |
|------|----------|----------|
| PDF → PNG | `pdf-to-images/` | pdf2img |
| 图片 → PDF | `images-to-pdf/` | img2pdf |
| PDF → PPTX | `pdf-to-ppt/` | pdf2ppt |
| 读 ipynb | `ipynb-read/` | — |
| Word/PPT → PDF 等 | `windows/` 说明 | word2pdf / ppt2pdf / ppt2img / nbopen（`noomings/desktop-doc-tools/` 自行打包） |

网页版在浏览器内处理，文件不上传。依赖 jsDelivr 加载 pdf.js、pdf-lib、JSZip、PptxGenJS。
