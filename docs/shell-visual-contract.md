# 站内壳页视觉契约

适用于已挂 **site-shell** + **shell-prefs** 的页面（`assets/css/common.css`）。独立产品壳见文末例外表。

参考实现：[抽卡规划](../app/play/gacha-planner/)（深浅主题均依赖同一套 token）。

## 1. 可读性

### 1.1 浅底不加浅字

在 `--color-card`、`--color-canvas`、`--color-surface-dim` 上：

- 正文与 UI 字使用 `--color-ink`、`--color-body`、`--color-text-secondary`、`--color-text-tertiary` 或 `.text-note`
- **禁止** 白字 / 近白字（`#fff`、`rgba(255,255,255,0.9)` 等）作可读正文

### 1.2 深底不加深字

在深色 `--color-canvas`、深底终端块（如 `.gp-stats`）上：

- **禁止** `#000`、`rgba(0,0,0,*)` 作正文
- 说明字用 `--color-body` 或契约允许的半透明白；强调可用 `--color-theme`

### 1.3 验收

浅色与 `html[data-theme="dark"]` 各打开代表页；抽检 `color` / `background-color`，避免黑底黑字、白底白字。

## 2. 黄色按钮（抽卡式两档）

| 角色 | 类名 | 默认态 | 悬停 / 强调 |
|------|------|--------|-------------|
| **可点击主按钮** | `.btn-primary` | `--btn-emphasis-*`（洗黄底 + 墨字 + 细边） | `--btn-cta-*`（纯主题黄 + `--color-theme-ink`） |
| 工具条成组 | `.btn-emphasis` | 同上 | `--btn-emphasis-bg-hover` |
| 文件 / 工具入口（带 →） | `.tool-btn` | 淡黄底 + 黄边 | 纯主题黄 |
| 返回顶部 | `.back-to-top` | 淡黄底 + 黄边 | 纯主题黄 |
| 顶栏偏好开关 | `.site-shell-pref-btn` | 白底 / 按下淡黄底 + 黄边 | 纯主题黄 |
| 返回首页 | `.back-btn` | 墨底亮字 | **不属于**黄按钮族 |
| 小徽标 | `.hub-label` | 墨底黄字 | 禁止拉长当主按钮 |

默认态定义见 `assets/css/common.css` 中 `.btn-primary`，与抽卡页 `.gp-primary` 行为一致。**静止态不出现整块纯黄**。

## 3. 选中 / 开关态（淡黄底 + 黄描边）

非「未按下的主按钮」，而是 **已选中** 时：

- `background: --color-theme-wash`
- 2px `--color-theme-deep` 边框或 `box-shadow: inset 0 0 0 2px`
- 文字用 `--color-ink`；不再整块填充纯黄

典型选择器：`.is-active`、`[aria-pressed="true"]`、`:has(input:checked)`（OCR 语言、Markdown 目录/工具栏、棋类分段、问卷选项等）。

## 4. 颜色与主题

- 壳层样式 **只用语义 token**；不写 `#666` / `#f8f9fa` 作面板字色（状态色、棋盘木色等记入例外表）
- 主题唯一来源：`shell-prefs-boot.js` → `html[data-theme]` → `common.css` 变量
- 壳页勿单独 `color-scheme: light` 锁死浅色（菜单层可对齐 `data-theme`）

## 5. 壳层布局

- `body.page-container`：canvas 网格 + 卡片浮岛 + `section-header`
- 补充说明：`.text-note` 或 `--color-text-tertiary`

## 6. 工程约束

- 禁止内联 `style="color:#…"` 定主色
- 第三方 `*.min.css` **只叠加** 覆盖层，不改 min 源文件

## 7. 例外表白名单

| 区域 | 说明 |
|------|------|
| `app/notes/`、`app/citywalk/`、`app/parking-pso/` | 独立产品壳，本契约不作为强制标准 |
| 棋类/牌桌对局区、星铎 `star-duo.css` 全屏 | 沉浸配色保留 |
| 灯牌 `#stage` | 举牌舞台 |
| 语义色按钮 | 如下载成功绿钮等，可保留色相 |

## 8. 相关文档

- 文案：[copy-style.md](./copy-style.md)
- 信息架构：[app-ia.md](./app-ia.md)
