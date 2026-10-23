import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DIRS = [
    "app/tools",
    "app/lab",
    "app/play",
    "app/read",
    "app/navigation",
]
ROOT_INDEX = REPO / "index.html"
SHELL_CSS = '    <link rel="stylesheet" href="/assets/css/site-shell.css">'
SHELL_COMMON = '    <link rel="stylesheet" href="/assets/css/common.css">'
SHELL_JS = '    <script src="/assets/js/site-shell.js" defer></script>'
PAT_HEADER = re.compile(
    r'\s*<div class="header-top">[\s\S]*?</div>',
    re.M,
)
PAT_VP = re.compile(
    r'content="width=device-width, initial-scale=1\.0"(?!, viewport-fit=cover)'
)


def inject_shell_assets(text: str, after_pattern: str | None) -> str:
    if "site-shell.css" not in text:
        insert = SHELL_CSS
        if after_pattern:
            m = re.search(after_pattern, text)
            if m:
                text = text.replace(m.group(0), m.group(0) + "\n" + insert, 1)
            else:
                text = text.replace("</head>", insert + "\n</head>", 1)
        else:
            text = text.replace("</head>", insert + "\n</head>", 1)
    if "site-shell.js" not in text:
        text = text.replace("</body>", SHELL_JS + "\n</body>", 1)
    return text


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text

    rel = path.relative_to(REPO).as_posix()
    if "common.css" in text:
        text = inject_shell_assets(
            text, r'(<link rel="stylesheet" href="[^"]*common\.css">)'
        )
    elif rel.startswith("app/parking-pso"):
        if "/assets/css/common.css" not in text:
            text = inject_shell_assets(text, r'(<link rel="stylesheet" href="assets/styles/app\.css" />)')
            text = text.replace(
                SHELL_CSS,
                SHELL_COMMON + "\n" + SHELL_CSS,
                1,
            )
        else:
            text = inject_shell_assets(text, None)
    else:
        text = inject_shell_assets(text, r'(<link rel="stylesheet" href="[^"]+">)')

    text = PAT_VP.sub(
        'content="width=device-width, initial-scale=1.0, viewport-fit=cover"', text
    )
    if 'class="page-header"' in text or "page-header" in text:
        text = PAT_HEADER.sub("", text)

    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for d in DIRS:
        base = REPO / d
        if not base.is_dir():
            continue
        for path in base.rglob("index.html"):
            if patch_file(path):
                changed += 1
                print("patched", path.relative_to(REPO))
    if ROOT_INDEX.exists() and patch_file(ROOT_INDEX):
        changed += 1
        print("patched index.html")
    print("done,", changed, "files")


if __name__ == "__main__":
    main()
