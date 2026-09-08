# Radar E-commerce — roda todo sábado via Agendador de Tarefas do Windows.
# Chama o Claude Code headless para pesquisar a semana e atualizar ecommerce-news-data.js.
# Log: %TEMP%\radar-ecommerce.log
$proj = 'C:\Users\Teste\Downloads\Seller-Arthur'
$log  = Join-Path $env:TEMP 'radar-ecommerce.log'
Set-Location $proj
Add-Content -Encoding utf8 $log "`n=== $(Get-Date -Format 'yyyy-MM-dd HH:mm') ==="
$out = Get-Content "$proj\radar-ecommerce-prompt.md" -Raw |
  & 'C:\Users\Teste\.local\bin\claude.exe' -p --permission-mode acceptEdits `
      --allowedTools 'WebSearch,WebFetch,Read,Glob,Grep,Write,Edit,Bash(node --check:*)' 2>&1
$out | Add-Content -Encoding utf8 $log
