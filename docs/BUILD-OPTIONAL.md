# 可选：引入构建层（规划说明）

当前仓库以**纯静态 HTML** 直接发布到 GitHub Pages，无默认构建步骤。若 head 区块（favicon、OG、canonical）重复维护成本变高，可按下述方式之一引入「仅开发时构建」，**产物仍写入仓库根**（或写入 `docs/` 再由 Actions 发布），避免改变现有 Pages 根 URL。

## 方案 A：Eleventy（11ty）

- **适用**：多页共用布局、导航、SEO 片段；Markdown 文章转 HTML。
- **建议目录**：`_src/` 或 `src/` 放 Nunjuck/Liquid 模板与按页数据；`npm run build` 输出到仓库根或与当前 `index.html` 同级的发布目录。
- **注意**：`.eleventy.js` 中配置 `pathPrefix`：仅当站点部署在 **`https://<user>.github.io/<repo>/`** 项目页时才需要；当前 **`nooming.github.io` 用户站点**根路径为 `/`，保持默认即可。
- **CI**：GitHub Actions 在 `push` 时 `npm ci && npm run build`，将生成文件提交或由 `actions/upload-pages-artifact` 上传（二选一，需与仓库 Settings → Pages 来源一致）。

## 方案 B：小型 Node 脚本

- **适用**：只做「头部片段合并」或批量替换，不需要完整模板引擎。
- **做法**：`scripts/build-head.mjs` 读取 `templates/head.html` 与各页 YAML/front-matter，写回各 `index.html`；或仅生成 `assets/includes/` 再由构建拼进页面。
- **依赖**：仅 `node:` 内置模块即可，或极简 `ejs`/`handlebars` 单依赖。

## 与现有约定的关系

引入构建后，若仍发布到用户站根且需兼容 `file://`，模板中可继续生成与各页深度一致的 **`../../assets/css/...`** 等相对链，与 [SITE-CONVENTIONS.md](SITE-CONVENTIONS.md) 一致；若仅 HTTP 部署且接受放弃 `file://`，也可统一输出以 `/` 开头的 **`/assets/...`** 根绝对路径以简化模板。

当前未添加 `package.json` 或 workflow；采纳任一方案时再在仓库中落地配置即可。
