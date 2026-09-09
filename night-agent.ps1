# night-agent.ps1 — orquestrador da janela noturna (18h -> 07h BRT).
# Roda claude.exe -p headless em execucoes curtas e limitadas, numa branch dedicada,
# com teto de execucoes, parada RIGIDA antes das 07h, salvaguarda de progresso e log.
# Disparado pela Tarefa Agendada "Night Agent (Seller-Arthur)" as 18:00 diariamente.
# Para desligar: Disable-ScheduledTask -TaskName "Night Agent (Seller-Arthur)".

$ErrorActionPreference = 'Continue'
$proj         = 'C:\Users\Teste\Downloads\Seller-Arthur'
$claude       = 'C:\Users\Teste\.local\bin\claude.exe'
$prompt       = Join-Path $proj 'night-agent-prompt.md'
$maxRuns      = 24     # teto de execucoes (postura "aproveitar a janela"); o backlog finito para antes disso
$maxTurns     = 50     # teto de turnos por execucao
$perRunCapSec = 1500   # 25 min por execucao (backstop)
$tools = 'Read,Glob,Grep,Edit,Write,Skill,Bash(node:*),Bash(node --check:*),Bash(git add:*),Bash(git commit:*),Bash(git status:*),Bash(git log:*),Bash(git diff:*),Bash(git checkout:*),Bash(git rev-parse:*),Bash(date:*),Bash(ls:*),Bash(cat:*)'

Set-Location $proj

# O payload desta janela noturna era o backlog do modulo Fluxos, removido em 2026-09-08 junto com
# o 'night-agent-prompt.md'. Sem prompt nao ha o que fazer: para com mensagem clara em vez de
# rodar o claude.exe sem instrucao. Para desligar de vez:
#   Disable-ScheduledTask -TaskName "Night Agent (Seller-Arthur)"
if (-not (Test-Path $prompt)) {
  Write-Host "night-agent: '$prompt' nao existe (saiu com o modulo Fluxos em 2026-09-08)." -ForegroundColor Yellow
  Write-Host "Escreva um novo prompt nesse caminho ou desative a Tarefa Agendada." -ForegroundColor Yellow
  exit 0
}

$today = Get-Date -Format 'yyyy-MM-dd'
$log = Join-Path $env:TEMP "night-agent-$today.log"
$reportDir = Join-Path $proj 'docs\night-reports'
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
$report = Join-Path $reportDir "$today.md"

function Log($m) { Add-Content -Encoding utf8 $log ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }

# Mata SO o headless deste orquestrador (assinatura --max-turns), preservando o
# remote-control (--sdk-url / remote-control) e a sessao interativa do usuario.
function Kill-MyHeadless {
  try {
    Get-CimInstance Win32_Process -Filter "Name='claude.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match '--max-turns' -and $_.CommandLine -notmatch 'sdk-url|remote-control' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Log "kill claude headless PID $($_.ProcessId)" }
  } catch {}
}

Log "=== INICIO night-agent $today ==="

# Janela: comeca ~18h; termina 07h do dia seguinte.
$now  = Get-Date
$base = if ($now.Hour -ge 12) { $now.Date.AddDays(1) } else { $now.Date }  # ponytail: assume disparo a tarde; se ja for manha, usa hoje
$stopNew  = $base.AddHours(6).AddMinutes(30)  # nao iniciar execucao nova depois disto
$hardStop = $base.AddHours(6).AddMinutes(55)  # nada roda depois disto
Log "stopNew=$stopNew hardStop=$hardStop"

# Branch dedicada. Snapshot do working-tree atual como baseline (preserva o trabalho nao-commitado do usuario).
git -C $proj checkout -B "night-auto/$today" 2>&1 | ForEach-Object { Log "git: $_" }
if (git -C $proj status --porcelain) {
  git -C $proj add -A 2>&1 | ForEach-Object { Log "git: $_" }
  git -C $proj commit -m "night-agent: baseline working-tree ($today) [nao revisado]" 2>&1 | ForEach-Object { Log "git: $_" }
}

$run = 0; $fails = 0
while ((Get-Date) -lt $stopNew -and $run -lt $maxRuns) {
  $remain = [int][Math]::Floor(($hardStop - (Get-Date)).TotalSeconds)
  if ($remain -lt 120) { Log "Tempo insuficiente ($remain s); encerrando loop."; break }
  $timeout = [Math]::Min($perRunCapSec, $remain)
  $run++
  Log "--- Execucao $run (timeout ${timeout}s) ---"

  $job = Start-Job -ScriptBlock {
    param($claude, $proj, $prompt, $maxTurns, $tools)
    Set-Location $proj
    Get-Content $prompt -Raw | & $claude -p --permission-mode acceptEdits --max-turns $maxTurns --allowedTools $tools 2>&1
  } -ArgumentList $claude, $proj, $prompt, $maxTurns, $tools

  if (Wait-Job $job -Timeout $timeout) {
    $out = (Receive-Job $job) -join "`n"
    Remove-Job $job -Force
  } else {
    Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue
    Kill-MyHeadless
    $out = "[HARD-STOP: execucao excedeu ${timeout}s e foi encerrada]"
    Log $out
  }
  Add-Content -Encoding utf8 $log $out

  if ($out -match 'NIGHT_AGENT_DONE') { Log "Backlog esgotado. Fim."; break }
  if ($out -match 'Invalid API key|not authenticated|Usage limit|rate limit|credit balance|Overloaded') {
    $fails++; Log "Falha detectada ($fails)."
    if ($fails -ge 2) { Log "2 falhas seguidas; abortando para nao girar a toa."; break }
  } else { $fails = 0 }
}

# Salvaguarda final: commite qualquer coisa nao commitada (progresso salvo antes de encerrar).
if (git -C $proj status --porcelain) {
  git -C $proj add -A 2>&1 | ForEach-Object { Log "git: $_" }
  git -C $proj commit -m "night-agent: checkpoint de salvaguarda ($today)" 2>&1 | ForEach-Object { Log "git: $_" }
}
Kill-MyHeadless  # varredura final: garante que nada headless meu sobrou consumindo cota

# Rodape do relatorio (garante que existe mesmo se a ultima execucao foi morta).
if (-not (Test-Path $report)) {
  Set-Content -Encoding utf8 $report "# Relatorio noturno $today`n`n(Agente nao gravou relatorio proprio; ver log em $log)`n"
}
Add-Content -Encoding utf8 $report "`n---`nOrquestrador: $run execucao(oes), branch night-auto/$today, encerrado $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Log em $log`n"

Log "=== FIM night-agent (execucoes=$run) ==="
