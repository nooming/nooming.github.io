# 停车方案设计器（parking-pso）

SITP「社区停车动态调度与在线优化决策系统」前端。备案期间生产 API：`https://noomings-backend.zeabur.app` 的 `/api/parking/*`；备案通过后改为 `https://api.noomings.com`（见 `deploy/tencent/README.md`、`noomings_backend/README.md`）。

**动态到达与在线滚动**：见 [docs/DYNAMIC-PARKING-PLAN.md](docs/DYNAMIC-PARKING-PLAN.md)。

## 目录

| 文件 | 用途 |
|------|------|
| `index.html` | **线上入口**（bundle，GitHub Pages 默认打开） |
| `index.dev.html` | **本地开发**（按模块加载 `assets/js/**`，改逻辑用这个） |
| `index.bundled.html` | `bundle-js.ps1` 生成的 bundle 版 HTML 模板 |
| `assets/js/app/`、`optimizer/`、`core/` | 源码 |
| `assets/js/*.bundle.js` | 打包产物（发布前需重新生成） |
| `scripts/bundle-js.ps1` | 合并脚本为 bundle（保持 `app-state` 在 storage / default-source / analysis / tab-utils 之后） |
| `scripts/deploy.ps1` | 打 bundle 并覆盖 `index.html` |

> `app-state.js` 会在加载时捕获 storage / scenario-source / analysis / tab-utils 四个模块；调整 `index.dev.html` 或 bundle 顺序时不要把这四个文件放到 `app-state` 之后，否则默认场景与本地持久化会静默失效。

## 离线行为

- API 不可用时顶栏显示「离线」，方案库走本机缓存；
- 「运行优化」仍用本地 exact 优化；
- 「运行仿真」在离线时自动先算一次本地 exact，再生成「本地估算」时间轴，不发请求。

## 编辑与恢复

- 「运行优化」旁提供撤销 / 重做（最近 40 步）、复制摘要；
- 场景体检会检查道路、入口、居民楼、车位与优化状态，并给出可点击的下一步；
- 场景自动保存到本机浏览器，概览显示保存时间；换设备前导出 JSON；
- 「方案库与对比」可保存当前优化方案、勾选 2 个方案查看指标表与雷达图，并导出 HTML 对比报告。

## 界面

- 深色蓝图主题：画布作为浅色图纸浮在深色工作台上，左上角玻璃工具条、右上角紧凑图例；
- 工作台按总览 / 场景 / 车辆 / 仿真分段，底部固定操作 dock 常驻运行优化、撤销、重做、摘要；
- 车辆队列按「车号 / 目的楼 / 入口 / 需求 / 到达」排成紧凑表格；
- 移动端地图优先，操作 dock 固定底部，不遮挡内容。

## 本地开发

```powershell
# 终端 1
cd ..\..\..\noomings_backend   # 或 myweb-re\noomings_backend
python app.py

# 终端 2：静态服务本目录，打开 index.dev.html
# localhost 下 API 自动指向 http://127.0.0.1:5000
```

## 发布到 Pages

在 `app/parking-pso/scripts` 下：

```powershell
.\deploy.ps1
```

然后在 `nooming.github.io` 仓库内 `git add` / `commit` / `push`（含源码与 bundle）。

## 说明

本应用 **不挂** 全站 `site-shell`（与 Citywalk、笔记一致）。
