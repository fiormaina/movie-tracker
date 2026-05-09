$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
  "src/scripts/core/config.js",
  "src/scripts/core/api-client.js",
  "src/scripts/core/routes.js",
  "src/scripts/core/common-ui.js",
  "src/scripts/utils/helpers.js",
  "src/scripts/components/app-shell.js",
  "src/scripts/components/feedback.js",
  "src/scripts/components/folder-card.js"
)

$headerLines = @(
  "/*",
  " * Movie Tracker shared runtime bundle.",
  " * Rebuild with: ./scripts/build-app-runtime.ps1",
  " * Source files:"
)

$headerLines += $sourceFiles | ForEach-Object { " * - $_" }
$headerLines += " */", ""

$bundleParts = foreach ($relativePath in $sourceFiles) {
  $absolutePath = Join-Path $root $relativePath
  Get-Content -Raw -Path $absolutePath
}

$bundlePath = Join-Path $root "src/scripts/app-runtime.js"
$bundleContent = ($headerLines -join "`r`n") + ($bundleParts -join "`r`n`r`n")

Set-Content -Path $bundlePath -Value $bundleContent -Encoding utf8
