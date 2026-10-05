# Fix AI mentor: wrong endpoint + response format (local edit only, no git commit)
# Run: powershell -ExecutionPolicy Bypass -File fix_ai_mentor.ps1
$ErrorActionPreference = "Stop"
$Root     = "D:\Workstation\integrated"
$ApiJs    = Join-Path $Root "apps\selfstudy\frontend\js\api.js"
$AppJs    = Join-Path $Root "apps\selfstudy\frontend\app.js"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($f in @($ApiJs, $AppJs)) {
    if (-not (Test-Path $f)) { throw "File not found: $f" }
}

# Backups (kept out of git)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
foreach ($f in @($ApiJs, $AppJs)) { Copy-Item $f "$f.$stamp.bak" }
$exclude = Join-Path $Root ".git\info\exclude"
if (-not (Select-String -Path $exclude -SimpleMatch -Pattern "*.bak" -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -Path $exclude -Value "*.bak"
}

# ---- 1) api.js : /ai/ask  ->  /ai/ask-mentor ----
$t = [IO.File]::ReadAllText($ApiJs, [Text.Encoding]::UTF8)
$old = '${base}/ai/ask`'
$new = '${base}/ai/ask-mentor`'
if ($t.Contains($new)) {
    Write-Host "[skip] api.js already patched"
} elseif ($t.Contains($old)) {
    $t = $t.Replace($old, $new)
    [IO.File]::WriteAllText($ApiJs, $t, $Utf8NoBom)
    Write-Host "[done] api.js patched"
} else {
    Write-Host "[WARN] api.js: target text not found (file may have changed upstream)" -ForegroundColor Yellow
}

# ---- 2) app.js : read mentor_response.answer / studyTip / encouragement ----
$t = [IO.File]::ReadAllText($AppJs, [Text.Encoding]::UTF8)
if ($t.Contains("res.mentor_response")) {
    Write-Host "[skip] app.js already patched"
} else {
    $re = [regex]"const aiReply = \(res && res\.reply\) \|\| \(res && res\.message\) \|\| '([^']*)';"
    $m = $re.Match($t)
    if (-not $m.Success) {
        Write-Host "[WARN] app.js: target line not found (file may have changed upstream)" -ForegroundColor Yellow
    } else {
        $fallback = $m.Groups[1].Value
        $replacement = 'const mr = (res && res.mentor_response) || {}; ' +
            'const aiReply = [mr.answer, mr.studyTip && ("\uD83D\uDCA1 " + mr.studyTip), mr.encouragement].filter(Boolean).join("\n\n") ' +
            '|| (res && (res.reply || res.message)) || ''' + $fallback + ''';'
        $t = $t.Substring(0, $m.Index) + $replacement + $t.Substring($m.Index + $m.Length)
        [IO.File]::WriteAllText($AppJs, $t, $Utf8NoBom)
        Write-Host "[done] app.js patched"
    }
}

Write-Host ""
Write-Host "Check:" -ForegroundColor Cyan
Select-String -Path $ApiJs -Pattern "ai/ask" | ForEach-Object { $_.Line.Trim() }
Select-String -Path $AppJs -Pattern "mentor_response" | ForEach-Object { $_.Line.Trim() }
Write-Host ""
Write-Host "Now press Ctrl+F5 in the browser. Server restart is not needed." -ForegroundColor Green
