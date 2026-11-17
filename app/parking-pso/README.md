# 停车方案设计器（parking-pso）

**本地优先版本**：不依赖后端 API，优化、仿真、方案库都在浏览器本机完成。生产入口仍是 `index.html`，源码入口是 `index.dev.html`。

**动态到达与在线滚动**：见 [docs/DYNAMIC-PARKING-PLAN.md](docs/DYNAMIC-PARKING-PLAN.md)。

## 目录

| 文件 | 用途 |
|------|------|
| `index.html` | **线上入口**（bundle，GitHub Pages 默认打开） |
| `index.dev.html` | **本地开发**（按模块加载 `assets/js/**`，改逻辑用这个） |
| `index.bundled.html` | `bundle-js.ps1` 生成的 bundle 版 HTML 模板 |
| `assets/js/app/`、`optimizer/`、`core/` | 源码，含本地滚动仿真入口 |
| `assets/js/*.bundle.js` | 打包产物（发布前需重新生成） |
| `scripts/bundle-js.ps1` | 合并脚本为 bundle（保持 `app-state` 在 storage / default-source / analysis / tab-utils 之后） |
| `scripts/deploy.ps1` | 打 bundle 并覆盖 `index.html` |

> `app-state.js` 会在加载时捕获 storage / scenario-source / analysis / tab-utils 四个模块；调整 `index.dev.html` 或 bundle 顺序时不要把这四个文件放到 `app-state` 之后，否则默认场景与本地持久化会静默失效。

## 离线行为

- 不发起后端请求，顶栏显示「本地计算」；
- 优化支持本地 exact 与 PSO，可在「优化方法」切换；
- 本地可生成三套候选方案：最小总时间、均衡步行、提高利用率；
- 仿真用本地 FIFO 滚动分配 + 本地回放；
- 支持本地到达对照和 Monte Carlo 抽样；
- 方案库、场景自动保存都在本机浏览器。

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
