param(
  [string]$EnvPath = (Join-Path $PSScriptRoot '..\.env'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\supabase-config.js')
)

$ErrorActionPreference = 'Stop'

function Read-EnvValue([string]$Content, [string]$Name) {
  $match = [regex]::Match($Content, '(?m)^' + [regex]::Escape($Name) + '=(.*)$')
  if (-not $match.Success) { throw "Variável ausente: $Name" }
  return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

$content = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $EnvPath))
$url = Read-EnvValue $content 'SUPABASE_URL'
$key = Read-EnvValue $content 'SUPABASE_PUBLISHABLE_KEY'

if ($url -notmatch '^https://[a-z0-9-]+\.supabase\.co/?$') { throw 'SUPABASE_URL inválida.' }
if ($key -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'SUPABASE_PUBLISHABLE_KEY inválida.' }

$js = @"
// Gerado por supabase/generate-config.ps1 a partir do .env.
// Contém somente configuração pública do navegador. Nunca inclua secrets aqui.
window.SB_CONFIG = Object.freeze({
  url: '$($url.TrimEnd('/'))',
  publishableKey: '$key'
});
"@

[IO.File]::WriteAllText($OutputPath, $js, [Text.UTF8Encoding]::new($false))
Write-Output 'supabase-config.js atualizado com configuração pública.'
