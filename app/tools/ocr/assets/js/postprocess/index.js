/**
 * 识别正文后处理管线（浏览器侧）。
 * 顺序对齐 img2doc.postprocess_recognized_markdown，但跳过 md_struct_norm
 *（主要为 StructureV3 HTML 表 / Pandoc 题号服务，浏览器纯文本 OCR 收益有限）。
 *
 * 空格 → 拉丁 → 标点 → 公式补包 → 中英字母空格 → 表格数字
 */
import { collapseCjkSpaces, insertCjkLetterSpaces } from './cjk_space.js';
import { fixLatinSpaces } from './latin_space.js';
import { normalizePunctuation } from './punct_norm.js';
import { wrapInlineStatsMath } from './inline_math_wrap.js';
import { fixTableOcrDigits } from './table_digit.js';

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function postprocessRecognizedMarkdown(text) {
  let out = text || '';
  out = collapseCjkSpaces(out);
  out = await fixLatinSpaces(out);
  out = normalizePunctuation(out);
  out = wrapInlineStatsMath(out);
  out = insertCjkLetterSpaces(out);
  out = fixTableOcrDigits(out);
  return out;
}

export {
  collapseCjkSpaces,
  insertCjkLetterSpaces,
  fixLatinSpaces,
  normalizePunctuation,
  wrapInlineStatsMath,
  fixTableOcrDigits
};
