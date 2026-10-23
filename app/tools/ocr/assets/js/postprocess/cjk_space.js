/** 清多余中文空格；汉字与拉丁字母邻接补空格。对应 img2doc postprocess/cjk_space.py */
import { PROTECT_RE, mapUnprotected } from './protect.js';

const IDEOGRAPH_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff]/;
const CJK_PUNCT = new Set('，。；：！？、（）「」『』【】《》〈〉“”‘’…—·');
const ASCII_AS_CJK_PUNCT = new Set(',.;:!?()');
const HSPACE_RE = /[ \t\u3000]+/g;
const CJK_LETTER_GAP_RE = /([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff])([A-Za-z])/g;
const LETTER_CJK_GAP_RE = /([A-Za-z])([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff])/g;

function isIdeograph(ch) {
  return Boolean(ch) && IDEOGRAPH_RE.test(ch);
}

function isCjkPunctSide(ch) {
  if (!ch) return false;
  return CJK_PUNCT.has(ch) || ASCII_AS_CJK_PUNCT.has(ch);
}

function isAlnum(ch) {
  return Boolean(ch) && /[0-9A-Za-z]/.test(ch);
}

function isLineStart(text, i) {
  return i === 0 || text[i - 1] === '\n';
}

function collapseRun(left, right, original) {
  const leftCjk = isIdeograph(left);
  const rightCjk = isIdeograph(right);
  const leftPunct = isCjkPunctSide(left);
  const rightPunct = isCjkPunctSide(right);
  const leftAl = isAlnum(left);
  const rightAl = isAlnum(right);

  if (leftCjk && rightCjk) return '';
  if ((leftCjk && rightPunct) || (leftPunct && rightCjk)) return '';
  if (leftPunct && rightPunct) return '';
  if ((leftCjk && rightAl) || (leftAl && rightCjk)) return ' ';
  if (leftAl && rightAl) return ' ';
  return original;
}

function cleanSegment(text) {
  if (!text) return text;
  const out = [];
  let last = 0;
  HSPACE_RE.lastIndex = 0;
  let m;
  while ((m = HSPACE_RE.exec(text)) !== null) {
    out.push(text.slice(last, m.index));
    const run = m[0];
    const start = m.index;
    const end = m.index + run.length;
    if (isLineStart(text, start)) {
      out.push(run);
    } else {
      const left = start > 0 ? text[start - 1] : null;
      const right = end < text.length ? text[end] : null;
      out.push(collapseRun(left, right, run));
    }
    last = end;
  }
  out.push(text.slice(last));
  return out.join('');
}

export function collapseCjkSpaces(md) {
  return mapUnprotected(md, PROTECT_RE, cleanSegment);
}

function insertLetterSpacesSegment(text) {
  if (!text) return text;
  return text
    .replace(CJK_LETTER_GAP_RE, '$1 $2')
    .replace(LETTER_CJK_GAP_RE, '$1 $2');
}

export function insertCjkLetterSpaces(md) {
  return mapUnprotected(md, PROTECT_RE, insertLetterSpacesSegment);
}
