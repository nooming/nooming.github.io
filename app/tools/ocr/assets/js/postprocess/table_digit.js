/** 表格易混数字。对应 img2doc postprocess/table_digit.py */
import { PROTECT_RE_TABLE, mapUnprotected } from './protect.js';

const NUMERIC_CELL_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const ONE_LIKE = new Set(['一', 'l', 'I', '|', '丨']);
const ZERO_LIKE = new Set(['O', 'o']);
const PIPE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const HTML_TABLE_RE = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const HTML_ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const HTML_CELL_RE = /(<(?:td|th)\b[^>]*>)([\s\S]*?)(<\/(?:td|th)>)/gi;

function isNumericCell(raw) {
  return NUMERIC_CELL_RE.test(String(raw).trim());
}

function cellCore(raw) {
  return String(raw).trim();
}

function isOneLikeCell(raw) {
  return ONE_LIKE.has(cellCore(raw));
}

function isZeroLikeCell(raw) {
  return ZERO_LIKE.has(cellCore(raw));
}

function majorityNumeric(cells) {
  if (!cells.length) return false;
  let num = 0;
  for (const c of cells) {
    if (isNumericCell(c)) num += 1;
  }
  return num * 2 > cells.length;
}

function shouldFixConfused(rowCells, colCells) {
  return majorityNumeric(rowCells) || majorityNumeric(colCells);
}

function replaceConfusedCell(cell) {
  const core = cellCore(cell);
  if (ONE_LIKE.has(core)) {
    return cell.replace(core, '1');
  }
  if (ZERO_LIKE.has(core)) {
    return cell.replace(core, '0');
  }
  return null;
}

function fixPipeTables(text) {
  const lines = text.split('\n');
  let i = 0;
  const outLines = [];
  while (i < lines.length) {
    if (!PIPE_ROW_RE.test(lines[i])) {
      outLines.push(lines[i]);
      i += 1;
      continue;
    }
    const rows = [];
    const rawRows = [];
    while (i < lines.length && PIPE_ROW_RE.test(lines[i])) {
      const raw = lines[i];
      rawRows.push(raw);
      const m = raw.match(PIPE_ROW_RE);
      const cells = m[1].split('|');
      rows.push(cells);
      i += 1;
    }
    const ncols = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const cols = Array.from({ length: ncols }, () => []);
    for (const r of rows) {
      r.forEach((c, cI) => {
        cols[cI].push(c);
      });
    }
    const newRows = [];
    rows.forEach((cells, rI) => {
      const newCells = cells.map((cell, cI) => {
        if (
          (isOneLikeCell(cell) || isZeroLikeCell(cell))
          && shouldFixConfused(cells, cols[cI])
        ) {
          const replaced = replaceConfusedCell(cell);
          return replaced != null ? replaced : cell;
        }
        return cell;
      });
      const prefix = (rawRows[rI].match(/^(\s*)/) || ['', ''])[1];
      newRows.push(`${prefix}|${newCells.join('|')}|`);
    });
    outLines.push(...newRows);
  }
  return outLines.join('\n');
}

function fixHtmlTable(tableHtml) {
  const rowMatches = [...tableHtml.matchAll(new RegExp(HTML_ROW_RE.source, 'gi'))];
  if (!rowMatches.length) return tableHtml;

  const parsed = [];
  const cellTexts = [];
  for (const rm of rowMatches) {
    const parts = [...rm[1].matchAll(new RegExp(HTML_CELL_RE.source, 'gi'))];
    if (!parts.length) {
      parsed.push([]);
      cellTexts.push([]);
      continue;
    }
    const rowParts = parts.map((p) => [p[1], p[2], p[3]]);
    parsed.push(rowParts);
    cellTexts.push(rowParts.map((p) => p[1]));
  }

  const ncols = cellTexts.reduce((max, r) => Math.max(max, r.length), 0);
  const cols = Array.from({ length: ncols }, () => []);
  for (const r of cellTexts) {
    r.forEach((c, cI) => {
      cols[cI].push(c);
    });
  }

  const pieces = [];
  let last = 0;
  rowMatches.forEach((rm, rI) => {
    pieces.push(tableHtml.slice(last, rm.index));
    const rowInner = rm[1];
    if (!parsed[rI].length) {
      pieces.push(rm[0]);
      last = rm.index + rm[0].length;
      return;
    }
    const full = rm[0];
    const closeMatch = full.match(/<\/tr>$/i);
    const closeTr = closeMatch ? closeMatch[0] : '</tr>';
    const openTr = full.slice(0, full.length - rowInner.length - closeTr.length);
    const cellIter = [...rowInner.matchAll(new RegExp(HTML_CELL_RE.source, 'gi'))];
    const newInnerParts = [];
    let innerLast = 0;
    cellIter.forEach((cm, cI) => {
      newInnerParts.push(rowInner.slice(innerLast, cm.index));
      let openTd = cm[1];
      let body = cm[2];
      const closeTd = cm[3];
      if (
        (isOneLikeCell(body) || isZeroLikeCell(body))
        && shouldFixConfused(cellTexts[rI], cols[cI])
      ) {
        const replaced = replaceConfusedCell(body);
        if (replaced != null) body = replaced;
      }
      newInnerParts.push(openTd + body + closeTd);
      innerLast = cm.index + cm[0].length;
    });
    newInnerParts.push(rowInner.slice(innerLast));
    pieces.push(openTr + newInnerParts.join('') + closeTr);
    last = rm.index + rm[0].length;
  });
  pieces.push(tableHtml.slice(last));
  return pieces.join('');
}

function fixHtmlTables(text) {
  return text.replace(HTML_TABLE_RE, (m) => fixHtmlTable(m));
}

function fixSegment(text) {
  if (!text) return text;
  text = fixPipeTables(text);
  text = fixHtmlTables(text);
  return text;
}

export function fixTableOcrDigits(md) {
  return mapUnprotected(md, PROTECT_RE_TABLE, fixSegment);
}
