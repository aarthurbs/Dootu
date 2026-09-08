# Abre o Estudio de Videos COM o renderizador junto.
#
# Por que existe: o navegador nao corta MP4 sozinho. Quem corta e o FFmpeg do repositorio,
# atras da rota POST /api/video-cut que so o serve.py atende. Abrir o index.html por
# file:// ou por `python -m http.server` deixa os botoes "Baixar" sem ninguem do outro
# lado - o clique falha e parece que o botao esta quebrado. Este script tira a chance de
# abrir errado: sobe o servidor e abre a pagina nele.
#
# GUARDA (2026-09-01): antes, cada clique no atalho subia um serve.py NOVO sem olhar se ja
# havia um. O Windows deixa dois processos escutarem a mesma porta, e as requisicoes caem
# ora num ora noutro - defeito intermitente e dificil de enxergar. Medido: dois listeners
# na 8765 ao mesmo tempo.

$ErrorActionPreference = 'Stop'
$PORTA = 'http://127.0.0.1:8765/index.html'

function Get-Renderizadores {
    @(Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*video-worker\serve.py*' })
}

function Test-Responde {
    try { (Invoke-WebRequest -Uri $PORTA -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 }
    catch { $false }
}

function Stop-Renderizadores($lista) {
    foreach ($p in $lista) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 700
}

# `@(...)` no ponto de USO, nao so dentro da funcao: PowerShell DESENROLA o array que uma
# funcao devolve, entao com um processo so `$rodando` viraria escalar. Hoje sobrevive por
# acidente (`.Count` de escalar e 1 desde a v3), mas depender disso e pedir defeito.
$rodando = @(Get-Renderizadores)

# Mais de um ja e a bagunca que esta guarda existe para impedir: nao da para escolher qual
# atende, entao nenhum fica.
if ($rodando.Count -gt 1) {
    Write-Host "Havia $($rodando.Count) renderizadores na 8765 - isso faz a requisicao cair num ou noutro. Deixando um so."
    Stop-Renderizadores $rodando
    $rodando = @()
}

if ($rodando.Count -eq 1 -and (Test-Responde)) {
    # Python le o fonte na PARTIDA. Se algum .py mudou depois que o processo subiu, o
    # servidor esta rodando codigo VELHO - e isso nao aparece em lugar nenhum: ele responde
    # 200 e entrega o arquivo certo, so nao executa o proprio conserto. Custou uma hora em
    # 2026-09-01. Estatico (.js/.html/.css) e lido a cada requisicao, entao nao entra nesta
    # conta: so o codigo do servidor precisa de reinicio.
    $maisNovo = Get-ChildItem "$PSScriptRoot\video-worker\*.py" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($maisNovo -and $maisNovo.LastWriteTime -gt $rodando[0].CreationDate) {
        Write-Host "Renderizador (PID $($rodando[0].ProcessId)) esta com codigo velho: $($maisNovo.Name) mudou depois que ele subiu. Reiniciando."
        Stop-Renderizadores $rodando
        $rodando = @()
    }
    else {
        Write-Host "Ja havia um renderizador na 8765 (PID $($rodando[0].ProcessId)) e ele esta atualizado. Nao subi outro."
        Start-Process $PORTA
        exit 0
    }
}

# Processo existe mas nao responde (travado ou morrendo): tirar do caminho, senao o novo
# disputa a porta com um zumbi.
if ($rodando.Count -eq 1) { Stop-Renderizadores $rodando }

$server = Start-Process py -ArgumentList '-3.12', "$PSScriptRoot\video-worker\serve.py" -PassThru -NoNewWindow
Start-Sleep -Seconds 2
Start-Process $PORTA
# O PID do Start-Process e o do LANCADOR py.exe, nao o do python.exe que de fato atende
# (medido: lancador 12624, servidor 3564). As mensagens da guarda acima falam em PID de
# python, entao anunciar o do lancador daria dois numeros para a mesma coisa. O lancador
# sobrevive e e pai do python, entao o Wait-Process continua sendo nele.
$real = @(Get-Renderizadores)
$pidReal = if ($real.Count -ge 1) { $real[0].ProcessId } else { $server.Id }
Write-Host "Renderizador na 8765 (PID $pidReal). Feche esta janela para parar."
Wait-Process -Id $server.Id
