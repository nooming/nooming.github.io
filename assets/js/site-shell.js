// ========== 产品域导航壳 · 桌面顶栏 / 移动底栏 ==========
(function () {
    "use strict";

    var SPRITE = "/assets/icons/ui/hub-sprite.svg";
    var HOME = "/";

    function normalizePath(pathname) {
        var path = pathname || "/";
        if (/\/index\.html$/i.test(path)) {
            path = path.replace(/\/index\.html$/i, "/");
        }
        if (path.length > 1 && path.endsWith("/")) {
            path = path.slice(0, -1);
        }
        if (path === "/") {
            path = "";
        }
        return path;
    }

    function pathMatches(path, pattern) {
        if (typeof pattern === "string") {
            return path.indexOf(pattern) !== -1;
        }
        if (pattern instanceof RegExp) {
            return pattern.test(path);
        }
        return false;
    }

    function iconSvg(id) {
        return (
            '<span class="site-shell-tab__icon" aria-hidden="true">' +
            '<svg xmlns="http://www.w3.org/2000/svg" focusable="false">' +
            '<use href="' +
            SPRITE +
            "#" +
            id +
            '"/></svg></span>'
        );
    }

    /** 全站顶栏 + 桌面侧栏 + 移动底栏与分组菜单 */
    var GLOBAL = {
        contentWidth: "hub",
        l1: [
            {
                id: "home",
                label: "首页",
                href: "/",
                match: /^$|^\/app\/navigation$/,
            },
            {
                id: "lab",
                label: "实验",
                href: "/app/lab/pixelflow/",
                match: /^\/app\/lab/,
            },
            {
                id: "tools",
                label: "工具",
                href: "/app/tools/doc-tools/pdf-to-images/",
                match: /^\/app\/tools/,
            },
            {
                id: "read",
                label: "阅读",
                href: "/app/read/markdown/",
                match: /^\/app\/read/,
            },
            {
                id: "play",
                label: "娱乐",
                href: "/app/play/games/board-games/gomoku/",
                match: /^\/app\/play/,
            },
        ],
        mobile: [
            {
                id: "home",
                label: "首页",
                icon: "i-globe",
                href: "/",
                match: /^$|^\/app\/navigation$/,
            },
            {
                id: "lab",
                label: "实验",
                icon: "i-flask",
                href: "/app/lab/pixelflow/",
                match: /^\/app\/lab/,
            },
            {
                id: "tools",
                label: "工具",
                icon: "i-gear",
                href: "/app/tools/doc-tools/pdf-to-images/",
                match: /^\/app\/tools/,
            },
            {
                id: "read",
                label: "阅读",
                icon: "i-doc",
                href: "/app/read/markdown/",
                match: /^\/app\/read/,
            },
            {
                id: "play",
                label: "娱乐",
                icon: "i-gamepad",
                href: "/app/play/games/board-games/gomoku/",
                match: /^\/app\/play/,
            },
        ],
        menuGroups: [
            {
                title: "独立入口",
                links: [
                    { label: "导航", href: "/app/navigation/" },
                    { label: "笔记", href: "/app/notes/" },
                    { label: "Citywalk", href: "/app/citywalk/" },
                ],
            },
            {
                title: "实践",
                links: [
                    { label: "停车", href: "/app/parking-pso/" },
                    {
                        label: "物理探究 · 外链",
                        href: "https://physics.noomings.com",
                        external: true,
                    },
                ],
            },
            {
                title: "实验",
                links: [
                    { label: "像素涌流", href: "/app/lab/pixelflow/" },
                    { label: "质子", href: "/app/lab/proton/" },
                    { label: "风扇转速", href: "/app/lab/fan-rpm/" },
                ],
            },
            {
                title: "阅读",
                links: [
                    { label: "Markdown", href: "/app/read/markdown/" },
                    { label: "浏览器开发者工具实战", href: "/app/read/crawler-experience/" },
                    { label: "猫抓扩展使用笔记", href: "/app/read/cat-catch-tutorial/" },
                ],
            },
            {
                title: "娱乐",
                links: [
                    { label: "五子棋", href: "/app/play/games/board-games/gomoku/" },
                    { label: "围棋", href: "/app/play/games/board-games/go/" },
                    { label: "象棋", href: "/app/play/games/board-games/chess/" },
                    { label: "星铎棋", href: "/app/play/games/board-games/star-duo/" },
                    { label: "德州扑克", href: "/app/play/games/card-games/texas/" },
                    { label: "UNO", href: "/app/play/games/card-games/uno/" },
                    { label: "红心大战", href: "/app/play/games/card-games/hearts/" },
                    { label: "小恐龙", href: "/app/play/games/dino/" },
                    { label: "抽卡规划", href: "/app/play/gacha-planner/" },
                    { label: "MBTI", href: "/app/play/psychological/mbti-test/" },
                    { label: "动物塑", href: "/app/play/psychological/animal-test/" },
                ],
            },
            {
                title: "工具",
                links: [
                    { label: "文档 · PDF→图", href: "/app/tools/doc-tools/pdf-to-images/" },
                    { label: "图→PDF", href: "/app/tools/doc-tools/images-to-pdf/" },
                    { label: "图片识字", href: "/app/tools/ocr/" },
                    { label: "多选随机", href: "/app/tools/decision/quick-choice/" },
                    { label: "转盘", href: "/app/tools/decision/wheel/" },
                    { label: "抛硬币", href: "/app/tools/decision/coin-flip/" },
                    { label: "二维码", href: "/app/tools/qr-code-generator/" },
                    { label: "进制换算", href: "/app/tools/base-converter/" },
                    { label: "Base64", href: "/app/tools/base64-converter/" },
                    { label: "音频转换", href: "/app/tools/audio-converter/" },
                    { label: "灯牌", href: "/app/tools/light-board/" },
                ],
            },
            {
                title: "更多",
                links: [
                    {
                        label: "GitHub · nooming",
                        href: "https://github.com/nooming",
                        external: true,
                    },
                ],
            },
        ],
        asideHref: "https://github.com/nooming",
        asideLabel: "GitHub",
    };

    var DOMAINS = {
        tools: {
            id: "tools",
            contentWidth: "narrow",
            l1: [
                {
                    id: "qr",
                    label: "二维码",
                    href: "/app/tools/qr-code-generator/",
                    match: /\/qr-code-generator/,
                },
                {
                    id: "base",
                    label: "进制",
                    href: "/app/tools/base-converter/",
                    match: /\/base-converter/,
                },
                {
                    id: "b64",
                    label: "Base64",
                    href: "/app/tools/base64-converter/",
                    match: /\/base64-converter/,
                },
                {
                    id: "audio",
                    label: "音频",
                    href: "/app/tools/audio-converter/",
                    match: /\/audio-converter/,
                },
                {
                    id: "light",
                    label: "灯牌",
                    href: "/app/tools/light-board/",
                    match: /\/light-board/,
                },
            ],
            l2When: /\/app\/tools\/doc-tools\//,
            l2: [
                {
                    id: "pdf2img",
                    label: "PDF→图",
                    href: "/app/tools/doc-tools/pdf-to-images/",
                    match: /\/pdf-to-images/,
                },
                {
                    id: "img2pdf",
                    label: "图→PDF",
                    href: "/app/tools/doc-tools/images-to-pdf/",
                    match: /\/images-to-pdf/,
                },
                {
                    id: "pdf2ppt",
                    label: "PDF→PPT",
                    href: "/app/tools/doc-tools/pdf-to-ppt/",
                    match: /\/pdf-to-ppt/,
                },
                {
                    id: "ipynb",
                    label: "ipynb",
                    href: "/app/tools/doc-tools/ipynb-read/",
                    match: /\/ipynb-read/,
                },
                {
                    id: "win",
                    label: "Windows",
                    href: "/app/tools/doc-tools/windows/",
                    match: /\/windows/,
                    muted: true,
                },
            ],
            mobileDefault: [
                {
                    id: "doc",
                    label: "文档",
                    icon: "i-doc",
                    href: "/app/tools/doc-tools/pdf-to-images/",
                },
                {
                    id: "qr",
                    label: "二维码",
                    icon: "i-phone",
                    href: "/app/tools/qr-code-generator/",
                },
                {
                    id: "base",
                    label: "进制",
                    icon: "i-numbers",
                    href: "/app/tools/base-converter/",
                },
                {
                    id: "audio",
                    label: "音频",
                    icon: "i-music",
                    href: "/app/tools/audio-converter/",
                },
                { id: "menu", label: "菜单", icon: "i-wrench", action: "drawer" },
            ],
            mobileDoc: [
                {
                    id: "pdf2img",
                    label: "PDF→图",
                    icon: "i-doc",
                    href: "/app/tools/doc-tools/pdf-to-images/",
                },
                {
                    id: "img2pdf",
                    label: "图→PDF",
                    icon: "i-doc",
                    href: "/app/tools/doc-tools/images-to-pdf/",
                },
                {
                    id: "pdf2ppt",
                    label: "PPT",
                    icon: "i-doc",
                    href: "/app/tools/doc-tools/pdf-to-ppt/",
                },
                {
                    id: "ipynb",
                    label: "ipynb",
                    icon: "i-pencil",
                    href: "/app/tools/doc-tools/ipynb-read/",
                },
                {
                    id: "suite",
                    label: "套件",
                    icon: "i-gear",
                    href: "/app/tools/qr-code-generator/",
                },
            ],
            random: [
                {
                    id: "quick",
                    label: "多选随机",
                    href: "/app/tools/decision/quick-choice/",
                    match: /\/quick-choice/,
                },
                {
                    id: "wheel",
                    label: "转盘",
                    href: "/app/tools/decision/wheel/",
                    match: /\/wheel/,
                },
                {
                    id: "coin",
                    label: "抛硬币",
                    href: "/app/tools/decision/coin-flip/",
                    match: /\/coin-flip/,
                },
            ],
            ocr: [
                {
                    id: "ocr",
                    label: "图片识字",
                    href: "/app/tools/ocr/",
                    match: /\/tools\/ocr/,
                },
            ],
            display: [
                {
                    id: "light",
                    label: "灯牌",
                    href: "/app/tools/light-board/",
                    match: /\/light-board/,
                },
            ],
        },
        play: {
            id: "play",
            contentWidth: "wide",
            l2BoardWhen: /\/board-games\//,
            l2Board: [
                {
                    id: "gomoku",
                    label: "五子棋",
                    href: "/app/play/games/board-games/gomoku/",
                    match: /\/gomoku/,
                },
                {
                    id: "go",
                    label: "围棋",
                    href: "/app/play/games/board-games/go/",
                    match: /\/board-games\/go\/?$/,
                },
                {
                    id: "chess",
                    label: "象棋",
                    href: "/app/play/games/board-games/chess/",
                    match: /\/chess/,
                },
                {
                    id: "star-duo",
                    label: "星铎棋",
                    href: "/app/play/games/board-games/star-duo/",
                    match: /\/star-duo/,
                },
            ],
            l2CardWhen: /\/card-games\//,
            l2Card: [
                {
                    id: "texas",
                    label: "德州",
                    href: "/app/play/games/card-games/texas/",
                    match: /\/texas/,
                },
                {
                    id: "uno",
                    label: "UNO",
                    href: "/app/play/games/card-games/uno/",
                    match: /\/uno/,
                },
                {
                    id: "hearts",
                    label: "红心",
                    href: "/app/play/games/card-games/hearts/",
                    match: /\/hearts/,
                },
            ],
            mobileDefault: [
                {
                    id: "gomoku",
                    label: "五子棋",
                    icon: "i-go",
                    href: "/app/play/games/board-games/gomoku/",
                },
                {
                    id: "texas",
                    label: "德州",
                    icon: "i-spade",
                    href: "/app/play/games/card-games/texas/",
                },
                {
                    id: "dino",
                    label: "恐龙",
                    icon: "i-dino",
                    href: "/app/play/games/dino/",
                },
                { id: "menu", label: "菜单", icon: "i-wrench", action: "drawer" },
            ],
            mobileBoard: [
                {
                    id: "gomoku",
                    label: "五子",
                    icon: "i-go",
                    href: "/app/play/games/board-games/gomoku/",
                },
                {
                    id: "go",
                    label: "围棋",
                    icon: "i-go",
                    href: "/app/play/games/board-games/go/",
                },
                {
                    id: "chess",
                    label: "象棋",
                    icon: "i-chess",
                    href: "/app/play/games/board-games/chess/",
                },
                {
                    id: "star-duo",
                    label: "星铎",
                    icon: "i-go",
                    href: "/app/play/games/board-games/star-duo/",
                },
                {
                    id: "menu",
                    label: "菜单",
                    icon: "i-wrench",
                    action: "drawer",
                },
            ],
            mobileCard: [
                {
                    id: "texas",
                    label: "德州",
                    icon: "i-spade",
                    href: "/app/play/games/card-games/texas/",
                },
                {
                    id: "uno",
                    label: "UNO",
                    icon: "i-cards",
                    href: "/app/play/games/card-games/uno/",
                },
                {
                    id: "hearts",
                    label: "红心",
                    icon: "i-heart-suit",
                    href: "/app/play/games/card-games/hearts/",
                },
                {
                    id: "menu",
                    label: "菜单",
                    icon: "i-wrench",
                    action: "drawer",
                },
            ],
            psych: [
                {
                    id: "mbti",
                    label: "MBTI",
                    href: "/app/play/psychological/mbti-test/",
                    match: /\/mbti-test/,
                },
                {
                    id: "animal",
                    label: "动物塑",
                    href: "/app/play/psychological/animal-test/",
                    match: /\/animal-test/,
                },
            ],
            gacha: [
                {
                    id: "gacha",
                    label: "抽卡规划",
                    href: "/app/play/gacha-planner/",
                    match: /\/gacha-planner/,
                },
            ],
        },
        lab: {
            id: "lab",
            contentWidth: "wide",
            l1: [
                {
                    id: "pixel",
                    label: "像素涌流",
                    href: "/app/lab/pixelflow/",
                    match: /\/pixelflow/,
                },
                {
                    id: "proton",
                    label: "质子",
                    href: "/app/lab/proton/",
                    match: /\/proton/,
                },
                {
                    id: "fan",
                    label: "风扇转速",
                    href: "/app/lab/fan-rpm/",
                    match: /\/fan-rpm/,
                },
            ],
            mobileDefault: [
                {
                    id: "pixel",
                    label: "像素",
                    icon: "i-numbers",
                    href: "/app/lab/pixelflow/",
                    match: /\/pixelflow/,
                },
                {
                    id: "proton",
                    label: "质子",
                    icon: "i-atom",
                    href: "/app/lab/proton/",
                    match: /\/proton/,
                },
                {
                    id: "menu",
                    label: "菜单",
                    icon: "i-wrench",
                    action: "drawer",
                },
            ],
        },
        read: {
            id: "read",
            contentWidth: "wide",
            l1: [
                {
                    id: "md",
                    label: "Markdown",
                    href: "/app/read/markdown/",
                    match: /\/read\/markdown/,
                },
                {
                    id: "art1",
                    label: "浏览器开发者工具实战",
                    href: "/app/read/crawler-experience/",
                    match: /crawler-experience/,
                },
                {
                    id: "art2",
                    label: "猫抓扩展使用笔记",
                    href: "/app/read/cat-catch-tutorial/",
                    match: /cat-catch-tutorial/,
                },
            ],
            mobileDefault: [
                {
                    id: "md",
                    label: "Markdown",
                    icon: "i-pencil",
                    href: "/app/read/markdown/",
                    match: /\/read\/markdown/,
                },
                {
                    id: "articles",
                    label: "长文",
                    icon: "i-doc",
                    href: "/app/read/crawler-experience/",
                    match: /crawler-experience|cat-catch-tutorial/,
                },
                {
                    id: "menu",
                    label: "菜单",
                    icon: "i-wrench",
                    action: "drawer",
                },
            ],
        },
    };

    function underApp(segment, path) {
        var base = "/app/" + segment;
        return path === base || path.indexOf(base + "/") === 0;
    }

    /** 独立应用：与 Citywalk 相同，不注入导航壳 */
    function isNoShellAppPath(path) {
        return (
            path.indexOf("/app/citywalk") === 0 ||
            path.indexOf("/app/notes") === 0 ||
            underApp("parking-pso", path)
        );
    }

    function isReadPath(path) {
        return path.indexOf("/app/read") === 0;
    }

    function isLabPath(path) {
        return underApp("lab", path);
    }

    function isPlayPath(path) {
        return underApp("play", path);
    }

    function isToolsPath(path) {
        return underApp("tools", path);
    }

    function detectDomain(path) {
        if (isReadPath(path)) return DOMAINS.read;
        if (isLabPath(path)) return DOMAINS.lab;
        if (isPlayPath(path)) return DOMAINS.play;
        if (isToolsPath(path)) return DOMAINS.tools;
        return null;
    }

    function isHubShellPath(path) {
        return path === "" || path.indexOf("/app/navigation") === 0;
    }

    /** @returns {{ type: 'domain', domain: object } | { type: 'hub' } | null} */
    function detectContext(path) {
        if (isNoShellAppPath(path)) return null;
        var domain = detectDomain(path);
        if (domain) return { type: "domain", domain: domain };
        if (isHubShellPath(path)) return { type: "hub" };
        return null;
    }

    function isActive(path, item) {
        if (item.match && pathMatches(path, item.match)) return true;
        return normalizePath(item.href) === path;
    }

    /** 全站顶栏 L1：与 detectDomain 同优先级，避免 fan-rpm 等路径双高亮 */
    function resolveGlobalL1Id(path) {
        if (path === "" || path.indexOf("/app/navigation") === 0) return "home";
        if (isReadPath(path)) return "read";
        if (isLabPath(path)) return "lab";
        if (isPlayPath(path)) return "play";
        if (isToolsPath(path)) return "tools";
        return null;
    }

    function isGlobalL1Active(path, item) {
        var activeId = resolveGlobalL1Id(path);
        if (activeId) return item.id === activeId;
        return isActive(path, item);
    }

    function resolveGlobalMobileTabId(path) {
        return resolveGlobalL1Id(path);
    }

    function isGlobalMobileTabActive(path, tab) {
        var activeId = resolveGlobalMobileTabId(path);
        if (activeId) return tab.id === activeId;
        return tab.href && isActive(path, tab);
    }

    function buildL1Links(items, path, activeFn) {
        var pickActive = activeFn || isActive;
        return items
            .map(function (item) {
                var cls = pickActive(path, item) ? " is-active" : "";
                if (item.muted) cls += " is-muted";
                return (
                    '<a href="' +
                    item.href +
                    '" class="' +
                    cls.trim() +
                    '">' +
                    item.label +
                    "</a>"
                );
            })
            .join("");
    }

    function buildTopBar(path) {
        var asideHtml =
            '<a class="site-shell-aside" href="' +
            GLOBAL.asideHref +
            '" target="_blank" rel="noopener noreferrer">' +
            GLOBAL.asideLabel +
            "</a>";
        var menuBtn =
            '<button type="button" class="site-shell-menu-btn" data-shell-drawer="open" aria-label="站点菜单">' +
            iconSvg("i-wrench") +
            '<span class="site-shell-menu-btn__text">菜单</span></button>';
        return (
            '<header class="site-shell-top" role="banner">' +
            '<div class="site-shell-top__inner site-shell-top__inner--global">' +
            '<a class="site-shell-brand" href="' +
            HOME +
            '">' +
            '<img class="site-shell-brand__mark" src="/assets/brand/noomings-mark.svg" width="28" height="28" alt="" decoding="async">' +
            '<span class="site-shell-brand__word">noomings</span></a>' +
            '<nav class="site-shell-l1 site-shell-l1--global" aria-label="全站">' +
            buildL1Links(GLOBAL.l1, path, isGlobalL1Active) +
            "</nav>" +
            menuBtn +
            asideHtml +
            "</div></header>"
        );
    }

    function buildSideLinks(items, path) {
        return items
            .map(function (item) {
                var cls = isActive(path, item) ? " is-active" : "";
                if (item.muted) cls += " is-muted";
                var ext =
                    item.external
                        ? ' target="_blank" rel="noopener noreferrer"'
                        : "";
                return (
                    '<a href="' +
                    item.href +
                    '"' +
                    ext +
                    ' class="site-shell-side__link' +
                    cls +
                    '">' +
                    item.label +
                    "</a>"
                );
            })
            .join("");
    }

    function getSidebarSections(domain) {
        if (domain.id === "play") {
            return [
                { title: "棋类", items: domain.l2Board },
                { title: "卡牌", items: domain.l2Card },
                {
                    title: "街机",
                    items: [
                        {
                            id: "dino",
                            label: "小恐龙",
                            href: "/app/play/games/dino/",
                            match: /\/dino/,
                        },
                    ],
                },
                { title: "问卷", items: domain.psych },
                { title: "游戏工具", items: domain.gacha },
            ];
        }
        if (domain.id === "lab") {
            return [{ title: "", items: domain.l1 }];
        }
        if (domain.id === "read") {
            return [
                {
                    title: "Markdown",
                    items: domain.l1.filter(function (item) {
                        return item.id === "md";
                    }),
                },
                {
                    title: "站内长文",
                    items: domain.l1.filter(function (item) {
                        return item.id === "art1" || item.id === "art2";
                    }),
                },
            ];
        }
        if (domain.id === "tools") {
            var encode = domain.l1.filter(function (item) {
                return (
                    item.id === "qr" ||
                    item.id === "base" ||
                    item.id === "b64" ||
                    item.id === "audio"
                );
            });
            return [
                { title: "文档转换", items: domain.l2 },
                { title: "编码与媒体", items: encode },
                { title: "图像", items: domain.ocr },
                { title: "随机", items: domain.random },
                { title: "展示", items: domain.display },
            ];
        }
        return [{ title: "", items: domain.l1 || [] }];
    }

    function buildSidebar(domain, path) {
        var inner = getSidebarSections(domain)
            .map(function (section) {
                var head = section.title
                    ? '<p class="site-shell-side__heading">' +
                      section.title +
                      "</p>"
                    : "";
                return head + buildSideLinks(section.items, path);
            })
            .join("");
        return (
            '<aside class="site-shell-side" aria-label="本模块导航">' +
            inner +
            "</aside>"
        );
    }

    function buildMobModLinks(items, path) {
        return items
            .map(function (item) {
                var cls = isActive(path, item) ? " is-active" : "";
                if (item.muted) cls += " is-muted";
                var ext =
                    item.external
                        ? ' target="_blank" rel="noopener noreferrer"'
                        : "";
                return (
                    '<a href="' +
                    item.href +
                    '"' +
                    ext +
                    ' class="site-shell-mob-mod__link' +
                    cls +
                    '">' +
                    item.label +
                    "</a>"
                );
            })
            .join("");
    }

    function buildMobileModuleRail(domain, path) {
        var sections = getSidebarSections(domain);
        var chunks = sections
            .map(function (section) {
                if (!section.items || !section.items.length) return "";
                var label = section.title
                    ? '<span class="site-shell-mob-mod__label">' +
                      section.title +
                      "</span>"
                    : "";
                return (
                    '<div class="site-shell-mob-mod__group">' +
                    label +
                    '<div class="site-shell-mob-mod__links">' +
                    buildMobModLinks(section.items, path) +
                    "</div></div>"
                );
            })
            .join("");
        if (!chunks) return "";
        return (
            '<nav class="site-shell-mob-mod" aria-label="本模块导航">' +
            '<div class="site-shell-mob-mod__scroll">' +
            chunks +
            "</div></nav>"
        );
    }

    function scrollMobileModuleActiveIntoView() {
        var rail = document.querySelector(".site-shell-mob-mod__scroll");
        if (!rail) return;
        var active = rail.querySelector(".site-shell-mob-mod__link.is-active");
        if (!active || typeof active.scrollIntoView !== "function") return;
        active.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: "auto",
        });
    }

    function buildSubLinks(items, path) {
        if (!items) return "";
        return items
            .map(function (item) {
                var cls = isActive(path, item) ? " is-active" : "";
                return (
                    '<a href="' +
                    item.href +
                    '" class="' +
                    cls.trim() +
                    '">' +
                    item.label +
                    "</a>"
                );
            })
            .join("");
    }

    function resolveSub(domain, path) {
        if (domain.l2When && pathMatches(path, domain.l2When) && domain.l2) {
            return domain.l2;
        }
        if (domain.l2BoardWhen && pathMatches(path, domain.l2BoardWhen) && domain.l2Board) {
            return domain.l2Board;
        }
        if (domain.l2CardWhen && pathMatches(path, domain.l2CardWhen) && domain.l2Card) {
            return domain.l2Card;
        }
        return null;
    }

    function buildMobileTabs(tabs, path, activeFn) {
        var pickActive =
            activeFn ||
            function (p, tab) {
                return (
                    (tab.href && isActive(p, tab)) ||
                    (tab.action === "drawer" &&
                        tab.match &&
                        pathMatches(p, tab.match))
                );
            };
        return tabs
            .map(function (tab) {
                var active = pickActive(path, tab) ? " is-active" : "";
                if (tab.action === "drawer") {
                    return (
                        '<button type="button" class="site-shell-tab' +
                        active +
                        '" data-shell-drawer="open" aria-label="' +
                        tab.label +
                        '">' +
                        iconSvg(tab.icon) +
                        "<span>" +
                        tab.label +
                        "</span></button>"
                    );
                }
                return (
                    '<a href="' +
                    tab.href +
                    '" class="site-shell-tab' +
                    active +
                    '">' +
                    iconSvg(tab.icon) +
                    "<span>" +
                    tab.label +
                    "</span></a>"
                );
            })
            .join("");
    }

    function buildMenuSheet(groups) {
        var sections = groups
            .map(function (group) {
                var links = group.links
                    .map(function (item) {
                        var ext = item.external
                            ? ' target="_blank" rel="noopener noreferrer"'
                            : "";
                        return (
                            '<a href="' +
                            item.href +
                            '"' +
                            ext +
                            ">" +
                            item.label +
                            "</a>"
                        );
                    })
                    .join("");
                return (
                    '<section class="site-shell-menu__group">' +
                    "<h4>" +
                    group.title +
                    "</h4>" +
                    links +
                    "</section>"
                );
            })
            .join("");
        return (
            '<div class="site-shell-drawer-backdrop" id="shellDrawerBackdrop" aria-hidden="true"></div>' +
            '<div class="site-shell-drawer site-shell-drawer--menu" id="shellDrawer" role="dialog" aria-label="站点菜单" aria-hidden="true">' +
            '<button type="button" class="site-shell-drawer-close" id="shellDrawerClose" aria-label="关闭">×</button>' +
            "<h3>菜单</h3>" +
            '<div class="site-shell-menu">' +
            sections +
            "</div></div>"
        );
    }

    function wireDrawer() {
        var backdrop = document.getElementById("shellDrawerBackdrop");
        var drawer = document.getElementById("shellDrawer");
        if (!drawer) return;

        function close() {
            drawer.classList.remove("is-open");
            backdrop.classList.remove("is-open");
            drawer.setAttribute("aria-hidden", "true");
            drawer.setAttribute("inert", "");
            backdrop.setAttribute("inert", "");
        }

        function open() {
            drawer.classList.add("is-open");
            backdrop.classList.add("is-open");
            drawer.setAttribute("aria-hidden", "false");
            drawer.removeAttribute("inert");
            backdrop.removeAttribute("inert");
        }

        close();

        document.querySelectorAll('[data-shell-drawer="open"]').forEach(function (btn) {
            btn.addEventListener("click", open);
        });
        backdrop.addEventListener("click", close);
        document.getElementById("shellDrawerClose").addEventListener("click", close);
    }

    function watchLightBoardStage() {
        var path = normalizePath(window.location.pathname);
        if (path.indexOf("/tools/light-board") === -1) return;
        var stage = document.getElementById("stage");
        if (!stage) return;
        var sync = function () {
            document.body.classList.toggle("shell-chrome-hidden", !stage.hidden);
        };
        sync();
        new MutationObserver(sync).observe(stage, {
            attributes: true,
            attributeFilter: ["hidden"],
        });
    }

    function applyContentWidth(width) {
        if (width === "narrow") {
            document.body.classList.add("shell-content-narrow");
        } else if (width === "wide") {
            document.body.classList.add("shell-content-wide");
        } else if (width === "hub") {
            document.body.classList.add("shell-content-hub");
        }
    }

    function init() {
        var path = normalizePath(window.location.pathname);
        var ctx = detectContext(path);
        if (!ctx) return;

        document.body.classList.add("shell-active", "shell-global");
        var domain = ctx.type === "domain" ? ctx.domain : null;

        if (ctx.type === "hub") {
            document.body.classList.add("shell-hub");
            applyContentWidth(GLOBAL.contentWidth);
        } else {
            document.body.classList.add("shell-" + domain.id, "shell-has-sidebar");
            applyContentWidth(domain.contentWidth);
            document.body.classList.add("shell-has-mob-mod");

            var subItems = resolveSub(domain, path);
            if (subItems) {
                document.body.classList.add("shell-has-sub");
            }
        }

        var topHtml = buildTopBar(path);
        var sideHtml = domain ? buildSidebar(domain, path) : "";
        var mobModHtml = domain ? buildMobileModuleRail(domain, path) : "";
        var subHtml = "";
        if (domain) {
            var subItemsNav = resolveSub(domain, path);
            if (subItemsNav) {
                subHtml =
                    '<nav class="site-shell-sub" aria-label="子导航">' +
                    '<div class="site-shell-sub__inner">' +
                    buildSubLinks(subItemsNav, path) +
                    "</div></nav>";
            }
        }

        var bottomHtml =
            '<nav class="site-shell-bottom" aria-label="移动导航">' +
            buildMobileTabs(GLOBAL.mobile, path, isGlobalMobileTabActive) +
            "</nav>";
        var drawerHtml = buildMenuSheet(GLOBAL.menuGroups);

        var wrap = document.createElement("div");
        wrap.innerHTML =
            topHtml + sideHtml + mobModHtml + subHtml + bottomHtml + drawerHtml;
        while (wrap.firstChild) {
            document.body.insertBefore(wrap.firstChild, document.body.firstChild);
        }

        wireDrawer();
        watchLightBoardStage();
        scrollMobileModuleActiveIntoView();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
