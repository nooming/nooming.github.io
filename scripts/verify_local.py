#!/usr/bin/env python3
"""Smoke-test local static server: all index.html routes + removed hub 404s."""
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
ROOT = Path(__file__).resolve().parents[1]

pages = list(ROOT.rglob("index.html"))
paths = sorted(
    {
        "/"
        + str(p.relative_to(ROOT)).replace("\\", "/").replace("index.html", "")
        for p in pages
    }
)

must_404 = [
    "/app/lab/",
    "/app/read/",
    "/app/play/",
    "/app/play/games/",
    "/app/play/games/board-games/",
    "/app/play/games/card-games/",
    "/app/play/psychological/",
    "/app/tools/doc-tools/",
]

bad: list[tuple[str, str]] = []
ok_count = 0

for path in paths:
    url = BASE + path
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            if r.status != 200:
                bad.append((path, str(r.status)))
            else:
                ok_count += 1
    except Exception as e:
        bad.append((path, str(e)))

for path in must_404:
    url = BASE + path
    try:
        urllib.request.urlopen(url, timeout=8)
        bad.append((path, "expected 404"))
    except urllib.error.HTTPError as e:
        if e.code != 404:
            bad.append((path, f"HTTP {e.code}"))
    except Exception as e:
        bad.append((path, str(e)))

html = (
    urllib.request.urlopen(BASE + "/app/play/games/card-games/uno/", timeout=8)
    .read()
    .decode("utf-8", errors="replace")
)
for m in re.findall(r'(?:href|src)="([^"]+)"', html):
    if m.startswith(("http", "data:", "#", "mailto:")):
        continue
    au = BASE + m if m.startswith("/") else BASE + "/app/play/games/card-games/uno/" + m
    try:
        urllib.request.urlopen(au, timeout=8)
    except Exception as e:
        bad.append(("uno asset " + m, str(e)))

print(f"index routes OK: {ok_count}/{len(paths)}")
if bad:
    print(f"FAILURES: {len(bad)}")
    for item in bad:
        print(" ", item)
    sys.exit(1)
print("All checks passed.")
