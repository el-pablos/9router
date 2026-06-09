param([string]$branch)
$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:GIT_EDITOR = "true"
$env:GIT_MERGE_AUTOEDIT = "no"
Set-Location "D:\work\9router\.worktrees\merge-prs"

Write-Output "===HEAD BEFORE==="
git rev-parse --short HEAD
Write-Output "===MERGE $branch==="
git merge --no-ff --no-edit $branch 2>&1 | Out-String | Write-Output
Write-Output "exit=$LASTEXITCODE"
Write-Output "===CONFLICT FILES==="
git diff --name-only --diff-filter=U 2>&1 | Out-String | Write-Output
