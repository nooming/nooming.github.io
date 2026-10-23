import {
    downloadBlob,
    loadPdfJs,
    setProgress,
    setStatus,
    stemFromFilename,
} from "/app/tools/doc-tools/assets/js/common.js";

const fileInput = document.getElementById("pdf-file");
const fileNameEl = document.getElementById("file-name");
const convertBtn = document.getElementById("convert-btn");
const pagePngBtn = document.getElementById("page-png-btn");
const statusEl = document.getElementById("status");
const zoomSelect = document.getElementById("zoom");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress-bar");
const pagePickerEl = document.getElementById("page-picker");
const previewEl = document.getElementById("pdf-preview");
const pagePrevBtn = document.getElementById("page-prev");
const pageNextBtn = document.getElementById("page-next");
const pageNumInput = document.getElementById("page-num");
const pageTotalEl = document.getElementById("page-total");

/** @type {File | null} */
let selectedFile = null;
/** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
let pdfDoc = null;
let numPages = 0;
let previewPage = 1;
/** @type {number} */
let previewRenderToken = 0;
let pdfLoading = false;

function isPdfFile(file) {
    if (!file) return false;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) return true;
    const type = (file.type || "").toLowerCase();
    return type === "application/pdf" || type === "application/x-pdf";
}

function showPreviewMessage(text, isError = false) {
    if (!previewEl) return;
    previewEl.replaceChildren();
    const p = document.createElement("p");
    p.className = isError ? "doc-pdf-preview__loading doc-pdf-preview__error" : "doc-pdf-preview__loading";
    p.textContent = text;
    previewEl.appendChild(p);
}

function clearPdfDocument() {
    pdfDoc = null;
    numPages = 0;
    previewPage = 1;
}

function hidePagePicker() {
    if (pagePickerEl) pagePickerEl.hidden = true;
}

function showPagePicker() {
    if (pagePickerEl) pagePickerEl.hidden = false;
}

function resetUiForNoFile() {
    clearPdfDocument();
    hidePagePicker();
    showPreviewMessage("选择 PDF 后将在此预览");
    if (pageNumInput) {
        pageNumInput.value = "1";
        pageNumInput.max = "1";
    }
    if (pageTotalEl) pageTotalEl.textContent = "/ 1";
    if (pagePrevBtn) pagePrevBtn.disabled = true;
    if (pageNextBtn) pageNextBtn.disabled = true;
    if (pagePngBtn) pagePngBtn.disabled = true;
    if (convertBtn) convertBtn.disabled = true;
}

function setPageControls() {
    if (pageNumInput) {
        pageNumInput.min = "1";
        pageNumInput.max = String(Math.max(1, numPages));
        pageNumInput.value = String(previewPage);
    }
    if (pageTotalEl) pageTotalEl.textContent = `/ ${Math.max(1, numPages)}`;
    const ready = !!pdfDoc && numPages > 0 && !pdfLoading;
    const canExport = !!selectedFile && !pdfLoading;
    if (pagePrevBtn) pagePrevBtn.disabled = !ready || previewPage <= 1;
    if (pageNextBtn) pageNextBtn.disabled = !ready || previewPage >= numPages;
    if (pagePngBtn) pagePngBtn.disabled = !canExport;
    if (convertBtn) convertBtn.disabled = !canExport;
}

function clampPage(n) {
    if (!numPages) return 1;
    return Math.min(numPages, Math.max(1, n));
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {number} pageNum 1-based
 * @param {number} scale
 */
async function renderPageToCanvas(pdf, pageNum, scale) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas;
}

async function renderPageToPngBlob(pdf, pageNum, scale) {
    const canvas = await renderPageToCanvas(pdf, pageNum, scale);
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))), "image/png");
    });
}

async function refreshPreview() {
    if (!pdfDoc || !numPages || !previewEl) return;
    const token = ++previewRenderToken;
    showPreviewMessage("正在生成预览…");

    try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const page = await pdfDoc.getPage(previewPage);
        const baseVp = page.getViewport({ scale: 1 });
        const maxW = Math.max(200, previewEl.clientWidth - 16);
        const previewScale = Math.min(1.5, maxW / baseVp.width);
        const canvas = await renderPageToCanvas(pdfDoc, previewPage, previewScale);
        if (token !== previewRenderToken) return;
        previewEl.replaceChildren(canvas);
    } catch (err) {
        if (token !== previewRenderToken) return;
        console.error(err);
        showPreviewMessage(err.message || "预览失败，可尝试直接下载当前页", true);
    }
}

async function goToPage(n) {
    previewPage = clampPage(n);
    setPageControls();
    await refreshPreview();
}

async function openPdfFromFile() {
    if (!selectedFile) throw new Error("请先选择 PDF");
    if (pdfDoc) return pdfDoc;

    const pdfjsLib = await loadPdfJs();
    const data = new Uint8Array(await selectedFile.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    numPages = pdfDoc.numPages;
    if (!numPages) {
        pdfDoc = null;
        throw new Error("PDF 没有页面");
    }
    previewPage = 1;
    return pdfDoc;
}

async function loadSelectedPdf() {
    if (!selectedFile) {
        resetUiForNoFile();
        return;
    }

    pdfLoading = true;
    clearPdfDocument();
    showPagePicker();
    showPreviewMessage("正在读取 PDF…");
    setPageControls();
    setStatus(statusEl, "正在读取 PDF…");

    try {
        await openPdfFromFile();
        fileNameEl.textContent = `${selectedFile.name}（共 ${numPages} 页）`;
        setStatus(statusEl, "可以预览选页，或导出全部 ZIP");
        await refreshPreview();
    } catch (err) {
        console.error(err);
        clearPdfDocument();
        showPreviewMessage(err.message || "无法打开 PDF，请换文件或检查网络（需加载 pdf.js）", true);
        setStatus(statusEl, err.message || "无法打开 PDF", "error");
    } finally {
        pdfLoading = false;
        setPageControls();
    }
}

if (!pagePickerEl || !previewEl) {
    console.error("pdf-to-images: 页面结构不完整，预览功能不可用");
    setStatus(statusEl, "页面脚本与 HTML 不匹配，请硬刷新后重试", "error");
} else {
    resetUiForNoFile();
    showPreviewMessage("选择 PDF 后将在此预览");
}

fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0] ?? null;
    selectedFile = isPdfFile(file) ? file : null;

    if (!file) {
        resetUiForNoFile();
        if (fileNameEl) fileNameEl.textContent = "未选择文件";
        setStatus(statusEl, "请选择 PDF 文件");
        return;
    }

    if (!selectedFile) {
        resetUiForNoFile();
        if (fileNameEl) fileNameEl.textContent = `${file.name}（不是 PDF 格式）`;
        setStatus(statusEl, "请选择 .pdf 或 MIME 为 application/pdf 的文件", "error");
        return;
    }

    if (fileNameEl) fileNameEl.textContent = file.name;
    loadSelectedPdf();
});

pagePrevBtn?.addEventListener("click", () => {
    goToPage(previewPage - 1);
});

pageNextBtn?.addEventListener("click", () => {
    goToPage(previewPage + 1);
});

pageNumInput?.addEventListener("change", () => {
    const n = parseInt(pageNumInput.value, 10);
    if (!Number.isFinite(n)) {
        pageNumInput.value = String(previewPage);
        return;
    }
    goToPage(n);
});

pagePngBtn?.addEventListener("click", async () => {
    if (!selectedFile) return;
    pagePngBtn.disabled = true;
    convertBtn.disabled = true;
    progressWrap.hidden = false;
    setProgress(progressBar, 0);

    try {
        await openPdfFromFile();
        const scale = parseFloat(zoomSelect.value) || 2;
        setStatus(statusEl, `正在渲染第 ${previewPage} 页…`);
        const blob = await renderPageToPngBlob(pdfDoc, previewPage, scale);
        const stem = stemFromFilename(selectedFile.name);
        downloadBlob(blob, `${stem}_page_${previewPage}.png`);
        setStatus(statusEl, `已下载第 ${previewPage} 页 PNG`);
        if (typeof showToast === "function") showToast("已下载 PNG", "success");
    } catch (err) {
        console.error(err);
        setStatus(statusEl, err.message || "导出失败", "error");
        if (typeof showToast === "function") showToast("导出失败", "error");
    } finally {
        progressWrap.hidden = true;
        setProgress(progressBar, 0);
        setPageControls();
    }
});

convertBtn?.addEventListener("click", async () => {
    if (!selectedFile) return;
    convertBtn.disabled = true;
    pagePngBtn.disabled = true;
    progressWrap.hidden = false;
    setProgress(progressBar, 0);

    try {
        await openPdfFromFile();
        const total = numPages;
        const scale = parseFloat(zoomSelect.value) || 2;
        const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")).default;

        const zip = new JSZip();
        const folderName = `${stemFromFilename(selectedFile.name)}_images`;

        for (let i = 1; i <= total; i++) {
            const blob = await renderPageToPngBlob(pdfDoc, i, scale);
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
        setPageControls();
        progressWrap.hidden = true;
        setProgress(progressBar, 0);
    }
});
