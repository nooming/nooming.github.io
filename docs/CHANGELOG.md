# 个人主页更新日志

## v2.0

### 结构调整
- **`labs/` 统一入口**：原 **`apps/`**（网址导航、手写笔记、Citywalk）与 **`tools/`**（决策、心理测试、实用工具、小游戏）合并为 **`labs/`**；原 **`tools/index.html`** 现为 **`labs/index.html`**（对外路径 **`/labs/`**）。**`sitemap.xml`**、根 **`index.html`** 与各页 **canonical / og:url** 已改为新路径。
- **静态资源**：**`labs/games/gomoku`**、**`labs/games/chess`** 的脚本与样式迁入各页 **`assets/`**；**`labs/citywalk`** 的 **`app.js`**、**`styles.css`** 迁至 **`assets/js/`**、**`assets/css/`**。

### 文档
- **`docs/README.md`**、**`docs/SITE-CONVENTIONS.md`**、**`labs/games/card-games/README.md`** 已随 **`labs/`** 约定更新。

## v1.9

### 结构调整
- **桌游旧链**：已移除 **`tools/games/card-games/`** 根目录下的 **`texas.html` / `uno.html` / `hearts.html`** 重定向页；请一律使用 **`texas/`、`uno/`、`hearts/`** 目录入口。
- **独立应用目录**：新增 **`apps/`**，将网址导航、手写笔记、Citywalk 分别置于 **`apps/navigation/`**、**`apps/notes/`**、**`apps/citywalk/`**（原顶层 `navigation/`、`notes/`、`cuisine/` 迁入；Citywalk 对外路径由 `cuisine/` 更名为语义清晰的 **`citywalk`**）。
- **静态资源模板**：`tools/practical` 中带独立 `js/`、`css/` 子目录的工具改为 **`assets/js/`**、**`assets/css/`**；**`apps/notes/`** 与 **`articles/parking-pso/`** 的页面脚本与样式迁入各自 **`assets/`**。
- **站点地图与主页入口**：**`sitemap.xml`** 与根 **`index.html`** 横幅链接已更新为上述新 URL。

### 文档
- **`docs/README.md`**、**`docs/SITE-CONVENTIONS.md`** 中的项目结构说明与例外约定已与当前目录一致。

## v1.8

### 结构调整
- **全站公共资源路径**：各页对 **`common/`**、**`favicon-io/`** 的引用统一为根相对（如 **`/common/css/common.css`**、**`/favicon-io/favicon.ico`**），减少深层目录下 `../../../` 维护成本；**`favicon-io/site.webmanifest`** 内图标改为 **`/favicon-io/...`**。
- **桌游 URL**：德州 / UNO / 红心正式入口迁至 **`tools/games/card-games/texas/`**、**`uno/`**、**`hearts/`**（各目录 `index.html`）；**`sitemap.xml`** 与合集 **`card-games/index.html`** 入口已改为新路径。（此后曾短期保留根目录 **`texas.html` / `uno.html` / `hearts.html`** 作旧链重定向，已在后续版本中移除。）

### 文档
- 新增 **`docs/SITE-CONVENTIONS.md`**（路径与目录模板）、**`docs/BUILD-OPTIONAL.md`**（可选 Eleventy / 脚本构建规划）。
- **`docs/README.md`**、**`tools/games/card-games/README.md`** 与项目结构树已随上述约定更新。

## v1.7

### 结构调整
- **小游戏资源**：`tools/games/dino/` 的页面样式与主脚本迁至 `assets/css/`、`assets/js/`；`tools/games/proton/` 的 `proton.css`、`proton.js` 迁至 `assets/css/`、`assets/js/`（页面 URL 未变，`sitemap.xml` 无需改动）。
- **桌游**（v1.8 已演进为目录入口 + 旧 `.html` 重定向；此处保留 v1.7 当时说明）：曾以多入口 `texas.html` / `uno.html` / `hearts.html` 维持外链；README 中说明例外约定。
- **手写笔记**：`notes/js/utils.js` 重命名为 **`notes/js/notes-utils.js`**，与全站 **`common/js/utils.js`** 区分，避免同名混淆。
- **清理**：删除空的 `tools/practical/recite/` 与 `tools/study/`（含空 `recite/`）占位目录。

### 文档
- `docs/README.md`：补充「前端目录约定」、新增页面检查清单，并更新项目结构树中与上述变更一致的描述。

## v1.6

### 新增功能
- 工具总览：新增 tools/index.html，集中链向选择辅助、心理测试、实用工具、小游戏四类合集
- 专题索引：新增 articles/index.html，汇总开发者工具实战、猫抓教学、停车分配互动实验等专题入口
- 主页：在「专题与实践」「实用工具」模块增加指向上述索引页的链接

### 界面优化
- 主页专属样式迁至 common/css/home.css，与子页共用 common.css 的搭配方式一致
- 质子世界与桌游单页（UNO、德州扑克、红心大战）顶栏配色、返回链与全站一致，并补充 canonical 与 Open Graph；桌游合集页增加返回站点首页入口

### 功能调整
- 站点地图：修正抛硬币、快速选择的路径（不再错误嵌套在 wheel 下），并补充 tools/、articles/、cuisine/、风扇转速工具等条目
- 清理：移除 tools/practical/fan-rpm 下无站内入口的 windmill-test 测试页
- Citywalk 后端：删除 cuisine 中与 noomings_backend 重复的 citywalk.py，路线规划 Flask 以后端仓库为唯一维护副本（说明见 docs/README.md）
- 文档：docs/README.md 项目结构与功能说明已与当前仓库同步

## v1.5

### 新增功能
- 专题与实践：原「技术教程」更名，并新增小区停车分配优化互动页（画布编辑、精确最优 / PSO、路径可视化）
- Citywalk 与全站：生产 API 指向新 Zeabur 域名，导航与简介等随之一并更新

## v1.4

### 新增功能
- 城市漫步 · Citywalk 定制器：
  - 支持选择起点/终点和路线偏好（自然、文创、咖啡等），自动规划适合步行的城市路线，并推荐沿途打卡点
  - 路线详情：展示总距离、预计用时、打卡点列表，点击可在地图中居中查看
  - 文案生成：一键生成贴心的 Citywalk 游玩文字攻略，并自动复制到剪贴板
  - 分享支持：可生成带路线统计、打卡点与文艺文案的朋友圈分享长图

## v1.3

### 新增功能
- 网址导航：精选实用网站集合，包含学习、娱乐、游戏、工具等各类导航
- 手写笔记：支持手写绘图和文本编辑的在线笔记工具
  - 支持创建多个绘图页面和文本页面，分类管理不同类型的笔记
  - 流畅的手写绘图体验，支持多种画笔工具和颜色选择
  - 简洁的文本编辑器，支持富文本编辑功能
  - 所有笔记数据自动保存到本地浏览器，无需担心数据丢失
  - 支持批量选择和删除页面，方便管理大量笔记
- 小游戏专区：五子棋、围棋、中国象棋、谷歌小恐龙

### 界面优化
- 渐变背景设计，卡片悬停动画效果
- 网址导航和手写笔记采用醒目横幅设计
- 移动端响应式优化
- 手写笔记支持侧边栏折叠，优化编辑区域显示

## v1.2

### 新增功能
- 猫抓扩展保姆级教学教程

### 功能调整
- 重新组织工具分类：选择辅助工具、心理测试工具、实用工具
- 新增心理测试工具：MBTI性格测试、动物塑测试
- 实用工具新增：Base64编解码、二维码生成与识别

## v1.1

### 新增功能
- 爬取资源心得：浏览器开发者工具实战教程
- 选择困难工具：选择困难症转盘、抛硬币、快速选择
- 实用工具：音频格式转换器、进制转换器

## v1.0

### 初始版本
- 基础个人主页
- 进制转换器工具

---

访问地址：noomings.com

