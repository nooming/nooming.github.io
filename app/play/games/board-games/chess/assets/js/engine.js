/*
 * 象棋引擎：自带走法生成 / 局面评估 / Alpha-Beta 搜索
 * ------------------------------------------------------------
 * 设计要点：
 *   1. 与 xiangqi.js 解耦：搜索在扁平的 90 格 Uint8Array 上用整数运算完成，
 *      只在开始（读入局面）和结束（落子）时与规则库交互，避免每个节点重建着法对象。
 *   2. 迭代加深 + 置换表 + 空着裁剪没有引入（象棋空着不安全），
 *      改为：静态搜索（吃子）、将军延伸、杀手着法、历史启发。
 *   3. 评估函数：子力 + 位置分值表 + 车通线奖励。
 *
 * 记法：行 0 为黑方底线（棋盘上方），行 9 为红方底线。
 * 棋子编码：1 帅 2 仕 3 相 4 马 5 车 6 炮 7 兵；黑方为对应值 + 8。
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        (root.XQ = root.XQ || {}).Engine = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const INF = 1e7;
    const MATE = 1e6;
    const EMPTY = 0;
    const KING = 1;
    const ADVISOR = 2;
    const BISHOP = 3;
    const KNIGHT = 4;
    const ROOK = 5;
    const CANNON = 6;
    const PAWN = 7;
    const BLACK_OFFSET = 8;

    const PIECE_VALUE = [0, 10000, 220, 220, 420, 940, 480, 110];
    const PIECE_TYPE_BY_CHAR = { k: KING, a: ADVISOR, b: BISHOP, n: KNIGHT, r: ROOK, c: CANNON, p: PAWN };
    const PIECE_CHAR = ['', 'k', 'a', 'b', 'n', 'r', 'c', 'p'];

    function squareIndex(square) {
        return (9 - Number(square.charAt(1))) * 9 + (square.charCodeAt(0) - 97);
    }
    function squareName(index) {
        return String.fromCharCode(97 + (index % 9)) + (9 - Math.floor(index / 9));
    }
    function rowOf(index) { return (index / 9) | 0; }
    function colOf(index) { return index % 9; }
    function sideOf(piece) { return piece >= BLACK_OFFSET ? 1 : 0; }
    function typeOf(piece) { return piece >= BLACK_OFFSET ? piece - BLACK_OFFSET : piece; }
    function makePiece(side, type) { return side === 1 ? type + BLACK_OFFSET : type; }

    // ---------------------------------------------------------------- 位置分值
    function flatten(rows) {
        const out = new Float32Array(90);
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) out[r * 9 + c] = rows[r][c];
        return out;
    }

    const PST_PAWN = flatten([
        [10, 10, 10, 20, 20, 20, 10, 10, 10],
        [20, 25, 30, 40, 45, 40, 30, 25, 20],
        [15, 20, 25, 35, 40, 35, 25, 20, 15],
        [5, 10, 15, 25, 30, 25, 15, 10, 5],
        [0, 0, 5, 15, 20, 15, 5, 0, 0],
        [0, 0, 0, 0, 5, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);

    const PST_KNIGHT = flatten([
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 4, 8, 10, 10, 10, 8, 4, 0],
        [4, 8, 12, 16, 18, 16, 12, 8, 4],
        [8, 12, 18, 22, 24, 22, 18, 12, 8],
        [10, 14, 20, 24, 26, 24, 20, 14, 10],
        [10, 14, 20, 24, 26, 24, 20, 14, 10],
        [8, 12, 18, 22, 24, 22, 18, 12, 8],
        [6, 10, 14, 18, 20, 18, 14, 10, 6],
        [2, 6, 10, 14, 16, 14, 10, 6, 2],
        [0, 4, 8, 10, 12, 10, 8, 4, 0]
    ]);

    const PST_ROOK = flatten([
        [10, 12, 10, 16, 18, 16, 10, 12, 10],
        [12, 16, 14, 20, 22, 20, 14, 16, 12],
        [10, 14, 12, 18, 20, 18, 12, 14, 10],
        [10, 14, 12, 18, 20, 18, 12, 14, 10],
        [10, 12, 10, 16, 18, 16, 10, 12, 10],
        [10, 12, 10, 16, 18, 16, 10, 12, 10],
        [6, 8, 6, 12, 14, 12, 6, 8, 6],
        [2, 6, 4, 10, 12, 10, 4, 6, 2],
        [0, 4, 2, 8, 10, 8, 2, 4, 0],
        [4, 6, 4, 10, 12, 10, 4, 6, 4]
    ]);

    const PST_CANNON = flatten([
        [6, 4, 0, -4, -6, -4, 0, 4, 6],
        [6, 4, 0, -2, -4, -2, 0, 4, 6],
        [2, 2, 0, 0, -2, 0, 0, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 2, 4, 2, 2, 0, 0],
        [0, 2, 4, 6, 8, 6, 4, 2, 0],
        [2, 4, 6, 8, 10, 8, 6, 4, 2],
        [4, 6, 8, 10, 12, 10, 8, 6, 4],
        [2, 4, 6, 8, 10, 8, 6, 4, 2],
        [0, 2, 4, 6, 8, 6, 4, 2, 0]
    ]);

    const PST_ADVISOR = new Float32Array(90);
    const PST_BISHOP = new Float32Array(90);
    const PST_KING = new Float32Array(90);
    PST_ADVISOR[9 * 9 + 4] = 6; PST_ADVISOR[9 * 9 + 3] = 4; PST_ADVISOR[9 * 9 + 5] = 4;
    PST_ADVISOR[7 * 9 + 3] = 2; PST_ADVISOR[7 * 9 + 5] = 2;
    PST_BISHOP[9 * 9 + 2] = 4; PST_BISHOP[9 * 9 + 6] = 4;
    PST_BISHOP[7 * 9 + 0] = 6; PST_BISHOP[7 * 9 + 4] = 6; PST_BISHOP[7 * 9 + 8] = 6;
    PST_BISHOP[5 * 9 + 2] = 4; PST_BISHOP[5 * 9 + 6] = 4;
    PST_KING[9 * 9 + 4] = 8; PST_KING[9 * 9 + 3] = 4; PST_KING[9 * 9 + 5] = 4;
    PST_KING[8 * 9 + 4] = 2;

    const PST = [null, PST_KING, PST_ADVISOR, PST_BISHOP, PST_KNIGHT, PST_ROOK, PST_CANNON, PST_PAWN];

    // ---------------------------------------------------------------- Zobrist
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return (t ^ (t >>> 14)) >>> 0;
        };
    }

    const ZA = new Int32Array(90 * 15);
    const ZB = new Int32Array(90 * 15);
    const SIDE_A = new Int32Array(1);
    const SIDE_B = new Int32Array(1);
    (function initZobrist() {
        const rand = mulberry32(0x9e3779b9);
        for (let i = 0; i < ZA.length; i++) {
            ZA[i] = rand() | 0;
            ZB[i] = rand() | 0;
        }
        SIDE_A[0] = rand() | 0;
        SIDE_B[0] = rand() | 0;
    })();

    function zobristIndex(square, piece) {
        return square * 15 + (piece >= BLACK_OFFSET ? piece - BLACK_OFFSET + 7 : piece);
    }

    // ---------------------------------------------------------------- 走法生成
    // 走法编码：[0..89] 起点、[0..89] 终点 -> from * 128 + to
    const KNIGHT_MOVES = [
        [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]
    ];
    const BISHOP_MOVES = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    const ADVISOR_MOVES = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    function inPalace(row, col, side) {
        if (row < 0 || row > 9) return false;
        if (col < 3 || col > 5) return false;
        return side === 0 ? row >= 7 : row <= 2;
    }

    function generateMoves(board, side, out) {
        out.length = 0;
        const base = side === 0 ? 0 : BLACK_OFFSET;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const from = r * 9 + c;
                const piece = board[from];
                if (!piece || sideOf(piece) !== side) continue;
                const type = piece > 7 ? piece - 8 : piece;
                switch (type) {
                    case KING: {
                        for (let i = 0; i < 4; i++) {
                            const nr = r + ORTHO[i][0], nc = c + ORTHO[i][1];
                            if (!inPalace(nr, nc, side)) continue;
                            const to = nr * 9 + nc;
                            if (board[to] && sideOf(board[to]) === side) continue;
                            out.push(from * 128 + to);
                        }
                        break;
                    }
                    case ADVISOR: {
                        for (let i = 0; i < 4; i++) {
                            const nr = r + ADVISOR_MOVES[i][0], nc = c + ADVISOR_MOVES[i][1];
                            if (!inPalace(nr, nc, side)) continue;
                            const to = nr * 9 + nc;
                            if (board[to] && sideOf(board[to]) === side) continue;
                            out.push(from * 128 + to);
                        }
                        break;
                    }
                    case BISHOP: {
                        for (let i = 0; i < 4; i++) {
                            const dr = BISHOP_MOVES[i][0], dc = BISHOP_MOVES[i][1];
                            const nr = r + dr, nc = c + dc;
                            if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
                            if (side === 0 ? nr < 5 : nr > 4) continue; // 象不过河
                            if (board[(r + dr / 2) * 9 + (c + dc / 2)]) continue; // 塞象眼
                            const to = nr * 9 + nc;
                            if (board[to] && sideOf(board[to]) === side) continue;
                            out.push(from * 128 + to);
                        }
                        break;
                    }
                    case KNIGHT: {
                        for (let i = 0; i < 8; i++) {
                            const m = KNIGHT_MOVES[i];
                            const nr = r + m[0], nc = c + m[1];
                            if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
                            if (board[(r + m[2]) * 9 + (c + m[3])]) continue; // 蹩马腿
                            const to = nr * 9 + nc;
                            if (board[to] && sideOf(board[to]) === side) continue;
                            out.push(from * 128 + to);
                        }
                        break;
                    }
                    case ROOK: {
                        for (let i = 0; i < 4; i++) {
                            const dr = ORTHO[i][0], dc = ORTHO[i][1];
                            let nr = r + dr, nc = c + dc;
                            while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                const to = nr * 9 + nc;
                                const target = board[to];
                                if (!target) {
                                    out.push(from * 128 + to);
                                } else {
                                    if (sideOf(target) !== side) out.push(from * 128 + to);
                                    break;
                                }
                                nr += dr; nc += dc;
                            }
                        }
                        break;
                    }
                    case CANNON: {
                        for (let i = 0; i < 4; i++) {
                            const dr = ORTHO[i][0], dc = ORTHO[i][1];
                            let nr = r + dr, nc = c + dc;
                            let screen = false;
                            while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                const to = nr * 9 + nc;
                                const target = board[to];
                                if (!screen) {
                                    if (!target) out.push(from * 128 + to);
                                    else screen = true;
                                } else if (target) {
                                    if (sideOf(target) !== side) out.push(from * 128 + to);
                                    break;
                                }
                                nr += dr; nc += dc;
                            }
                        }
                        break;
                    }
                    case PAWN: {
                        const forward = side === 0 ? -1 : 1;
                        const nr = r + forward;
                        if (nr >= 0 && nr <= 9) {
                            const to = nr * 9 + c;
                            if (!board[to] || sideOf(board[to]) !== side) out.push(from * 128 + to);
                        }
                        const crossed = side === 0 ? r <= 4 : r >= 5;
                        if (crossed) {
                            if (c > 0) {
                                const to = r * 9 + c - 1;
                                if (!board[to] || sideOf(board[to]) !== side) out.push(from * 128 + to);
                            }
                            if (c < 8) {
                                const to = r * 9 + c + 1;
                                if (!board[to] || sideOf(board[to]) !== side) out.push(from * 128 + to);
                            }
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        }
        return out;
    }

    /** 目标格是否被 bySide 方攻击（含将帅照面） */
    function isAttacked(board, target, bySide) {
        const tr = rowOf(target), tc = colOf(target);
        const enemy = bySide === 0 ? 0 : BLACK_OFFSET; // 攻击方棋子的编码偏移

        // 兵/卒
        if (bySide === 0) {
            // 红兵从下方直攻
            if (tr < 9) {
                const p = board[(tr + 1) * 9 + tc];
                if (p === PAWN) return true;
            }
            // 过河红兵从左右横攻（兵所在行 <= 4）
            if (tr <= 4) {
                if (tc > 0 && board[tr * 9 + tc - 1] === PAWN) return true;
                if (tc < 8 && board[tr * 9 + tc + 1] === PAWN) return true;
            }
        } else {
            if (tr > 0) {
                const p = board[(tr - 1) * 9 + tc];
                if (p === PAWN + BLACK_OFFSET) return true;
            }
            if (tr >= 5) {
                if (tc > 0 && board[tr * 9 + tc - 1] === PAWN + BLACK_OFFSET) return true;
                if (tc < 8 && board[tr * 9 + tc + 1] === PAWN + BLACK_OFFSET) return true;
            }
        }

        // 马
        for (let i = 0; i < 8; i++) {
            const m = KNIGHT_MOVES[i];
            const hr = tr - m[0], hc = tc - m[1];
            if (hr < 0 || hr > 9 || hc < 0 || hc > 8) continue;
            const p = board[hr * 9 + hc];
            if (p !== KNIGHT + enemy) continue;
            // 马腿：马身边、朝目标方向的那一格
            if (!board[(hr + m[2]) * 9 + (hc + m[3])]) return true;
        }

        // 象
        for (let i = 0; i < 4; i++) {
            const br = tr - BISHOP_MOVES[i][0], bc = tc - BISHOP_MOVES[i][1];
            if (br < 0 || br > 9 || bc < 0 || bc > 8) continue;
            if (board[br * 9 + bc] !== BISHOP + enemy) continue;
            if (!board[((br + tr) / 2) * 9 + ((bc + tc) / 2)]) return true;
        }

        // 仕
        for (let i = 0; i < 4; i++) {
            const ar = tr - ADVISOR_MOVES[i][0], ac = tc - ADVISOR_MOVES[i][1];
            if (ar < 0 || ar > 9 || ac < 0 || ac > 8) continue;
            if (board[ar * 9 + ac] === ADVISOR + enemy) return true;
        }

        // 车、炮、将帅（四方向扫描）
        for (let i = 0; i < 4; i++) {
            const dr = ORTHO[i][0], dc = ORTHO[i][1];
            let nr = tr + dr, nc = tc + dc;
            let first = 0, firstR = 0, firstC = 0, second = 0;
            while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                const p = board[nr * 9 + nc];
                if (p) {
                    if (!first) {
                        first = p;
                        firstR = nr;
                        firstC = nc;
                    } else {
                        second = p;
                        break;
                    }
                }
                nr += dr; nc += dc;
            }
            if (first && sideOf(first) === bySide) {
                // 车：同线第一个子
                if (first === ROOK + enemy) return true;
                // 将帅：相邻，或同一纵线上「白脸将」
                if (first === KING + enemy) {
                    if (Math.abs(firstR - tr) + Math.abs(firstC - tc) === 1) return true;
                    if (dc === 0) return true;
                }
            }
            // 炮：隔一个炮架后的第一个子
            if (second && second === CANNON + enemy) return true;
        }
        return false;
    }

    function findKing(board, side) {
        for (let i = 0; i < 90; i++) {
            const p = board[i];
            if (p === KING || p === KING + BLACK_OFFSET) {
                if (sideOf(p) === side) return i;
            }
        }
        return -1;
    }

    function inCheck(board, side) {
        const king = findKing(board, side);
        if (king < 0) return true;
        return isAttacked(board, king, side ^ 1);
    }

    // ---------------------------------------------------------------- 落子/撤销
    let hashA = 0;
    let hashB = 0;

    function recomputeHash(board, side) {
        hashA = 0;
        hashB = 0;
        for (let i = 0; i < 90; i++) {
            const p = board[i];
            if (!p) continue;
            const zi = zobristIndex(i, p);
            hashA ^= ZA[zi];
            hashB ^= ZB[zi];
        }
        if (side === 1) {
            hashA ^= SIDE_A[0];
            hashB ^= SIDE_B[0];
        }
    }

    function currentKey() {
        return (hashA >>> 0) * 2097152 + (hashB >>> 11);
    }

    function doMove(board, move) {
        const from = move >> 7, to = move & 127;
        const piece = board[from];
        const captured = board[to];
        const ziFrom = zobristIndex(from, piece);
        hashA ^= ZA[ziFrom];
        hashB ^= ZB[ziFrom];
        if (captured) {
            const ziTo = zobristIndex(to, captured);
            hashA ^= ZA[ziTo];
            hashB ^= ZB[ziTo];
        }
        const ziTo2 = zobristIndex(to, piece);
        hashA ^= ZA[ziTo2];
        hashB ^= ZB[ziTo2];
        hashA ^= SIDE_A[0];
        hashB ^= SIDE_B[0];
        board[to] = piece;
        board[from] = 0;
        return captured;
    }

    function undoMove(board, move, captured) {
        const from = move >> 7, to = move & 127;
        const piece = board[to];
        board[from] = piece;
        board[to] = captured || 0;
        const ziFrom = zobristIndex(from, piece);
        hashA ^= ZA[ziFrom];
        hashB ^= ZB[ziFrom];
        const ziTo2 = zobristIndex(to, piece);
        hashA ^= ZA[ziTo2];
        hashB ^= ZB[ziTo2];
        if (captured) {
            const ziTo = zobristIndex(to, captured);
            hashA ^= ZA[ziTo];
            hashB ^= ZB[ziTo];
        }
        hashA ^= SIDE_A[0];
        hashB ^= SIDE_B[0];
    }

    function legalMoves(board, side, out) {
        const pseudo = generateMoves(board, side, out || []);
        const kingSq = findKing(board, side);
        const legal = [];
        for (let i = 0; i < pseudo.length; i++) {
            const move = pseudo[i];
            const captured = doMove(board, move);
            const kingNow = (move >> 7) === kingSq ? (move & 127) : kingSq;
            if (kingNow >= 0 && !isAttacked(board, kingNow, side ^ 1)) legal.push(move);
            undoMove(board, move, captured);
        }
        return legal;
    }

    // ---------------------------------------------------------------- 评估
    function evaluate(board, side) {
        let score = 0;
        const pawns = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const rooks = [];

        for (let i = 0; i < 90; i++) {
            const piece = board[i];
            if (!piece) continue;
            const pSide = sideOf(piece);
            const type = typeOf(piece);
            const r = (i / 9) | 0, c = i % 9;
            let value = PIECE_VALUE[type];
            if (pSide === 0) {
                value += PST[type][i];
            } else {
                value += PST[type][(9 - r) * 9 + c];
            }
            if (type === PAWN) pawns[pSide * 9 + c]++;
            else if (type === ROOK) rooks.push(pSide, c);
            score += pSide === 0 ? value : -value;
        }

        for (let i = 0; i < rooks.length; i += 2) {
            const pSide = rooks[i], c = rooks[i + 1];
            if (pawns[pSide * 9 + c] === 0) score += pSide === 0 ? 12 : -12;
            if (pawns[(1 - pSide) * 9 + c] === 0) score += pSide === 0 ? 8 : -8;
        }

        return side === 0 ? score : -score;
    }

    // ---------------------------------------------------------------- 搜索
    const TT = new Map();
    const TT_LIMIT = 120000;
    const historyHeuristic = new Float64Array(128 * 128);
    const killers = new Int32Array(128);

    let S = null;

    function newSearchState(board, side, timeMs, maxDepth) {
        return {
            board: new Uint8Array(board),
            rootSide: side,
            nodes: 0,
            deadline: (typeof performance !== 'undefined' ? performance.now() : Date.now()) + timeMs,
            stopped: false,
            maxDepth,
            path: [],
            pathLen: 0,
            moveBuffers: []
        };
    }

    function now() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    function isRepetition() {
        const key = currentKey();
        for (let i = S.pathLen - 2; i >= 0; i--) {
            if (S.path[i] === key) return true;
        }
        return false;
    }

    function moveScore(move, ttMove, ply) {
        if (move === ttMove) return 1e9;
        const from = move >> 7, to = move & 127;
        const victim = S.board[to];
        if (victim) {
            const attacker = S.board[from];
            return 1e7 + PIECE_VALUE[typeOf(victim)] * 16 - PIECE_VALUE[typeOf(attacker)];
        }
        if (move === killers[ply]) return 5e6;
        return historyHeuristic[move] || 0;
    }

    function orderMoves(moves, ttMove, ply, bufferIndex) {
        let buf = S.moveBuffers[bufferIndex];
        if (!buf) buf = S.moveBuffers[bufferIndex] = { moves: new Int32Array(128), scores: new Float64Array(128) };
        const n = moves.length;
        for (let i = 0; i < n; i++) {
            buf.moves[i] = moves[i];
            buf.scores[i] = moveScore(moves[i], ttMove, ply);
        }
        // 插入排序（着法数量不大，避免额外分配）
        for (let i = 1; i < n; i++) {
            const move = buf.moves[i];
            const score = buf.scores[i];
            let j = i - 1;
            while (j >= 0 && buf.scores[j] < score) {
                buf.moves[j + 1] = buf.moves[j];
                buf.scores[j + 1] = buf.scores[j];
                j--;
            }
            buf.moves[j + 1] = move;
            buf.scores[j + 1] = score;
        }
        return buf;
    }

    function checkTime() {
        if ((++S.nodes & 255) === 0 && now() > S.deadline) S.stopped = true;
        return S.stopped;
    }

    const QUIESCE_BUFFER_OFFSET = 64;

    function quiesce(alpha, beta, ply, qdepth) {
        if (checkTime()) return 0;
        const side = S.rootSide ^ (ply & 1);
        const stand = evaluate(S.board, side);
        if (qdepth >= 4) return stand;
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;

        const moves = legalMoves(S.board, side);
        const captures = [];
        for (let i = 0; i < moves.length; i++) {
            if (S.board[moves[i] & 127]) captures.push(moves[i]);
        }
        if (!captures.length) return alpha;

        const bufferIndex = QUIESCE_BUFFER_OFFSET + Math.min(qdepth, 8);
        const buf = orderMoves(captures, 0, ply, bufferIndex);
        const n = captures.length;

        for (let i = 0; i < n; i++) {
            const move = buf.moves[i];
            const victim = S.board[move & 127];
            // delta 裁剪：即便白吃也追不上 alpha
            if (stand + PIECE_VALUE[typeOf(victim)] + 180 < alpha) continue;
            const captured = doMove(S.board, move);
            S.path[S.pathLen++] = currentKey();
            const score = -quiesce(-beta, -alpha, ply + 1, qdepth + 1);
            S.pathLen--;
            undoMove(S.board, move, captured);
            if (S.stopped) return 0;
            if (score >= beta) return score;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }

    function negamax(depth, alpha, beta, ply) {
        if (checkTime()) return 0;
        const side = S.rootSide ^ (ply & 1);

        if (isRepetition()) return 0;
        if (inCheck(S.board, side) && ply < 12) depth += 1; // 将军延伸
        if (depth <= 0) return quiesce(alpha, beta, ply, 0);

        const key = currentKey();
        const entry = TT.get(key);
        let ttMove = 0;
        if (entry) {
            ttMove = entry.move;
            // 将军分数与搜索起点相关，跨搜索复用可能失真，直接忽略
            if (entry.depth >= depth && Math.abs(entry.score) < MATE - 1000) {
                if (entry.flag === 0) return entry.score;
                if (entry.flag === 1 && entry.score >= beta) return entry.score;
                if (entry.flag === 2 && entry.score <= alpha) return entry.score;
            }
        }

        const moves = legalMoves(S.board, side);
        if (!moves.length) return -MATE + ply; // 将死或困毙，均判负

        const buf = orderMoves(moves, ttMove, ply, ply);
        const n = moves.length;
        const alphaOriginal = alpha;
        let bestScore = -INF;
        let bestMove = 0;

        for (let i = 0; i < n; i++) {
            const move = buf.moves[i];
            const captured = doMove(S.board, move);
            S.path[S.pathLen++] = currentKey();
            const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
            S.pathLen--;
            undoMove(S.board, move, captured);
            if (S.stopped) return 0;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            if (score > alpha) alpha = score;
            if (alpha >= beta) {
                if (!S.board[move & 127]) {
                    historyHeuristic[move] += depth * depth;
                    killers[ply] = move;
                }
                break;
            }
        }

        if (!S.stopped) {
            if (TT.size > TT_LIMIT) TT.clear();
            const flag = bestScore <= alphaOriginal ? 2 : (bestScore >= beta ? 1 : 0);
            TT.set(key, { depth, score: bestScore, flag, move: bestMove });
        }
        return bestScore;
    }

    function rootSearch(depth, preferred, fullWindow) {
        const side = S.rootSide;
        const moves = legalMoves(S.board, side);
        if (!moves.length) return { move: 0, score: -MATE, scores: [] };

        const buf = orderMoves(moves, preferred, 0, 60);
        let alpha = -INF;
        let bestMove = buf.moves[0];
        let bestScore = -INF;
        const scores = [];

        for (let i = 0; i < moves.length; i++) {
            const move = buf.moves[i];
            const captured = doMove(S.board, move);
            S.path[S.pathLen++] = currentKey();
            const score = fullWindow
                ? -negamax(depth - 1, -INF, INF, 1)
                : -negamax(depth - 1, -INF, -alpha, 1);
            S.pathLen--;
            undoMove(S.board, move, captured);
            if (S.stopped) break;
            scores.push({ move, score });
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            if (score > alpha) alpha = score;
        }
        return { move: bestMove, score: bestScore, scores };
    }

    /**
     * 搜索最佳着法。
     * @param {Uint8Array} board 90 格棋盘（本模块编码）
     * @param {number} side 0 红 / 1 黑
     * @param {{timeMs?:number, maxDepth?:number, fullWindow?:boolean, margin?:number, blunder?:number}} [opts]
     * @returns {{move:number, score:number, depth:number, nodes:number, scores:Array}}
     */
    function analyze(board, side, opts) {
        opts = opts || {};
        const timeMs = opts.timeMs || 400;
        const maxDepth = opts.maxDepth || 5;
        S = newSearchState(board, side, timeMs, maxDepth);
        recomputeHash(S.board, side);
        S.path[0] = currentKey();
        S.pathLen = 1;
        killers.fill(0);

        let best = { move: 0, score: 0, scores: [] };
        let completedDepth = 0;

        for (let depth = 1; depth <= maxDepth; depth++) {
            const result = rootSearch(depth, best.move, depth === 1 || opts.fullWindow !== false);
            if (S.stopped) break;
            if (result.move) {
                best = result;
                completedDepth = depth;
            }
            if (Math.abs(best.score) > MATE - 1000) break;
            if (now() > S.deadline - 12) break;
            if (opts.maxDepth && depth >= opts.maxDepth) break;
        }

        // 低难度：在接近最优的着法中随机挑选，制造不确定性
        let chosen = best.move;
        if (best.scores.length > 1 && (opts.margin || opts.blunder)) {
            const margin = opts.margin || 0;
            const blunder = opts.blunder || 0;
            if (blunder > 0 && Math.random() < blunder) {
                const pool = best.scores.slice(0, Math.min(best.scores.length, 6));
                chosen = pool[Math.floor(Math.random() * pool.length)].move;
            } else if (margin > 0) {
                const threshold = best.score - margin;
                const pool = best.scores.filter((s) => s.score >= threshold);
                if (pool.length > 1) chosen = pool[Math.floor(Math.random() * pool.length)].move;
            }
        }

        // 保底：任何情况下都返回合法着法
        if (!chosen) {
            const fallback = legalMoves(S.board, side);
            chosen = fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : 0;
        }

        return {
            move: chosen,
            score: best.score,
            depth: completedDepth,
            nodes: S.nodes,
            pvScore: best.score
        };
    }

    // ---------------------------------------------------------------- 适配层
    function fromLibBoard(libBoard) {
        const board = new Uint8Array(90);
        for (let r = 0; r < 10; r++) {
            const row = libBoard[r];
            for (let c = 0; c < 9; c++) {
                const piece = row[c];
                if (!piece) continue;
                const type = PIECE_TYPE_BY_CHAR[String(piece.type).toLowerCase()];
                if (!type) continue;
                board[r * 9 + c] = makePiece(piece.color === 'b' ? 1 : 0, type);
            }
        }
        return board;
    }

    function toSquares(move) {
        return {
            from: squareName(move >> 7),
            to: squareName(move & 127),
            iccs: squareName(move >> 7) + squareName(move & 127)
        };
    }

    const DIFFICULTY = {
        easy: { timeMs: 35, maxDepth: 2, margin: 140, blunder: 0.28, fullWindow: true },
        medium: { timeMs: 140, maxDepth: 4, margin: 30, blunder: 0.02, fullWindow: true },
        hard: { timeMs: 650, maxDepth: 7, margin: 0, blunder: 0, fullWindow: false }
    };

    /**
     * 面向棋局的接口：直接给定 xiangqi.js 实例。
     * @returns {{from:string,to:string,iccs:string,score:number,depth:number,nodes:number}|null}
     */
    function chooseMove(xiangqi, difficulty) {
        const board = fromLibBoard(xiangqi.board());
        const side = xiangqi.turn() === 'b' ? 1 : 0;
        const profile = DIFFICULTY[difficulty] || DIFFICULTY.medium;
        const result = analyze(board, side, profile);
        if (!result.move) return null;
        const squares = toSquares(result.move);
        return {
            from: squares.from,
            to: squares.to,
            iccs: squares.iccs,
            score: result.score,
            depth: result.depth,
            nodes: result.nodes
        };
    }

    return {
        chooseMove,
        analyze,
        DIFFICULTY,
        // 便于测试 / 二次开发
        fromLibBoard,
        squareIndex,
        squareName,
        generateMoves,
        legalMoves,
        isAttacked,
        inCheck,
        evaluate,
        doMove,
        undoMove,
        recomputeHash,
        currentKey,
        resetTT: function () { TT.clear(); historyHeuristic.fill(0); }
    };
});
