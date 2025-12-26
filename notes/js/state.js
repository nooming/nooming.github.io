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
let isDrawing = false;
let currentColor = '#000000';
let currentSize = 3;
let currentMode = 'pen'; // 'pen' 或 'eraser' 或 'drag'
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
let pendingPoints = []; // 待绘制的点队列（移动端优化）
let rafId = null; // requestAnimationFrame ID

// 工具函数
// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

