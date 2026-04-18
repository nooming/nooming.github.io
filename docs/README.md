# 个人学习网站

个人学习记录 · 实用工具集合 · 专题与实践

## 项目简介

这是一个基于 GitHub Pages 搭建的个人学习网站，包含多个实用的在线工具、专题文章与互动实验、小游戏和网址导航。

## 功能特性

### 🌐 网址导航
- **精选网站集合**：包含学习、娱乐、游戏、工具等各类网站导航，一站式解决你的需求

### 📝 手写笔记
- **在线笔记工具**：支持手写绘图和文本编辑的在线笔记工具，随时记录想法
- **多页面管理**：支持创建多个绘图页面和文本页面，分类管理不同类型的笔记
- **绘图功能**：流畅的手写绘图体验，支持多种画笔工具和颜色选择
- **文本编辑**：简洁的文本编辑器，支持富文本编辑功能
- **数据持久化**：所有笔记数据自动保存到本地浏览器，无需担心数据丢失
- **批量操作**：支持批量选择和删除页面，方便管理大量笔记

### 📚 专题与实践
- **索引页**：[`articles/`](../articles/) 汇总所有专题入口
- **浏览器开发者工具实战**：详细讲解如何使用浏览器自带的开发者工具（Network面板、Console等）分析并获取网页资源，包含8个步骤的实战操作指南和技术限制说明
- **猫抓扩展保姆级教学**：从安装到实际抓取视频/音频资源，手把手演示如何使用猫抓（Cat Catch）浏览器扩展，适合零基础用户快速上手
- **小区停车分配优化（互动页）**：在 `articles/parking-pso/` 编辑虚拟小区平面图，精确最优或 PSO 优化车辆→车位分配，依赖已部署后端 `/api/default` 与 `/api/optimize`

### 🎯 选择辅助工具
- **选择困难症转盘**：自定义选项、自定义颜色样式，支持预设管理保存常用组合，查看历史结果记录，随机抽取公平选择
- **抛硬币**：一键在线抛硬币，随机生成正反面结果，帮助你快速做决定
- **快速选择**：输入选项，立即获得随机选择结果，无需复杂设置，适合快速决策场景

### 🧠 心理测试
- **MBTI性格测试**：通过28道精心设计的题目，了解你的MBTI性格类型，发现真实的自己，探索性格特征和职业倾向
- **动物塑测试**：通过20道问题，发现你的动物性格，了解自己的行为模式和性格特征，找到与你最匹配的动物形象

### 🔧 实用工具
- **索引页**：[`tools/practical/`](../tools/practical/) 汇总音频、进制、Base64、二维码、风扇转速等工具
- **音频格式转换器**：支持各种音频格式转换为 MP3 或 WAV，MP3 适合压缩体积，WAV 保持无损音质
- **进制转换器**：支持二进制、八进制、十进制、十六进制互转，附带进制计算说明与示例，适合编程学习
- **Base64 编解码器**：快速进行 Base64 编码和解码操作，支持文本和文件处理
- **二维码生成与识别**：生成自定义样式的二维码，支持文本、链接等内容，并可识别上传的二维码图片
- **风扇转速估算**：根据叶片视觉暂留估算转速的实用小工具

### 🚶 城市漫步 · Citywalk 定制器
- **全国多城路线规划**：可切换城市（含热门城市快捷入口），选择起点和终点后，自动规划适合步行游玩的路线，并推荐沿途打卡点（咖啡、甜品、文创等）
- **地图交互体验**：基于高德地图 Web SDK，支持在地图上点击选择起终点、查看每个 POI 的详细信息
- **智能游玩文案与分享图**：一键生成贴心的游玩文字攻略，并支持生成朋友圈分享长图
- **后端服务说明**：前端页面位于 **`apps/citywalk/`**。路线规划 Flask 源码与部署以仓库 **`noomings_backend`** 中的 `citywalk.py` 为唯一维护副本。生产环境 API 基址为 `https://noomings-backend.zeabur.app`（与 `apps/citywalk/app.js` 中 `API_BASE_URL` 一致）

### 🎮 小游戏
- **索引页**：[`tools/games/`](../tools/games/) 汇总棋类、小恐龙、桌游与质子世界等
- **五子棋 / 围棋 / 中国象棋**：支持单人对战 AI 或双人对战（因游戏而异）
- **谷歌小恐龙**：经典跑酷小游戏
- **桌游合集**（`tools/games/card-games/`）：德州扑克、UNO、红心大战，本地 AI 对战
- **质子世界**（`tools/games/proton/`）：带电粒子在电场、磁场与阻力下的平面可视化模拟

### 🧰 工具总览
- **[`tools/index.html`](../tools/)**：四类工具（决策、心理、实用、游戏）的统一入口，便于从深层子页返回时快速跳转

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Audio API
- LameJS (MP3编码)
- 中国象棋引擎库 (xiangqi.js)
- Perfect Freehand (手写笔记绘图库)
- Canvas API (绘图功能)
- LocalStorage (数据持久化)

## 代码注释约定

- **Python**：文件顶模块说明；分节用 `# --- 标题 ---` 或 `# ==================== 标题 ====================`；公开函数写 docstring；避免「修复 1」「！！！」等临时口吻。
- **JavaScript**：文件顶用 `// ========== 模块 · 职责 ==========` 或 JSDoc；大段逻辑用同级分隔线；业务说明用简短中文。
- **CSS**：文件顶一行 `/* ========== 页面/模块 ========== */`；区块可用 `/* --- 区块 --- */`。
- **HTML**：关键结构用 `<!-- 区域名：作用 -->`，不必每行标注。
- **不改动**：第三方压缩脚本（如 `*.min.js`、`lib/` 内库）。

## 项目结构

以下为仓库**顶层与常用子目录**示意，未穷尽列举各工具内的全部静态资源；路径模板与新增页面约定见 **[SITE-CONVENTIONS.md](SITE-CONVENTIONS.md)**，桌游合集另有 **[../tools/games/card-games/README.md](../tools/games/card-games/README.md)**。

```
├── index.html                  # 主页（样式见 common/css/home.css）
├── 404.html                    # 自定义 404 页面
├── CNAME                       # GitHub Pages 自定义域名
├── docs/                       # 文档目录
│   ├── README.md               # 项目说明文档
│   ├── CHANGELOG.md            # 更新日志
│   ├── SITE-CONVENTIONS.md     # 路径与目录模板约定
│   └── BUILD-OPTIONAL.md       # 可选静态构建规划（未默认启用）
├── articles/                   # 专题与实践（长文 + 互动实验）
│   ├── index.html              # 专题索引
│   ├── cat-catch-tutorial/     # 猫抓扩展教程
│   │   ├── index.html          # 教程页入口
│   │   └── cat-catch.zip       # 猫抓扩展源码压缩包
│   ├── crawler-experience/     # 浏览器开发者工具实战
│   │   └── index.html          # 专题页入口
│   └── parking-pso/            # 小区停车分配优化（API 见 Zeabur /api/*）
│       ├── index.html          # 页面入口
│       └── assets/             # 页面脚本与样式
│           ├── js/app.js
│           └── css/style.css
├── apps/                       # 独立多页应用（导航 / 笔记 / Citywalk）
│   ├── navigation/
│   │   └── index.html          # 网址导航入口
│   ├── notes/                  # 手写笔记
│   │   ├── index.html
│   │   └── assets/
│   │       ├── css/styles.css
│   │       └── js/             # app、canvas、page、render、state、storage、notes-utils
│   └── citywalk/               # 城市漫步 · Citywalk（地图全屏）
│       ├── index.html
│       ├── app.js
│       └── styles.css          # 页面样式（与 index 同级）
├── tools/                      # 工具集合
│   ├── index.html              # 四类工具总览入口
│   ├── decision/               # 选择辅助工具
│   │   ├── index.html          # 选择辅助工具合集首页
│   │   ├── assets/             # 共享资源（CSS、JS）
│   │   ├── wheel/              # 转盘工具
│   │   │   └── index.html
│   │   ├── coin-flip/          # 抛硬币
│   │   │   └── index.html
│   │   └── quick-choice/       # 快速选择
│   │       └── index.html
│   ├── psychological/          # 心理测试
│   │   ├── index.html
│   │   ├── mbti-test/          # MBTI 性格测试
│   │   └── animal-test/        # 动物塑测试
│   ├── practical/              # 实用工具
│   │   ├── index.html          # 实用工具合集首页
│   │   ├── audio-converter/    # 音频格式转换器
│   │   ├── base-converter/     # 进制转换器（页面资源见 assets/css、assets/js）
│   │   ├── base64-converter/   # Base64 编解码器
│   │   ├── qr-code-generator/  # 二维码生成与识别
│   │   └── fan-rpm/            # 风扇转速估算
│   └── games/                  # 小游戏
│       ├── index.html          # 小游戏合集入口
│       ├── gomoku/             # 五子棋
│       ├── go/                 # 围棋
│       ├── chess/              # 中国象棋
│       ├── dino/               # 谷歌小恐龙（index.html；assets/css、assets/js、素材子目录）
│       ├── card-games/         # 桌游（德州 / UNO / 红心）
│       │   ├── index.html      # 合集入口
│       │   ├── README.md       # 该目录 URL 与资源约定
│       │   ├── texas/
│       │   │   └── index.html  # 德州扑克正式入口
│       │   ├── uno/
│       │   │   └── index.html  # UNO 正式入口
│       │   ├── hearts/
│       │   │   └── index.html  # 红心大战正式入口
│       │   └── assets/         # 共享脚本与样式等
│       └── proton/             # 质子世界物理演示
│           ├── index.html
│           └── assets/
│               ├── css/
│               │   └── proton.css
│               └── js/
│                   └── proton.js
├── common/                     # 公共资源
│   ├── css/                    # 公共样式（含 home.css 主页专用）
│   └── js/                     # 公共脚本
├── favicon-io/                 # 网站图标
├── sitemap.xml
└── robots.txt
```

## 前端目录约定

更完整的说明见 **[SITE-CONVENTIONS.md](SITE-CONVENTIONS.md)**（`common` / `favicon-io` 的相对引用方式、新工具目录模板、本地预览注意点）。

- **`tools/games/` 下各小游戏**：静态资源优先放在 **`assets/css/`**、**`assets/js/`**、**`assets/img/`**（可按需增删子目录），页面入口统一为 **`index.html`**，便于与「仅 HTML + 散落 css/js」的异构布局区分。
- **`tools/games/card-games/`**：德州 / UNO / 红心入口为 **`texas/`、`uno/`、`hearts/`**（各目录 `index.html`）。共享脚本与样式在同目录 **`assets/`**。详见该目录下的 `README.md`。
- **全站公共脚本**：通用 Toast、剪贴板、防抖、返回顶部等仅在 **`common/js/utils.js`**；手写笔记专用逻辑在 **`apps/notes/assets/js/notes-utils.js`**，二者勿混用文件名。
- **`tools/practical/`**：进制、Base64、二维码等工具的页面脚本与样式放在各子目录 **`assets/js/`**、**`assets/css/`**；音频转换、风扇转速等以单页内联或仅依赖 **`common/`**（由页面写 `../` 链回到站根）为主。
- **其他 `tools/` 二级分类**（如 `decision`）：已采用 **`assets/`** 或与历史页并存的，新建工具时优先 **`assets/`** 模板，避免同分类混用多种布局。

## 新增可访问页面时的检查清单

1. 新增或修改 **`index.html`（或其它入口 HTML）** 后，视情况更新上级索引页的入口链接（如 `tools/games/index.html`）。
2. 若页面应被搜索引擎发现，在 **[`sitemap.xml`](../sitemap.xml)** 中增加或更新对应 `<loc>`（注意与 GitHub Pages 实际路径一致）。
3. 若页面需要全站 Toast / 返回顶部等，从当前 HTML 所在目录写回到 **`common/js/utils.js`**（与引入 `common.css` 时相同的 `../` 深度）。

## 使用说明

1. 推荐通过 **GitHub Pages** 或本地 **HTTP 静态服务**（如 VS Code Live Server）访问站点根；各页已用 **`../` 链** 引用 **`common/`**、**`favicon-io/`**，在 `file://` 下也可加载公共资源（部分浏览器对 manifest 仍可能限制）。
2. 更细的路径规则见 [SITE-CONVENTIONS.md](SITE-CONVENTIONS.md)。

## 部署

本项目已配置为 GitHub Pages，可直接在 GitHub 仓库设置中启用 Pages 功能。

## 更新记录

各版本功能与结构调整见 [CHANGELOG.md](CHANGELOG.md)（当前最新为 v1.9）。

## 许可证

© 2025 个人学习网站 | 仅用于学习交流，请勿用于商业用途

## 作者

nooming - [GitHub](https://github.com/nooming)
