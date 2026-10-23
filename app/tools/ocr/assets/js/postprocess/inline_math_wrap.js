/** 行内统计公式补包 E(...)/Var(...)/P(...)。对应 img2doc postprocess/inline_math_wrap.py */
import { PROTECT_RE, mapUnprotected } from './protect.js';

const FN_RE = /(?<![A-Za-z\\])(E|Var|P)\(([A-Za-z0-9+\-*/=<>.,_|^\s\\]+)\)/g;

function wrapSegment(text) {
  if (!text) return text;
  return text.replace(FN_RE, (full, name, inner) => {
    if (!inner.trim()) return full;
    if (!/[A-Za-z0-9]/.test(inner)) return full;
    return `$${name}(${inner})$`;
  });
}

export function wrapInlineStatsMath(md) {
  return mapUnprotected(md, PROTECT_RE, wrapSegment);
}
