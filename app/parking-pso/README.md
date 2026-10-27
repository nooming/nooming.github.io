# 停车方案设计器（parking-pso）

SITP「社区停车动态调度与在线优化决策系统」前端。API：`noomings-backend.zeabur.app` 的 `/api/parking/*`（见 `noomings_backend/README.md`）。

**动态到达与在线滚动**：见 [docs/DYNAMIC-PARKING-PLAN.md](docs/DYNAMIC-PARKING-PLAN.md)。

## 目录

| 文件 | 用途 |
|------|------|
| `index.html` | **线上入口**（bundle，GitHub Pages 默认打开） |
| `index.dev.html` | **本地开发**（按模块加载 `assets/js/**`，改逻辑用这个） |
| `index.bundled.html` | `bundle-js.ps1` 生成的 bundle 版 HTML 模板 |
| `assets/js/app/`、`optimizer/`、`core/` | 源码 |
| `assets/js/*.bundle.js` | 打包产物（发布前需重新生成） |
| `scripts/bundle-js.ps1` | 合并脚本为 bundle |
| `scripts/deploy.ps1` | 打 bundle 并覆盖 `index.html` |

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
