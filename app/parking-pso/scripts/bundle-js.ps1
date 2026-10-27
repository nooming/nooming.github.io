# 将 index.html 中的 script 合并为 optimizer.bundle.js + app.bundle.js
$ErrorActionPreference = "Stop"
$FrontendRoot = Split-Path -Parent $PSScriptRoot
$AssetsJs = Join-Path $FrontendRoot "assets\js"

$OptimizerFiles = @(
  "core\constants.js",
  "core\geometry.js",
  "core\road\road-model.js",
  "core\road\road-snap.js",
  "core\scenario\default-scenario.js",
  "core\scenario\normalize.js",
  "optimizer\nav-grid.js",
  "optimizer\pathfinding.js",
  "optimizer\path-cost.js",
  "optimizer\cost-matrix.js",
  "optimizer\algorithms\hungarian.js",
  "optimizer\algorithms\pso.js",
  "optimizer\pack-result.js",
  "optimizer\index.js"
)

$AppFiles = @(
  "app\api\api-client.js",
  "app\state\app-state.js",
  "app\scenario\default-source.js",
  "app\scenario\scenario-presets.js",
  "app\scenario\collections.js",
  "app\scenario\road-edit.js",
  "app\scenario\obstacle-edit.js",
  "app\scenario\collision.js",
  "app\scenario\snap.js",
  "app\scenario\sanitize.js",
  "app\storage\state-storage.js",
  "app\storage\scenario-io.js",
  "app\analysis\optimizer-analysis.js",
  "app\ui\tab-utils.js",
  "app\ui\workspace-status.js",
  "app\ui\tab-flow.js",
  "app\ui\props\props-form-utils.js",
  "app\ui\props\props-entrance.js",
  "app\ui\props\props-obstacle.js",
  "app\ui\props\props-road.js",
  "app\ui\props\props-building.js",
  "app\ui\props\props-slot.js",
  "app\ui\lot-panel.js",
  "app\ui\props-panel.js",
  "app\ui\vehicle-panel.js",
  "app\ui\pso-lab-panel.js",
  "app\ui\results-panel.js",
  "app\ui\api-status.js",
  "app\ui\scenario-library.js",
  "app\ui\compare-panel.js",
  "app\ui\planner-panel.js",
  "app\ui\underlay-panel.js",
  "app\ui\workflow-guide.js",
  "app\ui\precompute-warm.js",
  "app\ui\simulate-panel.js",
  "app\canvas\viewport.js",
  "app\canvas\layer-controls.js",
  "app\canvas\layers\underlay-layer.js",
  "app\canvas\layers\road-layer.js",
  "app\canvas\layers\draw-primitives.js",
  "app\canvas\layers\draw-slots.js",
  "app\canvas\layers\draw-buildings.js",
  "app\canvas\layers\draw-obstacles.js",
  "app\canvas\layers\draw-drafts.js",
  "app\canvas\layers\draw-entrances.js",
  "app\canvas\layers\objects-layer.js",
  "app\canvas\layers\hover-layer.js",
  "app\canvas\layers\overlay-layer.js",
  "app\canvas\renderer.js",
  "app\canvas\chart.js",
  "app\interaction\pick.js",
  "app\interaction\draft-tools.js",
  "app\interaction\drag-session.js",
  "app\interaction\pointer.js",
  "app\lifecycle\startup.js",
  "app\bootstrap.js"
)

function Join-Scripts($files, $outPath, $label) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("/* bundled $label from $($files.Count) files */")
  foreach ($rel in $files) {
    $path = Join-Path $AssetsJs $rel
    if (-not (Test-Path $path)) { Write-Error "Missing: $path" }
    [void]$sb.AppendLine("/* --- $rel --- */")
    [void]$sb.Append((Get-Content -Path $path -Raw -Encoding UTF8))
    [void]$sb.AppendLine("")
  }
  $dir = Split-Path -Parent $outPath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  [System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
  Write-Host "Wrote $outPath"
}

$optOut = Join-Path $AssetsJs "optimizer.bundle.js"
$appOut = Join-Path $AssetsJs "app.bundle.js"
Join-Scripts $OptimizerFiles $optOut "optimizer"
Join-Scripts $AppFiles $appOut "app"

$indexPath = Join-Path $FrontendRoot "index.dev.html"
$bundledPath = Join-Path $FrontendRoot "index.bundled.html"
if (-not (Test-Path $indexPath)) { Write-Error "Missing index.dev.html (dev entry with module script tags)" }
$html = Get-Content -Path $indexPath -Raw -Encoding UTF8
$bundleBlock = @"
  <script src="assets/js/optimizer.bundle.js"></script>
  <script src="assets/js/app.bundle.js"></script>
"@
$html2 = [regex]::Replace(
  $html,
  '(?s)  <script src="assets/js/core/constants\.js"></script>.*?  <script src="assets/js/app/bootstrap\.js"></script>',
  $bundleBlock.TrimEnd()
)
if ($html2 -eq $html) { Write-Error "index.dev.html script block replace failed" }
[System.IO.File]::WriteAllText($bundledPath, $html2, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $bundledPath"
