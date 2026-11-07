/*
 * 棋盘渲染层
 * ------------------------------------------------------------
 * - 与设备像素比（DPR）对齐，避免高分屏发虚
 * - 静态棋盘（木纹 / 网格 / 楚河汉界 / 兵炮位）预渲染到离屏画布，每帧只需一次 drawImage
 * - 棋子预栅格化为位图精灵，避免每帧重复解码 SVG
 * - 着法滑动动画、选中高亮、可走点、将军提示、键盘光标
 */
(function (root) {
    'use strict';
    const XQ = root.XQ = root.XQ || {};

    const PIECE_KEYS = ['rK', 'rA', 'rB', 'rN', 'rR', 'rC', 'rP', 'bK', 'bA', 'bB', 'bN', 'bR', 'bC', 'bP'];
    const PIECE_DIR = 'assets/lib/img/xiangqipieces/wikimedia/';
    const MOVE_EASING = 0.22; // 动画时长（秒）

    const BOARD_STYLE = {
        woodTop: '#d97a41',
        woodBottom: '#ad4a1b',
        glow: 'rgba(255, 226, 178, 0.20)',
        line: 'rgba(45, 21, 8, 0.86)',
        lineSoft: 'rgba(45, 21, 8, 0.55)',
        river: 'rgba(58, 25, 9, 0.82)',
        frame: 'rgba(255, 236, 205, 0.14)'
    };

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function clamp(value, min, max) {
        return value < min ? min : value > max ? max : value;
    }

    function now() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    function createBoardView(canvas, options) {
        options = options || {};
        const ctx = canvas.getContext('2d', { alpha: false });
        const images = {};
        const sprites = new Map();
        const state = {
            board: null,
            selected: null,
            legal: [],
            lastMove: null,
            check: null,
            cursor: null,
            hint: null
        };

        let metrics = null;
        let staticLayer = null;
        let frameHandle = 0;
        let needsDraw = true;
        let anim = null;
        let checkPulseStart = 0;
        let hintStart = 0;
        let dpr = 1;

        // ------------------------------------------------------------ 图片
        function loadImages() {
            const jobs = PIECE_KEYS.map(function (key) {
                return new Promise(function (resolve) {
                    const img = new Image();
                    img.decoding = 'async';
                    img.onload = function () {
                        images[key] = img;
                        sprites.clear();
                        invalidate();
                        resolve();
                    };
                    img.onerror = function () {
                        resolve(); // 失败时使用绘制兜底棋子
                    };
                    img.src = PIECE_DIR + key + '.svg';
                });
            });
            return Promise.all(jobs);
        }

        // ------------------------------------------------------------ 尺寸
        function measure() {
            const rect = canvas.getBoundingClientRect();
            const w = Math.max(1, Math.round(rect.width));
            const h = Math.max(1, Math.round(rect.height));
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            const margin = Math.max(6, Math.min(w, h) * 0.06);
            const cell = Math.min((w - margin * 2) / 9, (h - margin * 2) / 10);
            return {
                w: w,
                h: h,
                dpr: ratio,
                cell: cell,
                originX: (w - cell * 8) / 2,
                originY: (h - cell * 9) / 2
            };
        }

        function resize() {
            const next = measure();
            const sizeChanged = !metrics || metrics.w !== next.w || metrics.h !== next.h || metrics.dpr !== next.dpr;
            metrics = next;
            dpr = next.dpr;
            if (sizeChanged) {
                canvas.width = Math.max(1, Math.round(next.w * dpr));
                canvas.height = Math.max(1, Math.round(next.h * dpr));
                sprites.clear();
                buildStaticLayer();
            }
            invalidate();
        }

        // ------------------------------------------------------------ 静态层
        function buildStaticLayer() {
            const m = metrics;
            if (!m) return;
            if (!staticLayer) staticLayer = document.createElement('canvas');
            staticLayer.width = Math.round(m.w * dpr);
            staticLayer.height = Math.round(m.h * dpr);
            const g = staticLayer.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawBoard(g, m);
        }

        function drawBoard(g, m) {
            const { w, h, cell, originX, originY } = m;

            // 木纹底面
            const base = g.createLinearGradient(0, 0, w * 0.7, h);
            base.addColorStop(0, BOARD_STYLE.woodTop);
            base.addColorStop(0.55, '#c8642f');
            base.addColorStop(1, BOARD_STYLE.woodBottom);
            g.fillStyle = base;
            g.fillRect(0, 0, w, h);

            const glow = g.createRadialGradient(w * 0.42, h * 0.38, cell * 0.5, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
            glow.addColorStop(0, BOARD_STYLE.glow);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            g.fillStyle = glow;
            g.fillRect(0, 0, w, h);

            // 细木纹
            g.save();
            g.globalAlpha = 0.05;
            g.strokeStyle = '#3b190a';
            g.lineWidth = 1;
            let seed = 20240501;
            const rand = function () {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x7fffffff;
            };
            for (let i = 0; i < 46; i++) {
                const y = rand() * h;
                g.beginPath();
                g.moveTo(0, y);
                g.bezierCurveTo(w * 0.3, y + rand() * 6 - 3, w * 0.7, y + rand() * 6 - 3, w, y + rand() * 4 - 2);
                g.stroke();
            }
            g.restore();

            const gridW = cell * 8;
            const gridH = cell * 9;
            const left = originX;
            const top = originY;
            const right = originX + gridW;
            const bottom = originY + gridH;
            const lineWidth = Math.max(1, cell * 0.026);

            // 外框双线
            const frameOut = cell * 0.64;
            const frameIn = cell * 0.52;
            g.strokeStyle = 'rgba(45, 21, 8, 0.78)';
            g.lineWidth = Math.max(1.5, cell * 0.045);
            g.strokeRect(left - frameOut, top - frameOut, gridW + frameOut * 2, gridH + frameOut * 2);
            g.lineWidth = Math.max(1, cell * 0.018);
            g.strokeStyle = 'rgba(45, 21, 8, 0.55)';
            g.strokeRect(left - frameIn, top - frameIn, gridW + frameIn * 2, gridH + frameIn * 2);

            // 网格（纵线在楚河汉界处断开，仅两侧边线贯通）
            g.strokeStyle = BOARD_STYLE.line;
            g.lineWidth = lineWidth;
            g.lineCap = 'square';
            g.beginPath();
            for (let c = 0; c < 9; c++) {
                const x = Math.round(left + c * cell) + 0.5;
                if (c === 0 || c === 8) {
                    g.moveTo(x, top);
                    g.lineTo(x, bottom);
                } else {
                    g.moveTo(x, top);
                    g.lineTo(x, top + cell * 4);
                    g.moveTo(x, top + cell * 5);
                    g.lineTo(x, bottom);
                }
            }
            for (let r = 0; r < 10; r++) {
                const y = Math.round(top + r * cell) + 0.5;
                g.moveTo(left, y);
                g.lineTo(right, y);
            }
            g.stroke();

            // 九宫斜线
            g.lineWidth = Math.max(1, cell * 0.022);
            g.strokeStyle = BOARD_STYLE.lineSoft;
            g.beginPath();
            [[3, 0], [5, 0], [3, 7], [5, 7]].forEach(function (p) {
                const x1 = left + p[0] * cell, y1 = top + p[1] * cell;
                g.moveTo(x1, y1);
                g.lineTo(x1 + 2 * cell, y1 + 2 * cell);
                g.moveTo(x1 + 2 * cell, y1);
                g.lineTo(x1, y1 + 2 * cell);
            });
            g.stroke();

            // 楚河汉界
            const riverY = top + cell * 4.5;
            g.save();
            g.fillStyle = BOARD_STYLE.river;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const fontSize = cell * 0.62;
            g.font = '600 ' + fontSize + 'px "KaiTi", "STKaiti", "Kaiti SC", "Songti SC", "Noto Serif SC", serif';
            const drawSpaced = function (text, cx) {
                const spacing = cell * 0.16;
                const total = text.length * fontSize * 0.72 + (text.length - 1) * spacing;
                let x = cx - total / 2 + fontSize * 0.36;
                for (let i = 0; i < text.length; i++) {
                    g.fillText(text.charAt(i), x, riverY);
                    x += fontSize * 0.72 + spacing;
                }
            };
            drawSpaced('楚河', left + cell * 2);
            drawSpaced('漢界', left + cell * 6);
            g.restore();

            // 兵、炮位标记
            g.strokeStyle = BOARD_STYLE.line;
            g.lineWidth = Math.max(1, cell * 0.028);
            const marks = [
                [1, 2], [7, 2], [1, 7], [7, 7],
                [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
                [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]
            ];
            const gap = cell * 0.09;
            const len = cell * 0.16;
            marks.forEach(function (p) {
                const x = left + p[0] * cell;
                const y = top + p[1] * cell;
                const sides = [];
                if (p[0] > 0) sides.push(-1);
                if (p[0] < 8) sides.push(1);
                sides.forEach(function (sx) {
                    g.beginPath();
                    g.moveTo(x + sx * gap, y - gap);
                    g.lineTo(x + sx * (gap + len), y - gap);
                    g.moveTo(x + sx * gap, y - gap);
                    g.lineTo(x + sx * gap, y - gap - len);
                    g.moveTo(x + sx * gap, y + gap);
                    g.lineTo(x + sx * (gap + len), y + gap);
                    g.moveTo(x + sx * gap, y + gap);
                    g.lineTo(x + sx * gap, y + gap + len);
                    g.stroke();
                });
            });

            // 暗角
            const vignette = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(1, 'rgba(60, 20, 5, 0.28)');
            g.fillStyle = vignette;
            g.fillRect(0, 0, w, h);
        }

        // ------------------------------------------------------------ 棋子精灵
        function pieceKey(piece) {
            return piece.color + String(piece.type).toUpperCase();
        }

        function spriteFor(piece) {
            const key = pieceKey(piece);
            const px = Math.round(metrics.cell * dpr);
            const cacheKey = key + '@' + px;
            const cached = sprites.get(cacheKey);
            if (cached) return cached;

            const slot = Math.max(2, px);
            const canvasSprite = document.createElement('canvas');
            canvasSprite.width = slot;
            canvasSprite.height = slot;
            const g = canvasSprite.getContext('2d');
            const img = images[key];
            const diameter = slot * 0.86;
            const offset = (slot - diameter) / 2;

            g.save();
            g.shadowColor = 'rgba(45, 12, 0, 0.42)';
            g.shadowBlur = slot * 0.09;
            g.shadowOffsetY = slot * 0.045;
            if (img && img.complete && img.naturalWidth) {
                g.drawImage(img, offset, offset, diameter, diameter);
            } else {
                drawFallbackPiece(g, piece, offset + diameter / 2, offset + diameter / 2, diameter);
            }
            g.restore();

            const sprite = { canvas: canvasSprite, slot: slot };
            sprites.set(cacheKey, sprite);
            return sprite;
        }

        function drawFallbackPiece(g, piece, cx, cy, size) {
            const radius = size / 2;
            const gradient = g.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.2, cx, cy, radius);
            gradient.addColorStop(0, '#fbe9b6');
            gradient.addColorStop(0.7, '#e8c264');
            gradient.addColorStop(1, '#c99a3c');
            g.beginPath();
            g.arc(cx, cy, radius, 0, Math.PI * 2);
            g.fillStyle = gradient;
            g.fill();
            g.lineWidth = Math.max(1, size * 0.035);
            g.strokeStyle = piece.color === 'r' ? '#b3261e' : '#1b1b1b';
            g.stroke();
            g.beginPath();
            g.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
            g.lineWidth = Math.max(1, size * 0.018);
            g.stroke();
            g.fillStyle = piece.color === 'r' ? '#b3261e' : '#1b1b1b';
            g.font = '700 ' + Math.round(size * 0.52) + 'px "KaiTi", "STKaiti", "Kaiti SC", serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const names = { k: '帥', a: '仕', b: '相', n: '馬', r: '車', c: '炮', p: '兵' };
            const blackNames = { k: '將', a: '士', b: '象', n: '馬', r: '車', c: '炮', p: '卒' };
            const char = (piece.color === 'r' ? names : blackNames)[String(piece.type).toLowerCase()] || '';
            g.fillText(char, cx, cy + size * 0.03);
        }

        // ------------------------------------------------------------ 坐标
        function squareCenter(square) {
            const col = square.charCodeAt(0) - 97;
            const row = 9 - Number(square.charAt(1));
            return {
                x: metrics.originX + col * metrics.cell,
                y: metrics.originY + row * metrics.cell
            };
        }

        function squareAt(clientX, clientY) {
            if (!metrics) return null;
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const dx = (x - metrics.originX) / metrics.cell;
            const dy = (y - metrics.originY) / metrics.cell;
            const col = Math.round(dx);
            const row = Math.round(dy);
            if (col < 0 || col > 8 || row < 0 || row > 9) return null;
            // 允许一定容差，同时避免误触邻格
            if (Math.abs(dx - col) > 0.62 || Math.abs(dy - row) > 0.62) return null;
            return String.fromCharCode(97 + col) + (9 - row);
        }

        // ------------------------------------------------------------ 绘制
        function draw(t) {
            if (!metrics) resize();
            if (!metrics) return;
            const m = metrics;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, m.w, m.h);
            if (staticLayer) ctx.drawImage(staticLayer, 0, 0, m.w, m.h);

            drawCheckGlow(ctx, m, t);
            drawLastMove(ctx, m);
            drawLegalTargets(ctx, m);
            drawPieces(ctx, m, t);
            drawSelection(ctx, m, t);
            drawHint(ctx, m, t);
            drawCursor(ctx, m);
        }

        function drawCheckGlow(g, m, t) {
            if (!state.check) return;
            const pos = squareCenter(state.check);
            const elapsed = (t - checkPulseStart) / 1000;
            const pulse = elapsed < 1.8 ? 0.55 + 0.45 * Math.sin(elapsed * 12) : 0.75;
            const radius = m.cell * 0.62;
            const gradient = g.createRadialGradient(pos.x, pos.y, radius * 0.2, pos.x, pos.y, radius * 1.5);
            gradient.addColorStop(0, 'rgba(255, 70, 50, ' + (0.55 * pulse).toFixed(3) + ')');
            gradient.addColorStop(0.55, 'rgba(255, 60, 40, ' + (0.22 * pulse).toFixed(3) + ')');
            gradient.addColorStop(1, 'rgba(255, 60, 40, 0)');
            g.fillStyle = gradient;
            g.beginPath();
            g.arc(pos.x, pos.y, radius * 1.5, 0, Math.PI * 2);
            g.fill();
        }

        function drawLastMove(g, m) {
            if (!state.lastMove) return;
            const from = squareCenter(state.lastMove.from);
            const to = squareCenter(state.lastMove.to);
            const radius = m.cell * 0.5;
            g.save();
            // 起点淡环、终点亮环（都在棋子外缘之外，不会被棋子盖住）
            g.strokeStyle = 'rgba(255, 214, 64, 0.34)';
            g.lineWidth = Math.max(1.2, m.cell * 0.024);
            g.beginPath();
            g.arc(from.x, from.y, radius, 0, Math.PI * 2);
            g.stroke();
            g.strokeStyle = 'rgba(255, 214, 64, 0.72)';
            g.lineWidth = Math.max(1.6, m.cell * 0.032);
            g.beginPath();
            g.arc(to.x, to.y, radius, 0, Math.PI * 2);
            g.stroke();
            g.restore();
        }

        function drawLegalTargets(g, m) {
            if (!state.legal || !state.legal.length) return;
            g.save();
            for (let i = 0; i < state.legal.length; i++) {
                const target = state.legal[i];
                const pos = squareCenter(target.to);
                if (target.capture) {
                    g.strokeStyle = 'rgba(255, 80, 60, 0.95)';
                    g.lineWidth = Math.max(2, m.cell * 0.055);
                    g.beginPath();
                    g.arc(pos.x, pos.y, m.cell * 0.43, 0, Math.PI * 2);
                    g.stroke();
                } else {
                    g.fillStyle = 'rgba(30, 120, 40, 0.55)';
                    g.beginPath();
                    g.arc(pos.x, pos.y, m.cell * 0.12, 0, Math.PI * 2);
                    g.fill();
                }
            }
            g.restore();
        }

        function drawPieces(g, m, t) {
            const board = state.board;
            if (!board) return;
            const cell = m.cell;
            const movingTo = anim ? anim.to : null;

            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 9; col++) {
                    const piece = board[row][col];
                    if (!piece) continue;
                    const square = String.fromCharCode(97 + col) + (9 - row);
                    if (movingTo && square === movingTo) continue;
                    drawPieceAt(g, piece, m.originX + col * cell, m.originY + row * cell, cell);
                }
            }

            if (anim) {
                const progress = clamp((t - anim.start) / anim.duration, 0, 1);
                const eased = easeOutCubic(progress);
                const from = squareCenter(anim.from);
                const to = squareCenter(anim.to);
                if (anim.captured) {
                    const fade = clamp(1 - progress * 1.6, 0, 1);
                    const scale = 1 - 0.25 * progress;
                    g.save();
                    g.globalAlpha = fade;
                    drawPieceAt(g, anim.captured, to.x, to.y, cell, scale);
                    g.restore();
                }
                const x = from.x + (to.x - from.x) * eased;
                const y = from.y + (to.y - from.y) * eased;
                const lift = 1 + 0.05 * Math.sin(Math.PI * progress);
                drawPieceAt(g, anim.piece, x, y, cell, lift);
            }
        }

        function drawPieceAt(g, piece, cx, cy, cell, scale) {
            const sprite = spriteFor(piece);
            const size = cell * (scale || 1);
            g.drawImage(sprite.canvas, cx - size / 2, cy - size / 2, size, size);
        }

        function drawSelection(g, m) {
            if (!state.selected) return;
            const pos = squareCenter(state.selected);
            g.save();
            g.strokeStyle = 'rgba(255, 235, 120, 0.95)';
            g.lineWidth = Math.max(2, m.cell * 0.05);
            g.beginPath();
            g.arc(pos.x, pos.y, m.cell * 0.46, 0, Math.PI * 2);
            g.stroke();
            g.restore();
        }

        function drawHint(g, m, t) {
            if (!state.hint) return;
            const elapsed = (t - hintStart) / 1000;
            if (elapsed > 3.2) return;
            const from = squareCenter(state.hint.from);
            const to = squareCenter(state.hint.to);
            const alpha = 0.5 + 0.35 * Math.sin(elapsed * 5);
            const color = 'rgba(96, 232, 162, ' + alpha.toFixed(3) + ')';
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / length;
            const uy = dy / length;
            const head = m.cell * 0.17;
            const startX = from.x + ux * m.cell * 0.42;
            const startY = from.y + uy * m.cell * 0.42;
            const endX = to.x - ux * m.cell * 0.5;
            const endY = to.y - uy * m.cell * 0.5;

            g.save();
            g.strokeStyle = color;
            g.fillStyle = color;
            g.lineWidth = Math.max(2, m.cell * 0.05);
            g.lineCap = 'round';
            g.setLineDash([m.cell * 0.14, m.cell * 0.11]);
            g.beginPath();
            g.moveTo(startX, startY);
            g.lineTo(endX, endY);
            g.stroke();
            g.setLineDash([]);
            const angle = Math.atan2(uy, ux);
            g.beginPath();
            g.moveTo(endX + Math.cos(angle) * head * 0.4, endY + Math.sin(angle) * head * 0.4);
            g.lineTo(endX + Math.cos(angle + 2.5) * head, endY + Math.sin(angle + 2.5) * head);
            g.lineTo(endX + Math.cos(angle - 2.5) * head, endY + Math.sin(angle - 2.5) * head);
            g.closePath();
            g.fill();
            g.restore();
        }

        function drawCursor(g, m) {
            if (!state.cursor) return;
            const pos = squareCenter(state.cursor);
            g.save();
            g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            g.lineWidth = Math.max(1.5, m.cell * 0.03);
            g.setLineDash([m.cell * 0.1, m.cell * 0.08]);
            g.strokeRect(pos.x - m.cell * 0.46, pos.y - m.cell * 0.46, m.cell * 0.92, m.cell * 0.92);
            g.restore();
        }

        // ------------------------------------------------------------ 调度
        function frame(t) {
            frameHandle = 0;
            needsDraw = false;
            draw(t);
            if (anim && t - anim.start >= anim.duration) {
                const finished = anim;
                anim = null;
                draw(t);
                if (finished.onDone) finished.onDone();
            }
            const pulsing = state.check && t - checkPulseStart < 1800;
            const hinting = state.hint && t - hintStart < 3200;
            if (!!anim || pulsing || hinting || needsDraw) {
                frameHandle = requestAnimationFrame(frame);
            }
        }

        function invalidate() {
            needsDraw = true;
            if (!frameHandle) frameHandle = requestAnimationFrame(frame);
        }

        function prefersReducedMotion() {
            try {
                return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            } catch (err) {
                return false;
            }
        }

        function playMove(move, onDone) {
            // 尊重系统「减少动态效果」设置：直接落子
            if (prefersReducedMotion()) {
                anim = null;
                invalidate();
                if (onDone) onDone();
                return;
            }
            anim = {
                from: move.from,
                to: move.to,
                piece: move.piece,
                captured: move.captured || null,
                start: now(),
                duration: MOVE_EASING * 1000,
                onDone: onDone
            };
            invalidate();
        }

        function cancelMove() {
            if (anim) {
                anim = null;
                invalidate();
            }
        }

        // ------------------------------------------------------------ 对外接口
        const api = {
            loadImages: loadImages,
            setState: function (patch) {
                if (patch.check !== undefined && patch.check !== state.check) checkPulseStart = now();
                if (patch.hint !== undefined && patch.hint !== state.hint) hintStart = now();
                Object.assign(state, patch);
            },
            getState: function () { return state; },
            invalidate: invalidate,
            resize: resize,
            squareAt: squareAt,
            squareCenter: squareCenter,
            playMove: playMove,
            cancelMove: cancelMove,
            isAnimating: function () { return !!anim; },
            getMetrics: function () { return metrics; }
        };

        resize();
        return api;
    }

    XQ.createBoardView = createBoardView;
    XQ.PIECE_KEYS = PIECE_KEYS;
})(window);
