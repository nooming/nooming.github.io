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
    setProgress(progressBar, 0);

    try {
        const pdfjsLib = await loadPdfJs();
        const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;

        const data = new Uint8Array(await selectedFile.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const total = pdf.numPages;
        if (!total) throw new Error("PDF 没有页面");

        const scale = parseFloat(zoomSelect.value) || 2;
        const zip = new JSZip();
        const folderName = `${stemFromFilename(selectedFile.name)}_images`;

        for (let i = 1; i <= total; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))), "image/png");
            });
            zip.file(`${folderName}/page_${i}.png`, blob);
            setProgress(progressBar, i / total);
            setStatus(statusEl, `正在渲染 ${i} / ${total} 页…`);
        }

        setStatus(statusEl, "正在打包 ZIP…");
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${folderName}.zip`);
        setStatus(statusEl, `完成：共 ${total} 页`);
        if (typeof showToast === "function") showToast("已下载 ZIP", "success");
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
