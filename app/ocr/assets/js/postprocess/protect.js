/** 公式 / 代码 / 链接等保护区：后处理时原样保留。 */

export const PROTECT_RE = new RegExp(
  [
    '```[\\s\\S]*?```',
    '`[^`\\n]+`',
    '\\$\\$[\\s\\S]*?\\$\\$',
    '\\$[^$\\n]+\\$',
    '\\\\\\([\\s\\S]*?\\\\\\)',
    '\\\\\\[[\\s\\S]*?\\\\\\]',
    '!\\[[^\\]]*\\]\\([^)]*\\)',
    '\\[[^\\]]*\\]\\([^)]*\\)',
    'https?://[^\\s<>\\]]+',
    'www\\.[^\\s<>\\]]+',
    '<[^>]+>'
  ].join('|'),
  'gm'
);

/** 标点规范额外保护 Windows/相对路径 */
export const PROTECT_RE_PUNCT = new RegExp(
  [
    '```[\\s\\S]*?```',
    '`[^`\\n]+`',
    '\\$\\$[\\s\\S]*?\\$\\$',
    '\\$[^$\\n]+\\$',
    '\\\\\\([\\s\\S]*?\\\\\\)',
    '\\\\\\[[\\s\\S]*?\\\\\\]',
    '!\\[[^\\]]*\\]\\([^)]*\\)',
    '\\[[^\\]]*\\]\\([^)]*\\)',
    'https?://[^\\s<>\\]]+',
    'www\\.[^\\s<>\\]]+',
    '(?:[A-Za-z]:)?(?:[/\\\\][\\w.\\-]+)+',
    '<[^>]+>'
  ].join('|'),
  'gm'
);

/** 拉丁粘连：不保护 Markdown 链接正文（与源 latin_space 一致） */
export const PROTECT_RE_LATIN = new RegExp(
  [
    '```[\\s\\S]*?```',
    '`[^`\\n]+`',
    '\\$\\$[\\s\\S]*?\\$\\$',
    '\\$[^$\\n]+\\$',
    '\\\\\\([\\s\\S]*?\\\\\\)',
    '\\\\\\[[\\s\\S]*?\\\\\\]',
    '<[^>]+>',
    '!\\[[^\\]]*\\]\\([^)]*\\)'
  ].join('|'),
  'gm'
);

/** 表格数字：不保护裸 URL */
export const PROTECT_RE_TABLE = new RegExp(
  [
    '```[\\s\\S]*?```',
    '`[^`\\n]+`',
    '\\$\\$[\\s\\S]*?\\$\\$',
    '\\$[^$\\n]+\\$',
    '\\\\\\([\\s\\S]*?\\\\\\)',
    '\\\\\\[[\\s\\S]*?\\\\\\]',
    '!\\[[^\\]]*\\]\\([^)]*\\)',
    '\\[[^\\]]*\\]\\([^)]*\\)'
  ].join('|'),
  'gm'
);

/**
 * 对保护区之外的片段调用 fn，保护区原文拼接回去。
 * @param {string} md
 * @param {RegExp} protectRe
 * @param {(segment: string) => string} fn
 */
export function mapUnprotected(md, protectRe, fn) {
  if (!md) return md;
  const re = new RegExp(protectRe.source, protectRe.flags.includes('g') ? protectRe.flags : protectRe.flags + 'g');
  const parts = [];
  let last = 0;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) parts.push(fn(md.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < md.length) parts.push(fn(md.slice(last)));
  return parts.join('');
}
