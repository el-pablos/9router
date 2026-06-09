$ErrorActionPreference = "Continue"
Set-Location "D:\work\9router\.worktrees\merge-prs"
$files = @(
  "open-sse/config/runtimeConfig.js",
  "open-sse/translator/request/openai-to-claude.js",
  "open-sse/utils/claudeCloaking.js"
)
foreach ($f in $files) {
  Write-Output "===$f==="
  Select-String -Path $f -Pattern "<<<<<<<|=======|>>>>>>>" | ForEach-Object { Write-Output ("L" + $_.LineNumber + ": " + $_.Line) }
}
