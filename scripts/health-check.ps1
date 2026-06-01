<#
.SYNOPSIS
  Smart Shaadi multi-service health-check matrix.

.DESCRIPTION
  Probes the health/readiness endpoints of the api, ai-service, and web apps for
  either the local dev stack or production, prints a pass/fail table, and exits
  non-zero if any probe fails (skipped rows do not cause failure).

.PARAMETER Env
  Target environment: 'local' (default) or 'prod'.

.EXAMPLE
  pwsh scripts/health-check.ps1 -Env local
  pwsh scripts/health-check.ps1 -Env prod

.NOTES
  The web app has no /health route - its homepage (HTTP 200) is the liveness signal.
  The ai-service production URL is internal; set $env:AI_SERVICE_HEALTH_URL to probe
  it in prod, otherwise that row is SKIPPED.
#>

param(
  [ValidateSet('local', 'prod')]
  [string]$Env = 'local'
)

# --- Endpoint matrix ---------------------------------------------------------

if ($Env -eq 'local') {
  $apiBase = $env:API_BASE_URL; if (-not $apiBase) { $apiBase = 'http://localhost:4000' }
  $aiBase  = $env:AI_BASE_URL;  if (-not $aiBase)  { $aiBase  = 'http://localhost:8000' }
  $webBase = $env:WEB_BASE_URL; if (-not $webBase) { $webBase = 'http://localhost:3000' }

  $targets = @(
    @{ Service = 'api liveness';      Url = "$apiBase/health" },
    @{ Service = 'api readiness';     Url = "$apiBase/ready"  },
    @{ Service = 'ai-service health'; Url = "$aiBase/health"  },
    @{ Service = 'web homepage';      Url = "$webBase/"       }
  )
}
else {
  $apiBase = $env:API_BASE_URL; if (-not $apiBase) { $apiBase = 'https://api.smartshaadi.co.in' }
  $webBase = $env:WEB_BASE_URL; if (-not $webBase) { $webBase = 'https://smartshaadi.co.in' }

  $targets = @(
    @{ Service = 'api liveness';  Url = "$apiBase/health" },
    @{ Service = 'api readiness'; Url = "$apiBase/ready"  },
    @{ Service = 'web homepage';  Url = "$webBase/"       }
  )

  # ai-service prod URL is internal - only probe if explicitly provided.
  if ($env:AI_SERVICE_HEALTH_URL) {
    $targets += @{ Service = 'ai-service health'; Url = $env:AI_SERVICE_HEALTH_URL }
  }
  else {
    $targets += @{ Service = 'ai-service health'; Url = '(set AI_SERVICE_HEALTH_URL)'; Skip = $true }
  }
}

# --- Probe -------------------------------------------------------------------

$results = @()
$anyFail = $false

foreach ($t in $targets) {
  if ($t.Skip) {
    $results += [pscustomobject]@{ Service = $t.Service; Url = $t.Url; Status = '-'; Result = 'SKIPPED' }
    continue
  }

  $status = '-'
  $result = 'FAIL'
  try {
    $resp = Invoke-WebRequest -Uri $t.Url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $code = [int]$resp.StatusCode

    # Surface the JSON data.status for api/ai health + ready endpoints when present.
    $detail = $code
    try {
      $body = $resp.Content | ConvertFrom-Json -ErrorAction Stop
      if ($body.data -and $body.data.status) { $detail = "$code $($body.data.status)" }
    }
    catch { } # non-JSON body (e.g. web homepage HTML) - status code is enough

    $status = $detail
    if ($code -eq 200) { $result = 'PASS' } else { $result = 'FAIL' }
  }
  catch {
    # Invoke-WebRequest throws on non-2xx and on connection failure.
    $resp = $_.Exception.Response
    if ($resp) { $status = [int]$resp.StatusCode } else { $status = 'NO RESPONSE' }
    $result = 'FAIL'
  }

  if ($result -eq 'FAIL') { $anyFail = $true }
  $results += [pscustomobject]@{ Service = $t.Service; Url = $t.Url; Status = $status; Result = $result }
}

# --- Render table ------------------------------------------------------------

Write-Host ''
Write-Host "Smart Shaadi health check - env: $Env" -ForegroundColor Cyan
Write-Host ('-' * 78)
$fmt = "{0,-20} {1,-38} {2,-12} {3}"
Write-Host ($fmt -f 'SERVICE', 'URL', 'STATUS', 'RESULT')
Write-Host ('-' * 78)

foreach ($r in $results) {
  $line = $fmt -f $r.Service, $r.Url, $r.Status, $r.Result
  switch ($r.Result) {
    'PASS'    { Write-Host $line -ForegroundColor Green }
    'FAIL'    { Write-Host $line -ForegroundColor Red }
    'SKIPPED' { Write-Host $line -ForegroundColor DarkYellow }
    default   { Write-Host $line }
  }
}
Write-Host ('-' * 78)

if ($anyFail) {
  Write-Host 'One or more health checks FAILED.' -ForegroundColor Red
  exit 1
}
Write-Host 'All health checks passed.' -ForegroundColor Green
exit 0
