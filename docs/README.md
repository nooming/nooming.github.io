# 个人站点

笔记与工具 · 专题长文 · 浏览器内实验

## 项目简介

基于 GitHub Pages：在线工具、专题文章、互动实验、小游戏与网址导航。

## 功能特性

### 🌐 网址导航
- **外链索引**：学习、娱乐、游戏、工具等分类链接

### 📝 手写笔记
- **在线笔记工具**：支持手写绘图和文本编辑的在线笔记工具，随时记录想法
- **多页面管理**：支持创建多个绘图页面和文本页面，分类管理不同类型的笔记
- **绘图功能**：流畅的手写绘图体验，支持多种画笔工具和颜色选择
- **文本编辑**：简洁的文本编辑器，支持富文本编辑功能
- **数据持久化**：所有笔记数据自动保存到本地浏览器，无需担心数据丢失
- **批量操作**：支持批量选择和删除页面，方便管理大量笔记

### 📚 专题与实践
- **索引页**：[专题索引](../articles/) 汇总所有专题入口
- **开发者工具与资源分析**：Network、Console 等；八步说明与限制
- **猫抓扩展使用笔记**：安装 Cat Catch 至抓取音视频；按步骤操作
- **小区停车分配优化（互动页）**：在画布上编辑虚拟小区平面图，用精确最优或 PSO 优化车辆到车位的分配，并查看路径与结果可视化；在线体验需联网，依赖站点已开启的优化服务

### 🎯 决策工具
- **转盘**：自定义项与颜色、预设与历史
- **抛硬币**：正反面随机；本地统计
- **多选随机**：每行一项，随机保留一项

### 🧠 心理测试
- **MBTI**：28 题；四字母类型与简述
- **动物塑**：选择题映射动物形象；娱乐向

### 🔧 实用工具
- **索引页**：[实用工具总览](../app/practical/) 汇总音频、进制、Base64、二维码、风扇转速等工具
- **音频格式转换器**：支持各种音频格式转换为 MP3 或 WAV，MP3 适合压缩体积，WAV 保持无损音质
- **进制转换器**：支持二进制、八进制、十进制、十六进制互转，附带进制计算说明与示例，适合编程学习
- **Base64 编解码器**：快速进行 Base64 编码和解码操作，支持文本和文件处理
- **二维码生成与识别**：生成自定义样式的二维码，支持文本、链接等内容，并可识别上传的二维码图片
- **风扇转速估算**：根据叶片视觉暂留估算转速的实用小工具

### 🚶 城市漫步 · Citywalk 定制器
- **全国多城路线规划**：可切换城市（含热门城市快捷入口），选择起点和终点后，自动规划适合步行游玩的路线，并推荐沿途打卡点（咖啡、甜品、文创等）
- **地图交互体验**：在地图上点选起终点，查看沿途 POI 详情；依赖高德地图 Web 能力，需联网
- **智能游玩文案与分享图**：一键生成游玩文字攻略，并支持导出适合分享的长图
- **使用前提**：路线与 POI 依赖在线地图与站点提供的规划服务，请在联网环境下使用

### 🎮 小游戏
- **索引页**：[小游戏总览](../app/games/) 汇总棋类、小恐龙、桌游与质子世界等
- **五子棋 / 围棋 / 中国象棋**：支持单人对战 AI 或双人对战（因游戏而异）
- **谷歌小恐龙**：经典跑酷小游戏
- **桌游合集**：德州扑克、UNO、红心大战，本地 AI 对战；可从合集页进入各款
- **质子世界**：带电粒子在电场、磁场与阻力下的平面可视化模拟

### 🧰 实验与工具总览
- **[应用与实验总览](../app/)**：决策、心理测试、实用工具与小游戏等分类的统一入口，便于从深层子页返回时快速跳转

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
├── articles/                   # 专题与实践（长文 + 互动实验）
│   ├── index.html              # 专题索引
│   ├── cat-catch-tutorial/     # 猫抓扩展教程
│   │   ├── index.html          # 教程页入口
│   │   └── cat-catch.zip       # 猫抓扩展源码压缩包
│   ├── crawler-experience/     # 浏览器开发者工具实战
│   │   └── index.html          # 专题页入口
│   └── parking-pso/            # 小区停车分配优化（含在线优化交互）
│       ├── index.html          # 页面入口
│       └── assets/             # 页面脚本与样式
│           ├── js/app.js
│           └── css/style.css
├── assets/                     # 全站静态：CSS、JS、favicon 与 site.webmanifest
│   ├── css/                    # common.css、home.css 等
│   ├── js/                     # utils.js 等
│   └── icons/                  # 站点图标（原 favicon-io）
├── app/                        # 实验与工具：导航、笔记、城市漫步、决策、心理、实用、游戏等
│   ├── index.html              # 分类总览入口
│   ├── navigation/
│   │   └── index.html          # 网址导航入口
│   ├── notes/                  # 手写笔记
│   │   ├── index.html
│   │   └── assets/
│   │       ├── css/styles.css
│   │       └── js/             # app、canvas、page、render、state、storage、notes-utils
│   ├── citywalk/               # 城市漫步 · Citywalk（地图全屏）
│   │   ├── index.html
│   │   └── assets/             # js/app.js、css/styles.css
│   ├── decision/               # 选择辅助工具
│   │   ├── index.html
│   │   ├── assets/
│   │   ├── wheel/
│   │   ├── coin-flip/
│   │   └── quick-choice/
│   ├── psychological/
│   │   ├── index.html
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

## 新增可访问页面时的检查清单

1. 新增或修改 **`index.html`（或其它入口 HTML）** 后，视情况更新上级索引页的入口链接（如 `app/games/index.html`）。
2. 若页面应被搜索引擎发现，在 **[`sitemap.xml`](../sitemap.xml)** 中增加或更新对应 `<loc>`（注意与 GitHub Pages 实际路径一致）。
3. 若页面需要全站 Toast / 返回顶部等，从当前 HTML 所在目录写回到 **`assets/js/utils.js`**（与引入 **`assets/css/common.css`** 时相同的 `../` 深度）。

## 使用说明

1. 推荐通过 **GitHub Pages** 或本地 **HTTP 静态服务**（如 VS Code Live Server）访问站点根；各页已用 **`../` 链** 引用根 **`assets/css/`**、**`assets/js/`**、**`assets/icons/`**，在 `file://` 下也可加载公共资源（部分浏览器对 manifest 仍可能限制）。
2. 新增页面时保持与现有子目录相同的 **`../` 深度** 回到站根公共资源，并与「前端目录约定」中的 `assets/` 分工一致。

## 部署

本项目已配置为 GitHub Pages，可直接在 GitHub 仓库设置中启用 Pages 功能。

## 更新记录

各版本功能与结构调整见 [CHANGELOG.md](CHANGELOG.md)（当前最新为 v1.7）。

## 许可证

© 2026 个人学习网站 | 仅用于学习交流，请勿用于商业用途

## 作者

nooming - [GitHub](https://github.com/nooming)
