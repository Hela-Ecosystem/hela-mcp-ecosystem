$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'update.mjs'
& node $script @args
exit $LASTEXITCODE
