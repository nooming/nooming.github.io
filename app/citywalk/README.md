# Citywalk · 城市漫步路线规划

多城步行路线定制：地图选点、偏好与时长、智能规划、灵感种草、天气与分享长图。生产环境前端托管于 GitHub Pages，API 由 Zeabur 提供。

## 访问地址

- **页面**：<https://noomings.com/app/citywalk/>（自定义域，与 <https://nooming.github.io/app/citywalk/> 同源内容）
- **API**：<https://noomings-backend.zeabur.app>（后端 `CORS_ORIGINS` 须同时允许 `noomings.com` 与 `nooming.github.io`）

## 功能概览

- **智能规划**：自然语言描述需求（起终点可在地图或搜索框选定）
- **手动规划**：起终点路线 / 环线探索，打卡偏好与路线风格（均衡、氛围优先、省力直达）
- **灵感推荐**：浏览推荐 POI，勾选后纳入路线；可选联网选点（后端配置）
- **结果页**：距离与耗时、打卡列表、高德导航、游记文案与分享图、对话微调路线
- **其它**：多城切换、实时天气、历史路线（本地存储）

## 本地开发

完整 monorepo 见仓库内 `citywalk/`（`backend/` + `frontend/`）。仅调试 API 时可在 `noomings_backend` 目录执行 `python citywalk.py`；仅调试页面时在本目录用静态服务器打开 `index.html`，并将 hostname 设为 `localhost` 时 API 自动指向 `http://localhost:5000`。

后端环境变量与 Zeabur 部署说明见 `noomings_backend/README.md`（与 `citywalk/backend/README.md` 同步维护）。
