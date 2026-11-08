# WanderWalk · Citywalk 路线规划

**WanderWalk** 为产品主名；**Citywalk 路线规划** 为规划能力说明。多城步行路线定制：地图选点、偏好与时长、智能规划、灵感种草、天气与分享长图。社区侧提供找搭子、足迹与经验分享（演示数据）。生产环境前端托管于 GitHub Pages，API 由 Zeabur 提供。

## 访问地址

- **Citywalk 路线规划**：<https://noomings.com/app/citywalk/>（与 <https://nooming.github.io/app/citywalk/> 同源）
- **WanderWalk 社区**：<https://noomings.com/app/citywalk/community/>（Walk 经验、找搭子、足迹；规划结果可写入社区）
- **API（备案期间）**：<https://noomings-backend.zeabur.app/api/citywalk/>（通过后改为 `api.noomings.com`；`CORS_ORIGINS` 须允许 `nooming.github.io` / `noomings.com`）

## 功能概览

- **智能规划**：自然语言描述需求；偏好、节奏、时段与起终点在规划前可见并可提交
- **手动规划**：起终点路线 / 环线探索，路线风格、重置与完整历史
- **逛法节奏**：密集打卡 / 慢慢逛（`visit_pace`）
- **必去点**：最多 3 个，搜索直接订入，或右键 / 长按地图后再点「订为必去」；与灵感卡片一并作为种子
- **灵感推荐**：仅展示地理编码成功的真实 POI；勾选后纳入路线
- **结果页**：默认叙事（为何这些站 / 可选 / 计划 vs 预计）、逐站「下一站」导航、可选站跳过、天气室内重规划、对话微调、复制分享链接、游记与分享图
- **行程落地**：按日期/出发时间生成行程时间轴，可导出 `.ics` 加入系统日历
- **路线备选**：结果页「换一种走法」在均衡 / 氛围优先 / 省力直达之间重算，并对比当前与上一版的距离、时长、站数
- **数据控制**：社区「我 → 账号 → 数据与隐私」可导出本机 JSON、清除本机缓存（不删除云端），并显示云端服务状态
- **移动端**：首次进入半屏展示表单，结果页先半屏保留地图，上滑看完整行程；站点排序在触屏用「上移 / 下移」
- **降级**：地图脚本失败时显示重试占位；城市定位/配置接口 5 秒超时后回退当前城市，不再卡在「定位中」
- **其它**：多城切换、天气（港澳可参考邻近城市）、最近路线（本地存储）、统一品牌色、双指缩放

## 本地开发

后端：`cd noomings_backend && python app.py`（默认 `:5000`）。

前端：在本目录用静态服务器打开 `index.html`；`localhost` 下 API 自动指向本地后端（见 `assets/js/core/cw-state.js` 中的 `CW_API`）。

后端环境变量与 Zeabur 部署说明见 [`noomings_backend/README.md`](../../../noomings_backend/README.md)。
