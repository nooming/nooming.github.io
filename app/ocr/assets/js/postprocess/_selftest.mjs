/**
 * Node 自检：对假文本跑后处理管线。
 * 用法（在 app/ocr 目录）：node --experimental-vm-modules assets/js/postprocess/_selftest.mjs
 * 或：node assets/js/postprocess/_selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setWordfreqForTest } from './latin_space.js';
import {
  postprocessRecognizedMarkdown,
  normalizePunctuation,
  wrapInlineStatsMath,
  insertCjkLetterSpaces,
  fixTableOcrDigits,
  collapseCjkSpaces
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wordfreqPath = join(__dirname, '../../data/english_wordfreq.txt');
const wordfreqText = readFileSync(wordfreqPath, 'utf8');
const freq = {};
for (const line of wordfreqText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [w, s] = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(/\s+/);
  const score = Number(s);
  if (w && Number.isFinite(score)) freq[w.toLowerCase()] = score;
}
setWordfreqForTest(freq);

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error('FAIL', label);
    console.error('  expected:', JSON.stringify(expected));
    console.error('  actual  :', JSON.stringify(actual));
    process.exitCode = 1;
    return;
  }
  console.log('ok', label);
}

function assertIncludes(hay, needle, label) {
  if (!hay.includes(needle)) {
    console.error('FAIL', label, 'missing', JSON.stringify(needle));
    console.error('  in:', JSON.stringify(hay));
    process.exitCode = 1;
    return;
  }
  console.log('ok', label);
}

assertEqual(collapseCjkSpaces('你 这 台'), '你这台', 'cjk spaces');
assertEqual(normalizePunctuation('(2)求2次'), '（2）求2次', '(2)求 → （2）求');
assertEqual(normalizePunctuation('试求E(2X-3）'), '试求E(2X-3)', 'formula paren');
assertEqual(
  wrapInlineStatsMath('试求E(2X-3)和$\\mathrm{Var}(2X-3)$'),
  '试求$E(2X-3)$和$\\mathrm{Var}(2X-3)$',
  'inline math wrap'
);
assertEqual(insertCjkLetterSpaces('随机变量X的分布'), '随机变量 X 的分布', 'cjk-letter space');

const tableIn = '| X | -2 | 0 | 一 | 3 |\n| P | 0.2 | 0.4 | 0.1 | 0.3 |\n';
const tableOut = fixTableOcrDigits(tableIn);
assertIncludes(tableOut, '| 1 |', 'table 一→1');
assertEqual(tableOut.includes('| 一 |'), false, 'table no 一');

const pipeline = await postprocessRecognizedMarkdown(
  '你 好 , 世 界\n(2)求E(2X-3）\n随机变量X\n| X | -2 | 0 | 一 | 3 |\n| P | 0.2 | 0.4 | 0.1 | 0.3 |\n'
);
assertIncludes(pipeline, '你好，世界', 'pipeline cjk+punct');
assertIncludes(pipeline, '（2）求', 'pipeline topic enum');
assertIncludes(pipeline, '$E(2X-3)$', 'pipeline math wrap');
assertIncludes(pipeline, '随机变量 X', 'pipeline cjk letter');
assertIncludes(pipeline, '| 1 |', 'pipeline table digit');

if (process.exitCode) {
  console.error('\nselftest failed');
} else {
  console.log('\nselftest passed');
}
