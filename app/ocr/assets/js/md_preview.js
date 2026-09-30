/** Markdown + KaTeX 预览（编辑区内容 → HTML） */
const EMPTY_PREVIEW = '<p class="ocr-preview-placeholder">识别完成后可在此预览正文、表格与公式。</p>';

function looksLikeMath(t) {
  if (!t || t.length > 120) return false;
  if (/[\n\r]/.test(t)) return false;
  if (/[\\^_{}=<>]|\\[a-zA-Z]+|[±×÷∞∑∫√≤≥≠∈]/.test(t)) return true;
  if (/^[a-zA-Z]$/.test(t)) return true;
  if (/^[a-zA-Z0-9]+[_^]/.test(t)) return true;
  return false;
}

function prepareMathSource(md) {
  let s = md || '';
  const slots = [];
  const stash = (m) => {
    const i = slots.length;
    slots.push(m);
    return `@@OCR_MATH_${i}@@`;
  };
  s = s.replace(/\$\$[\s\S]*?\$\$/g, stash);
  s = s.replace(/\\\[[\s\S]*?\\\]/g, stash);
  s = s.replace(/\\\([\s\S]*?\\\)/g, stash);
  s = s.replace(/\$([^$\n]{1,120})\$/g, (full, inner) => {
    if (looksLikeMath(inner)) return stash(full);
    return full;
  });
  return { prepared: s, slots };
}

function restoreMathSource(html, slots) {
  return (html || '').replace(/@@OCR_MATH_(\d+)@@/g, (_, i) => {
    const idx = Number(i);
    return idx >= 0 && idx < slots.length ? slots[idx] : '';
  });
}

function sanitizeHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('script, iframe, object, embed, link[rel="import"]').forEach((el) => el.remove());
  tpl.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = String(attr.value || '');
      if (name.startsWith('on') || (name === 'href' && /^\s*javascript:/i.test(val))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return tpl.innerHTML;
}

/**
 * @param {HTMLElement} previewEl
 * @param {string} md
 */
export function renderMarkdownPreview(previewEl, md) {
  if (!previewEl) return;
  if (!md || !String(md).trim()) {
    previewEl.classList.add('is-empty');
    previewEl.innerHTML = EMPTY_PREVIEW;
    return;
  }
  if (typeof marked === 'undefined' || typeof marked.parse !== 'function') {
    previewEl.classList.remove('is-empty');
    previewEl.textContent = md;
    return;
  }
  marked.setOptions({ gfm: true, breaks: false });
  const { prepared, slots } = prepareMathSource(md);
  let html = marked.parse(prepared);
  html = restoreMathSource(html, slots);
  previewEl.classList.remove('is-empty');
  previewEl.innerHTML = sanitizeHtml(html);
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(previewEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      errorCallback: function (_msg, err) {
        if (err && err.name === 'ParseError') return;
      }
    });
    previewEl.querySelectorAll('.katex-error').forEach((el) => {
      if (!el.textContent) {
        el.textContent = el.getAttribute('title') || '[公式渲染失败]';
      }
    });
  }
}
