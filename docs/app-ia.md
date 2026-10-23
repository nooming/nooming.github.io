# `app/` 与顶栏信息架构

顶栏 **首页 · 实验 · 工具 · 阅读 · 娱乐** 与目录对应关系（无旧 URL 跳转）。

| 顶栏 | 目录 | 说明 |
|------|------|------|
| 首页 · 常用 | `navigation/`、`notes/`、`citywalk/` | 不挂全站壳（Citywalk 自有顶栏） |
| 首页 · 实践 | `parking-pso/` | 不挂壳 |
| 实验 | `lab/` | 顶栏 L1 → `pixelflow/`；`proton/`、`fan-rpm/`（无域目录页） |
| 工具 | `tools/` | 顶栏 L1 → `qr-code-generator/`；**工具目录** `tools/index.html` |
| 阅读 | `read/` | 顶栏 L1 → `read/markdown/`；站内长文（无域目录页） |
| 娱乐 | `play/` | 顶栏 L1 → `games/board-games/gomoku/`（无域目录页） |

导航壳逻辑：`assets/js/site-shell.js` 中 `detectDomain()` 按 `/app/lab`、`/app/tools`、`/app/read`、`/app/play` 前缀识别。
