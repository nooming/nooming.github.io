# noomings

个人静态站。线上地址：**https://noomings.com**

## 线上环境

- 腾讯云服务器 + Nginx 静态托管
- 域名：`noomings.com`，`www.noomings.com` 跳转/同站
- HTTPS：Let's Encrypt，Certbot 自动续期
- ICP：`沪ICP备2026061427号`
- 站点根目录：`/var/www/noomings`

GitHub Pages 仅作为源码托管，不再是生产入口。

## 当前上线范围

### 独立入口

- **导航**：[app/navigation/](../app/navigation/)
- **笔记**：[app/notes/](../app/notes/) — 画布 + 文本，本地持久化
- **停车**：[app/parking-pso/](../app/parking-pso/) — 纯本地停车方案设计器
- **另一个我**：[app/another-life/](../app/another-life/) — 静态交互叙事，生辰信息本地计算

### 实验

[像素涌流](../app/lab/pixelflow/) · [质子](../app/lab/proton/) · [风扇转速](../app/lab/fan-rpm/)

### 工具

顶栏默认进入 [PDF→图](../app/tools/doc-tools/pdf-to-images/)，完整入口见 [工具目录](../app/tools/)。

### 阅读

[Markdown](../app/read/markdown/) · [开发者工具实战](../app/read/crawler-experience/) · [猫抓笔记](../app/read/cat-catch-tutorial/)

### 娱乐

[五子棋](../app/play/games/board-games/gomoku/) 及棋类、卡牌、问卷、抽卡规划等。

## 未上线

- **Citywalk**：源码保留，当前 `/app/citywalk/` 返回 404，不挂入口
- **physics**：未部署到本站
- 两者需要单独的账号/UGC 或 AI/数据合规，不能直接恢复入口

## 停车方案设计器

`app/parking-pso/` 是纯本地版本：

- 无后端、无 API、无上传
- exact / PSO 优化
- 本地滚动仿真、到达对照、Monte Carlo
- 本地方案库、场景自动保存
- 所有计算和方案只保存在浏览器

源码入口为 `index.dev.html`，发布入口为 bundle 后的 `index.html`。

## 技术栈

- HTML5 / CSS3 / JavaScript (ES6+)
- Canvas API
- LocalStorage
- PDF.js、pdf-lib、JSZip、PptxGenJS（文档转换，按需加载）
- PaddleOCR / Tesseract.js（OCR，按需加载）
- Perfect Freehand（笔记）
- marked + DOMPurify（Markdown）
- 棋类引擎与 Web Worker

## 项目结构

```text
├── index.html                  # 首页
├── 404.html                    # 404
├── assets/                     # 全站 CSS/JS/icons
├── app/
│   ├── navigation/             # 导航
│   ├── notes/                  # 笔记
│   ├── parking-pso/            # 本地停车方案
│   ├── another-life/           # 另一个我
│   ├── lab/                    # 实验
│   ├── tools/                  # 工具
│   ├── read/                   # 阅读
│   ├── play/                   # 娱乐
│   └── citywalk/               # 源码保留，未上线
├── docs/                       # 开发文档与更新记录
├── sitemap.xml
└── robots.txt
```

## 部署

1. 将站内静态文件发布到 `/var/www/noomings`
2. Nginx `root` 指向该目录
3. `noomings.com` / `www.noomings.com` 解析到服务器
4. Certbot 管理 HTTPS
5. 更新后强制刷新或带版本参数，避免浏览器缓存旧 JS/CSS

具体线上信息不要写进前端代码或提交密钥。

## 文档

- [CHANGELOG.md](./CHANGELOG.md)：当前更新记录
- [CHANGELOG-legacy.md](./CHANGELOG-legacy.md)：旧版历史归档
- [changelog-style.md](./changelog-style.md)：更新日志写法
- [copy-style.md](./copy-style.md)：用户可见文案规范
- [shell-visual-contract.md](./shell-visual-contract.md)：站内壳页视觉契约

## 新增页面检查清单

1. 需要顶栏/侧栏入口时，同步 `assets/js/site-shell.js`
2. 需要被搜索引擎发现时，更新 `sitemap.xml`
3. 需要公共 Toast / 返回顶部时，从页面目录引用根 `assets/js/utils.js`
4. 页面若含本地数据，明确写出“仅存本机浏览器”
5. 上线前检查页脚 ICP
6. 不在未完成合规的情况下恢复 Citywalk / physics 入口

## 许可证

© 2026 noomings · 非商用 · 仅用于学习交流

作者：nooming
