// 数据模型和状态管理

// 应用状态
let state = {
    pages: [], // 页面列表，每个页面有 type: 'text' 或 'draw'
    activePageId: null
};

// UI状态
let editingPageId = null;
let multiSelectMode = false; // 多选模式
let selectedPageIds = []; // 选中的页面ID数组
let floatingToolbarVisible = true; // 浮动工具栏是否可见
let sidebarVisible = true; // 侧边栏是否可见

// 画布状态
let canvas = null;
let ctx = null;
let offscreenCanvas = null; // 离屏canvas，用于存储已完成的笔画
let offscreenCtx = null;
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 3;
let currentMode = 'pen'; // 'pen' 或 'eraser' 或 'drag' 或 'select'
let colorPanelOpen = false; // 颜色面板是否展开
let sizePanelOpen = false; // 粗细面板是否展开
let drawPanelOpen = false; // 绘图页面面板是否展开
let textPanelOpen = false; // 文本页面面板是否展开
let canvasOffsetX = 0; // 画布X偏移量
let canvasOffsetY = 0; // 画布Y偏移量
let isDragging = false; // 是否正在拖拽画布
let dragStartX = 0; // 拖拽起始X坐标
let dragStartY = 0; // 拖拽起始Y坐标
let dragStartOffsetX = 0; // 拖拽起始时的偏移X
let dragStartOffsetY = 0; // 拖拽起始时的偏移Y
let lastDrawX = 0; // 上一次绘制的位置X
let lastDrawY = 0; // 上一次绘制的位置Y
let recentPoints = []; // 最近的点，用于平滑计算（最多8个点，Excalidraw风格）

// 文本编辑器状态
const TEXT_FONT_SIZE = 16; // 文本字体大小（固定，适配移动端）
let findPanelOpen = false; // 查找面板是否展开
let findText = ''; // 当前查找文本
let findMatches = []; // 查找结果匹配项
let currentFindIndex = -1; // 当前查找索引
let alignPanelOpen = false; // 对齐面板是否展开
let currentTextAlign = 'left'; // 当前文本对齐方式：'left', 'center', 'right'

// 预设颜色
const presetColors = [
    { name: '黑色', value: '#000000' },
    { name: '红色', value: '#FF0000' },
    { name: '蓝色', value: '#0066FF' },
    { name: '绿色', value: '#00AA00' },
    { name: '橙色', value: '#FF8800' },
    { name: '紫色', value: '#AA00AA' },
    { name: '棕色', value: '#8B4513' },
    { name: '灰色', value: '#808080' }
];

// 笔画数据
let strokes = []; // 存储所有笔画
let currentStroke = null; // 当前正在绘制的笔画
let lastEraserPos = null; // 删除模式下的上一个位置
let eraserTrailPoints = []; // 橡皮擦尾迹路径点
let eraserTrailAnimationFrame = null; // 尾迹动画帧ID
let strokesToDelete = new Set(); // 待删除的笔画ID集合

// 撤销/重做栈
let undoStack = []; // 撤销栈，存储历史状态
let redoStack = []; // 重做栈，存储被撤销的状态
const MAX_HISTORY_SIZE = 50; // 最大历史记录数量

// 选择工具状态
let selectedStrokeIds = new Set(); // 选中的笔画ID集合
let selectionBox = null; // 选择框 {x1, y1, x2, y2}
let isSelecting = false; // 是否正在框选
let selectionStartX = 0; // 选择框起始X
let selectionStartY = 0; // 选择框起始Y
let isMovingSelection = false; // 是否正在移动选中内容
let moveStartX = 0; // 移动起始X
let moveStartY = 0; // 移动起始Y
let isResizingSelection = false; // 是否正在缩放选中内容
let resizeHandle = null; // 缩放控制点类型
let resizeStartBounds = null; // 缩放起始边界
let resizeStartX = 0; // 缩放起始X
let resizeStartY = 0; // 缩放起始Y

// 工具函数已移至 utils.js

