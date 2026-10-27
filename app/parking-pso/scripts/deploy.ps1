# 在本目录生成 bundle，并将 index.bundled.html 设为线上入口 index.html
$ErrorActionPreference = "Stop"
$FrontendRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "bundle-js.ps1")
Copy-Item -Force (Join-Path $FrontendRoot "index.bundled.html") (Join-Path $FrontendRoot "index.html")
Write-Host "Production index.html updated (bundled). Source modules kept under assets/js/."
