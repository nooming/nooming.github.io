'use strict';

let ctx = null;
let W = 0, H = 0, STEP = 0;
let P = [];

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

function draw(p) {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  if (p >= 1) return;
  for (const q of P) {
    const local = clamp((p - q.d) / (1 - q.d || 1));
    const ee = ease(local), m = 1 - ee;
    const x = m * m * q.sx + 2 * m * ee * q.cx + ee * ee * q.tx;
    const y = m * m * q.sy + 2 * m * ee * q.cy + ee * ee * q.ty;
    const c = clamp((local - .45) / .5);
    const size = 2.1 + (STEP + .6 - 2.1) * ee;
    ctx.fillStyle = `rgb(${(q.sr + (q.tr - q.sr) * c) | 0},${(q.sg + (q.tg - q.sg) * c) | 0},${(q.sb + (q.tb - q.sb) * c) | 0})`;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
}

self.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'init') {
    W = data.W;
    H = data.H;
    STEP = data.step;
    P = data.P;
    const canvas = data.canvas;
    canvas.width = Math.round(W * data.ratio);
    canvas.height = Math.round(H * data.ratio);
    ctx = canvas.getContext('2d');
    ctx.setTransform(data.ratio, 0, 0, data.ratio, 0, 0);
    draw(0);
  } else if (data.type === 'draw') {
    draw(data.p);
  } else if (data.type === 'clear') {
    if (ctx) ctx.clearRect(0, 0, W, H);
  }
};
