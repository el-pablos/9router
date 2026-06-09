$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:GIT_EDITOR = "true"
$env:GIT_MERGE_AUTOEDIT = "no"
Set-Location "D:\work\9router\.worktrees\merge-prs"

$order = @("pr-1448","pr-1505","pr-1666","pr-1738","pr-1740","pr-1711","pr-1573","pr-1599","pr-1600","pr-1568","pr-1570","pr-1646","pr-1636")
foreach ($b in $order) {
  git merge --no-ff --no-edit $b *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Output "MERGED_OK $b"
  } else {
    $conf = (git diff --name-only --diff-filter=U) -join ", "
    Write-Output "CONFLICT $b -> $conf"
    git merge --abort *> $null
  }
}
Write-Output "===FINAL HEAD==="
git rev-parse --short HEAD
