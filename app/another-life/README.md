# 另一个我 · 一生的平行来信

静态交互叙事：写下一个生辰，得到一条平行人生——四柱八字、十二幕场景，和一生的批注。入口为同目录 `index.html`。

## 目录

- `index.html`：四个屏幕（封面 / 生辰扉页 / 命盘 / 故事）的骨架。
- `assets/css/app.css`：页面样式与 `@font-face`。
- `assets/js/app.js`：界面、场景编排、转场、声音；`config.js` 把 `report.story` 配上画面；`data.js` 城市坐标与图集；`gsap.js` 动画库。
- `assets/js/bazi.js`：排盘引擎（含 lunar-javascript）；`bazi-worker.js`：排盘线程。
- `assets/js/fire-glyphs.js`：金文字形路径。
- `assets/fonts/`：WenKai / BookInk / Brush，以及封面用的 6 字子集 `brush-ui.woff2`。
- `assets/img/`：印章、场景、相册与章节插画（WebP）；每张背景另有 `-960` / `-1440` 两档变体，道具另有 `-960` / `-1280`。`assets/brand/favicon.png` 为站点图标。

## 加载策略

首屏只下 `app.css`、`data/config/gsap/app` 四个脚本、WenKai 正文字体、封面印章与封面图，不再预载场景图。

- `bazi.js`（646KB）与 `fire-glyphs.js`（214KB）不参与首屏；进入生辰扉页后趁空闲预取，点「展开我的平行人生」时才真正等待。加载失败会给出提示，不会静默换算出错。
- 排盘在 `assets/js/bazi-worker.js` 里算（`importScripts` 引擎）。worker 起不来（如 `file://`）时自动回退主线程。
- Brush 拆成两份：封面只需要「另一个我 / 启卷」，走 3KB 的 `BrushUI`；完整 Brush 等到命盘页再用。
- `scene-a.webp` 从 1672px 降到 1200px，并以 `fetchpriority="low"` 加载。
- 干支 22 个字全部在 `FIRE_GLYPHS` 里，因此移除了 HanziWriter 与 `HANZI_DATA`（`data.js` 从 53KB 降到 14KB）。
- 两个装饰字体的 `font-display` 改为 `swap`，弱网下不再出现空白字。
- 图片按屏宽取变体（`window.ART_SRCSET` + `srcset`/`sizes`，相册用 `<picture>`）：手机取 960，1× 桌面取 1440，DPR2 桌面仍取 1672 原图，肉眼不降质。相册底图用 q88，其余背景 q76。

## 交互

- 手机故事页上翻一小段后进入阅读态，画面遮盖约 36%，正文区扩大；向下滑或滚轮向上可回位，切章恢复。`?read=move` 可切换成画面上移版本对比。
- 换屏时焦点会交给新屏标题；章节标题是 `aria-live` 区域，读屏能听到翻页。
- 恢复窗口尺寸后会重新对齐时间轴火星。

## 校验

- **首屏**：3488KB / 15 个请求 → 1000KB（手机 940KB）/ 10–11 个请求；gzip 后约 2703KB → 827KB。
- **走完一生（12 幕）**：桌面 6692KB → 4865KB（−27%），手机 6543KB → 4174KB（−36%）。
- **画面**：关闭动画后逐像素对比，文字、版式、印章、时间轴全部一致；差异只出现在照片层——生辰页 3.3%（相册 1672→1440），故事页 0–5.1%（背景 1672→1440/960），片尾 1.2–4.2%。1:1 裁切下相册细节一致，背景在 1× 屏上略柔；DPR2 桌面仍取原图。

## 来源

字体、插画与排盘逻辑来自原页面（`另一个我-八字版`），另按反馈对齐烧字转场、翻转片尾背景，并在手机故事页上翻时收起画面。
