# Add automatic retry (and optional fallback model via GEMINI_FALLBACK_MODEL) for temporary Gemini errors
# (503 / 429 / 500 / 504) to the shared client.
# Local edit only (no git commit). ASCII-only on purpose.
# Run: powershell -ExecutionPolicy Bypass -File fix_gemini_retry.ps1
param(
    [string]$Root = "D:\Workstation\integrated",
    [switch]$NoRestart
)
$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Client = Join-Path (Join-Path (Join-Path $Root "shared") "ai") "gemini_client.py"
if (-not (Test-Path $Client)) { throw "File not found: $Client" }

$t = [IO.File]::ReadAllText($Client, [Text.Encoding]::UTF8)
if ($t.Contains("MQNET_RETRY")) {
    Write-Host "[skip] retry already installed"
    exit 0
}
$nl = if ($t.Contains("`r`n")) { "`r`n" } else { "`n" }

# Backup (kept out of git)
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item $Client "$Client.$stamp.bak"
$exclude = Join-Path (Join-Path (Join-Path $Root ".git") "info") "exclude"
if ((Test-Path $exclude) -and -not (Select-String -Path $exclude -SimpleMatch -Pattern "*.bak" -Quiet)) {
    Add-Content -Path $exclude -Value "*.bak"
}

# 1) helper function, inserted before "def clean_json_markdown"
$funcLines = @(
    '# MQNET_RETRY: retry temporary Gemini errors with a short backoff (1s, 2s, 4s)',
    'def _mqnet_install_retry(client):',
    '    import time',
    '    models = client.models',
    '    original = models.generate_content',
    '',
    '    def with_retry(*args, **kwargs):',
    '        delays = (1, 2, 4)',
    '        for attempt in range(len(delays) + 1):',
    '            try:',
    '                return original(*args, **kwargs)',
    '            except Exception as e:',
    '                msg = str(e)',
    '                code = getattr(e, "code", None)',
    '                transient = code in (429, 500, 503, 504) or "UNAVAILABLE" in msg or "RESOURCE_EXHAUSTED" in msg',
    '                if not transient:',
    '                    raise',
    '                if attempt == len(delays):',
    '                    fb = (os.getenv("GEMINI_FALLBACK_MODEL") or "").strip()',
    '                    if fb and kwargs.get("model") != fb:',
    '                        logger.warning(f"Gemini still unavailable, falling back to {fb}")',
    '                        kwargs["model"] = fb',
    '                        return original(*args, **kwargs)',
    '                    raise',
    '                logger.warning(f"Gemini temporary error, retry {attempt + 1}/{len(delays)}: {msg[:80]}")',
    '                time.sleep(delays[attempt])',
    '',
    '    models.generate_content = with_retry'
)
$func = ($funcLines -join $nl) + $nl + $nl + $nl
$fm = [regex]::Match($t, '(?m)^def clean_json_markdown')
if (-not $fm.Success) { throw "gemini_client.py: 'def clean_json_markdown' not found (file changed upstream?)" }
$t = $t.Substring(0, $fm.Index) + $func + $t.Substring($fm.Index)

# 2) call it right after the client is created
$cm = [regex]::Match($t, '(?m)^([ \t]*)self\._client = genai\.Client\(api_key=self\.api_key\)[ \t]*(?=\r?$)')
if (-not $cm.Success) { throw "gemini_client.py: client creation line not found (file changed upstream?)" }
$indent = $cm.Groups[1].Value
$t = $t.Substring(0, $cm.Index + $cm.Length) + $nl + $indent + "_mqnet_install_retry(self._client)" + $t.Substring($cm.Index + $cm.Length)

[IO.File]::WriteAllText($Client, $t, $Utf8NoBom)
Write-Host "[done] gemini_client.py: retry installed"

# 3) restart server
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
