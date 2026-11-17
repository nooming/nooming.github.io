# WanderWalk · Citywalk 路线规划

**WanderWalk** 为产品主名；**Citywalk 路线规划** 为规划能力说明。

> 当前状态：**未上线**。`/app/citywalk/` 在 `noomings.com` 返回 404，导航和首页不挂入口，也没有生产 API。

## 当前范围

源码保留在 `app/citywalk/`，用于后续恢复，但当前不对外提供：

- 路线规划
- 智能规划 / 对话微调
- 灵感推荐
- 社区（找搭子、足迹、经验分享）
- 分享长图、天气、日历导出

恢复上线前需要重新确认：

- 账号与 UGC 合规
- 地图 / POI / 天气 Key 与配额
- 后端部署与 `api.noomings.com`
- 公安备案和隐私说明
- 移动端与分享链路回归

## 本地开发

后端：

```bash
cd noomings_backend
python app.py
```

前端：在本目录用静态服务器打开 `index.html`。`localhost` 下 API 指向本地后端，配置见 `assets/js/core/cw-state.js` 中的 `CW_API`。

后端环境变量见 [`noomings_backend/README.md`](../../../noomings_backend/README.md)。

## 说明

此前文档中的 GitHub Pages、Zeabur API、`api.noomings.com` 生产地址均已过期，不再作为当前部署依据。
