import {
    downloadBlob,
    isImageFile,
    filesUseNumericSort,
    orderImageFilesForPdf,
    setProgress,
    setStatus,
} from "../../../assets/js/common.js";

/** webp / gif 等：经 canvas 转为 PNG 再嵌入 */
function imageFileToPngBytes(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error(`无法读取图片: ${file.name}`));
                    return;
                }
                resolve(new Uint8Array(await blob.arrayBuffer()));
            }, "image/png");
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`无法读取图片: ${file.name}`));
        };
        img.src = url;
    });
}

const fileInput = document.getElementById("img-files");
const fileNameEl = document.getElementById("file-name");
const convertBtn = document.getElementById("convert-btn");
const statusEl = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress-bar");
const previewEl = document.getElementById("preview");

/** @type {File[]} */
let selectedFiles = [];

fileInput.addEventListener("change", () => {
    const list = fileInput.files ? [...fileInput.files] : [];
    selectedFiles = orderImageFilesForPdf(list.filter(isImageFile));

    if (!selectedFiles.length) {
        fileNameEl.textContent = "未选择文件";
        convertBtn.disabled = true;
        previewEl.hidden = true;
        previewEl.innerHTML = "";
        setStatus(statusEl, "请选择至少一张图片");
        return;
    }

    const byNumber = filesUseNumericSort(selectedFiles);
    let hint = `已选 ${selectedFiles.length} 张：${selectedFiles.map((f) => f.name).join("、")}`;
    hint += byNumber ? "（按文件名编号排序）" : "（按选择顺序，与预览一致）";
    fileNameEl.textContent = hint;
    convertBtn.disabled = false;
    setStatus(statusEl, "可以开始合并");

    previewEl.hidden = false;
    previewEl.innerHTML = "";
    for (const file of selectedFiles.slice(0, 12)) {
        const cell = document.createElement("div");
        cell.className = "doc-preview-cell";
        const img = document.createElement("img");
        img.alt = file.name;
        img.src = URL.createObjectURL(file);
        cell.appendChild(img);
        previewEl.appendChild(cell);
    }
});

convertBtn.addEventListener("click", async () => {
    if (!selectedFiles.length) return;
    convertBtn.disabled = true;
    progressWrap.hidden = false;

    try {
        const { PDFDocument } = await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");
        const pdfDoc = await PDFDocument.create();
        const total = selectedFiles.length;

        for (let i = 0; i < total; i++) {
            const file = selectedFiles[i];
            const lower = file.name.toLowerCase();
            let embedded;
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                embedded = await pdfDoc.embedJpg(bytes);
            } else if (lower.endsWith(".png")) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                embedded = await pdfDoc.embedPng(bytes);
            } else {
                const pngBytes = await imageFileToPngBytes(file);
                embedded = await pdfDoc.embedPng(pngBytes);
            }
            const page = pdfDoc.addPage([embedded.width, embedded.height]);
            page.drawImage(embedded, {
                x: 0,
                y: 0,
                width: embedded.width,
                height: embedded.height,
            });
            setProgress(progressBar, (i + 1) / total);
            setStatus(statusEl, `已加入 ${i + 1} / ${total}：${file.name}`);
        }

        const pdfBytes = await pdfDoc.save();
        downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "合并.pdf");
        setStatus(statusEl, `完成：共 ${total} 页`);
        if (typeof showToast === "function") showToast("已下载 PDF", "success");
    } catch (err) {
        console.error(err);
        setStatus(statusEl, err.message || "合并失败", "error");
        if (typeof showToast === "function") showToast("合并失败", "error");
    } finally {
        convertBtn.disabled = !selectedFiles.length;
        progressWrap.hidden = true;
        setProgress(progressBar, 0);
    }
});
