# Citywalk · 城市漫步路线规划

多城步行路线定制：地图选点、偏好与时长、智能规划、灵感种草、天气与分享长图。生产环境前端托管于 GitHub Pages，API 由 Zeabur 提供。

## 访问地址

- **页面**：<https://noomings.com/app/citywalk/>（与 <https://nooming.github.io/app/citywalk/> 同源）
- **API**：<https://noomings-backend.zeabur.app/api/citywalk/>（`CORS_ORIGINS` 须允许前端域名）

## 功能概览

- **智能规划**：自然语言描述需求（起终点可在地图或搜索框选定）
- **手动规划**：起终点路线 / 环线探索，打卡偏好与路线风格
- **灵感推荐**：浏览推荐 POI，勾选后纳入路线
- **结果页**：距离与耗时、打卡列表、高德导航、游记文案与分享图
- **其它**：多城切换、实时天气、历史路线（本地存储）

## 本地开发

后端：`cd noomings_backend && python app.py`（默认 `:5000`）。

前端：在本目录用静态服务器打开 `index.html`；`localhost` 下 API 自动指向本地后端（见 `assets/js/core/cw-state.js` 中的 `CW_API`）。

后端环境变量与 Zeabur 部署说明见 [`noomings_backend/README.md`](../../../noomings_backend/README.md)。
