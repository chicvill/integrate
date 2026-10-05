# Switch all Gemini calls to a model that is still available (default: gemini-3.8-flash).
# Local edit only (no git commit). ASCII-only on purpose.
# Run: powershell -ExecutionPolicy Bypass -File fix_gemini_model.ps1
param(
    [string]$Root  = "D:\Workstation\integrated",
    [string]$Model = "gemini-3.8-flash",
    [switch]$SkipCheck,
    [switch]$NoRestart
)
$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$EnvFile = Join-Path $Root ".env.shared"
$Client  = Join-Path (Join-Path (Join-Path $Root "shared") "ai") "gemini_client.py"
foreach ($f in @($EnvFile, $Client)) { if (-not (Test-Path $f)) { throw "File not found: $f" } }

# 0) Read API key from .env.shared (never printed)
$m = Select-String -Path $EnvFile -Pattern '^\s*GEMINI_API_KEY\s*=\s*(.*)$' | Select-Object -Last 1
if (-not $m) { throw "GEMINI_API_KEY line not found in .env.shared" }
$key = $m.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")

# 1) Check that the model works with this key BEFORE changing anything
if (-not $SkipCheck) {
    $uri  = "https://generativelanguage.googleapis.com/v1beta/models/$Model`:generateContent"
    $body = '{"contents":[{"parts":[{"text":"Say hello in one short sentence."}]}]}'
    try {
        Invoke-RestMethod -Method Post -Uri $uri -Headers @{"x-goog-api-key" = $key} -ContentType "application/json" -Body $body | Out-Null
        Write-Host "[OK] Model '$Model' works with your key." -ForegroundColor Green
    } catch {
        Write-Host "[STOP] Model check failed. Nothing was changed." -ForegroundColor Red
        if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message } else { Write-Host $_.Exception.Message }
        exit 1
    }
}

# 2) Backups (kept out of git)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $EnvFile "$EnvFile.$stamp.bak"
Copy-Item $Client  "$Client.$stamp.bak"
$exclude = Join-Path (Join-Path (Join-Path $Root ".git") "info") "exclude"
if ((Test-Path $exclude) -and -not (Select-String -Path $exclude -SimpleMatch -Pattern "*.bak" -Quiet)) {
    Add-Content -Path $exclude -Value "*.bak"
}

# 3) gemini_client.py: load .env.shared into the environment and let GEMINI_MODEL override the model
$t  = [IO.File]::ReadAllText($Client, [Text.Encoding]::UTF8)
$nl = if ($t.Contains("`r`n")) { "`r`n" } else { "`n" }
$changed = $false

if (-not $t.Contains("MQNET_MODEL_OVERRIDE")) {
    $anchor = [regex]'(?m)^logger = logging\.getLogger\("mqnet\.gemini"\)[ \t]*\r?$'
    $am = $anchor.Match($t)
    if (-not $am.Success) { throw "gemini_client.py: logger line not found (file changed upstream?)" }
    $block = $nl + $nl + "# MQNET_MODEL_OVERRIDE: load .env.shared so GEMINI_MODEL can override the model name" + $nl +
        "try:" + $nl +
        "    from dotenv import load_dotenv" + $nl +
        "    load_dotenv("".env.shared"", override=False)" + $nl +
        "except Exception:" + $nl +
        "    pass"
    $t = $t.Substring(0, $am.Index + $am.Length) + $block + $t.Substring($am.Index + $am.Length)
    $changed = $true
}

$mm = [regex]::Match($t, '(?m)^([ \t]*)self\.model = model[ \t]*(?=\r?$)')
if ($mm.Success) {
    $new = $mm.Groups[1].Value + 'self.model = (os.getenv("GEMINI_MODEL") or model).strip().strip("''\"")'
    $t = $t.Substring(0, $mm.Index) + $new + $t.Substring($mm.Index + $mm.Length)
    $changed = $true
} elseif (-not $t.Contains('os.getenv("GEMINI_MODEL") or model')) {
    throw "gemini_client.py: 'self.model = model' line not found (file changed upstream?)"
}

if ($changed) {
    [IO.File]::WriteAllText($Client, $t, $Utf8NoBom)
    Write-Host "[done] gemini_client.py patched"
} else {
    Write-Host "[skip] gemini_client.py already patched"
}

# 4) .env.shared: set GEMINI_MODEL (replace existing line or append)
$e = [IO.File]::ReadAllText($EnvFile, [Text.Encoding]::UTF8)
$enl = if ($e.Contains("`r`n")) { "`r`n" } else { "`n" }
$line = "GEMINI_MODEL=$Model"
$re = [regex]'(?m)^[ \t]*GEMINI_MODEL[ \t]*=[^\r\n]*'
if ($re.IsMatch($e)) {
    $e = $re.Replace($e, $line, 1)
} else {
    if (-not $e.EndsWith("`n")) { $e += $enl }
    $e += $line + $enl
}
[IO.File]::WriteAllText($EnvFile, $e, $Utf8NoBom)
Write-Host "[done] .env.shared: $line"

# 5) Restart the server (run_server.bat loop brings it back with the new settings)
if (-not $NoRestart) {
    $conn = Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
    Start-Sleep -Seconds 12
    try {
        $r = Invoke-WebRequest -UseBasicParsing "http://localhost:9000/health" -TimeoutSec 10
        Write-Host "[OK] Server is back: HTTP $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "[CHECK] Server did not answer. Run: Start-ScheduledTask -TaskName MQnet-Server" -ForegroundColor Yellow
    }
}
Write-Host "Now press Ctrl+F5 in the browser and ask the AI coach again." -ForegroundColor Cyan
