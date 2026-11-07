/*!
 * go-engine.js — 围棋规则与 AI 引擎（无依赖，可在浏览器与 Node 中运行）
 *
 * 规则：中国规则（面积计分）、禁止自杀、简单劫 + 全局同形再现（超级劫）、
 *       贴目默认 7.5、双方连续弃权终局。
 *
 * 该文件同时通过 <script> 暴露 window.GoEngine，并通过 module.exports 供测试使用。
 */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GoEngine = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var EMPTY = 0;
    var BLACK = 1;
    var WHITE = 2;
    var SIZES = [9, 13, 19];
    var DEFAULT_KOMI = 7.5;

    /* ------------------------------------------------------------------ *
     * 几何：预计算邻接表（按棋盘尺寸缓存）
     * ------------------------------------------------------------------ */

    var neighborCache = new Map();

    function neighborsFor(n) {
        var cached = neighborCache.get(n);
        if (cached) return cached;

        var area = n * n;
        var table = new Array(area);
        for (var r = 0; r < n; r++) {
            for (var c = 0; c < n; c++) {
                var list = [];
                if (r > 0) list.push((r - 1) * n + c);
                if (r < n - 1) list.push((r + 1) * n + c);
                if (c > 0) list.push(r * n + c - 1);
                if (c < n - 1) list.push(r * n + c + 1);
                table[r * n + c] = Int32Array.from(list);
            }
        }
        neighborCache.set(n, table);
        return table;
    }

    var HOSHI = {
        9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
        13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
        19: [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ]
    };

    /** 星位（索引数组）。 */
    function hoshiPoints(n) {
        var rows = HOSHI[n] || [];
        return rows.map(function (rc) { return rc[0] * n + rc[1]; });
    }

    /* ------------------------------------------------------------------ *
     * Zobrist 哈希：用于劫 / 同形再现检测
     * ------------------------------------------------------------------ */

    var zobristCache = new Map();

    function zobristFor(n) {
        var cached = zobristCache.get(n);
        if (cached) return cached;

        var area = n * n;
        var seed = (0x9e3779b9 ^ (n * 0x85ebca6b)) | 0;
        function next() {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            return seed | 0;
        }

        var z = {
            blackA: new Int32Array(area),
            blackB: new Int32Array(area),
            whiteA: new Int32Array(area),
            whiteB: new Int32Array(area),
            turnA: next(),
            turnB: next()
        };
        for (var i = 0; i < area; i++) {
            z.blackA[i] = next();
            z.blackB[i] = next();
            z.whiteA[i] = next();
            z.whiteB[i] = next();
        }
        zobristCache.set(n, z);
        return z;
    }

    /* ------------------------------------------------------------------ *
     * 扫描上下文：复用 TypedArray，避免搜索时频繁分配
     * ------------------------------------------------------------------ */

    function createScratch(n) {
        var area = n * n;
        return {
            seen: new Int32Array(area),
            libSeen: new Int32Array(area),
            areaSeen: new Int32Array(area),
            candSeen: new Int32Array(area),
            groupLib: new Uint8Array(area),
            groupSize: new Uint16Array(area),
            stack: new Int32Array(area),
            queue: new Int32Array(area),
            groupBuf: [],
            candList: [],
            stamp: 0,
            libStamp: 0,
            areaStamp: 0,
            candStamp: 0,
            koPoint: -1,
            nodes: 0,
            deadline: Infinity
        };
    }

    function nextStamp(ctx) {
        if (ctx.stamp >= 0x3fffffff) {
            ctx.seen.fill(0);
            ctx.stamp = 0;
        }
        return ++ctx.stamp;
    }

    function nextLibStamp(ctx) {
        if (ctx.libStamp >= 0x3fffffff) {
            ctx.libSeen.fill(0);
            ctx.libStamp = 0;
        }
        return ++ctx.libStamp;
    }

    function nextAreaStamp(ctx) {
        if (ctx.areaStamp >= 0x3fffffff) {
            ctx.areaSeen.fill(0);
            ctx.areaStamp = 0;
        }
        return ++ctx.areaStamp;
    }

    function nextCandStamp(ctx) {
        if (ctx.candStamp >= 0x3fffffff) {
            ctx.candSeen.fill(0);
            ctx.candStamp = 0;
        }
        return ++ctx.candStamp;
    }

    /* ------------------------------------------------------------------ *
     * 棋块扫描
     * ------------------------------------------------------------------ */

    /**
     * 收集 start 所在的同色棋块。
     * 返回值中的 count / libs 为该块棋子数与气数，libPoint 仅在恰好一口气时有效。
     */
    function collectGroup(board, n, start, nbrs, ctx, stamp, out) {
        var color = board[start];
        var stack = ctx.stack;
        var seen = ctx.seen;
        var libSeen = ctx.libSeen;
        // 棋块与“气”必须使用独立的标记戳：同一次评估中多个棋块共享棋块戳，
        // 若气也复用同一个戳，后续棋块会把前一块的气误判为已访问。
        var libStamp = nextLibStamp(ctx);
        var top = 0;
        var libs = 0;
        var libPoint = -1;

        out.length = 0;
        stack[top++] = start;
        seen[start] = stamp;

        while (top > 0) {
            var p = stack[--top];
            out.push(p);
            var list = nbrs[p];
            for (var i = 0; i < list.length; i++) {
                var q = list[i];
                var v = board[q];
                if (v === EMPTY) {
                    if (libSeen[q] !== libStamp) {
                        libSeen[q] = libStamp;
                        libs++;
                        libPoint = q;
                    }
                } else if (v === color && seen[q] !== stamp) {
                    seen[q] = stamp;
                    stack[top++] = q;
                }
            }
        }

        return { color: color, count: out.length, libs: libs, libPoint: libPoint };
    }

    /**
     * 在 board 上落子（会修改 board）。非法（自杀）时回滚并返回 false。
     * 返回值为 -1（无劫）或劫点索引（简单劫）。
     */
    function playOnBoard(board, n, idx, color, nbrs, ctx, outCaptured) {
        var opponent = 3 - color;
        board[idx] = color;
        outCaptured.length = 0;

        var list = nbrs[idx];
        for (var i = 0; i < list.length; i++) {
            var q = list[i];
            if (board[q] === opponent) {
                var group = collectGroup(board, n, q, nbrs, ctx, nextStamp(ctx), ctx.groupBuf);
                if (group.libs === 0) {
                    var stones = ctx.groupBuf;
                    for (var k = 0; k < stones.length; k++) {
                        board[stones[k]] = EMPTY;
                        outCaptured.push(stones[k]);
                    }
                }
            }
        }

        var own = collectGroup(board, n, idx, nbrs, ctx, nextStamp(ctx), ctx.groupBuf);
        if (own.libs === 0) {
            for (var j = 0; j < outCaptured.length; j++) {
                board[outCaptured[j]] = opponent;
            }
            board[idx] = EMPTY;
            outCaptured.length = 0;
            return false;
        }

        return (outCaptured.length === 1 && own.count === 1 && own.libs === 1)
            ? own.libPoint
            : -1;
    }

    /** 撤销 playOnBoard。 */
    function undoPlay(board, idx, color, captured) {
        board[idx] = EMPTY;
        var opponent = 3 - color;
        for (var i = 0; i < captured.length; i++) {
            board[captured[i]] = opponent;
        }
    }

    /** 是否落在自己的真眼里（用于 AI 候选过滤）。 */
    function isOwnEye(board, n, idx, color, nbrs) {
        var list = nbrs[idx];
        for (var i = 0; i < list.length; i++) {
            if (board[list[i]] !== color) return false;
        }

        var r = (idx / n) | 0;
        var c = idx - r * n;
        var opponent = 3 - color;
        var opponentDiagonals = 0;
        var diagonals = 0;
        if (r > 0 && c > 0) { diagonals++; if (board[idx - n - 1] === opponent) opponentDiagonals++; }
        if (r > 0 && c < n - 1) { diagonals++; if (board[idx - n + 1] === opponent) opponentDiagonals++; }
        if (r < n - 1 && c > 0) { diagonals++; if (board[idx + n - 1] === opponent) opponentDiagonals++; }
        if (r < n - 1 && c < n - 1) { diagonals++; if (board[idx + n + 1] === opponent) opponentDiagonals++; }

        // 真眼：四邻皆己方，且对角线上没有对方棋子。
        return diagonals > 0 && opponentDiagonals === 0;
    }

    /** 预先计算每个棋子所在棋块的气数，供候选走法排序快速读取。 */
    function buildGroupLibs(board, n, nbrs, ctx) {
        var area = n * n;
        var lib = ctx.groupLib;
        var size = ctx.groupSize;
        var stamp = nextStamp(ctx);

        for (var i = 0; i < area; i++) {
            if (board[i] === EMPTY || ctx.seen[i] === stamp) continue;
            var group = collectGroup(board, n, i, nbrs, ctx, stamp, ctx.groupBuf);
            for (var k = 0; k < ctx.groupBuf.length; k++) {
                var s = ctx.groupBuf[k];
                lib[s] = group.libs;
                size[s] = group.count;
            }
        }
    }

    /* ------------------------------------------------------------------ *
     * 估值
     * ------------------------------------------------------------------ */

    /**
     * 从 toPlay 视角评估局面（分数越大越有利）。
     * 面积 = 棋子 + 单色围空；再对气紧的棋块做风险修正。
     */
    function evaluate(board, n, toPlay, komi, ctx, nbrs) {
        var area = n * n;
        var i;
        var black = 0;
        var white = 0;

        for (i = 0; i < area; i++) {
            if (board[i] === BLACK) black++;
            else if (board[i] === WHITE) white++;
        }

        // 围空：对每个空白连通用区域统计其边界颜色
        var areaSeen = ctx.areaSeen;
        var areaStamp = nextAreaStamp(ctx);
        var queue = ctx.queue;
        for (i = 0; i < area; i++) {
            if (board[i] !== EMPTY || areaSeen[i] === areaStamp) continue;

            var head = 0;
            var tail = 0;
            var touchBlack = false;
            var touchWhite = false;
            queue[tail++] = i;
            areaSeen[i] = areaStamp;

            while (head < tail) {
                var p = queue[head++];
                var list = nbrs[p];
                for (var k = 0; k < list.length; k++) {
                    var q = list[k];
                    var v = board[q];
                    if (v === EMPTY) {
                        if (areaSeen[q] !== areaStamp) {
                            areaSeen[q] = areaStamp;
                            queue[tail++] = q;
                        }
                    } else if (v === BLACK) {
                        touchBlack = true;
                    } else {
                        touchWhite = true;
                    }
                }
            }

            if (touchBlack && !touchWhite) black += tail;
            else if (touchWhite && !touchBlack) white += tail;
        }

        var score = (black - white - komi) * 10;

        // 棋块安全性
        var groupStamp = nextStamp(ctx);
        for (i = 0; i < area; i++) {
            if (board[i] === EMPTY || ctx.seen[i] === groupStamp) continue;
            var group = collectGroup(board, n, i, nbrs, ctx, groupStamp, ctx.groupBuf);
            var sign = group.color === BLACK ? 1 : -1;
            if (group.libs === 1) score -= sign * group.count * 22;
            else if (group.libs === 2) score -= sign * group.count * 5;
            else if (group.libs >= 4) score += sign * group.count;
        }

        return toPlay === BLACK ? score : -score;
    }

    /* ------------------------------------------------------------------ *
     * 候选走法
     * ------------------------------------------------------------------ */

    function orderScore(idx, board, n, color, ctx, nbrs, lastMove) {
        var opponent = 3 - color;
        var lib = ctx.groupLib;
        var size = ctx.groupSize;
        var score = Math.random() * 6;
        var list = nbrs[idx];

        for (var i = 0; i < list.length; i++) {
            var q = list[i];
            var v = board[q];
            if (v === color) {
                var myLibs = lib[q];
                if (myLibs === 1) score += 320 + size[q] * 26;
                else if (myLibs === 2) score += 40;
                score += 10;
            } else if (v === opponent) {
                var oppLibs = lib[q];
                if (oppLibs === 1) score += 520 + size[q] * 34;
                else if (oppLibs === 2) score += 90;
                score += 8;
            }
        }

        if (lastMove >= 0) {
            var r = (idx / n) | 0;
            var c = idx - r * n;
            var lr = (lastMove / n) | 0;
            var lc = lastMove - lr * n;
            var distance = Math.max(Math.abs(r - lr), Math.abs(c - lc));
            if (distance === 1) score += 30;
            else if (distance === 2) score += 12;
        }

        var row = (idx / n) | 0;
        var col = idx - row * n;
        var edge = Math.min(row, col, n - 1 - row, n - 1 - col);
        if (edge === 0) score -= 12;
        else if (edge === 1) score -= 4;
        else if (edge === 3) score += 6;

        return score;
    }

    /**
     * 生成候选走法（按启发式排序）。
     * 空盘时返回星位；否则取已有棋子周围 2 格内的空点，过滤己方真眼。
     */
    function generateMoves(board, n, color, ctx, nbrs, koPoint, limit, lastMove) {
        var area = n * n;
        var i;
        var stones = 0;
        var mark = ctx.candSeen;
        var stamp = nextCandStamp(ctx);
        var list = ctx.candList;
        list.length = 0;

        for (i = 0; i < area; i++) {
            if (board[i] === EMPTY) continue;
            stones++;
            var r = (i / n) | 0;
            var c = i - r * n;
            for (var dr = -2; dr <= 2; dr++) {
                var rr = r + dr;
                if (rr < 0 || rr >= n) continue;
                for (var dc = -2; dc <= 2; dc++) {
                    var cc = c + dc;
                    if (cc < 0 || cc >= n) continue;
                    var q = rr * n + cc;
                    if (board[q] !== EMPTY || mark[q] === stamp || q === koPoint) continue;
                    mark[q] = stamp;
                    list.push(q);
                }
            }
        }

        if (stones === 0) {
            return hoshiPoints(n).map(function (idx) {
                return { idx: idx, score: Math.random() };
            });
        }

        if (stones < 8) {
            var hoshi = hoshiPoints(n);
            for (i = 0; i < hoshi.length; i++) {
                var h = hoshi[i];
                if (board[h] === EMPTY && mark[h] !== stamp && h !== koPoint) {
                    mark[h] = stamp;
                    list.push(h);
                }
            }
        }

        buildGroupLibs(board, n, nbrs, ctx);

        var moves = [];
        for (i = 0; i < list.length; i++) {
            var idx = list[i];
            if (isOwnEye(board, n, idx, color, nbrs)) continue;
            moves.push({ idx: idx, score: orderScore(idx, board, n, color, ctx, nbrs, lastMove) });
        }
        moves.sort(function (a, b) { return b.score - a.score; });
        if (moves.length > limit) moves.length = limit;
        return moves;
    }

    /* ------------------------------------------------------------------ *
     * Negamax + Alpha-Beta
     * ------------------------------------------------------------------ */

    function search(board, n, toPlay, komi, depth, alpha, beta, koPoint, ctx, nbrs, ply, capStack, lastMove) {
        ctx.nodes++;
        if (depth <= 0 || Date.now() > ctx.deadline) {
            return evaluate(board, n, toPlay, komi, ctx, nbrs);
        }

        var moves = generateMoves(board, n, toPlay, ctx, nbrs, koPoint, depth >= 2 ? 8 : 6, lastMove);
        if (moves.length === 0) {
            return evaluate(board, n, toPlay, komi, ctx, nbrs);
        }

        var captured = capStack[ply] || (capStack[ply] = []);
        var best = -Infinity;
        for (var i = 0; i < moves.length; i++) {
            var idx = moves[i].idx;
            var nextKo = playOnBoard(board, n, idx, toPlay, nbrs, ctx, captured);
            if (nextKo === false) continue;

            var value = -search(
                board, n, 3 - toPlay, komi, depth - 1,
                -beta, -alpha, nextKo, ctx, nbrs, ply + 1, capStack, idx
            );
            undoPlay(board, idx, toPlay, captured);

            if (value > best) best = value;
            if (value > alpha) alpha = value;
            if (alpha >= beta) break;
            if (Date.now() > ctx.deadline) break;
        }

        return best === -Infinity ? evaluate(board, n, toPlay, komi, ctx, nbrs) : best;
    }

    /* ------------------------------------------------------------------ *
     * AI 入口
     * ------------------------------------------------------------------ */

    var DIFFICULTY = {
        easy: { depth: 1, rootLimit: 8, budget: 150 },
        medium: { depth: 2, rootLimit: 12, budget: 450 },
        hard: { depth: 4, rootLimit: 14, budget: 1200 }
    };

    /**
     * 选择一手棋。
     * @param {Object} options
     * @param {Int8Array|number[]} options.board 棋盘
     * @param {number} options.size 9 / 13 / 19
     * @param {number} options.toPlay BLACK | WHITE
     * @param {number} [options.komi=7.5]
     * @param {'easy'|'medium'|'hard'} [options.difficulty='medium']
     * @param {number} [options.koPoint=-1] 简单劫禁着点
     * @param {number} [options.lastMove=-1]
     * @param {boolean} [options.lastWasPass=false]
     * @returns {{pass:boolean,index:number,score:number,nodes:number,elapsed:number}}
     */
    function chooseMove(options) {
        var started = Date.now();
        var size = SIZES.indexOf(options.size) >= 0 ? options.size : 19;
        var n = size;
        var board = options.board instanceof Int8Array
            ? new Int8Array(options.board)
            : Int8Array.from(options.board);
        var toPlay = options.toPlay === WHITE ? WHITE : BLACK;
        var komi = typeof options.komi === 'number' ? options.komi : DEFAULT_KOMI;
        var difficulty = DIFFICULTY[options.difficulty] ? options.difficulty : 'medium';
        var config = DIFFICULTY[difficulty];
        var koPoint = Number.isInteger(options.koPoint) ? options.koPoint : -1;
        var lastMove = Number.isInteger(options.lastMove) ? options.lastMove : -1;
        var forbidden = options.forbidden || null;

        var ctx = createScratch(n);
        var nbrs = neighborsFor(n);
        ctx.deadline = started + config.budget;

        var stones = 0;
        for (var i = 0; i < n * n; i++) if (board[i] !== EMPTY) stones++;

        // 对手刚弃权且己方形势不差：直接弃权终局，避免无意义填子
        if (options.lastWasPass && stones > n * n * 0.35) {
            if (evaluate(board, n, toPlay, komi, ctx, nbrs) > 0) {
                return { pass: true, index: -1, score: 0, nodes: ctx.nodes, elapsed: Date.now() - started };
            }
        }

        var candidates = generateMoves(board, n, toPlay, ctx, nbrs, koPoint, config.rootLimit, lastMove);
        if (forbidden) {
            candidates = candidates.filter(function (move) { return !forbidden.has(move.idx); });
        }
        if (candidates.length === 0) {
            return { pass: true, index: -1, score: 0, nodes: ctx.nodes, elapsed: Date.now() - started };
        }

        var capStack = [];
        var results = [];
        var bestIndex = candidates[0].idx;
        var bestScore = -Infinity;
        var alpha = -Infinity;

        for (var m = 0; m < candidates.length; m++) {
            var idx = candidates[m].idx;
            var captured = capStack[0] || (capStack[0] = []);
            var nextKo = playOnBoard(board, n, idx, toPlay, nbrs, ctx, captured);
            if (nextKo === false) continue;

            var value;
            if (config.depth <= 1) {
                value = -evaluate(board, n, 3 - toPlay, komi, ctx, nbrs) + Math.random() * 12;
            } else {
                value = -search(
                    board, n, 3 - toPlay, komi, config.depth - 1,
                    -Infinity, -alpha, nextKo, ctx, nbrs, 1, capStack, idx
                );
            }
            undoPlay(board, idx, toPlay, captured);

            results.push({ idx: idx, score: value });
            if (value > bestScore) {
                bestScore = value;
                bestIndex = idx;
            }
            if (value > alpha) alpha = value;

            if (Date.now() > ctx.deadline) break;
        }

        if (results.length === 0) {
            return { pass: true, index: -1, score: 0, nodes: ctx.nodes, elapsed: Date.now() - started };
        }

        // 简单难度：在最优的几手中随机选择，避免每局完全一样
        if (difficulty === 'easy' && results.length > 1) {
            results.sort(function (a, b) { return b.score - a.score; });
            bestIndex = results[0].idx;
            if (results[0].score - results[1].score < 200) {
                var top = results.slice(0, Math.min(3, results.length));
                var roll = Math.random();
                var pick = roll < 0.6 ? 0 : roll < 0.85 ? 1 : 2;
                bestIndex = top[Math.min(pick, top.length - 1)].idx;
            }
        }

        return {
            pass: false,
            index: bestIndex,
            score: bestScore,
            nodes: ctx.nodes,
            elapsed: Date.now() - started
        };
    }

    /* ------------------------------------------------------------------ *
     * 计分
     * ------------------------------------------------------------------ */

    function scoreBoard(board, n, komi) {
        var area = n * n;
        var i;
        var blackStones = 0;
        var whiteStones = 0;
        var blackTerritory = 0;
        var whiteTerritory = 0;
        var neutral = 0;

        for (i = 0; i < area; i++) {
            if (board[i] === BLACK) blackStones++;
            else if (board[i] === WHITE) whiteStones++;
        }

        var seen = new Uint8Array(area);
        var queue = new Int32Array(area);
        var nbrs = neighborsFor(n);

        for (i = 0; i < area; i++) {
            if (board[i] !== EMPTY || seen[i]) continue;

            var head = 0;
            var tail = 0;
            var touchBlack = false;
            var touchWhite = false;
            queue[tail++] = i;
            seen[i] = 1;

            while (head < tail) {
                var p = queue[head++];
                var list = nbrs[p];
                for (var k = 0; k < list.length; k++) {
                    var q = list[k];
                    var v = board[q];
                    if (v === EMPTY) {
                        if (!seen[q]) {
                            seen[q] = 1;
                            queue[tail++] = q;
                        }
                    } else if (v === BLACK) {
                        touchBlack = true;
                    } else {
                        touchWhite = true;
                    }
                }
            }

            if (touchBlack && !touchWhite) blackTerritory += tail;
            else if (touchWhite && !touchBlack) whiteTerritory += tail;
            else neutral += tail;
        }

        var blackScore = blackStones + blackTerritory;
        var whiteScore = whiteStones + whiteTerritory + komi;
        var winner = blackScore > whiteScore ? BLACK : whiteScore > blackScore ? WHITE : 0;

        return {
            blackStones: blackStones,
            whiteStones: whiteStones,
            blackTerritory: blackTerritory,
            whiteTerritory: whiteTerritory,
            neutral: neutral,
            blackScore: blackScore,
            whiteScore: whiteScore,
            komi: komi,
            winner: winner,
            margin: Math.abs(blackScore - whiteScore)
        };
    }

    /* ------------------------------------------------------------------ *
     * 对局
     * ------------------------------------------------------------------ */

    function GoGame(options) {
        options = options || {};
        var size = SIZES.indexOf(options.size) >= 0 ? options.size : 19;
        this.size = size;
        this.komi = typeof options.komi === 'number' ? options.komi : DEFAULT_KOMI;
        this.nbrs = neighborsFor(size);
        this.zobrist = zobristFor(size);
        this.ctx = createScratch(size);
        this._captureBuf = [];
        this.reset();
    }

    GoGame.prototype.reset = function () {
        var area = this.size * this.size;
        this.board = new Int8Array(area);
        this.toPlay = BLACK;
        this.captures = { 1: 0, 2: 0 };
        this.moveNumber = 0;
        this.consecutivePasses = 0;
        this.history = [];
        this.positions = new Set();
        this.hashA = 0;
        this.hashB = 0;
        this.lastMove = -1;
        this.koPoint = -1;
        this.ended = false;
        this.result = null;
        this.positions.add(this._key(this.toPlay));
    };

    GoGame.prototype._key = function (toPlay, hashA, hashB) {
        var z = this.zobrist;
        var a = (hashA === undefined ? this.hashA : hashA) ^ (toPlay === WHITE ? z.turnA : 0);
        var b = (hashB === undefined ? this.hashB : hashB) ^ (toPlay === WHITE ? z.turnB : 0);
        return a + ':' + b;
    };

    GoGame.prototype._xor = function (idx, color) {
        var z = this.zobrist;
        if (color === BLACK) {
            this.hashA ^= z.blackA[idx];
            this.hashB ^= z.blackB[idx];
        } else {
            this.hashA ^= z.whiteA[idx];
            this.hashB ^= z.whiteB[idx];
        }
    };

    GoGame.prototype._hashAfter = function (idx, color, captured) {
        var z = this.zobrist;
        var a = this.hashA;
        var b = this.hashB;
        var opponent = 3 - color;

        if (color === BLACK) {
            a ^= z.blackA[idx];
            b ^= z.blackB[idx];
        } else {
            a ^= z.whiteA[idx];
            b ^= z.whiteB[idx];
        }

        for (var i = 0; i < captured.length; i++) {
            if (opponent === BLACK) {
                a ^= z.blackA[captured[i]];
                b ^= z.blackB[captured[i]];
            } else {
                a ^= z.whiteA[captured[i]];
                b ^= z.whiteB[captured[i]];
            }
        }
        return [a, b];
    };

    GoGame.prototype._apply = function (idx, color) {
        var ko = playOnBoard(
            this.board, this.size, idx, color,
            this.nbrs, this.ctx, this._captureBuf
        );
        if (ko === false) return null;
        this.ctx.koPoint = ko;
        return this._captureBuf;
    };

    /**
     * 检查落子是否合法（不改变棋局状态）。
     * @returns {{legal:boolean,reason?:string,message?:string}}
     */
    GoGame.prototype.checkMove = function (idx, color) {
        if (color === undefined) color = this.toPlay;
        var n = this.size;
        var area = n * n;

        if (this.ended) return { legal: false, reason: 'ended', message: '对局已结束' };
        if (!Number.isInteger(idx) || idx < 0 || idx >= area) {
            return { legal: false, reason: 'invalid', message: '无效的位置' };
        }
        if (this.board[idx] !== EMPTY) {
            return { legal: false, reason: 'occupied', message: '此处已有棋子' };
        }

        var captured = this._apply(idx, color);
        if (captured === null) {
            return { legal: false, reason: 'suicide', message: '不可自填：这手棋没有气' };
        }
        var capCopy = captured.slice();
        var hash = this._hashAfter(idx, color, capCopy);
        undoPlay(this.board, idx, color, capCopy);

        if (color === this.toPlay &&
            this.positions.has(this._key(3 - color, hash[0], hash[1]))) {
            return { legal: false, reason: 'ko', message: '打劫禁着：不能立即提回' };
        }

        return { legal: true };
    };

    GoGame.prototype.isLegal = function (idx, color) {
        return this.checkMove(idx, color).legal;
    };

    /**
     * 落子。
     * @returns {{ok:boolean,reason?:string,message?:string,captured?:number[],color?:number,index?:number}}
     */
    GoGame.prototype.playIndex = function (idx) {
        var check = this.checkMove(idx, this.toPlay);
        if (!check.legal) {
            return { ok: false, reason: check.reason, message: check.message };
        }

        var color = this.toPlay;
        var opponent = 3 - color;
        var captured = this._apply(idx, color);
        var cap = captured.slice();
        var hashBeforeA = this.hashA;
        var hashBeforeB = this.hashB;

        this._xor(idx, color);
        for (var i = 0; i < cap.length; i++) this._xor(cap[i], opponent);
        var keyAfter = this._key(opponent);

        this.history.push({
            type: 'move',
            index: idx,
            color: color,
            captured: cap,
            prevPasses: this.consecutivePasses,
            prevLastMove: this.lastMove,
            hashBeforeA: hashBeforeA,
            hashBeforeB: hashBeforeB,
            keyAfter: keyAfter
        });

        this.captures[color] += cap.length;
        this.moveNumber++;
        this.toPlay = opponent;
        this.consecutivePasses = 0;
        this.lastMove = idx;
        this.koPoint = this.ctx.koPoint;
        this.positions.add(keyAfter);

        return { ok: true, captured: cap, color: color, index: idx };
    };

    /** 弃权。 */
    GoGame.prototype.pass = function () {
        if (this.ended) return { ok: false, reason: 'ended', message: '对局已结束' };

        var color = this.toPlay;
        this.history.push({
            type: 'pass',
            color: color,
            prevPasses: this.consecutivePasses,
            prevLastMove: this.lastMove
        });
        this.consecutivePasses++;
        this.moveNumber++;
        this.toPlay = 3 - color;

        if (this.consecutivePasses >= 2) this._finish('score');
        return { ok: true, color: color };
    };

    /** 认输。 */
    GoGame.prototype.resign = function () {
        if (this.ended) return { ok: false, reason: 'ended', message: '对局已结束' };

        var color = this.toPlay;
        this.history.push({
            type: 'resign',
            color: color,
            prevPasses: this.consecutivePasses,
            prevLastMove: this.lastMove
        });
        this._finish('resign', 3 - color);
        return { ok: true, winner: 3 - color };
    };

    GoGame.prototype._finish = function (reason, winner) {
        this.ended = true;
        var score = this.computeScore();
        if (reason === 'resign') {
            // 先展开计分，再用认输胜者覆盖，避免被 score.winner 覆盖
            this.result = Object.assign({ reason: 'resign' }, score, { winner: winner });
        } else {
            this.result = Object.assign({ reason: 'score' }, score);
        }
    };

    /** 撤销一手（含弃权、认输）。 */
    GoGame.prototype.undo = function () {
        var record = this.history.pop();
        if (!record) return null;

        if (record.type === 'move') {
            undoPlay(this.board, record.index, record.color, record.captured);
            this.captures[record.color] -= record.captured.length;
            this.hashA = record.hashBeforeA;
            this.hashB = record.hashBeforeB;
            this.positions.delete(record.keyAfter);
            this.moveNumber--;
            this.toPlay = record.color;
            this.consecutivePasses = record.prevPasses;
            this.lastMove = record.prevLastMove;
        } else if (record.type === 'pass') {
            this.consecutivePasses = record.prevPasses;
            this.toPlay = record.color;
            this.moveNumber--;
            this.lastMove = record.prevLastMove;
        } else {
            this.toPlay = record.color;
            this.lastMove = record.prevLastMove;
        }

        this.koPoint = -1;
        this.ended = false;
        this.result = null;
        return record;
    };

    /** 面积计分。 */
    GoGame.prototype.computeScore = function () {
        return scoreBoard(this.board, this.size, this.komi);
    };

    /** 导出 SGF（FF[4]）。 */
    GoGame.prototype.toSGF = function () {
        var n = this.size;
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        var date = new Date().toISOString().slice(0, 10);

        var sgf = '(;GM[1]FF[4]CA[UTF-8]AP[go-standalone:2]SZ[' + n +
            ']KM[' + this.komi + ']DT[' + date + ']PB[黑]PW[白]';

        for (var i = 0; i < this.history.length; i++) {
            var record = this.history[i];
            var tag = record.color === BLACK ? 'B' : 'W';
            if (record.type === 'move') {
                var row = (record.index / n) | 0;
                var col = record.index - row * n;
                sgf += ';' + tag + '[' + letters[col] + letters[row] + ']';
            } else if (record.type === 'pass') {
                sgf += ';' + tag + '[]';
            }
        }

        if (this.result) {
            if (this.result.winner === 0) {
                sgf += 'RE[0]';
            } else {
                var winnerTag = this.result.winner === BLACK ? 'B' : 'W';
                if (this.result.reason === 'resign') sgf += 'RE[' + winnerTag + '+R]';
                else sgf += 'RE[' + winnerTag + '+' + this.result.margin + ']';
            }
        }

        return sgf + ')';
    };

    return {
        EMPTY: EMPTY,
        BLACK: BLACK,
        WHITE: WHITE,
        SIZES: SIZES,
        DEFAULT_KOMI: DEFAULT_KOMI,
        GoGame: GoGame,
        chooseMove: chooseMove,
        hoshiPoints: hoshiPoints,
        scoreBoard: scoreBoard,
        neighborsFor: neighborsFor
    };
});
