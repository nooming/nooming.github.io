# Regenerate /citywalk-community.html from app/citywalk/community/index.html
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path "$root\app\citywalk\community\index.html")) {
    throw "Expected app/citywalk/community under $root"
}
$html = Get-Content "$root\app\citywalk\community\index.html" -Raw -Encoding UTF8
$brandCss = Get-Content "$root\app\citywalk\assets\css\cw-brand.css" -Raw -Encoding UTF8
$commCss = Get-Content "$root\app\citywalk\community\assets\css\community.css" -Raw -Encoding UTF8
$html = $html -replace '<link rel="icon" href="../../assets/brand/favicon.svg" type="image/svg\+xml">', '<link rel="icon" href="/app/citywalk/assets/brand/favicon.svg" type="image/svg+xml">'
$html = $html -replace '(?s)<link rel="stylesheet" href="../../../../assets/css/cw-brand.css">\s*<link rel="stylesheet" href="assets/css/community.css">', "<style>`n$brandCss`n</style>`n<style>`n$commCss`n</style>"
$html = $html -replace 'src="../../../../assets/brand/', 'src="/app/citywalk/assets/brand/'
$html = $html -replace 'href="\.\./"', 'href="/app/citywalk/"'
$html = $html -replace 'href="\.\./\?r=', 'href="/app/citywalk/?r='
$html = $html -replace 'href="../../"', 'href="/"'
$html = $html -replace 'content="https://nooming.github.io/app/citywalk/community/"', 'content="https://noomings.com/citywalk-community.html"'
$html = $html -replace '(<title>[^<]+</title>)', "`$1`n<link rel=`"canonical`" href=`"https://noomings.com/citywalk-community.html`">"
$html = $html -replace 'content="https://nooming.github.io/app/citywalk/assets/brand/og-cover.svg"', 'content="https://noomings.com/app/citywalk/assets/brand/og-cover.svg"'
$scriptPaths = @(
    "app\citywalk\assets\js\cw-bridge.js",
    "app\citywalk\assets\js\cw-auth.js",
    "app\citywalk\community\assets\js\cw-community-api.js",
    "app\citywalk\community\assets\js\cw-footprint-sync.js",
    "app\citywalk\community\assets\js\data.js",
    "app\citywalk\community\assets\js\community.js"
)
$scriptBlock = ""
foreach ($rel in $scriptPaths) {
    $content = Get-Content "$root\$rel" -Raw -Encoding UTF8
    $content = $content -replace "'assets/images/", "'/app/citywalk/community/assets/images/"
    $content = $content -replace '"assets/images/', '"/app/citywalk/community/assets/images/'
    $content = $content -replace "href='../'", "href='/app/citywalk/'"
    $content = $content -replace "href='../\?r=", "href='/app/citywalk/?r="
    $content = $content -replace '<a href="../">', '<a href="/app/citywalk/">'
    $scriptBlock += "<script>`n/* $rel */`n$content`n</script>`n"
}
$html = [regex]::Replace($html, '(?s)<script src="../../../../assets/js/cw-bridge.js"></script>\s*<script src="../../../../assets/js/cw-auth.js"></script>\s*<script src="assets/js/cw-community-api.js"></script>\s*<script src="assets/js/cw-footprint-sync.js"></script>\s*<script src="assets/js/data.js"></script>\s*<script src="assets/js/community.js"></script>', $scriptBlock.Trim())
$out = "<!-- WanderWalk community single-file entry. Cover images: /app/citywalk/community/assets/images/ -->`n" + $html
$dest = Join-Path $root "citywalk-community.html"
[System.IO.File]::WriteAllText($dest, $out, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $dest ($((Get-Item $dest).Length) bytes)"
