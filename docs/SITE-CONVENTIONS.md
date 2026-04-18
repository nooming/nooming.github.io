# 站点结构与路径约定

面向在 `nooming.github.io` 仓库内新增或调整页面的维护说明（用户站点：`https://nooming.github.io/`，**用户级 Pages**，部署后 URL 仍以站点根为基准）。

**`app/`**：互动页与在线工具的统一一级目录（网址导航、笔记、Citywalk、决策、心理测试、实用工具、小游戏等均在此下；对外路径形如 **`/app/…`**）。专题长文与互动实验仍在 **`articles/`**。

## 全站公共资源

在任意深度的 HTML 中，引用全站 CSS、JS、favicon 时，从**当前 HTML 文件所在目录**写回到仓库根下的 **`assets/css/`**、**`assets/js/`**、**`assets/icons/`**（用若干 `../` 接 `assets/...`）。这样在 **`file://` 双击预览** 与 **GitHub Pages（`https://nooming.github.io/...`）** 下解析结果一致；**不要**再写成以 `/` 开头的根绝对路径（在 `file://` 下会指向磁盘根 `C:/assets/...`）。

- 样式：`…/assets/css/common.css`（相对链）；站根首页另有 `…/assets/css/home.css`
- 脚本：`…/assets/js/utils.js`（Toast、剪贴板、返回顶部等）
- 图标与 PWA：`…/assets/icons/...`（含 `site.webmanifest`；`site.webmanifest` 内图标 `src` 亦为相对 manifest 文件的路径）

**例外**：`app/citywalk/`（Citywalk）为独立全屏地图应用，可不引入 `common.css`；仍可按需加上述 favicon 链接以保持标签页图标一致。

**本地预览**：推荐仍用 **HTTP 服务**（如 `http://127.0.0.1:5500/`）预览整站；若仅用 `file://`，部分浏览器对 `site.webmanifest` 等仍可能报 CORS，属协议限制，与路径是否正确无关。

## 新工具 / 新栏目的目录模板（推荐）

| 内容 | 约定 |
|------|------|
| 对外 URL | `…/功能slug/` + 目录内 **`index.html`** |
| 静态资源 | **`assets/css/`**、**`assets/js/`**、按需 **`assets/img/`** |
| 与现有风格并存 | `app/notes/`、`articles/*/` 等已逐步统一为各页目录下 **`assets/`**；**新建**工具与专题互动页优先 `assets/` |

## 桌游 card-games

- 游戏页：`app/games/card-games/hearts/`、`app/games/card-games/texas/`、`app/games/card-games/uno/`
- 旧 `.html` 文件名保留为重定向，见 `app/games/card-games/README.md`

## 相关文档

- 可选静态站点构建（未默认启用）：[BUILD-OPTIONAL.md](BUILD-OPTIONAL.md)
