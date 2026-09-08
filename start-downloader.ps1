# Sobe o helper local do baixador (a ponte entre a extensao do navegador e o yt-dlp).
#
# Por que existe: a extensao nao pode executar programa nenhum na maquina — ela so sabe
# falar HTTP. Quem chama o yt-dlp e o baixador\local-helper\server.py, na porta 8770.
# Sem esse processo de pe, o botao "Baixar" da extensao falha e parece estar quebrado.
# A porta 8770 nao e a 8765 de proposito: a 8765 e do Estudio de Videos (estudio.ps1).
# Este script tambem CONFERE que o servico respondeu antes de dizer que esta pronto —
# um "subiu" que na verdade morreu no import e o jeito mais rapido de perder a tarde.

$ErrorActionPreference = 'Stop'

$server = Start-Process py -ArgumentList '-3.12', "$PSScriptRoot\baixador\local-helper\server.py" -PassThru -NoNewWindow

$health = $null
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8770/health' -TimeoutSec 3
        break
    } catch {
        $health = $null
    }
}

if ($null -eq $health) {
    Write-Host "FALHOU: o helper nao respondeu em http://127.0.0.1:8770/health."
    Write-Host "Verifique se a porta 8770 esta livre e rode o servidor na mao para ver o erro:"
    Write-Host "  py -3.12 `"$PSScriptRoot\baixador\local-helper\server.py`""
    try { Stop-Process -Id $server.Id -Force } catch { }
    exit 1
}

if ($health.status -eq 'ok') {
    Write-Host "yt-dlp $($health.ytDlp) | pasta de download: $($health.downloadFolder)"
} else {
    Write-Host "ATENCAO: $($health.error)"
    Write-Host "O helper esta de pe, mas nenhum download vai funcionar ate o yt-dlp estar no PATH."
}

Write-Host "Baixador no ar em http://127.0.0.1:8770 (PID $($server.Id)). Feche esta janela para parar."
Wait-Process -Id $server.Id
