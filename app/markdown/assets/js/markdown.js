// ========== Markdown 阅读 · 粘贴 / 打开 / 目录文档 ==========
(function () {
    const sourceEl = document.getElementById('md-source');
    const previewEl = document.getElementById('md-preview');
    const previewInnerEl = document.getElementById('md-preview-inner');
    const fileEl = document.getElementById('md-file');
    const dropEl = document.getElementById('md-drop');
    const workspaceEl = document.getElementById('md-workspace');
    const catalogEl = document.getElementById('md-catalog');
    const statusEl = document.getElementById('md-status');
    const clearEl = document.getElementById('md-clear');
    const toggleEl = document.getElementById('md-toggle-source');

    const purifyConfig = {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick']
    };

    let catalog = [];
    let activeId = '';

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function isReading() {
        if (workspaceEl) return workspaceEl.classList.contains('is-source-collapsed');
        return document.body.classList.contains('is-md-reading');
    }

    function setReading(on) {
        document.body.classList.toggle('is-md-reading', on);
        if (workspaceEl) workspaceEl.classList.toggle('is-source-collapsed', on);
        if (!toggleEl) return;
        toggleEl.setAttribute('aria-pressed', on ? 'false' : 'true');
        toggleEl.classList.toggle('is-on', !on);
        toggleEl.textContent = '源码';
    }

    function setActive(id) {
        activeId = id || '';
        if (!catalogEl) return;
        catalogEl.querySelectorAll('.md-catalog-btn').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.docId === activeId);
        });
    }

    function renderMarkdown(text) {
        const raw = window.marked.parse(text || '', { async: false });
        const html = window.DOMPurify.sanitize(raw, purifyConfig);
        const inner = html || '<p class="md-placeholder">预览会出现在这里。</p>';
        if (previewInnerEl) {
            previewInnerEl.innerHTML = inner;
        } else {
            previewEl.innerHTML = '<div class="md-preview-body">' + inner + '</div>';
        }
    }

    function applyText(text, label, id) {
        sourceEl.value = text;
        renderMarkdown(text);
        setStatus(label || '已渲染');
        setActive(id);
    }

    function isMarkdownFile(file) {
        if (!file) return false;
        const name = file.name || '';
        if (/\.(md|markdown|txt)$/i.test(name)) return true;
        return !!(file.type && /markdown|text/.test(file.type));
    }

    function readLocalFile(file) {
        if (!file) return;
        const name = file.name || '本地文件';
        if (!isMarkdownFile(file)) {
            if (typeof showToast === 'function') showToast('请选择 .md 文件', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = function () {
            applyText(String(reader.result || ''), name, '');
            if (typeof showToast === 'function') showToast('已打开 ' + name, 'success');
        };
        reader.onerror = function () {
            if (typeof showToast === 'function') showToast('读取失败', 'error');
        };
        reader.readAsText(file, 'utf-8');
    }

    async function loadDoc(id, pushQuery) {
        const item = catalog.find((doc) => doc.id === id);
        if (!item) {
            setStatus('未找到文档：' + id);
            if (typeof showToast === 'function') showToast('目录里没有这个 id', 'error');
            return;
        }
        try {
            const res = await fetch(item.file, { cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const text = await res.text();
            applyText(text, item.title, item.id);
            setReading(true);
            if (pushQuery) {
                const url = new URL(window.location.href);
                url.searchParams.set('doc', item.id);
                window.history.replaceState(null, '', url.pathname + url.search + url.hash);
            }
        } catch (err) {
            setStatus('无法加载 ' + item.file);
            if (typeof showToast === 'function') showToast('加载目录文档失败', 'error');
        }
    }

    function renderCatalog() {
        if (!catalogEl) return;
        catalogEl.innerHTML = '';
        catalog.forEach((doc) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'md-catalog-btn';
            btn.dataset.docId = doc.id;
            btn.textContent = doc.title;
            btn.addEventListener('click', function () {
                loadDoc(doc.id, true);
            });
            catalogEl.appendChild(btn);
        });
    }

    async function initCatalog() {
        try {
            const res = await fetch('catalog.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            catalog = Array.isArray(data.docs) ? data.docs : [];
        } catch (err) {
            catalog = [];
        }
        renderCatalog();

        const params = new URLSearchParams(window.location.search);
        const docId = params.get('doc');
        if (docId) {
            await loadDoc(docId, false);
            return;
        }
        if (catalog[0]) {
            await loadDoc(catalog[0].id, false);
            return;
        }
        setReading(false);
    }

    const liveRender = typeof debounce === 'function'
        ? debounce(function () {
            renderMarkdown(sourceEl.value);
            setStatus('来自粘贴 / 编辑');
            setActive('');
        }, 180)
        : function () {
            renderMarkdown(sourceEl.value);
        };

    sourceEl.addEventListener('input', liveRender);

    if (toggleEl) {
        toggleEl.addEventListener('click', function () {
            setReading(!isReading());
        });
    }

    fileEl.addEventListener('change', function () {
        const file = fileEl.files && fileEl.files[0];
        readLocalFile(file);
        fileEl.value = '';
    });

    clearEl.addEventListener('click', function () {
        applyText('', '尚未打开文档', '');
        setReading(false);
        const url = new URL(window.location.href);
        url.searchParams.delete('doc');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    });

    function setDragover(on) {
        if (dropEl) dropEl.classList.toggle('is-dragover', on);
        if (workspaceEl) workspaceEl.classList.toggle('is-dragover', on);
    }

    function hasFiles(event) {
        const types = event.dataTransfer && event.dataTransfer.types;
        if (!types) return false;
        return Array.prototype.indexOf.call(types, 'Files') !== -1;
    }

    ['dragenter', 'dragover'].forEach((type) => {
        document.addEventListener(type, function (event) {
            if (!hasFiles(event)) return;
            event.preventDefault();
            setDragover(true);
        });
    });
    document.addEventListener('dragleave', function (event) {
        if (event.relatedTarget && document.contains(event.relatedTarget)) return;
        setDragover(false);
    });
    document.addEventListener('drop', function (event) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDragover(false);
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        readLocalFile(file);
    });

    document.addEventListener('paste', function (event) {
        const clipboard = event.clipboardData;
        const file = clipboard && clipboard.files && clipboard.files[0];
        if (file && isMarkdownFile(file)) {
            event.preventDefault();
            readLocalFile(file);
            return;
        }
        if (!isReading()) return;
        const target = event.target;
        if (target && typeof target.closest === 'function' && (target === sourceEl || target.closest('input, textarea, [contenteditable="true"]'))) {
            return;
        }
        const text = clipboard && clipboard.getData('text/plain');
        if (!text) return;
        event.preventDefault();
        applyText(text, '来自粘贴 / 编辑', '');
        if (typeof showToast === 'function') showToast('已粘贴并渲染', 'success');
    });

    initCatalog();
})();
