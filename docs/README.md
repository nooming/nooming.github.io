# 个人站点

笔记 · 工具 · 专题 · 实践 · 导航

## 项目简介

GitHub Pages 静态站：枢纽页聚合工具与长文；实验与地图类功能需联网。

## 功能特性

### 🌐 网址导航
- **分类**（与 [app/navigation/](../app/navigation/) 页面顺序一致）：工具 → AI / 对话 → 开发 → 学习 → 视频（外链索引）

### 📝 手写笔记
- **画布 + 文本**：多页面；画笔与颜色；本地持久化；批量删选

### 📚 专题
- **开发者工具**：Network、Console；步骤与限制
- **猫抓扩展**：安装至抓取音视频

### 🧪 实践
- **停车分配**：[app/parking-pso/](../app/parking-pso/) — 画布编辑小区；精确最优或 PSO；路径可视化（在线优化服务）
- **质子场**：电场 / 磁场 / 阻力平面模拟；入口 `app/games/proton/`（首页「实践」）

### 🔧 实用工具
- **总览**：[实用工具](../app/practical/) — 音频、进制、Base64、二维码、风扇 RPM

### 🎯 决策工具
- **多选随机**：每行一项，随机保留一行
- **抛硬币**：正反面；本地统计
- **转盘**：自定义项与颜色；预设与历史

### 🧠 心理测试
- **MBTI**：28 题；四字母简述
- **动物塑**：娱乐向映射

### 🚶 Citywalk
- **多城步行**：起终点、沿途 POI；高德 Web；需联网
- **文案与长图**：攻略与分享图导出

### 🎮 小游戏
- **总览**：[小游戏](../app/games/) — 棋类 → 桌游 → 小恐龙
- **棋类**：五子棋 / 围棋 / 象棋；人机或双人（因游戏而异）
- **桌游**：德州、UNO、红心；本地 AI；[桌游子页](../app/games/card-games/)
- **小恐龙**：跑酷街机

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Audio API
- LameJS (MP3编码)
- 中国象棋引擎库（xiangqi，`xiangqi.min.js`，位于 `app/games/chess/assets/lib/`）
- Perfect Freehand (手写笔记绘图库)
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

以下为仓库**顶层与常用子目录**示意，未穷尽列举各工具内的全部静态资源；路径模板与新增页面约定见下文「**前端目录约定**」，桌游合集另有 **[../app/games/card-games/README.md](../app/games/card-games/README.md)**。

```
├── index.html                  # 主页（样式见 assets/css/home.css）
├── 404.html                    # 自定义 404 页面
├── CNAME                       # GitHub Pages 自定义域名
├── docs/                       # 文档目录
│   ├── README.md               # 项目说明文档
│   └── CHANGELOG.md            # 更新日志
├── articles/                   # 专题长文（教程与经验类）
│   ├── cat-catch-tutorial/     # 猫抓扩展教程
│   │   ├── index.html          # 教程页入口
│   │   └── cat-catch.zip       # 猫抓扩展源码压缩包
│   ├── crawler-experience/     # 浏览器开发者工具实战
│   │   └── index.html          # 专题页入口
│   └── parking-pso/            # 仅占位：跳转至 app/parking-pso/（兼容旧 URL）
│       └── index.html
├── assets/                     # 全站静态：CSS、JS、favicon 与 site.webmanifest
│   ├── css/                    # common.css、home.css 等
│   ├── js/                     # utils.js 等
│   └── icons/                  # 站点图标（原 favicon-io）
├── app/                        # 实验与工具：导航、笔记、城市漫步、决策、心理、实用、游戏等
│   ├── navigation/
│   │   ├── index.html          # 网址导航入口
│   │   └── assets/css/navigation.css  # 导航页卡片与分类样式（common.css 为全站基座）
│   ├── notes/                  # 手写笔记
│   │   ├── index.html
│   │   └── assets/
│   │       ├── css/styles.css
│   │       └── js/             # app、canvas、page、render、state、storage、notes-utils
│   ├── citywalk/               # 城市漫步 · Citywalk（独立应用；地图全屏）
│   │   ├── index.html
│   │   └── assets/             # js/app.js、css/styles.css、icons/
│   ├── parking-pso/            # 小区停车分配优化（独立应用；依赖后端 API）
│   │   ├── index.html
│   │   └── assets/             # js/app.js、css/style.css
│   ├── decision/               # 选择辅助工具
│   │   ├── index.html
│   │   ├── assets/
│   │   ├── wheel/
│   │   ├── coin-flip/
│   │   └── quick-choice/
│   ├── psychological/
│   │   ├── index.html
│   │   ├── assets/css/         # quiz-shell.css（问卷骨架）+ quiz-theme-*.css（各测主题）
│   │   ├── mbti-test/
│   │   └── animal-test/
│   ├── practical/
│   │   ├── index.html
│   │   ├── audio-converter/
│   │   ├── base-converter/
│   │   ├── base64-converter/
│   │   ├── qr-code-generator/
│   │   └── fan-rpm/
│   └── games/
│       ├── index.html
│       ├── board-games/          # 棋类合集入口（五子棋 / 围棋 / 象棋）
│       ├── gomoku/
│       ├── go/
│       ├── chess/
│       ├── dino/
│       ├── card-games/
│       │   ├── index.html
│       │   ├── README.md
│       │   ├── texas/
│       │   ├── uno/
│       │   ├── hearts/
│       │   └── assets/
│       └── proton/
│           ├── index.html
│           └── assets/
│               ├── css/proton.css
│               └── js/proton.js
├── sitemap.xml
└── robots.txt
```

## 前端目录约定

根级 **`assets/`** 与各页目录下 **`assets/`** 的分工、相对引用方式与本地预览注意点如下。

- **`app/games/` 下各小游戏**：页面内静态资源优先放在各游戏目录的 **`assets/css/`**、**`assets/js/`**、**`assets/img/`**（可按需增删子目录），页面入口统一为 **`index.html`**，便于与「仅 HTML + 散落 css/js」的异构布局区分。
- **`app/games/card-games/`**：德州 / UNO / 红心入口为 **`texas/`、`uno/`、`hearts/`**（各目录 `index.html`）。共享脚本与样式在同目录 **`assets/`**（含 **`assets/common/`** 子模块）。详见该目录下的 `README.md`。
- **全站公共脚本**：通用 Toast、剪贴板、防抖、返回顶部等仅在根 **`assets/js/utils.js`**；手写笔记专用逻辑在 **`app/notes/assets/js/notes-utils.js`**，二者勿混用文件名。
- **`app/practical/`**：进制、Base64、二维码等工具的页面脚本与样式放在各子目录 **`assets/js/`**、**`assets/css/`**；音频转换、风扇转速等以单页内联或依赖根 **`assets/css/common.css`** / **`assets/js/utils.js`**（由页面写 `../` 链回到站根）为主。
- **其他 `app/` 二级分类**（如 `decision`）：已采用 **`assets/`** 或与历史页并存的，新建页面时优先 **`assets/`** 模板，避免同分类混用多种布局。
- **`app/citywalk/`** 与 **`app/parking-pso/`**：作为独立交互应用，业务脚本与样式放在各自目录的 **`assets/`**；与站根 **`assets/`** 仅通过 `../../assets/` 共享 favicon、**`common.css`**（Citywalk）、**`utils.js`**（Citywalk Toast 等），避免把应用逻辑散到站根。

## 新增可访问页面时的检查清单

1. 新增或修改 **`index.html`（或其它入口 HTML）** 后，视情况更新上级索引页的入口链接（如 `app/games/index.html`）。
2. 若页面应被搜索引擎发现，在 **[`sitemap.xml`](../sitemap.xml)** 中增加或更新对应 `<loc>`（注意与 GitHub Pages 实际路径一致）。
3. 若页面需要全站 Toast / 返回顶部等，从当前 HTML 所在目录写回到 **`assets/js/utils.js`**（与引入 **`assets/css/common.css`** 时相同的 `../` 深度）。

## 使用说明

1. 推荐通过 **GitHub Pages** 或本地 **HTTP 静态服务**（如 VS Code Live Server）访问站点根；各页已用 **`../` 链** 引用根 **`assets/css/`**、**`assets/js/`**、**`assets/icons/`**，在 `file://` 下也可加载公共资源（部分浏览器对 manifest 仍可能限制）。
2. 新增页面时保持与现有子目录相同的 **`../` 深度** 回到站根公共资源，并与「前端目录约定」中的 `assets/` 分工一致。

## 部署

本项目已配置为 GitHub Pages，可直接在 GitHub 仓库设置中启用 Pages 功能。站根 **[`CNAME`](../CNAME)** 指定自定义域 **noomings.com**（与 GitHub Pages 仓库设置中的域名一致时生效）。

## 更新记录

各版本功能与结构调整见 [CHANGELOG.md](CHANGELOG.md)（当前最新为 v1.7）。

## 许可证

© 2026 个人学习网站 | 仅用于学习交流，请勿用于商业用途

## 作者

nooming - [GitHub](https://github.com/nooming)
