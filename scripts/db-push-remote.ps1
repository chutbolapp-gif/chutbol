# Push migrations (and optionally the seed) to the remote Supabase project without `supabase login`.
# Reads the connection string from supabase/.env.db.local (gitignored, filled in by the owner).
# Never prints the connection string or the password.
#
#   powershell -ExecutionPolicy Bypass -File scripts/db-push-remote.ps1            # migrations + seed
#   powershell -ExecutionPolicy Bypass -File scripts/db-push-remote.ps1 -DryRun    # show what would run
#   powershell -ExecutionPolicy Bypass -File scripts/db-push-remote.ps1 -Test      # run the pgTAP tests remotely (rolled back)
param([switch]$DryRun, [switch]$NoSeed, [switch]$Test)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'supabase/.env.db.local'
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }
$line = Get-Content $envFile | Where-Object { $_ -match '^\s*SUPABASE_DB_URL\s*=' } | Select-Object -First 1
$url = if ($line) { ($line -split '=', 2)[1].Trim().Trim('"') } else { '' }
if (-not $url) { throw 'SUPABASE_DB_URL is empty in supabase/.env.db.local' }
if ($url -match '\[YOUR-PASSWORD\]') { throw 'Replace [YOUR-PASSWORD] in supabase/.env.db.local with the database password' }
if ($url -notmatch '^postgres(ql)?://') { throw 'SUPABASE_DB_URL must start with postgresql://' }

$cli = Join-Path $root 'node_modules/supabase/dist/supabase.js'
if ($Test) {
  $cliArgs = @($cli, 'test', 'db', '--db-url', $url)
} else {
  $cliArgs = @($cli, 'db', 'push', '--db-url', $url, '--yes')
  if (-not $NoSeed) { $cliArgs += '--include-seed' }
  if ($DryRun) { $cliArgs += '--dry-run' }
}
Set-Location $root
# the CLI writes progress to stderr; in Windows PowerShell that must not stop the script
$ErrorActionPreference = 'Continue'
# mask the connection string in anything the CLI prints
& node @cliArgs 2>&1 | ForEach-Object { "$_".Replace($url, '<SUPABASE_DB_URL>') -replace 'postgres(ql)?://[^\s"]+', '<db-url>' }
exit $LASTEXITCODE
