# 更新日志

## v2.3

枢纽页改为「入口 / 实践 / 工具 / 其它」，访客站名为 **noomings**；`app/` 下文件夹未按栏目搬迁。

1. 首页（`index.html`）：四栏分组、整卡链接、条目更紧凑；标题 / canonical / og 为 `https://noomings.com/`；简介区分浏览器内完成与需联网。实践区增加外链「物理探究」（`https://physics.noomings.com`）。
2. 新增 Markdown 阅读（`app/markdown/`）：全宽预览，粘贴或拖入 `.md`，目录见 `catalog.json`。
3. 新增图片识字（`app/ocr/`）：引擎可选「标准（PaddleOCR）」与「轻量（Tesseract）」；默认为标准。图仍不离开浏览器。标准引擎首次下载检测/识别模型（约 20MB）及 ONNX Runtime WASM，之后由浏览器缓存；识别可能要几秒。标准引擎加载失败时自动改用轻量引擎。
4. 未采用官方 `@paddleocr/paddleocr-js`：该包依赖 OpenCV.js 与打包器，多线程 WASM 还需 COOP/COEP，GitHub Pages 不易配置。改为 vendored `@ocr-web/core` + jsDelivr 上的 PP-OCRv5 ONNX / `onnxruntime-web` 单线程 WASM。轻量引擎为 Tesseract.js（按需加载 CDN，canvas 预处理保留）；首页工具卡与 `docs/README.md` 同步为双引擎表述。
5. 音频转换（`app/practical/audio-converter/`）改为本地 `lamejs`，修复转码失败。
6. 枢纽页返回改为「返回」；合集页整卡可点；页脚「© 2026 noomings · 非商业使用」。删除 `articles/parking-pso/` 占位，应用仍在 `app/parking-pso/`。

## v2.2

Citywalk 大版本同步：前后端模块化，智能规划与环线探索上线；API 仍为 `noomings-backend.zeabur.app`。

1. **前端**（`app/citywalk/`）：智能规划 / 手动规划 / 结果 Tab；环线探索、灵感种草卡片、对话微调路线、路线风格与合并打卡偏好、历史路线；JS 拆分为 `core/`、`map/`、`plan/`、`ui/`、`share/`。
2. **后端**（`noomings_backend`）：由单体 `citywalk.py` 拆为 `agent/`、`api/`、`lib/`、`planning/`；新增 `/agent/*`、`/resolve_location`、`/poi/enrich` 等接口；环境变量配置 Key 与 CORS。
3. 站内左上角「←」仍返回首页；重置选点由面板内「重置选择」提供。

## v2.1

实践栏目扩充与 `app/games` 目录重组；全站链接、文案与站点地图同步更新（旧路径不保留跳转）。

1. 新增实践工具「像素涌流」（`app/pixelflow/`）：双图像素排序重排、动画过渡、运动拖尾与 PNG 导出，纯本地处理。
2. 首页实践区新增像素涌流入口并适配三卡布局；SEO 与区块说明与小游戏合集文案对齐。
3. 重组 `app/games/`：五子棋、围棋、象棋迁入 `board-games/`，与 `card-games/` 目录模式一致。
4. 质子世界迁至 `app/proton/`，与首页「实践」栏目一致；小游戏合集仅描述棋类、桌游、小恐龙。
5. `sitemap.xml` 更新：`app/pixelflow/`、`app/proton/`、`app/games/board-games/{gomoku,go,chess}/` 等；移除 `app/games/proton/` 及原平级棋类路径。

## v1.8

1. 新增「终末地抽卡规划」页面并归类到决策栏目（`app/decision/gacha-planner/`），支持角色/武器概率与保底规则模拟。
2. 决策工具列表新增抽卡规划入口；首页“决策”卡片文案同步扩展为“随机 + 抽卡概率估算”。
3. 站点索引同步更新：移除 `app/practical/gacha-planner/`，新增 `app/decision/gacha-planner/`。

## v1.7

1. 首页与全站导航：工具、实验、互动应用重新分组，从目录上更容易找到对应入口。
2. 城市漫步：作为独立栏目与其它工具并列；站内用语与入口与「美食」类旧称脱钩。
3. 桌游：德州扑克、UNO、红心大战各自成页，从桌游合集进入；各局返回首页的路径与其它子站一致。
4. 无入口的孤立测试页下线，避免误点进半成品。

## v1.6

1. 新增工具总览页，集中列出站内工具与直达入口。（现为 [app/practical/](../app/practical/)「实用工具合集」及首页「实用工具」区块。）
2. 新增专题索引页；主页增加「专题」「工具」两处入口。（专题索引即首页 `id="topics"` 专题区，非独立 articles 列表页；「工具」入口后并入首页「实用工具」等呈现。）
3. 桌游单局、质子世界等子页：顶栏与返回方式与其它站内页统一，浏览习惯一致。
4. 抛硬币、多选随机等部分工具在站内导航中的链路与实际页面一致。

## v1.5

1. 「技术教程」更名为专题与实践。
2. 上线停车分配互动实验（画布、匈牙利 / PSO、路径可视化）。
3. Citywalk 生产 API 指向新 Zeabur；全站导航与简介同步。

## v1.4

1. Citywalk：地图选起终点、路线偏好、步行路线与沿途 POI。
2. 展示距离、耗时、打卡列表；地图可定位 POI。
3. 生成文字方案并可复制；支持导出含路线与 POI 的长图。

## v1.3

1. 网址导航：分类外链入口。
2. 手写笔记：绘图与文本、多页、本地存储、批量删页。
3. 小游戏：五子棋、围棋、象棋、小恐龙。
4. 首页与导航/笔记横幅、卡片动效、移动端与笔记侧栏折叠等 UI。

## v1.2

1. 猫抓扩展专题（安装与抓取流程）。
2. 工具分为：决策、心理测试、实用工具。
3. 心理测试：MBTI、动物塑。
4. 实用工具：Base64、二维码生成与识别。

## v1.1

1. 浏览器开发者工具与资源分析专题。
2. 决策：转盘、抛硬币、多选随机。
3. 实用工具：音频转换、进制转换。

## v1.0

1. 个人主页。
2. 进制转换器。

---

noomings.com
