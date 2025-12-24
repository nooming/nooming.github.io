// 使用 xiangqi.js 处理游戏逻辑，自己绘制棋盘

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;

// 计算每个格子的大小（留出边距）
function calculateCellSize() {
    // 根据canvas实际尺寸计算，确保格子是正方形
    const padding = 15; // 边距
    const availableWidth = canvas.width - padding * 2;
    const availableHeight = canvas.height - padding * 2;
    
    // 使用较小的尺寸确保格子是正方形
    const cellSize = Math.min(availableWidth / BOARD_WIDTH, availableHeight / BOARD_HEIGHT);
    
    return {
        width: cellSize,
        height: cellSize,
        padding: padding
    };
}

let cellSize = calculateCellSize();

const PIECE_IMAGES = {};
const PIECE_KEYS = ['rK', 'rA', 'rB', 'rN', 'rR', 'rC', 'rP', 'bK', 'bA', 'bB', 'bN', 'bR', 'bC', 'bP'];

let xiangqi = null;
let gameOver = false;
let selectedSquare = null;
let validMoves = [];
let boardBackground = null;
let gameMode = 'two'; // 'two' = 双人, 'ai' = 单人
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'

// 加载棋子图片
function loadPieceImages() {
    const promises = PIECE_KEYS.map(key => {
        const img = new Image();
        img.src = `lib/img/xiangqipieces/wikimedia/${key}.svg`;
        PIECE_IMAGES[key] = img;
        return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
    });
    return Promise.all(promises);
}

// 初始化游戏
function initGame() {
    xiangqi = new Xiangqi();
    cellSize = calculateCellSize();
    
    // 加载棋盘背景图
    boardBackground = new Image();
    boardBackground.onload = () => redraw();
    boardBackground.src = 'lib/img/xiangqiboards/wikimedia/xiangqiboard.svg';
    
    loadPieceImages().then(() => {
        redraw();
        updateStatus();
        updateUndoButton();
    });
}

// 绘制棋子
function drawPieces() {
    const board = xiangqi.board();
    
    for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
            const piece = board[row][col];
            if (piece) {
                drawPiece(row, col, piece);
            }
        }
    }
    
    // 绘制高亮
    if (selectedSquare) {
        drawHighlight(selectedSquare, '#ffeb3b');
        validMoves.forEach(move => {
            const targetSquare = typeof move === 'string' ? move.substring(2, 4) : (move.to || move.iccs?.substring(2, 4));
            if (targetSquare) {
                drawHighlight(targetSquare, '#4caf50');
            }
        });
    }
}

// 绘制单个棋子
function drawPiece(row, col, piece) {
    const x = cellSize.padding + (col + 0.5) * cellSize.width;
    const y = cellSize.padding + (row + 0.5) * cellSize.height;
    const size = Math.min(cellSize.width, cellSize.height) * 0.85;
    
    const pieceKey = piece.color + piece.type.toUpperCase();
    const img = PIECE_IMAGES[pieceKey];
    
    if (img && img.complete) {
        ctx.drawImage(img, x - size/2, y - size/2, size, size);
    } else if (img) {
        img.onload = () => redraw();
    }
}

// 绘制高亮
function drawHighlight(square, color) {
    const pos = squareToPosition(square);
    if (!pos) return;
    
    const x = cellSize.padding + (pos.col + 0.5) * cellSize.width;
    const y = cellSize.padding + (pos.row + 0.5) * cellSize.height;
    const radius = Math.min(cellSize.width, cellSize.height) * 0.4;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

// 将坐标转换为格子位置
function getSquareFromPosition(x, y) {
    const adjustedX = x - cellSize.padding;
    const adjustedY = y - cellSize.padding;
    
    if (adjustedX < 0 || adjustedY < 0) return null;
    
    let col = Math.floor(adjustedX / cellSize.width);
    col = Math.max(0, Math.min(col, BOARD_WIDTH - 1));
    
    let canvasRow = Math.floor(adjustedY / cellSize.height);
    canvasRow = Math.max(0, Math.min(canvasRow, BOARD_HEIGHT - 1));
    
    const colChar = String.fromCharCode(97 + col);
    const rowNum = 9 - canvasRow;
    return colChar + rowNum;
}

// 将格子位置转换为坐标
function squareToPosition(square) {
    const col = square.charCodeAt(0) - 97;
    const canvasRow = 9 - parseInt(square.charAt(1));
    
    if (canvasRow >= 0 && canvasRow < BOARD_HEIGHT && col >= 0 && col < BOARD_WIDTH) {
        return { row: canvasRow, col };
    }
    return null;
}

// 清除选择
function clearSelection() {
    selectedSquare = null;
    validMoves = [];
}

// 检查是否为当前玩家的棋子
function isCurrentPlayerPiece(piece, currentTurn) {
    return piece && piece.color === currentTurn;
}

// 处理点击
function handleClick(e) {
    if (gameOver) return;
    
    const currentTurn = xiangqi.turn();
    // AI模式下，如果是黑方回合，阻止玩家操作
    if (gameMode === 'ai' && currentTurn === 'b') {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    const square = getSquareFromPosition(x, y);
    if (!square) return;
    
    const board = xiangqi.board();
    const pos = squareToPosition(square);
    const piece = board[pos.row][pos.col];
    
    if (selectedSquare) {
        if (selectedSquare === square) {
            clearSelection();
            redraw();
            return;
        }
        
        if (isCurrentPlayerPiece(piece, currentTurn)) {
            selectSquare(square);
            return;
        }
        
        const move = xiangqi.move({ from: selectedSquare, to: square });
        if (move === null) {
            clearSelection();
            redraw();
            return;
        }
        
        clearSelection();
        redraw();
        updateStatus();
        updateUndoButton();
        checkGameOver();
        
        // AI模式下，玩家移动后触发AI移动
        if (gameMode === 'ai' && !gameOver && xiangqi.turn() === 'b') {
            setTimeout(() => {
                aiMove();
            }, 300);
        }
    } else {
        if (isCurrentPlayerPiece(piece, currentTurn)) {
            selectSquare(square);
        }
    }
}

// 选择格子
function selectSquare(square) {
    selectedSquare = square;
    validMoves = xiangqi.moves({ square: square, verbose: true });
    redraw();
}

// 重绘
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制背景
    ctx.fillStyle = '#deb887';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制棋盘背景
    if (boardBackground && boardBackground.complete) {
        const boardWidth = cellSize.width * BOARD_WIDTH;
        const boardHeight = cellSize.height * BOARD_HEIGHT;
        ctx.drawImage(boardBackground, cellSize.padding, cellSize.padding, boardWidth, boardHeight);
    }
    
    drawPieces();
}

// 更新状态显示
function updateStatus() {
    const statusEl = document.getElementById('status');
    
    if (gameOver) {
        return;
    }
    
    const turn = xiangqi.turn();
    const inCheck = xiangqi.in_check();
    
    if (xiangqi.in_checkmate()) {
        const winner = turn === 'r' ? '黑方' : '红方';
        statusEl.textContent = `${winner}获胜！`;
        gameOver = true;
    } else if (xiangqi.in_draw()) {
        statusEl.textContent = '和棋！';
        gameOver = true;
    } else if (xiangqi.in_stalemate()) {
        statusEl.textContent = '困毙！';
        gameOver = true;
    } else {
        const player = turn === 'r' ? '红方' : '黑方';
        const checkText = inCheck ? ' - 将军！' : '';
        statusEl.textContent = `${player}回合${checkText}`;
    }
}

// 检查游戏是否结束
function checkGameOver() {
    if (xiangqi.game_over()) {
        gameOver = true;
        updateStatus();
    }
}

// 悔棋
function undoMove() {
    if (gameOver) return;
    
    if (gameMode === 'ai') {
        // AI模式：撤销两步（玩家和AI）
        if (xiangqi.history().length < 2) return;
        xiangqi.undo(); // 撤销AI的步
        xiangqi.undo(); // 撤销玩家的步
    } else {
        // 双人模式：撤销一步
        if (!xiangqi.history().length) return;
        xiangqi.undo();
    }
    
    clearSelection();
    gameOver = false;
    redraw();
    updateStatus();
    updateUndoButton();
}

// 更新悔棋按钮状态
function updateUndoButton() {
    const undoBtn = document.getElementById('undoBtn');
    if (gameMode === 'ai') {
        // AI模式下需要至少两步才能悔棋（玩家+AI）
        undoBtn.disabled = xiangqi.history().length < 2 || gameOver;
    } else {
        // 双人模式下至少一步
        undoBtn.disabled = !xiangqi.history().length || gameOver;
    }
}

// 重置游戏
function resetGame() {
    xiangqi.reset();
    clearSelection();
    gameOver = false;
    redraw();
    updateStatus();
    updateUndoButton();
}

// 棋子价值评估
const PIECE_VALUES = {
    'K': 10000, 'A': 20, 'B': 20, 'N': 40, 'R': 90, 'C': 45, 'P': 10
};

// 评估棋盘局面
function evaluatePosition() {
    const board = xiangqi.board();
    let score = 0;
    
    for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
            const piece = board[row][col];
            if (piece) {
                const value = PIECE_VALUES[piece.type.toUpperCase()] || 0;
                score += piece.color === 'r' ? value : -value;
            }
        }
    }
    
    return score;
}

// AI移动
function aiMove() {
    if (gameOver || xiangqi.turn() !== 'b') return;
    
    const moves = xiangqi.moves({ verbose: true });
    if (moves.length === 0) return;
    
    let bestMove = null;
    let bestScore = -Infinity;
    
    if (aiDifficulty === 'easy') {
        // 简单难度：随机选择，但优先吃子
        const captureMoves = moves.filter(m => m.captured);
        if (captureMoves.length > 0 && Math.random() > 0.3) {
            bestMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
        } else {
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        }
    } else if (aiDifficulty === 'medium') {
        // 中等难度：评估所有移动，选择最好的
        for (const move of moves) {
            xiangqi.move(move);
            const score = -evaluatePosition(); // 负号因为评估是从红方角度
            xiangqi.undo();
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
    } else {
        // 困难难度：考虑对手的最佳回应（简单minimax）
        for (const move of moves) {
            xiangqi.move(move);
            
            // 如果AI能获胜，直接选择
            if (xiangqi.in_checkmate() || xiangqi.in_check()) {
                xiangqi.undo();
                bestMove = move;
                break;
            }
            
            // 评估对手的最佳回应
            const opponentMoves = xiangqi.moves({ verbose: true });
            let worstScore = Infinity;
            
            for (const oppMove of opponentMoves) {
                xiangqi.move(oppMove);
                const score = -evaluatePosition();
                xiangqi.undo();
                worstScore = Math.min(worstScore, score);
            }
            
            xiangqi.undo();
            
            if (worstScore > bestScore) {
                bestScore = worstScore;
                bestMove = move;
            }
        }
    }
    
    if (bestMove) {
        const move = xiangqi.move(bestMove);
        if (move) {
            redraw();
            updateStatus();
            updateUndoButton();
            checkGameOver();
        }
    }
}

// 事件监听
canvas.addEventListener('click', handleClick);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleClick(e);
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

// 初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
