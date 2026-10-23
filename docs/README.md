# noomings

顶栏导航 · 首页独立入口三格

## 项目简介

GitHub Pages 静态站：顶栏 **首页 · 实验 · 工具 · 阅读 · 娱乐**。首页 **独立入口**（导航 · 笔记 · Citywalk）+ **实践**（停车、物理外链）。用户可见文案见 [copy-style.md](./copy-style.md)。

## 功能特性

下列为功能说明，入口以顶栏与首页为准。`app/` 分域说明见 [app-ia.md](./app-ia.md)。

### 首页 · 独立入口（`#discover`）
- **导航**：[app/navigation/](../app/navigation/) — 外链主题索引
- **笔记**：[app/notes/](../app/notes/) — 画布 + 文本；本地持久化
- **Citywalk**：[app/citywalk/](../app/citywalk/)（说明见 [app/citywalk/README.md](../app/citywalk/README.md)）

### 首页 · 实践（`#practice`）
- **停车**：[app/parking-pso/](../app/parking-pso/) — 匈牙利或 PSO（在线优化服务）
- **物理探究**：https://physics.noomings.com（外链）

### 实验（顶栏 · `app/lab/`）
- 顶栏进入 [像素涌流](../app/lab/pixelflow/) · [质子](../app/lab/proton/) · [风扇转速](../app/lab/fan-rpm/)

### 阅读（顶栏 · `app/read/`）
- 顶栏进入 [Markdown](../app/read/markdown/) · [开发者工具实战](../app/read/crawler-experience/) · [猫抓笔记](../app/read/cat-catch-tutorial/)

### 工具（顶栏 · `app/tools/`）
- 顶栏默认 [PDF→图](../app/tools/doc-tools/pdf-to-images/) · 全量入口 [工具目录](../app/tools/)

### 娱乐（顶栏 · `app/play/`）
- 顶栏进入 [五子棋](../app/play/games/board-games/gomoku/) · 侧栏 / 移动菜单见棋类、卡牌、问卷等


## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Audio API
- LameJS (MP3编码)
- 中国象棋引擎库（xiangqi，`xiangqi.min.js`，位于 `app/play/games/board-games/chess/assets/lib/`）
- Perfect Freehand (手写笔记绘图库)
- marked + DOMPurify（Markdown 阅读；库文件在 `app/read/markdown/assets/js/vendor/`）
- PaddleOCR / `@ocr-web/core`（图片识字默认引擎；PP-OCRv5 ONNX，单线程 WASM；模型与 onnxruntime-web 从 jsDelivr 加载并缓存）
- Tesseract.js（图片识字轻量备选；按需从 CDN 加载 worker/core，语言模型从 tessdata 下载并缓存在浏览器）
- pdf.js、pdf-lib、JSZip、PptxGenJS（文档转换；从 jsDelivr 按需加载 · 文件不发送至服务器）
- Canvas API (绘图功能)
- LocalStorage (数据持久化)

## 代码注释约定

本仓库以 HTML/CSS/JavaScript 静态页为主；下表同时作为作者维护其它语言仓库时的习惯参考（本仓无 `.py` 源码时，Python 条仅作对照，不必强行套用）。

- **Python**：文件顶模块说明；分节用 `# --- 标题 ---` 或 `# ==================== 标题 ====================`；公开函数写 docstring；避免「修复 1」「！！！」等临时口吻。
- **JavaScript**：文件顶用 `// ========== 模块 · 职责 ==========` 或 JSDoc；大段逻辑用同级分隔线；业务说明用简短中文。
- **CSS**：文件顶一行 `/* ========== 页面/模块 ========== */`；区块可用 `/* --- 区块 --- */`。
- **HTML**：关键结构用 `<!-- 区域名：作用 -->`，不必每行标注。
- **不改动**：第三方压缩脚本（如 `*.min.js`、`lib/` 内库）。

## 项目结构

以下为仓库**顶层与常用子目录**示意，未穷尽列举各工具内的全部静态资源；路径模板与新增页面约定见下文「**前端目录约定**」。

```
├── index.html                  # 主页（样式见 assets/css/home.css）
├── 404.html                    # 自定义 404 页面
├── CNAME                       # GitHub Pages 自定义域名
├── docs/                       # README、CHANGELOG、copy-style、app-ia
├── assets/                     # 全站 CSS/JS/icons；site-shell、article.css、home.css
├── app/
│   ├── navigation/  notes/  citywalk/   # 首页 · 独立入口（Citywalk 独立壳）
│   ├── parking-pso/                     # 首页 · 实践
│   ├── lab/                             # 实验：proton、pixelflow、fan-rpm
│   ├── tools/                           # 工具：doc-tools、编码媒体、ocr、decision 随机、灯牌等
│   ├── read/                            # 阅读：markdown、站内长文
│   └── play/                            # 娱乐：games、psychological、gacha-planner
├── sitemap.xml
└── robots.txt
```

## 前端目录约定

根级 **`assets/`** 与各页目录下 **`assets/`** 的分工、相对引用方式与本地预览注意点如下。

- **`app/play/games/` 下各小游戏**：页面内静态资源优先放在各游戏目录的 **`assets/css/`**、**`assets/js/`**、**`assets/img/`**（可按需增删子目录），页面入口统一为 **`index.html`**，便于与「仅 HTML + 散落 css/js」的异构布局区分。
- **`app/play/games/board-games/`** 与 **`app/play/games/card-games/`**：无中间目录页；各对局在 **`gomoku/`、`go/`、`chess/`** 或 **`texas/`、`uno/`、`hearts/`**（各目录 `index.html`）；卡牌共享脚本与样式在 **`card-games/assets/`**（含 **`assets/common/`**）。
- **全站公共脚本**：通用 Toast、剪贴板、防抖、返回顶部等仅在根 **`assets/js/utils.js`**；手写笔记专用逻辑在 **`app/notes/assets/js/notes-utils.js`**，二者勿混用文件名。
- **`app/tools/`**：进制、Base64、二维码等工具的页面脚本与样式放在各子目录 **`assets/js/`**、**`assets/css/`**；音频转换、风扇转速等以单页内联或依赖根 **`assets/css/common.css`** / **`assets/js/utils.js`**（由页面写 `../` 链回到站根）为主。
- **导航壳**：`assets/css/site-shell.css`、`assets/js/site-shell.js` — 顶栏五域、桌面侧栏、移动底栏 + 分组菜单；批量注入见 `scripts/apply_site_shell.py`。**不挂壳**：`app/notes/`、`app/parking-pso/`、`app/citywalk/`（实验/工具/阅读/娱乐域内页挂壳）。
- **`app/tools/doc-tools/`**：文档转换合集；各子工具独立 **`index.html`**，共享 **`assets/css/doc-tools.css`**、**`assets/js/common.js`**；转换逻辑为 ES module，pdf.js 等从 CDN 动态 import。Office/COM 类能力仅在 **`windows/`** 说明，不提供 exe 下载。
- **`app/lab/`**、**`app/citywalk/`**、**`app/parking-pso/`**：重交互应用，业务资源在各自 **`assets/`**；通过相对路径引用站根 **`assets/`**。
- **`app/tools/decision/`**：随机三件套共享 **`assets/`**；抽卡规划在 **`app/play/gacha-planner/`**。
- **`app/read/markdown/`**：Markdown 阅读；页面脚本与样式在 **`assets/`**，第三方 **`marked`** / **`DOMPurify`** 放在 **`assets/js/vendor/`**，仓库文档清单为 **`catalog.json`**（GitHub Pages 不能列目录）。
- **`app/read/*/`**（长文）：共用 **`assets/css/article.css`**；新增长文放同目录 `index.html`，并在 **`site-shell.js`** 阅读侧栏与移动菜单登记。
- **`app/tools/ocr/`**：图片识字；页面脚本与样式在 **`assets/`**。默认引擎为 vendored `@ocr-web/core`（PP-OCRv5），ONNX Runtime WASM 与模型从 jsDelivr 加载（`numThreads: 1`，不依赖 COOP/COEP）；轻量引擎为 Tesseract.js（按需 CDN，`langPath` 指向 tessdata `4.0.0_fast`）。不把大模型打进仓库。

## 新增可访问页面时的检查清单

1. 新增或修改 **`index.html`（或其它入口 HTML）** 后，视情况更新 **`site-shell.js`** 侧栏 / 菜单；工具类可同步 **`app/tools/index.html`**。
2. 若页面应被搜索引擎发现，在 **[`sitemap.xml`](../sitemap.xml)** 中增加或更新对应 `<loc>`（注意与 GitHub Pages 实际路径一致）。
3. 若页面需要全站 Toast / 返回顶部等，从当前 HTML 所在目录写回到 **`assets/js/utils.js`**（与引入 **`assets/css/common.css`** 时相同的 `../` 深度）。

## 使用说明

1. 推荐通过 **GitHub Pages** 或本地 **HTTP 静态服务**（如 VS Code Live Server）访问站点根；各页已用 **`../` 链** 引用根 **`assets/css/`**、**`assets/js/`**、**`assets/icons/`**，在 `file://` 下也可加载公共资源（部分浏览器对 manifest 仍可能限制）。
2. 新增页面时保持与现有子目录相同的 **`../` 深度** 回到站根公共资源，并与「前端目录约定」中的 `assets/` 分工一致。

## 部署

本项目已配置为 GitHub Pages，可直接在 GitHub 仓库设置中启用 Pages 功能。站根 **[`CNAME`](../CNAME)** 指定自定义域 **noomings.com**（与 GitHub Pages 仓库设置中的域名一致时生效）。

## 更新记录

各版本功能与结构调整见 [CHANGELOG.md](CHANGELOG.md)（当前最新为 v2.4）。

## 许可证

© 2026 个人学习网站 | 仅用于学习交流，请勿用于商业用途

## 作者

nooming - [GitHub](https://github.com/nooming)
