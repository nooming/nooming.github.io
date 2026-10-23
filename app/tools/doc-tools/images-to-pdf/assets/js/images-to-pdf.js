import {
    downloadBlob,
    isImageFile,
    filesUseNumericSort,
    orderImageFilesForPdf,
    setProgress,
    setStatus,
} from "/app/tools/doc-tools/assets/js/common.js";

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
/** @type {string[]} */
let previewObjectUrls = [];
let orderTouched = false;

function revokePreviewUrls() {
    for (const url of previewObjectUrls) URL.revokeObjectURL(url);
    previewObjectUrls = [];
}

function updateFileNameHint() {
    if (!selectedFiles.length) {
        fileNameEl.textContent = "未选择文件";
        return;
    }
    const names = selectedFiles.map((f) => f.name).join("、");
    let suffix;
    if (orderTouched) {
        suffix = "（已手动调整顺序，与预览一致）";
    } else if (filesUseNumericSort(selectedFiles)) {
        suffix = "（按文件名编号排序）";
    } else {
        suffix = "（按选择顺序，与预览一致）";
    }
    fileNameEl.textContent = `已选 ${selectedFiles.length} 张：${names}${suffix}`;
}

function moveFile(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= selectedFiles.length) return;
    const list = selectedFiles;
    [list[index], list[next]] = [list[next], list[index]];
    orderTouched = true;
    renderPreview();
    updateFileNameHint();
    setStatus(statusEl, `第 ${index + 1} 张与第 ${next + 1} 张已对调`);
}

function renderPreview() {
    if (!previewEl) return;
    revokePreviewUrls();
    previewEl.replaceChildren();

    selectedFiles.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "doc-preview-item";

        const head = document.createElement("div");
        head.className = "doc-preview-item__head";

        const indexEl = document.createElement("span");
        indexEl.className = "doc-preview-item__index";
        indexEl.textContent = `第 ${index + 1} 页`;

        const move = document.createElement("div");
        move.className = "doc-preview-item__move";

        const btnLeft = document.createElement("button");
        btnLeft.type = "button";
        btnLeft.className = "doc-preview-order-btn";
        btnLeft.textContent = "←";
        btnLeft.disabled = index === 0;
        btnLeft.setAttribute("aria-label", `第 ${index + 1} 张向左移动`);
        btnLeft.addEventListener("click", () => moveFile(index, -1));

        const btnRight = document.createElement("button");
        btnRight.type = "button";
        btnRight.className = "doc-preview-order-btn";
        btnRight.textContent = "→";
        btnRight.disabled = index === selectedFiles.length - 1;
        btnRight.setAttribute("aria-label", `第 ${index + 1} 张向右移动`);
        btnRight.addEventListener("click", () => moveFile(index, 1));

        move.append(btnLeft, btnRight);
        head.append(indexEl, move);

        const cell = document.createElement("div");
        cell.className = "doc-preview-cell";
        const img = document.createElement("img");
        img.alt = file.name;
        const url = URL.createObjectURL(file);
        previewObjectUrls.push(url);
        img.src = url;
        cell.appendChild(img);

        const name = document.createElement("p");
        name.className = "doc-preview-item__name";
        name.textContent = file.name;
        name.title = file.name;

        item.append(head, cell, name);
        previewEl.appendChild(item);
    });
}

function clearSelection() {
    selectedFiles = [];
    orderTouched = false;
    revokePreviewUrls();
    if (previewEl) {
        previewEl.hidden = true;
        previewEl.replaceChildren();
    }
    convertBtn.disabled = true;
    fileNameEl.textContent = "未选择文件";
    setStatus(statusEl, "请选择至少一张图片");
}

fileInput.addEventListener("change", () => {
    const list = fileInput.files ? [...fileInput.files] : [];
    orderTouched = false;
    selectedFiles = orderImageFilesForPdf(list.filter(isImageFile));

    if (!selectedFiles.length) {
        clearSelection();
        if (list.length) setStatus(statusEl, "未识别到图片文件");
        return;
    }

    updateFileNameHint();
    convertBtn.disabled = false;
    setStatus(statusEl, "可以开始合并；预览区 ← → 可调整页序");

    previewEl.hidden = false;
    renderPreview();
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
