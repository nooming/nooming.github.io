# Citywalk · 城市漫步路线规划

多城步行路线定制：地图选点、偏好与时长、智能规划、灵感种草、天气与分享长图。生产环境前端托管于 GitHub Pages，API 由 Zeabur 提供。

## 访问地址

- **页面**：<https://noomings.com/app/citywalk/>（与 <https://nooming.github.io/app/citywalk/> 同源）
- **API**：<https://noomings-backend.zeabur.app/api/citywalk/>（`CORS_ORIGINS` 须允许前端域名）

## 功能概览

- **智能规划**：自然语言描述需求；偏好、节奏、时段与起终点在规划前可见并可提交
- **手动规划**：起终点路线 / 环线探索，路线风格、重置与完整历史
- **逛法节奏**：密集打卡 / 慢慢逛（`visit_pace`）
- **必去点**：最多 3 个，搜索或长按地图订入，与灵感卡片一并作为种子
- **灵感推荐**：仅展示地理编码成功的真实 POI；勾选后纳入路线
- **结果页**：默认叙事（为何这些站 / 可选 / 计划 vs 预计）、逐站「下一站」导航、可选站跳过、天气室内重规划、对话微调、复制分享链接、游记与分享图
- **其它**：多城切换、天气（港澳可参考邻近城市）、最近路线（本地存储）、主题持久化、双指缩放

## 本地开发

后端：`cd noomings_backend && python app.py`（默认 `:5000`）。

前端：在本目录用静态服务器打开 `index.html`；`localhost` 下 API 自动指向本地后端（见 `assets/js/core/cw-state.js` 中的 `CW_API`）。

后端环境变量与 Zeabur 部署说明见 [`noomings_backend/README.md`](../../../noomings_backend/README.md)。
