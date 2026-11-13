$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'setup.mjs'
& node $script @args
exit $LASTEXITCODE
