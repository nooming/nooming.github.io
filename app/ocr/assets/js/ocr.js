// ========== 图片识字 · PaddleOCR 默认 / Tesseract 轻量 ==========
// 标准引擎：@ocr-web/core（PP-OCRv5 ONNX），单线程 WASM，不依赖 COOP/COEP。
// 模型与 ORT wasm 从 jsDelivr 拉取，浏览器缓存；推理只在本机。
// 轻量引擎：Tesseract.js（按需加载 CDN）。标准引擎加载失败时自动改用轻量。
import { OcrEngine } from './vendor/ocr-web/index.js';
import * as ort from 'onnxruntime-web';

const dropEl = document.getElementById('ocr-drop');
const fileEl = document.getElementById('ocr-file');
const thumbEl = document.getElementById('ocr-thumb');
const placeholderEl = document.getElementById('ocr-placeholder');
const textEl = document.getElementById('ocr-text');
const statusEl = document.getElementById('ocr-status');
const copyEl = document.getElementById('ocr-copy');
const clearEl = document.getElementById('ocr-clear');
const progressEl = document.getElementById('ocr-progress');
const progressBarEl = document.getElementById('ocr-progress-bar');
const progressLabelEl = document.getElementById('ocr-progress-label');
const langsEl = document.getElementById('ocr-langs');
const hintEl = document.getElementById('ocr-hint');

const LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast';
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const ORT_WASM_PATHS = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';
const PADDLE_MODELS = {
    detection: 'https://cdn.jsdelivr.net/gh/bent2685/ocr-web@v0.1.1/models/ppocrv5_det.onnx',
    recognition: 'https://cdn.jsdelivr.net/gh/bent2685/ocr-web@v0.1.1/models/ppocrv5_rec.onnx',
    dictionary: 'https://cdn.jsdelivr.net/gh/bent2685/ocr-web@v0.1.1/models/ppocrv5_dict.txt'
};
const HINTS = {
    paddle: '印刷体/高清截图；手写、模糊、过小的代码截图仍会出错。标准引擎首次下载约 20MB 模型后会缓存，识别可能要几秒。',
    tesseract: '轻量引擎启动更快，中文截图更容易出错。首次会下载语言模型并缓存。'
};
const MIN_SIDE = 1200;
const MAX_SIDE = 4000;
const CONTRAST = 1.4;
const TESS_PARAMS = {
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
};
const PROGRESS_LABELS = {
    'loading tesseract core': '加载识别引擎',
    'initializing tesseract': '初始化引擎',
    'loading language traineddata': '下载语言模型（首次较慢，之后会缓存）',
    'loaded language traineddata': '语言模型已就绪',
    'initializing api': '准备识别',
    'initialized api': '引擎已就绪',
    'recognizing text': '正在识别',
    preprocessing: '正在增强图片',
    'loading paddle models': '下载 PaddleOCR 模型（首次较慢，之后会缓存）',
    'init paddle runtime': '初始化识别引擎',
    'paddle recognizing': '正在识别'
};

let currentFile = null;
let objectUrl = '';
let worker = null;
let workerLang = '';
let runId = 0;
let tesseractLoadPromise = null;
let paddleEngine = null;
let paddleLoadPromise = null;
let paddleLoadFailed = false;

if (ort && ort.env && ort.env.wasm) {
    ort.env.wasm.wasmPaths = ORT_WASM_PATHS;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
}

function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
}

function selectedEngine() {
    const checked = document.querySelector('input[name="ocr-engine"]:checked');
    return (checked && checked.value) || 'paddle';
}

function selectedLang() {
    const checked = document.querySelector('input[name="ocr-lang"]:checked');
    return (checked && checked.value) || 'chi_sim';
}

function syncEngineUi() {
    const engine = selectedEngine();
    if (langsEl) langsEl.hidden = engine !== 'tesseract';
    if (hintEl) hintEl.textContent = HINTS[engine] || HINTS.paddle;
}

function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(png|jpe?g|gif|webp|bmp|tif{1,2})$/i.test(file.name || '');
}

function clipboardImage(clipboard) {
    if (!clipboard) return null;
    const fromFiles = clipboard.files && clipboard.files[0];
    if (fromFiles && isImageFile(fromFiles)) return fromFiles;
    const items = clipboard.items;
    if (!items) return null;
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || !item.type || item.type.indexOf('image/') !== 0) continue;
        const asFile = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
        if (asFile) return asFile;
    }
    return null;
}

function progressText(message) {
    const status = (message && message.status) || '';
    const mapped = PROGRESS_LABELS[status] || status || '处理中';
    const ratio = typeof (message && message.progress) === 'number' ? message.progress : null;
    const showPct = status.indexOf('loading language') !== -1
        || status === 'recognizing text'
        || status.indexOf('loading tesseract') !== -1
        || status === 'preprocessing'
        || status === 'loading paddle models';
    if (ratio === null || !showPct) {
        return mapped;
    }
    if (ratio <= 0) {
        return mapped + '…';
    }
    return mapped + ' ' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
}

function showProgress(message) {
    progressEl.hidden = false;
    const ratio = typeof (message && message.progress) === 'number' ? message.progress : 0;
    progressBarEl.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
    progressLabelEl.textContent = progressText(message);
}

function hideProgress() {
    progressEl.hidden = true;
    progressBarEl.style.width = '0';
    progressLabelEl.textContent = '';
}

function previewFile(file) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    thumbEl.src = objectUrl;
    thumbEl.hidden = false;
    placeholderEl.hidden = true;
}

function resetPreview() {
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
    }
    thumbEl.removeAttribute('src');
    thumbEl.hidden = true;
    placeholderEl.hidden = false;
}

function loadImage(file) {
    return new Promise(function (resolve, reject) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function () {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error('无法读取图片'));
        };
        img.src = url;
    });
}

function otsuThreshold(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i += 1) sum += i * hist[i];
    let sumB = 0;
    let wB = 0;
    let max = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t += 1) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > max) {
            max = between;
            threshold = t;
        }
    }
    return threshold;
}

async function preprocessImage(file) {
    const img = await loadImage(file);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const minSide = Math.min(srcW, srcH);
    let scale = 1;
    if (minSide < MIN_SIDE) {
        scale = Math.min(4, Math.max(2, MIN_SIDE / minSide));
    }
    let width = Math.round(srcW * scale);
    let height = Math.round(srcH * scale);
    const longSide = Math.max(width, height);
    if (longSide > MAX_SIDE) {
        const cap = MAX_SIDE / longSide;
        width = Math.max(1, Math.round(width * cap));
        height = Math.max(1, Math.round(height * cap));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const n = width * height;
    const gray = new Uint8ClampedArray(n);
    const hist = new Uint32Array(256);
    const intercept = 128 * (1 - CONTRAST);
    let light = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        let v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        v = CONTRAST * v + intercept;
        if (v < 0) v = 0;
        else if (v > 255) v = 255;
        const g = v < 0 ? 0 : v > 255 ? 255 : (v + 0.5) | 0;
        gray[p] = g;
        hist[g] += 1;
        if (g >= 240) light += 1;
    }

    const sharpened = new Uint8ClampedArray(n);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const idx = y * width + x;
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                sharpened[idx] = gray[idx];
                continue;
            }
            const center = gray[idx] * 5
                - gray[idx - 1]
                - gray[idx + 1]
                - gray[idx - width]
                - gray[idx + width];
            sharpened[idx] = center < 0 ? 0 : center > 255 ? 255 : center;
        }
    }

    const screenshotLike = light / n > 0.35;
    if (screenshotLike) {
        const t = otsuThreshold(hist, n);
        for (let p = 0; p < n; p += 1) {
            const v = sharpened[p] > t ? 255 : 0;
            const i = p * 4;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
        }
    } else {
        for (let p = 0; p < n; p += 1) {
            const v = sharpened[p];
            const i = p * 4;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function loadTesseract() {
    if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
        return Promise.resolve(window.Tesseract);
    }
    if (tesseractLoadPromise) return tesseractLoadPromise;
    tesseractLoadPromise = new Promise(function (resolve, reject) {
        const script = document.createElement('script');
        script.src = TESSERACT_SRC;
        script.async = true;
        script.onload = function () {
            if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
                resolve(window.Tesseract);
            } else {
                tesseractLoadPromise = null;
                reject(new Error('未能加载 Tesseract.js，请检查网络后刷新'));
            }
        };
        script.onerror = function () {
            tesseractLoadPromise = null;
            reject(new Error('未能加载 Tesseract.js，请检查网络后刷新'));
        };
        document.head.appendChild(script);
    });
    return tesseractLoadPromise;
}

async function ensureTessWorker(lang) {
    await loadTesseract();
    if (!window.Tesseract || typeof window.Tesseract.createWorker !== 'function') {
        throw new Error('未能加载 Tesseract.js，请检查网络后刷新');
    }
    if (worker && workerLang === lang) return worker;
    if (worker) {
        try {
            await worker.terminate();
        } catch (err) {
            /* 忽略旧 worker 结束失败 */
        }
        worker = null;
        workerLang = '';
    }
    worker = await window.Tesseract.createWorker(lang, 1, {
        langPath: LANG_PATH,
        logger: showProgress
    });
    if (typeof worker.setParameters === 'function') {
        await worker.setParameters(TESS_PARAMS);
    }
    workerLang = lang;
    return worker;
}

async function ensurePaddleEngine() {
    if (paddleEngine) return paddleEngine;
    if (paddleLoadFailed) {
        throw new Error('PaddleOCR 未能加载');
    }
    if (paddleLoadPromise) return paddleLoadPromise;

    const loadedByFile = { detection: 0, recognition: 0 };
    const totalByFile = { detection: 0, recognition: 0 };

    paddleLoadPromise = OcrEngine.create({
        models: {
            detection: PADDLE_MODELS.detection,
            recognition: PADDLE_MODELS.recognition
        },
        dictionary: PADDLE_MODELS.dictionary,
        runtime: 'wasm',
        wasmPaths: ORT_WASM_PATHS,
        numThreads: 1,
        onProgress: function (p) {
            const file = p && p.file;
            if (file === 'detection' || file === 'recognition') {
                loadedByFile[file] = p.loaded || 0;
                totalByFile[file] = p.total || 0;
            }
            const loaded = loadedByFile.detection + loadedByFile.recognition;
            const total = totalByFile.detection + totalByFile.recognition;
            const ratio = total > 0 ? loaded / total : 0;
            showProgress({ status: 'loading paddle models', progress: Math.min(0.92, ratio) });
        }
    }).then(function (engine) {
        showProgress({ status: 'init paddle runtime', progress: 1 });
        paddleEngine = engine;
        return engine;
    }).catch(function (err) {
        paddleLoadFailed = true;
        paddleLoadPromise = null;
        throw err;
    });

    return paddleLoadPromise;
}

function switchToTesseract() {
    const input = document.querySelector('input[name="ocr-engine"][value="tesseract"]');
    if (input) input.checked = true;
    syncEngineUi();
}

async function recognizeWithPaddle(file) {
    showProgress({ status: 'loading paddle models', progress: 0.04 });
    const engine = await ensurePaddleEngine();
    showProgress({ status: 'paddle recognizing', progress: 0.55 });
    const result = await engine.recognize(file);
    return ((result && result.fullText) || '').trim();
}

async function recognizeWithTesseract(file) {
    const lang = selectedLang();
    showProgress({ status: 'preprocessing', progress: 0.08 });
    let payload = file;
    try {
        payload = await preprocessImage(file);
    } catch (preErr) {
        payload = file;
    }
    showProgress({ status: 'loading tesseract core', progress: 0.12 });
    const engine = await ensureTessWorker(lang);
    const result = await engine.recognize(payload);
    return ((result && result.data && result.data.text) || '').trim();
}

async function recognize(file) {
    if (!file || !isImageFile(file)) {
        if (typeof showToast === 'function') showToast('请选择图片', 'error');
        return;
    }
    currentFile = file;
    previewFile(file);
    const thisRun = ++runId;
    const label = file.name || '剪贴板图片';
    const engine = selectedEngine();
    setStatus('正在识别 ' + label);
    try {
        let text = '';
        if (engine === 'paddle') {
            try {
                text = await recognizeWithPaddle(file);
            } catch (paddleErr) {
                if (thisRun !== runId) return;
                if (!paddleEngine && paddleLoadFailed) {
                    switchToTesseract();
                    if (typeof showToast === 'function') {
                        showToast('标准引擎未能加载，已改用轻量引擎', 'info', 3200);
                    }
                    setStatus('标准引擎失败，改用轻量识别 ' + label);
                    text = await recognizeWithTesseract(file);
                } else {
                    throw paddleErr;
                }
            }
        } else {
            text = await recognizeWithTesseract(file);
        }
        if (thisRun !== runId) return;
        textEl.value = text;
        setStatus('已识别 · ' + label);
        if (typeof showToast === 'function') showToast('识别完成', 'success');
    } catch (err) {
        if (thisRun !== runId) return;
        setStatus('识别失败');
        if (typeof showToast === 'function') showToast((err && err.message) || '识别失败', 'error');
    } finally {
        if (thisRun === runId) hideProgress();
    }
}

syncEngineUi();

fileEl.addEventListener('change', function () {
    const file = fileEl.files && fileEl.files[0];
    fileEl.value = '';
    if (file) recognize(file);
});

dropEl.addEventListener('click', function (event) {
    if (event.target.closest('a, button, input, label')) return;
    fileEl.click();
});

dropEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileEl.click();
    }
});

['dragenter', 'dragover'].forEach(function (type) {
    dropEl.addEventListener(type, function (event) {
        event.preventDefault();
        dropEl.classList.add('is-dragover');
    });
});
['dragleave', 'drop'].forEach(function (type) {
    dropEl.addEventListener(type, function (event) {
        event.preventDefault();
        if (type === 'dragleave' && dropEl.contains(event.relatedTarget)) return;
        dropEl.classList.remove('is-dragover');
    });
});
dropEl.addEventListener('drop', function (event) {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) recognize(file);
});

document.addEventListener('paste', function (event) {
    const file = clipboardImage(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    recognize(file);
});

document.querySelectorAll('input[name="ocr-engine"]').forEach(function (input) {
    input.addEventListener('change', function () {
        syncEngineUi();
        if (currentFile) recognize(currentFile);
    });
});

document.querySelectorAll('input[name="ocr-lang"]').forEach(function (input) {
    input.addEventListener('change', function () {
        if (currentFile && selectedEngine() === 'tesseract') recognize(currentFile);
    });
});

copyEl.addEventListener('click', function () {
    const text = textEl.value;
    if (!text) {
        if (typeof showToast === 'function') showToast('没有可复制的文本', 'info');
        return;
    }
    if (typeof copyToClipboard === 'function') {
        copyToClipboard(text, '已复制');
    }
});

clearEl.addEventListener('click', function () {
    runId += 1;
    currentFile = null;
    textEl.value = '';
    resetPreview();
    hideProgress();
    setStatus('尚未选择图片');
});
