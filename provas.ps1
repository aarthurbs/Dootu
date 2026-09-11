<#
  provas.ps1 -- roda TODAS as provas do projeto, soma as contagens e confere a documentacao.

  Existe por causa de dois defeitos reais, que tinham a mesma raiz: nao havia um comando que
  rodasse as provas, entao cada um rodava as 8 suites a mao e somava de cabeca.

  1) A linha "Checks:" do CLAUDE.md ganhou um total inventado ("673 verificacoes"), que nao
     fechava com nenhum subconjunto: era o total MENOS uma suite, com o rotulo errado. Aqui
     quem soma e o script, e ele FALHA se a documentacao divergir -- numero desatualizado
     passa a ser erro, nao descuido.
  2) Um .pyc obsoleto e VALIDO fez o test_captions reprovar 2 checks sem defeito no codigo (o
     cache guardava RODAPE_PCT = 0.2; mtime em segundos inteiros e tamanho em bytes
     coincidiram). PYTHONPYCACHEPREFIX manda todo o cache para um temporario, entao o
     __pycache__ da arvore nao e consultado -- a armadilha deixa de ser possivel em vez de
     virar "lembre-se de conferir".

  Uso:  .\provas.ps1
  Saida: contagem por suite, total, e a linha pronta para colar no CLAUDE.md.
#>

$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot
Set-Location $raiz

$env:PYTHONPYCACHEPREFIX = Join-Path $env:TEMP ('provas-pycache-' + [guid]::NewGuid().ToString('N'))

$suites = @(
  @{ rotulo = 'test_captions.py';      cmd = 'py';   args = @('-3.12', 'video-worker/test_captions.py') },
  @{ rotulo = 'test_serve.py';         cmd = 'py';   args = @('-3.12', 'video-worker/test_serve.py') },
  @{ rotulo = 'test_ytclip.py';        cmd = 'py';   args = @('-3.12', 'video-worker/test_ytclip.py') },
  @{ rotulo = 'test_worker.py';        cmd = 'py';   args = @('-3.12', 'video-worker/test_worker.py') },
  @{ rotulo = 'test_muapi.py';         cmd = 'py';   args = @('-3.12', 'video-worker/test_muapi.py') },
  @{ rotulo = 'test_helper.py';        cmd = 'py';   args = @('-3.12', 'baixador/local-helper/test_helper.py') },
  @{ rotulo = 'studio/test-preset.mjs';cmd = 'node'; args = @('studio/test-preset.mjs') },
  @{ rotulo = 'test-video-ops.js';     cmd = 'node'; args = @('test-video-ops.js') },
  @{ rotulo = 'test-video-ops-dom.js'; cmd = 'node'; args = @('test-video-ops-dom.js') }
)

$total = 0
$reprovadas = @()
$contagens = @{}

foreach ($s in $suites) {
  $saida = & $s.cmd $s.args 2>&1 | Out-String
  $code = $LASTEXITCODE
  # Uma expressao para os tres formatos de rodape do projeto: "77 verificacoes passaram",
  # "38 provas OK" e "127 checagens". A ULTIMA ocorrencia e o rodape -- as anteriores podem
  # ser linha de falha ("13 verificacao(oes) falharam").
  $achados = [regex]::Matches($saida, '(\d+)\s*(?:verifica\w*|provas|checagens)')
  if ($achados.Count -gt 0) {
    $n = [int]$achados[$achados.Count - 1].Groups[1].Value
  } else {
    $n = 0
  }
  $contagens[$s.rotulo] = $n
  if ($code -ne 0) {
    $reprovadas += $s.rotulo
    Write-Host ("  FALHOU  {0,-24} exit {1}" -f $s.rotulo, $code) -ForegroundColor Red
    Write-Host ($saida.Trim() -split "`n" | Select-Object -Last 6 | Out-String)
  } else {
    $total += $n
    Write-Host ("  ok      {0,-24} {1,4} verificacoes" -f $s.rotulo, $n) -ForegroundColor Green
  }
}

Write-Host ''
if ($reprovadas.Count -gt 0) {
  Write-Host ("REPROVOU: " + ($reprovadas -join ', ')) -ForegroundColor Red
  exit 1
}
Write-Host ("TOTAL MEDIDO: {0} verificacoes nas {1} suites" -f $total, $suites.Count) -ForegroundColor Green

# A linha pronta, no formato que o CLAUDE.md usa -- para ninguem mais somar de cabeca.
$partes = foreach ($s in $suites) { ('`' + $s.rotulo + '` (' + $contagens[$s.rotulo] + ')') }
$linha = '    - Checks: ' + ($partes -join ' * ') + " -- **$total verificacoes, zero falhas**."
Write-Host ''
Write-Host 'Linha para o CLAUDE.md:' -ForegroundColor Cyan
Write-Host $linha

# E a conferencia: o total escrito na documentacao tem de bater com o medido agora.
$claude = Get-Content (Join-Path $raiz 'CLAUDE.md') -Raw -Encoding UTF8
# O numeral por extenso ("nas oito") ficava FIXO aqui, entao registrar uma suite nova fazia a
# conferencia nao achar mais a linha -- e "nao achei" e justamente o ramo que este script
# declara ser pior que conferencia nenhuma. `\S+` casa qualquer numeral sem afrouxar a ancora.
$doc = [regex]::Matches($claude, '\*\*(\d+)\s*verifica\w*\s*nas\s*\S+')
if ($doc.Count -eq 0) {
  Write-Host ''
  Write-Host 'FALHA: nao achei no CLAUDE.md a linha de total ("**N verificacoes nas <numeral>").' -ForegroundColor Red
  Write-Host 'Se o formato da linha mudou, ajuste este script -- conferencia que nao acha nada' -ForegroundColor Red
  Write-Host 'e pior que conferencia nenhuma, porque passa a impressao de ter conferido.' -ForegroundColor Red
  exit 1
}
$escrito = [int]$doc[$doc.Count - 1].Groups[1].Value
if ($escrito -ne $total) {
  Write-Host ''
  Write-Host ("FALHA: o CLAUDE.md diz {0} e o medido agora e {1}. Atualize a linha." -f $escrito, $total) -ForegroundColor Red
  exit 1
}
Write-Host ''
Write-Host ("CLAUDE.md confere ({0})." -f $escrito) -ForegroundColor Green
exit 0
