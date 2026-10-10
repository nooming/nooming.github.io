# WanderWalk 品牌标识

## 概念 · W 线标 + 三站

- **形态**：标准 **W** 字线标（左高 → 左谷 → 中峰 → 右谷 → 右高），圆角描边；一眼可读，不再用「像 W 的波浪线」这种牵强说法。
- **三站圆点**：落在 W 的三个「上沿」锚点（左起、中峰、右终），薄荷 / 黄油 / 粉紫 — 对应 `--mint` / `--butter` / `--accent`，兼作 Citywalk 多站叙事。
- **渐变描边**：`#ff6f91` → `#9b8cff`，与 `cw-brand.css` 主色一致；底为浅粉紫画布，适合浅色 UI。

## 文件

| 文件 | 用途 |
|------|------|
| `wanderwalk-mark.svg` | 独立图标（64×64，可缩放） |
| `wanderwalk-mark-light.svg` | 规划页顶栏渐变底上的反白图标 |
| `wanderwalk-logo.svg` | 横版锁标（图标 + 字标） |
| `favicon.svg` | 浏览器标签 / PWA |

## 使用

- 顶栏：`.cw-brand-logo` + `wanderwalk-logo.svg` 或 mark + 现有 `.logo` 渐变字
- 勿拉伸变形；最小清晰宽度 mark 约 **24px**
- 字标「Walk」渐变与社区 `.logo b` 一致，可继续用 HTML 字标 + SVG 图标组合

## 禁忌

- 不要单独改节点颜色顺序（会破坏「旅程」叙事）
- 不要在深色底使用彩色 mark，请用 `wanderwalk-mark-light.svg`

## 文案

用户可见用语见仓库根目录 `citywalk-后续.md` · **文案规范**；社区示例说明集中写在 `community/assets/js/community.js` 的 `WW_COPY`。
