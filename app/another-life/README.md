# 另一个我 · 一生的平行来信

静态交互叙事。入口为同目录 `index.html`，首页「独立入口」链接到此。

- 原文件：`另一个我-八字版 .html`，内容原样保留，按加载性能拆分为外部资源。
- 目录：
  - `assets/css/app.css`：页面样式与 `@font-face`
  - `assets/js/`：主脚本、排盘、数据、GSAP、HanziWriter
  - `assets/fonts/`：四个 WOFF2 字体
  - `assets/img/`：印章、场景、相册与章节插画（WebP）
- 首屏只加载封面所需字体和图片；相册图延迟加载，章节图随场景使用加载。
- `assets/js/legacy/` 保留原页面的离线数字识别模型与推理脚本，当前页面未加载。
- 排盘 worker 通过 fetch 读取 `assets/js/bazi.js` 的源码；`file://` 等无法 fetch 的场景自动回退主线程计算。
- 字体、插画与排盘逻辑来自原页面；仅调整资源外链、worker 源码读取与图片路径解析。
