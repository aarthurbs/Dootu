# Registra (e habilita) a Tarefa Agendada do agente noturno. Rode UMA vez.
# Uso:  ! powershell -NoProfile -ExecutionPolicy Bypass -File register-night-agent.ps1
# Para desligar depois:  Disable-ScheduledTask -TaskName "Night Agent (Seller-Arthur)"
# Para remover de vez:    Unregister-ScheduledTask -TaskName "Night Agent (Seller-Arthur)" -Confirm:$false

$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Teste\Downloads\Seller-Arthur\night-agent.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At '18:00'
$princ   = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$set     = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 13) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "Night Agent (Seller-Arthur)" -Action $action -Trigger $trigger -Principal $princ -Settings $set `
  -Description "Agente noturno de manutencao (backlog plans/); 18h->07h BRT; branch dedicada; para antes das 7h." -Force

$t = Get-ScheduledTask -TaskName "Night Agent (Seller-Arthur)"
$info = Get-ScheduledTaskInfo -TaskName "Night Agent (Seller-Arthur)"
Write-Host "OK. State: $($t.State) | Proxima execucao: $($info.NextRunTime)"
