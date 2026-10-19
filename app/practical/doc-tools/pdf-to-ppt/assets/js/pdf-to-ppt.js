import {
    downloadBlob,
    loadPdfJs,
    setProgress,
    setStatus,
    stemFromFilename,
} from "../../../assets/js/common.js";

const fileInput = document.getElementById("pdf-file");
const fileNameEl = document.getElementById("file-name");
const convertBtn = document.getElementById("convert-btn");
const statusEl = document.getElementById("status");
const zoomSelect = document.getElementById("zoom");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress-bar");

/** @type {File | null} */
let selectedFile = null;

fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    selectedFile = file && file.name.toLowerCase().endsWith(".pdf") ? file : null;
    fileNameEl.textContent = selectedFile ? selectedFile.name : "未选择文件";
    convertBtn.disabled = !selectedFile;
    setStatus(statusEl, selectedFile ? "可以开始转换" : "请选择 PDF 文件");
});

convertBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    convertBtn.disabled = true;
    progressWrap.hidden = false;

    try {
        const pdfjsLib = await loadPdfJs();
        const PptxGenJS = (await import("https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm")).default;

        const data = new Uint8Array(await selectedFile.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const total = pdf.numPages;
        if (!total) throw new Error("PDF 没有页面");

        const scale = parseFloat(zoomSelect.value) || 2;
        const firstPage = await pdf.getPage(1);
        const firstVp = firstPage.getViewport({ scale: 1 });
        const slideW = firstVp.width / 72;
        const slideH = firstVp.height / 72;

        const pres = new PptxGenJS();
        pres.defineLayout({ name: "PDF_PAGE", width: slideW, height: slideH });
        pres.layout = "PDF_PAGE";

        for (let i = 1; i <= total; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL("image/png");

            const slide = pres.addSlide();
            slide.addImage({
                data: dataUrl,
                x: 0,
                y: 0,
                w: slideW,
                h: slideH,
            });

            setProgress(progressBar, i / total);
            setStatus(statusEl, `正在写入第 ${i} / ${total} 页…`);
        }

        setStatus(statusEl, "正在生成 PPTX…");
        const blob = await pres.write({ outputType: "blob" });
        downloadBlob(blob, `${stemFromFilename(selectedFile.name)}.pptx`);
        setStatus(statusEl, `完成：共 ${total} 页幻灯片`);
        if (typeof showToast === "function") showToast("已下载 PPTX", "success");
    } catch (err) {
        console.error(err);
        setStatus(statusEl, err.message || "转换失败", "error");
        if (typeof showToast === "function") showToast("转换失败", "error");
    } finally {
        convertBtn.disabled = !selectedFile;
        progressWrap.hidden = true;
        setProgress(progressBar, 0);
    }
});
