# Liga o motor de analise na SUA maquina e serve a pagina localmente.
#
#   .\analise-local.ps1
#   .\analise-local.ps1 -Site "https://cortes-abc123.vercel.app"
#
# O motor NUNCA vai para a nuvem nesta fase (decisao do usuario, 2026-08-27).
# A pagina publicada no Vercel e a MESMA que roda aqui; ela chama este processo em
# http://127.0.0.1:8080. Com o motor desligado, a pagina publicada abre e explica
# que o motor esta desligado, em vez de dar erro de rede.
#
# Ctrl+C encerra os dois.

param(
  # Endereco do site publicado. Sem ele, so a pagina local consegue chamar o motor
  # (o CORS recusaria a origem do Vercel).
  [string]$Site = $env:CLIPS_SITE,
  [int]$ApiPort = 8080,
  [int]$WebPort = 8090
)

$ErrorActionPreference = "Stop"
$raiz = $PSScriptRoot

# Porta ocupada e a confusao numero 1 (rodar o script duas vezes). O erro nativo do
# Python no Windows nao diz isso com clareza.
foreach ($p in @($ApiPort, $WebPort)) {
  $usada = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if ($usada) {
    Write-Host "A porta $p ja esta em uso (PID $($usada[0].OwningProcess))." -ForegroundColor Yellow
    Write-Host "Provavelmente o script ja esta rodando. Feche a outra janela ou:" -ForegroundColor Yellow
    Write-Host "  Stop-Process -Id $($usada[0].OwningProcess)"
    exit 1
  }
}

$origens = "http://127.0.0.1:$WebPort,http://localhost:$WebPort"
if ($Site) { $origens = "$origens,$($Site.TrimEnd('/'))" }

$env:ALLOWED_ORIGIN = $origens
$env:CLIPS_DEV = "1"          # sem Turnstile: nao esta publico, nao ha o que proteger

Write-Host ""
Write-Host "  motor da analise   http://127.0.0.1:$ApiPort" -ForegroundColor Green
Write-Host "  pagina local       http://127.0.0.1:$WebPort" -ForegroundColor Green
if ($Site) {
  Write-Host "  pagina publicada   $Site" -ForegroundColor Green
} else {
  Write-Host "  pagina publicada   (nao configurada - use -Site ou defina CLIPS_SITE)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Ctrl+C encerra os dois." -ForegroundColor DarkGray
Write-Host ""

# A pagina estatica vai para uma janela propria; o motor fica em primeiro plano,
# onde o log dele fica a vista.
$web = Start-Process -PassThru -WindowStyle Minimized `
  -FilePath "py" -ArgumentList "-3.12", "-m", "http.server", "$WebPort", "-d", (Join-Path $raiz "web")

try {
  & py -3.12 (Join-Path $raiz "cloud\probe_server.py")
} finally {
  if ($web -and -not $web.HasExited) { Stop-Process -Id $web.Id -ErrorAction SilentlyContinue }
  Write-Host "encerrado." -ForegroundColor DarkGray
}

