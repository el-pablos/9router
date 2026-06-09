$ErrorActionPreference = "Continue"
Set-Location "D:\work\9router\.worktrees\merge-prs"
$files = @(
  "cli/scripts/build-cli.js",
  "open-sse/config/runtimeConfig.js",
  "open-sse/executors/base.js",
  "open-sse/utils/proxyFetch.js"
)
foreach ($f in $files) {
  Write-Output "===$f==="
  Select-String -Path $f -Pattern "<<<<<<<|=======|>>>>>>>" | ForEach-Object { Write-Output ("L" + $_.LineNumber) }
}
