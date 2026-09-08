# Radar IA — roda todo dia à meia-noite via Agendador de Tarefas do Windows (OPCIONAL).
# Alternativa ao agente do Cowork. NÃO use os dois ao mesmo tempo (evita rodar em duplicidade).
# Chama o Claude Code headless para pesquisar o dia e atualizar ai-news-data.js.
# Log: %TEMP%\radar-ia.log
$proj = 'C:\Users\Teste\Downloads\Seller-Arthur'
$log  = Join-Path $env:TEMP 'radar-ia.log'
Set-Location $proj
Add-Content -Encoding utf8 $log "`n=== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ==="
$out = Get-Content "$proj\radar-ia-prompt.md" -Raw |
  & 'C:\Users\Teste\.local\bin\claude.exe' -p --permission-mode acceptEdits `
      --allowedTools 'WebSearch,WebFetch,Read,Glob,Grep,Write,Edit,Bash(node --check:*)' 2>&1
$out | Add-Content -Encoding utf8 $log
