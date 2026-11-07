/*
 * 中文记谱（XFEN/ICCS 之外的人类可读记法）
 * ------------------------------------------------------------
 * 规则：
 *   - 红方纵线自右向左为 一…九，黑方自右向左为 1…9。
 *   - 车/炮/兵/帅：进/退后跟移动的格数；平后跟目标纵线。
 *   - 马/相/仕：进/退后跟目标纵线。
 *   - 同一纵线上有同类棋子时，改用「前/后（/中）」开头。
 *
 * 记谱只依赖走子前的局面，因此调用方需要在落子前传入棋盘快照。
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        (root.XQ = root.XQ || {}).Notation = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const RED_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const BLACK_NUMERALS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const PIECE_NAMES = {
        r: { k: '帅', a: '仕', b: '相', n: '马', r: '车', c: '炮', p: '兵' },
        b: { k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒' }
    };
    const DIAGONAL_TYPES = { n: true, b: true, a: true };

    function fileOf(col) {
        return String.fromCharCode(97 + col);
    }

    /** 棋盘坐标 -> { row, col }（a9 为左上角） */
    function parseSquare(square) {
        return { row: 9 - Number(square.charAt(1)), col: square.charCodeAt(0) - 97 };
    }

    /** 红方纵线号：红自右向左 一…九，即 col 8 -> 一、col 0 -> 九 */
    function fileNumber(color, col) {
        return color === 'r' ? 9 - col : col + 1;
    }

    function numeral(color, value) {
        const table = color === 'r' ? RED_NUMERALS : BLACK_NUMERALS;
        return table[value - 1] || String(value);
    }

    /** 同一纵线上多个同类棋子时的前缀：前 / 中 / 后（数量更多时用序数） */
    function ordinalPrefix(color, index, total) {
        if (index === 0) return '前';
        if (index === total - 1) return '后';
        if (total === 3) return '中';
        return numeral(color, index + 1);
    }

    /**
     * 生成中文记谱。
     * @param {Array} board 走子前的棋盘（board[row][col]，元素形如 {type,color}）
     * @param {{color:string,piece:string,from:string,to:string}} move
     * @returns {string} 例如「炮二平五」「马8进7」
     */
    function toChinese(board, move) {
        if (!board || !move || !move.from || !move.to) return '';

        const from = parseSquare(move.from);
        const to = parseSquare(move.to);
        const color = move.color === 'b' ? 'b' : 'r';
        const type = String(move.piece || '').toLowerCase();
        const name = (PIECE_NAMES[color] || {})[type] || '';

        // 统计同一纵线上的同类同伴（走子前）
        const sameFile = [];
        for (let row = 0; row < 10; row++) {
            const piece = board[row] && board[row][from.col];
            if (piece && piece.color === color && String(piece.type).toLowerCase() === type) {
                sameFile.push(row);
            }
        }

        let head;
        if (sameFile.length >= 2) {
            // 「前」= 更靠近对方底线的一方
            sameFile.sort((a, b) => (color === 'r' ? a - b : b - a));
            const index = sameFile.indexOf(from.row);
            head = ordinalPrefix(color, index < 0 ? 0 : index, sameFile.length) + name;
        } else {
            head = name + numeral(color, fileNumber(color, from.col));
        }

        const deltaRow = to.row - from.row;
        let direction;
        if (deltaRow === 0) {
            direction = '平';
        } else if ((color === 'r' && deltaRow < 0) || (color === 'b' && deltaRow > 0)) {
            direction = '进';
        } else {
            direction = '退';
        }

        // 平：写目标纵线；马/相/仕：写目标纵线；其余：写移动格数
        const target = direction === '平' || DIAGONAL_TYPES[type]
            ? numeral(color, fileNumber(color, to.col))
            : numeral(color, Math.abs(deltaRow));

        return head + direction + target;
    }

    /** 红黑双方通用的简短着法：ICCS（如 h2e2） */
    function toIccs(move) {
        if (!move || !move.from || !move.to) return '';
        return move.from + move.to;
    }

    return { toChinese, toIccs, parseSquare, fileNumber, PIECE_NAMES };
});
