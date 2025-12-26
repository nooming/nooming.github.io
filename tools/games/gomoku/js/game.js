// 五子棋游戏逻辑
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const BOARD_SIZE = 15;
const CELL_SIZE = canvas.width / (BOARD_SIZE + 1);
const STONE_RADIUS = CELL_SIZE * 0.4;

let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1; // 1 = 黑, 2 = 白
let gameMode = 'two'; // 'two' = 双人, 'ai' = 单人
let gameOver = false;
let stones = []; // 存储已放置的棋子位置
let moveHistory = []; // 存储每一步的历史记录
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'

// 初始化棋盘
function initBoard() {
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;

    // 绘制网格线
    for (let i = 1; i <= BOARD_SIZE; i++) {
        const pos = i * CELL_SIZE;
        // 横线
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE, pos);
        ctx.lineTo(BOARD_SIZE * CELL_SIZE, pos);
        ctx.stroke();
        // 竖线
        ctx.beginPath();
        ctx.moveTo(pos, CELL_SIZE);
        ctx.lineTo(pos, BOARD_SIZE * CELL_SIZE);
        ctx.stroke();
    }

    // 绘制天元（15路五子棋标准：只在中心位置标记一个点）
    const tengen = Math.floor(BOARD_SIZE / 2) + 1; // 中心位置（第8行第8列）
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(tengen * CELL_SIZE, tengen * CELL_SIZE, 4, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制棋子
function drawStone(row, col, player) {
    const x = (col + 1) * CELL_SIZE;
    const y = (row + 1) * CELL_SIZE;

    ctx.beginPath();
    ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
    
    if (player === 1) {
        // 黑棋
        const gradient = ctx.createRadialGradient(x - STONE_RADIUS * 0.3, y - STONE_RADIUS * 0.3, 0, x, y, STONE_RADIUS);
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(1, '#000');
        ctx.fillStyle = gradient;
    } else {
        // 白棋
        const gradient = ctx.createRadialGradient(x - STONE_RADIUS * 0.3, y - STONE_RADIUS * 0.3, 0, x, y, STONE_RADIUS);
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ddd');
        ctx.fillStyle = gradient;
    }
    
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 检查是否获胜
function checkWin(row, col, player) {
    const directions = [
        [[0, 1], [0, -1]],   // 横向
        [[1, 0], [-1, 0]],   // 纵向
        [[1, 1], [-1, -1]],  // 主对角线
        [[1, -1], [-1, 1]]   // 副对角线
    ];

    for (let dir of directions) {
        let count = 1; // 包含当前棋子
        
        for (let d of dir) {
            let r = row + d[0];
            let c = col + d[1];
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                count++;
                r += d[0];
                c += d[1];
            }
        }
        
        if (count >= 5) {
            return true;
        }
    }
    return false;
}

// 评估单个方向的连子情况
function evaluateDirection(row, col, dr, dc, player) {
    let count = 1; // 当前位置
    let blocked1 = false, blocked2 = false;
    
    // 向前检查
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
    }
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== 0) {
        blocked1 = true;
    }
    
    // 向后检查
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
    }
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== 0) {
        blocked2 = true;
    }
    
    return { count, blocked1, blocked2 };
}

// 成熟的五子棋评估函数（基于开源实现）
function evaluateThreat(row, col, player) {
    if (board[row][col] !== 0) return 0;
    
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let score = 0;
    let liveFour = 0, rushFour = 0, liveThree = 0, rushThree = 0;
    let doubleThree = false;
    
    // 临时放置棋子进行评估
    board[row][col] = player;
    
    for (let [dr, dc] of directions) {
        const { count, blocked1, blocked2 } = evaluateDirection(row, col, dr, dc, player);
        
        if (count >= 5) {
            // 连五（获胜）
            board[row][col] = 0;
            return 10000000;
        } else if (count === 4) {
            if (!blocked1 && !blocked2) {
                // 活四（必杀）
                liveFour++;
                score += 100000;
            } else if (!blocked1 || !blocked2) {
                // 冲四
                rushFour++;
                score += 10000;
            }
        } else if (count === 3) {
            if (!blocked1 && !blocked2) {
                // 活三
                liveThree++;
                score += 1000;
            } else if (!blocked1 || !blocked2) {
                // 眠三
                rushThree++;
                score += 100;
            }
        } else if (count === 2) {
            if (!blocked1 && !blocked2) {
                // 活二
                score += 10;
            } else if (!blocked1 || !blocked2) {
                // 眠二
                score += 1;
            }
        }
    }
    
    // 恢复棋盘
    board[row][col] = 0;
    
    // 特殊模式识别（基于成熟五子棋AI的评估）
    if (liveFour >= 1) {
        score += 500000; // 活四必杀
    }
    if (liveThree >= 2) {
        score += 50000; // 双活三必杀
        doubleThree = true;
    }
    if (rushFour >= 2) {
        score += 30000; // 双冲四
    }
    if (liveThree >= 1 && rushFour >= 1) {
        score += 20000; // 冲四活三组合
    }
    if (liveThree >= 1 && rushThree >= 1) {
        score += 5000; // 活三眠三组合
    }
    
    return score;
}

// 获取智能候选走法（改进：考虑全局热点）
function getSmartCandidateMoves(searchRadius = 2) {
    const candidateMoves = new Set();
    
    // 1. 已有棋子周围
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) {
                for (let dr = -searchRadius; dr <= searchRadius; dr++) {
                    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === 0) {
                            candidateMoves.add(`${nr},${nc}`);
                        }
                    }
                }
            }
        }
    }
    
    // 2. 如果棋盘较空，添加中心位置
    let stoneCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] !== 0) stoneCount++;
        }
    }
    if (stoneCount < 4) {
        const center = Math.floor(BOARD_SIZE / 2);
        if (board[center][center] === 0) {
            candidateMoves.add(`${center},${center}`);
        }
    }
    
    return candidateMoves;
}

// 成熟的Negamax算法（基于开源实现，优化版）
function negamax(depth, alpha, beta, player) {
    // 快速检查是否有人获胜
    const winCheck = checkWinForPlayer(player);
    if (winCheck.win) {
        return winCheck.player === player ? 10000000 : -10000000;
    }
    
    if (depth === 0) {
        // 评估当前局面（从当前玩家角度）
        return evaluatePosition(player);
    }
    
    const candidateMoves = getSmartCandidateMoves(2);
    if (candidateMoves.size === 0) {
        return 0; // 平局
    }
    
    // 对候选走法进行评分和排序
    const movesWithScores = [];
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        const score = evaluateThreat(r, c, player);
        movesWithScores.push({ row: r, col: c, score });
    }
    movesWithScores.sort((a, b) => b.score - a.score);
    
    // 根据深度限制搜索的走法数量
    const maxMoves = depth >= 3 ? 8 : (depth >= 2 ? 12 : 15);
    const topMoves = movesWithScores.slice(0, Math.min(maxMoves, movesWithScores.length));
    
    let bestScore = -Infinity;
    for (let move of topMoves) {
        board[move.row][move.col] = player;
        const score = -negamax(depth - 1, -beta, -alpha, player === 1 ? 2 : 1);
        board[move.row][move.col] = 0;
        
        bestScore = Math.max(bestScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break; // Alpha-Beta剪枝
    }
    
    return bestScore;
}

// 检查是否有玩家获胜（优化版）
function checkWinForPlayer(player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player && checkWin(r, c, player)) {
                return { win: true, player };
            }
        }
    }
    return { win: false };
}

// 评估整个局面的价值（成熟的五子棋评估方法）
function evaluatePosition(player) {
    let score = 0;
    const opponent = player === 1 ? 2 : 1;
    
    // 评估所有空位的威胁
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) {
                const myThreat = evaluateThreat(r, c, player);
                const oppThreat = evaluateThreat(r, c, opponent);
                // 防守权重略高于进攻（1.1倍）
                score += (myThreat - oppThreat * 1.1);
            }
        }
    }
    
    return score;
}

// AI 落子（智能策略）
function aiMove() {
    // 简单难度：只做基本防守和进攻，有一定随机性
    if (aiDifficulty === 'easy') {
        return aiMoveEasy();
    }
    // 中等难度：当前逻辑
    else if (aiDifficulty === 'medium') {
        return aiMoveMedium();
    }
    // 困难难度：更深入的评估
    else {
        return aiMoveHard();
    }
}

// 简单难度AI（改进：使用智能候选走法）
function aiMoveEasy() {
    const candidateMoves = getSmartCandidateMoves(2);
    
    if (candidateMoves.size === 0) {
        return { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) };
    }
    
    const movesArray = Array.from(candidateMoves).map(m => {
        const [r, c] = m.split(',').map(Number);
        return { row: r, col: c };
    });
    
    // 简单难度：优先阻止玩家获胜，其他情况随机或简单评估
    for (let move of movesArray) {
        // 阻止玩家获胜
        board[move.row][move.col] = 1;
        if (checkWin(move.row, move.col, 1)) {
            board[move.row][move.col] = 0;
            return move;
        }
        board[move.row][move.col] = 0;
        
        // 自己获胜
        board[move.row][move.col] = 2;
        if (checkWin(move.row, move.col, 2)) {
            board[move.row][move.col] = 0;
            return move;
        }
        board[move.row][move.col] = 0;
    }
    
    // 简单评估：只考虑明显的威胁（连三、连四）
    const goodMoves = [];
    for (let move of movesArray) {
        const playerScore = evaluateThreat(move.row, move.col, 1);
        if (playerScore >= 500) { // 只考虑明显的威胁（活三以上）
            goodMoves.push(move);
        }
    }
    
    // 如果有明显威胁，随机选择一个；否则完全随机
    if (goodMoves.length > 0 && Math.random() > 0.3) {
        return goodMoves[Math.floor(Math.random() * goodMoves.length)];
    }
    
    return movesArray[Math.floor(Math.random() * movesArray.length)];
}

// 中等难度AI（基于成熟算法：2层Negamax）
function aiMoveMedium() {
    // 1. 检查是否能获胜（最高优先级）
    const candidateMoves = getSmartCandidateMoves(2);
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        board[r][c] = 2;
        if (checkWin(r, c, 2)) {
            board[r][c] = 0;
            return { row: r, col: c };
        }
        board[r][c] = 0;
    }
    
    // 2. 检查是否需要防守（阻止对手获胜）
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        board[r][c] = 1;
        if (checkWin(r, c, 1)) {
            board[r][c] = 0;
            return { row: r, col: c };
        }
        board[r][c] = 0;
    }
    
    // 3. 使用2层Negamax搜索
    let bestMove = null;
    let bestScore = -Infinity;
    
    // 先按评估函数排序，取前10个候选
    const movesWithScores = [];
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        const aiScore = evaluateThreat(r, c, 2);
        const playerScore = evaluateThreat(r, c, 1);
        const totalScore = aiScore * 1.2 + playerScore * 1.0;
        movesWithScores.push({ row: r, col: c, score: totalScore });
    }
    
    movesWithScores.sort((a, b) => b.score - a.score);
    const topMoves = movesWithScores.slice(0, 10);
    
    if (topMoves.length === 0) {
        return { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) };
    }
    
    // 对前10个走法使用2层Negamax评估
    for (let move of topMoves) {
        board[move.row][move.col] = 2;
        const score = negamax(2, -Infinity, Infinity, 2);
        board[move.row][move.col] = 0;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    return bestMove || topMoves[0];
}

// 困难难度AI：使用4层Negamax + 深度评估（基于成熟算法）
function aiMoveHard() {
    // 1. 检查是否能获胜（最高优先级）
    const candidateMoves = getSmartCandidateMoves(3);
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        board[r][c] = 2;
        if (checkWin(r, c, 2)) {
            board[r][c] = 0;
            return { row: r, col: c };
        }
        board[r][c] = 0;
    }
    
    // 2. 检查是否需要防守（阻止对手获胜）
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        board[r][c] = 1;
        if (checkWin(r, c, 1)) {
            board[r][c] = 0;
            return { row: r, col: c };
        }
        board[r][c] = 0;
    }
    
    // 3. 使用4层Negamax搜索
    let bestMove = null;
    let bestScore = -Infinity;
    
    // 先按评估函数排序，取前12个候选
    const movesWithScores = [];
    for (let move of candidateMoves) {
        const [r, c] = move.split(',').map(Number);
        const aiScore = evaluateThreat(r, c, 2);
        const playerScore = evaluateThreat(r, c, 1);
        const totalScore = aiScore * 1.5 + playerScore * 1.3;
        movesWithScores.push({ row: r, col: c, score: totalScore });
    }
    
    movesWithScores.sort((a, b) => b.score - a.score);
    const topMoves = movesWithScores.slice(0, 12);
    
    if (topMoves.length === 0) {
        return { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) };
    }
    
    // 对前12个走法使用4层Negamax评估
    for (let move of topMoves) {
        board[move.row][move.col] = 2;
        const score = negamax(4, -Infinity, Infinity, 2);
        board[move.row][move.col] = 0;
        
        // 结合评估函数分数（70%搜索分数 + 30%评估分数）
        const evalScore = evaluateThreat(move.row, move.col, 2) * 1.2 + 
                         evaluateThreat(move.row, move.col, 1) * 1.0;
        const combinedScore = score * 0.7 + evalScore * 0.3;
        
        if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMove = move;
        }
    }
    
    return bestMove || topMoves[0];
}

// 处理落子
function placeStone(row, col, isUndo = false) {
    if (gameOver || board[row][col] !== 0) {
        return;
    }

    board[row][col] = currentPlayer;
    drawStone(row, col, currentPlayer);
    
    // 记录历史（如果不是撤销操作）
    if (!isUndo) {
        moveHistory.push({
            row,
            col,
            player: currentPlayer,
            gameOver: false
        });
        updateUndoButton();
    }

    if (checkWin(row, col, currentPlayer)) {
        gameOver = true;
        const winner = currentPlayer === 1 ? '黑方' : '白方';
        document.getElementById('status').textContent = `${winner}获胜！`;
        if (!isUndo && moveHistory.length > 0) {
            moveHistory[moveHistory.length - 1].gameOver = true;
        }
        updateUndoButton();
        return;
    }

    // 检查平局
    let isFull = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) {
                isFull = false;
                break;
            }
        }
        if (!isFull) break;
    }
    if (isFull) {
        gameOver = true;
        document.getElementById('status').textContent = '平局！';
        if (!isUndo && moveHistory.length > 0) {
            moveHistory[moveHistory.length - 1].gameOver = true;
        }
        updateUndoButton();
        return;
    }

    // 切换玩家
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    document.getElementById('status').textContent = currentPlayer === 1 ? '黑方回合' : '白方回合';

    // AI 模式
    if (gameMode === 'ai' && currentPlayer === 2 && !gameOver && !isUndo) {
        setTimeout(() => {
            const aiMoveResult = aiMove();
            if (aiMoveResult) {
                placeStone(aiMoveResult.row, aiMoveResult.col);
            }
        }, 300);
    }
}

// 更新悔棋按钮状态
function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');
    if (gameMode === 'ai') {
        // AI模式下需要至少两步才能悔棋（玩家+AI）
        undoBtn.disabled = moveHistory.length < 2 || gameOver;
    } else {
        // 双人模式下至少一步
        undoBtn.disabled = moveHistory.length < 1 || gameOver;
    }
}

// 悔棋
function undoMove() {
    if (gameOver) return;
    
    if (gameMode === 'ai') {
        // AI模式：撤销两步（玩家和AI）
        if (moveHistory.length < 2) return;
        
        // 撤销AI的步
        const aiMove = moveHistory.pop();
        board[aiMove.row][aiMove.col] = 0;
        
        // 撤销玩家的步
        const playerMove = moveHistory.pop();
        board[playerMove.row][playerMove.col] = 0;
        
        // 重新绘制棋盘
        redrawBoard();
        
        // 恢复当前玩家
        currentPlayer = playerMove.player;
        document.getElementById('status').textContent = currentPlayer === 1 ? '黑方回合' : '白方回合';
    } else {
        // 双人模式：撤销一步
        if (moveHistory.length < 1) return;
        
        const lastMove = moveHistory.pop();
        board[lastMove.row][lastMove.col] = 0;
        
        // 重新绘制棋盘
        redrawBoard();
        
        // 恢复当前玩家
        currentPlayer = lastMove.player;
        document.getElementById('status').textContent = currentPlayer === 1 ? '黑方回合' : '白方回合';
    }
    
    updateUndoButton();
}

// 重新绘制整个棋盘
function redrawBoard() {
    initBoard();
    for (let move of moveHistory) {
        drawStone(move.row, move.col, move.player);
    }
}

// 获取点击坐标（处理移动端缩放）
function getClickPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        // 触摸事件
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        // 鼠标事件
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    const col = Math.round(x / CELL_SIZE) - 1;
    const row = Math.round(y / CELL_SIZE) - 1;
    
    return { row, col };
}

// 点击事件
canvas.addEventListener('click', (e) => {
    if (gameOver || (gameMode === 'ai' && currentPlayer === 2)) {
        return;
    }

    const { row, col } = getClickPosition(e);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        placeStone(row, col);
    }
});

// 触摸事件（移动端）
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 防止页面滚动
    if (gameOver || (gameMode === 'ai' && currentPlayer === 2)) {
        return;
    }

    const { row, col } = getClickPosition(e);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        placeStone(row, col);
    }
});

// 模式切换
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameMode = btn.dataset.mode;
        
        // 显示/隐藏难度选择器
        const difficultySelector = document.getElementById('difficultySelector');
        if (gameMode === 'ai') {
            difficultySelector.classList.add('show');
        } else {
            difficultySelector.classList.remove('show');
        }
        
        resetGame();
        updateUndoButton();
    });
});

// 难度切换
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        aiDifficulty = btn.dataset.difficulty;
    });
});

// 重置游戏
function resetGame() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    currentPlayer = 1;
    gameOver = false;
    stones = [];
    moveHistory = [];
    initBoard();
    document.getElementById('status').textContent = '黑方先行';
    updateUndoButton();
    
    // 初始化时显示/隐藏难度选择器
    const difficultySelector = document.getElementById('difficultySelector');
    if (gameMode === 'ai') {
        difficultySelector.classList.add('show');
    } else {
        difficultySelector.classList.remove('show');
    }
}

// 初始化
initBoard();
updateUndoButton();

