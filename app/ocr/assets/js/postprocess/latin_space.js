/** 拉丁粘连补空格。对应 img2doc postprocess/latin_space.py */
import { PROTECT_RE_LATIN, mapUnprotected } from './protect.js';

const WORDFREQ_URL = new URL('../../data/english_wordfreq.txt', import.meta.url);
const LATIN_RUN_RE = /[A-Za-z]{4,}/g;

/** @type {Record<string, number> | null} */
let cachedWordfreq = null;
/** @type {Promise<Record<string, number>> | null} */
let loadPromise = null;

function parseWordfreq(text) {
  /** @type {Record<string, number>} */
  const freq = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let w;
    let s;
    if (trimmed.includes('\t')) {
      const parts = trimmed.split('\t');
      w = parts[0];
      s = parts[1];
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      w = parts[0];
      s = parts[1];
    }
    const score = Number(s);
    if (!Number.isFinite(score)) continue;
    freq[w.toLowerCase()] = score;
  }
  return freq;
}

export async function getWordfreq() {
  if (cachedWordfreq) return cachedWordfreq;
  if (!loadPromise) {
    loadPromise = fetch(WORDFREQ_URL)
      .then((res) => {
        if (!res.ok) throw new Error('词表加载失败');
        return res.text();
      })
      .then((text) => {
        cachedWordfreq = parseWordfreq(text);
        return cachedWordfreq;
      })
      .catch(() => {
        loadPromise = null;
        cachedWordfreq = {};
        return cachedWordfreq;
      });
  }
  return loadPromise;
}

/** 供测试注入词表 */
export function setWordfreqForTest(freq) {
  cachedWordfreq = freq || {};
  loadPromise = Promise.resolve(cachedWordfreq);
}

export function segmentLatinToken(token, wordfreq) {
  if (!token || token.includes(' ')) return token;
  if (!/^[A-Za-z]+$/.test(token)) return token;
  const wf = wordfreq;
  if (!wf || !Object.keys(wf).length) return token;
  const lower = token.toLowerCase();
  const n = lower.length;
  const NEG = -Infinity;
  const bestScore = new Array(n + 1).fill(NEG);
  const bestPrev = new Array(n + 1).fill(-1);
  bestScore[0] = 0;

  const maxW = Math.min(24, n);
  for (let i = 0; i < n; i += 1) {
    if (bestScore[i] === NEG) continue;
    for (let length = 1; length <= maxW; length += 1) {
      const j = i + length;
      if (j > n) break;
      const piece = lower.slice(i, j);
      if (length === 1 && piece !== 'a' && piece !== 'i') continue;
      if (!(piece in wf)) continue;
      const score = bestScore[i] + wf[piece] + length * 30;
      if (score > bestScore[j]) {
        bestScore[j] = score;
        bestPrev[j] = i;
      }
    }
  }

  if (bestPrev[n] < 0) return token;

  const cuts = [];
  let idx = n;
  while (idx > 0) {
    const prev = bestPrev[idx];
    if (prev < 0) return token;
    cuts.push([prev, idx]);
    idx = prev;
  }
  cuts.reverse();
  return cuts.map(([a, b]) => token.slice(a, b)).join(' ');
}

function fixLatinInPlain(text, wordfreq) {
  return text.replace(LATIN_RUN_RE, (raw) => {
    const low = raw.toLowerCase();
    if (low in wordfreq) return raw;
    return segmentLatinToken(raw, wordfreq);
  });
}

export async function fixLatinSpaces(markdown, wordfreq) {
  if (!markdown) return markdown;
  const wf = wordfreq || (await getWordfreq());
  if (!wf || !Object.keys(wf).length) return markdown;
  return mapUnprotected(markdown, PROTECT_RE_LATIN, (seg) => fixLatinInPlain(seg, wf));
}
