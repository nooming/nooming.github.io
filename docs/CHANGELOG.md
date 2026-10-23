# 更新日志

## v2.4

顶栏与 `app/` 目录对齐；首页枢纽与阅读域重组；全站注入导航壳（`site-shell`）。旧路径不保留跳转。

1. **全站导航壳**（`assets/css/site-shell.css`、`assets/js/site-shell.js`）：顶栏 **首页 · 实验 · 工具 · 阅读 · 娱乐**；L1 点击进常用子页（质子 / 二维码 / Markdown / 五子棋）；仅 **工具** 保留 `tools/index.html` 总览；桌面侧栏 + 移动底栏 + 分组菜单；首页与 `app/navigation/` 同 hub 壳。**笔记 / 停车 / Citywalk** 仍不挂壳；顶栏 L1 互斥高亮。
2. **首页**：`#discover` **常用** 三格（导航 · 笔记 · Citywalk）；`#practice` 停车 + 物理外链；hub 标题与入口横幅样式调整。
3. **阅读**（`app/read/`）：Markdown 迁入 `read/markdown/`；原 `articles/` 长文迁入 `read/`；共用 `assets/css/article.css`。删除根级 `articles/`、`app/markdown/`。
4. **`app/` 分域**：`lab/`、`tools/`、`read/`、`play/` 物理分目录；路径与 IA 见 `docs/app-ia.md`。
5. **文案**：用户可见表述收敛至 `docs/copy-style.md`；`sitemap.xml` 与站内链同步新路径。
6. **索引扁平化**：删除中间目录页及 **`lab/`、`read/`、`play/` 域目录页**（子项少、与侧栏重复）；保留 **`tools/index.html`**；`tools/doc-tools/` 等 hub 已删；侧栏无自指目录项。
7. **母品牌标**（`assets/brand/`）：定稿「n 是窗，月亮在窗里」；圆角黑底白门 + 黄月牙；顶栏与首页 hero 用 `noomings-mark.svg`；全站标签页 `favicon.svg`，主屏幕 PNG 由主标导出。WanderWalk 不变。

## v2.3

枢纽页改为「入口 / 实践 / 工具 / 其它」，访客域名为 noomings（`app/` 目录未按栏目搬迁）；本版上线 Markdown 阅读、图片识字、灯牌、**文档转换**，并将 Citywalk 升级为 **WanderWalk**（路线规划 + 社区）。

1. **枢纽与导航**：首页四栏、整卡链接、SEO 为 `https://noomings.com/`；简介区分纯本地与需联网；实践区外链「物理探究」。全站返回统一为「返回」；页脚「© 2026 noomings · 非商业使用」。删除 `articles/parking-pso/` 占位（应用仍在 `app/parking-pso/`）。
2. **工具**：Markdown 阅读（`app/markdown/`，粘贴或拖入 `.md`）；图片识字（`app/ocr/`，浏览器内 PP-OCRv5，失败回退 Tesseract，图不出本机）；换算合集新增灯牌（`app/practical/light-board/`）；音频转换改本地 `lamejs`，修复 MP3 转码。
3. **WanderWalk 规划**（`app/citywalk/`）：品牌视觉与规划面板；规划前偏好 / 节奏 / 时段 / 路线风格与最多 3 个必去点（搜索、地图 Pin、灵感勾选）；地图偏好探索与灵感候选 Pin（高德 PlaceSearch）；灵感联网博查且仅展示地理编码成功的 POI；路线去折返、贴计划时长；分享链接与 `?r=` 打开即还原参数；定位或 IP 定城、最近路线、移动搜索贴键盘；结果页叙事、天气室内重规划、逐站步行导航、可选站跳过与增删站重规划、主题色路线绘制。
4. **WanderWalk 社区**（`app/citywalk/community/`）：Walk 灵感、找搭子、足迹（演示数据 + 邮箱登录后足迹云同步）；规划完成可「记录到社区」，经 `sessionStorage` 展示路线时间轴；粉紫品牌 token、Tab 与联动条、示例诚实标注；移动端安全区与 ≥44px 触控。
5. **文档转换**（`app/practical/doc-tools/`）：浏览器内 PDF→PNG（ZIP）、图片→PDF（按文件名数字 1、2、3… 排序）、PDF→PPTX（整页位图）、只读 ipynb；文件不上传，脚本经 jsDelivr 加载 pdf.js、pdf-lib、JSZip、PptxGenJS。Word/PPT→PDF、PPT→图、nbopen 等依赖本机 Office/WPS 或 Jupyter，见 `windows/` 打包说明（源码在 monorepo `noomings/desktop-doc-tools/`，本站不提供 exe）。换算与媒体与首页工具区增加入口。

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
