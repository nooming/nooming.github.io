// ========== Markdown 阅读 · 粘贴 / 打开 / 目录文档 ==========
(function () {
    const sourceEl = document.getElementById('md-source');
    const previewEl = document.getElementById('md-preview');
    const fileEl = document.getElementById('md-file');
    const dropEl = document.getElementById('md-drop');
    const catalogEl = document.getElementById('md-catalog');
    const statusEl = document.getElementById('md-status');
    const clearEl = document.getElementById('md-clear');

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
        previewEl.innerHTML = html || '<p class="md-placeholder">预览会出现在这里。</p>';
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
        }
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

    fileEl.addEventListener('change', function () {
        const file = fileEl.files && fileEl.files[0];
        readLocalFile(file);
        fileEl.value = '';
    });

    clearEl.addEventListener('click', function () {
        applyText('', '尚未打开文档', '');
        const url = new URL(window.location.href);
        url.searchParams.delete('doc');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    });

    ['dragenter', 'dragover'].forEach((type) => {
        dropEl.addEventListener(type, function (event) {
            event.preventDefault();
            dropEl.classList.add('is-dragover');
        });
    });
    ['dragleave', 'drop'].forEach((type) => {
        dropEl.addEventListener(type, function (event) {
            event.preventDefault();
            if (type === 'dragleave' && dropEl.contains(event.relatedTarget)) return;
            dropEl.classList.remove('is-dragover');
        });
    });
    dropEl.addEventListener('drop', function (event) {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        readLocalFile(file);
    });

    document.addEventListener('paste', function (event) {
        const clipboard = event.clipboardData;
        const file = clipboard && clipboard.files && clipboard.files[0];
        if (!file || !isMarkdownFile(file)) return;
        event.preventDefault();
        readLocalFile(file);
    });

    initCatalog();
})();
