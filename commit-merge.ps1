param([string]$msg)
$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:GIT_EDITOR = "true"
$env:GIT_MERGE_AUTOEDIT = "no"
Set-Location "D:\work\9router\.worktrees\merge-prs"

Write-Output "===REMAINING CONFLICT MARKERS (should be empty)==="
git diff --name-only --diff-filter=U 2>&1 | Out-String | Write-Output
Write-Output "===ADD ALL==="
git add -A 2>&1 | Out-String | Write-Output
Write-Output "===COMMIT==="
git commit --no-edit -m $msg 2>&1 | Out-String | Write-Output
Write-Output "exit=$LASTEXITCODE"
git rev-parse --short HEAD
