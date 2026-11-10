'use strict';

let ctx = null;
let W = 0, H = 0, STEP = 0, RATIO = 1;
let P = [];
let TARGET = null;
let settled = null, sctx = null;
let tmp = null, tx = null;

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

function pageScale(r) {
  return Math.max(1, Math.pow(STEP, 1 - ease(clamp(r))));
}

function drawPage(r) {
  if (!TARGET) return;
  const b = pageScale(r);
  if (b <= 1.4) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(TARGET, 0, 0, TARGET.width, TARGET.height, 0, 0, W, H);
    return;
  }
  const c2 = Math.ceil(W / b), r2 = Math.ceil(H / b);
  tmp.width = c2; tmp.height = r2;
  tx.clearRect(0, 0, c2, r2);
  tx.imageSmoothingQuality = 'high';
  tx.drawImage(TARGET, 0, 0, TARGET.width, TARGET.height, 0, 0, c2, r2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, c2, r2, 0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
}

function drawParticles(p) {
  ctx.clearRect(0, 0, W, H);
  if (settled) ctx.drawImage(settled, 0, 0, W, H);
  for (const q of P) {
    const local = clamp((p - q.d) / (1 - q.d || 1));
    if (local >= 1) {
      if (!q.settled) {
        q.settled = true;
        sctx.fillStyle = `rgb(${q.tr | 0},${q.tg | 0},${q.tb | 0})`;
        const size = STEP + .6;
        sctx.fillRect(q.tx - size / 2, q.ty - size / 2, size, size);
      }
      continue;
    }
    if (local <= 0) continue;
    const ee = ease(local), m = 1 - ee;
    const x = m * m * q.sx + 2 * m * ee * q.cx + ee * ee * q.tx;
    const y = m * m * q.sy + 2 * m * ee * q.cy + ee * ee * q.ty;
    const c = clamp((local - .45) / .5);
    const size = 2.1 + (STEP + .6 - 2.1) * ee;
    ctx.fillStyle = `rgb(${(q.sr + (q.tr - q.sr) * c) | 0},${(q.sg + (q.tg - q.sg) * c) | 0},${(q.sb + (q.tb - q.sb) * c) | 0})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

function draw(p, r) {
  if (!ctx) return;
  if (p >= 1) {
    ctx.clearRect(0, 0, W, H);
    drawPage(r);
  } else {
    drawParticles(p);
  }
}

self.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'init') {
    W = data.W;
    H = data.H;
    STEP = data.step;
    RATIO = data.ratio;
    P = data.P;
    TARGET = data.target || null;
    const canvas = data.canvas;
    canvas.width = Math.round(W * RATIO);
    canvas.height = Math.round(H * RATIO);
    ctx = canvas.getContext('2d');
    ctx.setTransform(RATIO, 0, 0, RATIO, 0, 0);
    settled = new OffscreenCanvas(Math.round(W * RATIO), Math.round(H * RATIO));
    sctx = settled.getContext('2d');
    sctx.setTransform(RATIO, 0, 0, RATIO, 0, 0);
    tmp = new OffscreenCanvas(1, 1);
    tx = tmp.getContext('2d');
    draw(0, 0);
  } else if (data.type === 'draw') {
    draw(data.p, data.r);
  } else if (data.type === 'clear') {
    if (ctx) ctx.clearRect(0, 0, W, H);
  }
};
