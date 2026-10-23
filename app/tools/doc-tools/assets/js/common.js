/** 文档转换 · 公共逻辑（与 desktop-doc-tools / 2s 的排序规则对齐） */

const PDFJS_VERSION = "4.10.38";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

/** @returns {Promise<typeof import('pdfjs-dist')>} */
export async function loadPdfJs() {
    const pdfjsLib = await import(`${PDFJS_BASE}/pdf.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.mjs`;
    return pdfjsLib;
}

/**
 * 与 Python numeric_sort_key 一致：纯数字主文件名按数值排序。
 * @param {string} filename
 */
export function numericSortKey(filename) {
    const stem = filename.replace(/\.[^.]+$/, "");
    if (/^\d+$/.test(stem)) {
        return [0, parseInt(stem, 10), stem];
    }
    const m = stem.match(/^(\d+)/);
    if (m) {
        return [0, parseInt(m[1], 10), stem];
    }
    return [1, 0, stem.toLowerCase()];
}

/** @param {{ name: string }[]} files */
export function sortImageFiles(files) {
    return [...files].sort((a, b) => {
        const ka = numericSortKey(a.name);
        const kb = numericSortKey(b.name);
        for (let i = 0; i < 3; i++) {
            if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
        }
        return 0;
    });
}

const IMAGE_EXT = new Set([
    ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff",
]);

export function isImageFile(file) {
    const lower = file.name.toLowerCase();
    for (const ext of IMAGE_EXT) {
        if (lower.endsWith(ext)) return true;
    }
    return !!(file.type && file.type.startsWith("image/"));
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * @param {HTMLElement} el
 * @param {string} message
 * @param {'idle'|'error'} [tone]
 */
export function setStatus(el, message, tone = "idle") {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("doc-status--error", tone === "error");
}

/**
 * @param {HTMLElement} barInner
 * @param {number} ratio 0–1
 */
export function setProgress(barInner, ratio) {
    if (!barInner) return;
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    barInner.style.width = `${pct}%`;
}

export function stemFromFilename(name) {
    return name.replace(/\.[^.]+$/, "") || "output";
}
