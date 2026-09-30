/** 最近识别结果（localStorage，限条数与单条长度） */
const STORAGE_KEY = 'ocr-recent-results-v1';
const MAX_ITEMS = 8;
const MAX_TEXT_CHARS = 80000;

/**
 * @typedef {{ id: string, label: string, text: string, at: number }} RecentItem
 */

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeStore(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (_err) {
    /* 配额满等：尽量丢掉更旧条目再试一次 */
    try {
      const trimmed = items.slice(0, Math.max(1, Math.floor(items.length / 2)));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_err2) {
      /* 忽略 */
    }
  }
}

function formatLabel(at, hint) {
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const name = (hint || '识别结果').slice(0, 28);
  return `${stamp} · ${name}`;
}

/**
 * @param {string} text
 * @param {string} [hint]
 * @returns {RecentItem[]}
 */
export function saveRecentResult(text, hint) {
  const body = String(text || '');
  if (!body.trim()) return readStore();
  const clipped = body.length > MAX_TEXT_CHARS ? body.slice(0, MAX_TEXT_CHARS) : body;
  const at = Date.now();
  /** @type {RecentItem} */
  const item = {
    id: `r-${at}-${Math.random().toString(36).slice(2, 8)}`,
    label: formatLabel(at, hint),
    text: clipped,
    at
  };
  const next = [item, ...readStore().filter((x) => x && x.text !== clipped)].slice(0, MAX_ITEMS);
  writeStore(next);
  return next;
}

/** @returns {RecentItem[]} */
export function listRecentResults() {
  return readStore().filter((x) => x && typeof x.text === 'string' && x.id);
}

/**
 * @param {string} id
 * @returns {RecentItem | null}
 */
export function getRecentResult(id) {
  return listRecentResults().find((x) => x.id === id) || null;
}
