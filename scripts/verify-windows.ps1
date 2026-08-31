param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PnpmArguments = @("check")
)

$ErrorActionPreference = "Stop"

function Resolve-CommandPath {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string[]]$Candidates = @()
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  throw "Required Windows verification tool is unavailable: $Name"
}

$runtimeRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$bash = Resolve-CommandPath -Name "bash" -Candidates @(
  (Join-Path $env:ProgramFiles "Git\bin\bash.exe"),
  (Join-Path $runtimeRoot "native\git\bin\bash.exe")
)
$bundledPython = Join-Path $runtimeRoot "python\python.exe"
$python = if (Test-Path -LiteralPath $bundledPython) {
  $bundledPython
} else {
  Resolve-CommandPath -Name "python"
}
$pnpm = Resolve-CommandPath -Name "pnpm" -Candidates @(
  (Join-Path $runtimeRoot "bin\fallback\pnpm.cmd")
)
$node = Resolve-CommandPath -Name "node" -Candidates @(
  (Join-Path $runtimeRoot "node\bin\node.exe")
)

$bashRoot = Split-Path -Parent (Split-Path -Parent $bash)
$toolDirectories = @(
  (Split-Path -Parent $bash),
  (Join-Path $bashRoot "usr\bin"),
  (Split-Path -Parent $python),
  (Split-Path -Parent $pnpm),
  (Split-Path -Parent $node)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

$env:Path = (($toolDirectories + $env:Path.Split([IO.Path]::PathSeparator)) -join [IO.Path]::PathSeparator)

Write-Host "Hearth Windows verification: Bash, Python, Node, and pnpm are available."
& $pnpm @PnpmArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
