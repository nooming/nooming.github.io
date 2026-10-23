/** 中英文标点规范。对应 img2doc postprocess/punct_norm.py */
import { PROTECT_RE_PUNCT, mapUnprotected } from './protect.js';

const CJK_LETTER_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff\u2e80-\u2eff]/;
const ALNUM_RE = /[A-Za-z0-9]/

const DECIMAL_DOT_PAREN_RE = /(?<num>\d+\.\d+)\.\s*(?<open>[（(])(?<sub>\d{1,3})(?<close>[）)])/g;
const INT_PERIOD_AFTER_RE = /(?<![.\d])(?<num>\d+)。(?<ws>\s*)(?<after>[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff\u2e80-\u2eff]|[（(])/g;
const LATIN_FORMULA_BODY_RE = /^[A-Za-z0-9+\-*/=^_.,\\{}\s<>|!~]+$/;
const LATIN_PAREN_RE = /([（(])([A-Za-z0-9+\-*/=^_.,\\{}\s<>|!~]{1,80})([）)])/g;
const ENUM_PAREN_MISMATCH_RE = /([（(])(\d{1,3})([）)])/g;
const CJK_TOPIC_ENUM_PAREN_RE = /(?:^|(?<=[。！？；\n]))(?<ws>[ \t]*)\((?<num>\d{1,3})\)(?=[ \t]*[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\u31f0-\u31ff\u2e80-\u2eff])/gm;

const ASCII_TO_CJK = {
  ',': '，',
  ';': '；',
  ':': '：',
  '!': '！',
  '?': '？',
  '(': '（',
  ')': '）'
};

const CJK_TO_ASCII = {
  '，': ',',
  '。': '.',
  '；': ';',
  '：': ':',
  '！': '!',
  '？': '?',
  '（': '(',
  '）': ')'
};

function isCjk(ch) {
  return Boolean(ch) && CJK_LETTER_RE.test(ch);
}

function isAlnum(ch) {
  return Boolean(ch) && ALNUM_RE.test(ch);
}

function isPunct(ch) {
  if (!ch || /\s/.test(ch) || isAlnum(ch) || isCjk(ch)) return false;
  return true;
}

function prevSignificant(text, i) {
  let j = i - 1;
  while (j >= 0) {
    const ch = text[j];
    if (!/\s/.test(ch)) return ch;
    j -= 1;
  }
  return null;
}

function nextSignificant(text, i) {
  let j = i + 1;
  const n = text.length;
  while (j < n) {
    const ch = text[j];
    if (!/\s/.test(ch)) return ch;
    j += 1;
  }
  return null;
}

function prevLang(text, i) {
  let j = i - 1;
  while (j >= 0) {
    const ch = text[j];
    if (/\s/.test(ch) || isPunct(ch)) {
      j -= 1;
      continue;
    }
    return ch;
  }
  return null;
}

function nextLang(text, i) {
  let j = i + 1;
  const n = text.length;
  while (j < n) {
    const ch = text[j];
    if (/\s/.test(ch) || isPunct(ch)) {
      j += 1;
      continue;
    }
    return ch;
  }
  return null;
}

function restoreDecimalDotParen(text) {
  return text.replace(DECIMAL_DOT_PAREN_RE, (...args) => {
    const groups = args[args.length - 1];
    const openCh = groups.open;
    const openOut = openCh === '（' ? '（' : '(';
    const closeOut = openCh === '（' ? '）' : ')';
    return `${groups.num}。${openOut}${groups.sub}${closeOut}`;
  });
}

function fixIntTopicPeriod(text) {
  return text.replace(INT_PERIOD_AFTER_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.num}. ${groups.after}`;
  });
}

function fixEnumParenMismatch(text) {
  return text.replace(ENUM_PAREN_MISMATCH_RE, (full, openCh, body, closeCh) => {
    if (openCh === '(' && closeCh === ')') return full;
    if (openCh === '（' && closeCh === '）') return full;
    if (openCh === '(') return `(${body})`;
    return `（${body}）`;
  });
}

function fixCjkTopicEnumParens(text) {
  return text.replace(CJK_TOPIC_ENUM_PAREN_RE, (...args) => {
    const groups = args[args.length - 1];
    return `${groups.ws}（${groups.num}）`;
  });
}

function fixLatinFormulaParens(text) {
  return text.replace(LATIN_PAREN_RE, (full, openCh, body, closeCh) => {
    const stripped = body.trim();
    if (/^\d{1,3}$/.test(stripped)) return full;
    if (!LATIN_FORMULA_BODY_RE.test(body)) return full;
    if (!/[A-Za-z]/.test(body) && !/\d\s*[+\-*/=^]/.test(body)) return full;
    if (openCh === '(' && closeCh === ')') return full;
    return `(${body})`;
  });
}

function isEnumParenChar(text, i) {
  const ch = text[i];
  if (ch === '(' || ch === '（') {
    return /^[（(]\d{1,3}[）)]/.test(text.slice(i));
  }
  if (ch === ')' || ch === '）') {
    let j = i - 1;
    while (j >= 0 && /\d/.test(text[j])) j -= 1;
    const digits = i - j - 1;
    if (digits < 1 || digits > 3) return false;
    return j >= 0 && (text[j] === '(' || text[j] === '（');
  }
  return false;
}

function periodAfterDecimal(text, i) {
  if (i < 1 || !/\d/.test(text[i - 1])) return false;
  let j = i - 1;
  while (j >= 0 && /\d/.test(text[j])) j -= 1;
  return j >= 0 && text[j] === '.';
}

function isTopicIntPeriod(text, i) {
  if (periodAfterDecimal(text, i)) return false;
  if (i < 1 || !/\d/.test(text[i - 1])) return false;
  let j = i - 1;
  while (j >= 0 && /\d/.test(text[j])) j -= 1;
  if (j >= 0 && text[j] === '.') return false;
  let k = i + 1;
  const n = text.length;
  while (k < n && (text[k] === ' ' || text[k] === '\t')) k += 1;
  if (k >= n) return false;
  const ch = text[k];
  return isCjk(ch) || ch === '(' || ch === '（';
}

function inNumberContext(text, i, ch) {
  const left = i > 0 ? text[i - 1] : '';
  const right = i + 1 < text.length ? text[i + 1] : '';
  if (',.，。'.includes(ch)) {
    if (/\d/.test(left) && /\d/.test(right)) return true;
  }
  return false;
}

function decideSide(left, right) {
  const leftCjk = isCjk(left);
  const rightCjk = isCjk(right);
  const leftAl = isAlnum(left);
  const rightAl = isAlnum(right);

  if (leftCjk && rightCjk) return 'cjk';
  if (leftAl && rightAl) return 'ascii';
  if (leftCjk && rightAl) return 'cjk';
  if (leftAl && rightCjk) return 'cjk';
  if (leftCjk || rightCjk) return 'cjk';
  if (leftAl || rightAl) return 'ascii';
  return null;
}

function normQuotes(text) {
  const chars = text.split('');
  const n = chars.length;
  let i = 0;
  let openDq = true;
  while (i < n) {
    const ch = chars[i];
    if (ch === '"') {
      const left = prevSignificant(text, i);
      const right = nextSignificant(text, i);
      const side = decideSide(left, right);
      if (side === 'cjk') {
        chars[i] = openDq ? '“' : '”';
        openDq = !openDq;
      }
    } else if (ch === '“') {
      openDq = false;
    } else if (ch === '”') {
      openDq = true;
    }
    i += 1;
  }

  i = 0;
  let openSq = true;
  let rebuilt = chars.join('');
  while (i < n) {
    const ch = chars[i];
    if (ch === "'") {
      const left = i > 0 ? rebuilt[i - 1] : '';
      const right = i + 1 < n ? rebuilt[i + 1] : '';
      if (/[A-Za-z]/.test(left) && /[A-Za-z]/.test(right)) {
        i += 1;
        continue;
      }
      const leftS = prevSignificant(rebuilt, i);
      const rightS = nextSignificant(rebuilt, i);
      const side = decideSide(leftS, rightS);
      if (side === 'cjk') {
        chars[i] = openSq ? '‘' : '’';
        openSq = !openSq;
        rebuilt = chars.join('');
      }
    } else if (ch === '‘') {
      openSq = false;
    } else if (ch === '’') {
      openSq = true;
    }
    i += 1;
  }
  return chars.join('');
}

function normSegment(text) {
  if (!text) return text;
  text = restoreDecimalDotParen(text);
  text = fixIntTopicPeriod(text);
  text = fixEnumParenMismatch(text);
  text = fixCjkTopicEnumParens(text);

  const out = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (text.startsWith('...', i) || text.startsWith('…', i)) {
      if (text.startsWith('...', i)) {
        out.push('...');
        i += 3;
      } else {
        out.push('…');
        i += 1;
      }
      continue;
    }

    if ('()（）'.includes(ch) && isEnumParenChar(text, i)) {
      out.push(ch);
      i += 1;
      continue;
    }

    if ('.。'.includes(ch) && isTopicIntPeriod(text, i)) {
      out.push('.');
      i += 1;
      if (i < n && text[i] !== ' ' && text[i] !== '\t' && (isCjk(text[i]) || text[i] === '(' || text[i] === '（')) {
        out.push(' ');
      }
      continue;
    }

    if ('.。'.includes(ch) && periodAfterDecimal(text, i)) {
      out.push('。');
      i += 1;
      continue;
    }

    const left = prevLang(text, i);
    const right = nextLang(text, i);

    if (ch in ASCII_TO_CJK || ch === '.') {
      if (inNumberContext(text, i, ch)) {
        out.push(ch);
        i += 1;
        continue;
      }
      const side = decideSide(left, right);
      if (side === 'cjk') {
        out.push(ch === '.' ? '。' : ASCII_TO_CJK[ch] || ch);
      } else {
        out.push(ch);
      }
      i += 1;
      continue;
    }

    if (ch in CJK_TO_ASCII) {
      if (inNumberContext(text, i, ch)) {
        out.push(ch);
        i += 1;
        continue;
      }
      const side = decideSide(left, right);
      if (side === 'ascii') {
        out.push(CJK_TO_ASCII[ch]);
      } else {
        out.push(ch);
      }
      i += 1;
      continue;
    }

    out.push(ch);
    i += 1;
  }

  text = fixLatinFormulaParens(out.join(''));
  return normQuotes(text);
}

export function normalizePunctuation(md) {
  return mapUnprotected(md, PROTECT_RE_PUNCT, normSegment);
}
