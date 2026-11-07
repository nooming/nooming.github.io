// ========== 阅读长文 · 目录 / 进度 / 代码复制 ==========
// 页面只需提供 .article-body、#article-toc、#article-meta 三个挂载点。

(function () {
    'use strict';

    var body = document.querySelector('.article-body');
    if (!body) return;

    var tocHost = document.getElementById('article-toc');
    var metaHost = document.getElementById('article-meta');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- 目录 ---

    function collectEntries() {
        var headings = Array.prototype.slice.call(body.querySelectorAll('h2, h3'));

        // 步骤式长文（只有 1 个 h3）改用「步骤N」小标题做目录
        if (headings.length < 3) {
            headings = Array.prototype.slice.call(body.querySelectorAll('.article-step > strong'));
        }

        return headings.map(function (node, index) {
            var target = node.tagName === 'STRONG' ? node.parentElement : node;
            if (!target) return null;
            if (!target.id) target.id = 'article-sec-' + (index + 1);

            return {
                id: target.id,
                el: target,
                text: (node.textContent || '').trim()
            };
        }).filter(Boolean);
    }

    function buildToc(entries) {
        if (!tocHost) return;

        if (entries.length < 2) {
            tocHost.hidden = true;
            return;
        }

        var title = document.createElement('p');
        title.className = 'article-toc__title';
        title.textContent = '本文目录';

        tocHost.hidden = false;

        var list = document.createElement('ol');
        list.className = 'article-toc__list';

        entries.forEach(function (entry) {
            var item = document.createElement('li');
            var link = document.createElement('a');
            link.href = '#' + entry.id;
            link.textContent = entry.text;
            link.addEventListener('click', function (event) {
                event.preventDefault();
                entry.el.scrollIntoView({
                    behavior: reduceMotion ? 'auto' : 'smooth',
                    block: 'start'
                });
                history.replaceState(null, '', '#' + entry.id);
            });
            item.appendChild(link);
            list.appendChild(item);
        });

        tocHost.replaceChildren(title, list);
    }

    var entries = collectEntries();
    buildToc(entries);

    // --- 阅读进度条 ---

    var progress = document.createElement('div');
    progress.className = 'article-progress';
    progress.setAttribute('aria-hidden', 'true');

    var progressFill = document.createElement('div');
    progressFill.className = 'article-progress__fill';
    progress.appendChild(progressFill);
    document.body.appendChild(progress);

    function updateProgress() {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        progressFill.style.width = (ratio * 100).toFixed(2) + '%';
    }

    // --- 目录高亮 ---

    var links = tocHost ? Array.prototype.slice.call(tocHost.querySelectorAll('a')) : [];
    var activeId = '';

    function updateActive() {
        if (!entries.length) return;

        var offset = 120;
        var current = entries[0].id;
        entries.forEach(function (entry) {
            if (entry.el.getBoundingClientRect().top <= offset) current = entry.id;
        });
        if (current === activeId) return;

        activeId = current;
        links.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + current);
        });
    }

    var ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
            updateProgress();
            updateActive();
            ticking = false;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateProgress();
    updateActive();

    // --- 阅读时长 ---

    if (metaHost) {
        var text = (body.innerText || body.textContent || '').replace(/\s+/g, '');
        var minutes = Math.max(1, Math.round(text.length / 400));
        metaHost.textContent = '约 ' + text.length + ' 字 · 阅读约 ' + minutes + ' 分钟';
    }

    // --- 代码块复制 ---

    Array.prototype.forEach.call(body.querySelectorAll('.article-code'), function (block) {
        if (block.querySelector('.article-code__copy')) return;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'article-code__copy';
        button.textContent = '复制';

        button.addEventListener('click', function () {
            button.style.display = 'none';
            var code = (block.innerText || block.textContent || '').trim();
            button.style.display = '';

            if (typeof copyToClipboard === 'function') {
                copyToClipboard(code, '代码已复制');
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(code);
            }
        });

        block.appendChild(button);
    });
})();
