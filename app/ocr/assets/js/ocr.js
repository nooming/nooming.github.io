// ========== 图片识字 · 拖入 / 粘贴 / Tesseract.js ==========
// Tesseract.js 从 jsDelivr CDN 加载（tesseract.js@5）；worker + core 由库自行拉取。
// 语言模型 langPath 指向 tessdata 4.0.0_fast；首次下载后由 Tesseract 缓存在浏览器。
(function () {
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

    const LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast';
    const MIN_SIDE = 1200;
    const MAX_SIDE = 4000;
    const CONTRAST = 1.4;
    // PSM 6：单一文字块（截图/段落）；比默认 AUTO 更稳
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
        preprocessing: '正在增强图片'
    };

    let currentFile = null;
    let objectUrl = '';
    let worker = null;
    let workerLang = '';
    let runId = 0;

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function selectedLang() {
        const checked = document.querySelector('input[name="ocr-lang"]:checked');
        return (checked && checked.value) || 'chi_sim';
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
            || status === 'preprocessing';
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

    async function ensureWorker(lang) {
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

    async function recognize(file) {
        if (!file || !isImageFile(file)) {
            if (typeof showToast === 'function') showToast('请选择图片', 'error');
            return;
        }
        currentFile = file;
        previewFile(file);
        const thisRun = ++runId;
        const lang = selectedLang();
        const label = file.name || '剪贴板图片';
        setStatus('正在识别 ' + label);
        showProgress({ status: 'preprocessing', progress: 0.08 });
        try {
            let payload = file;
            try {
                payload = await preprocessImage(file);
            } catch (preErr) {
                payload = file;
            }
            if (thisRun !== runId) return;
            showProgress({ status: 'loading tesseract core', progress: 0.12 });
            const engine = await ensureWorker(lang);
            if (thisRun !== runId) return;
            const result = await engine.recognize(payload);
            if (thisRun !== runId) return;
            const text = (result && result.data && result.data.text) || '';
            textEl.value = text.trim();
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

    document.querySelectorAll('input[name="ocr-lang"]').forEach(function (input) {
        input.addEventListener('change', function () {
            if (currentFile) recognize(currentFile);
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
})();
