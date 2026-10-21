param([switch]$CheckOnly, [string]$ExePath)

$ErrorActionPreference = "Stop"
$ruleName = "MiniSumos RC - Ejecutable Hotspot TCP 8000"
$exePath = if ($ExePath) { [System.IO.Path]::GetFullPath($ExePath) } else { [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "MiniSumosRC.exe")) }

if (-not (Test-Path -LiteralPath $exePath -PathType Leaf)) {
    Write-Error "No se encontró MiniSumosRC.exe junto a este script: $exePath"
    exit 2
}

# Detecta la dirección habitual del hotspot de Windows y adaptadores localizados.
$ipAddresses = @(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" })
$hotspot = $ipAddresses | Where-Object { $_.IPAddress -eq "192.168.137.1" } | Select-Object -First 1
if (-not $hotspot) { $hotspot = $ipAddresses | Where-Object { $_.IPAddress -match "^192\.168\.137\." } | Select-Object -First 1 }
if (-not $hotspot) { $hotspot = $ipAddresses | Where-Object { $_.InterfaceAlias -match "(?i)Local Area Connection|Conexión de área local" } | Select-Object -First 1 }

if (-not $hotspot) {
    Write-Host "No pude identificar la interfaz del hotspot de Windows." -ForegroundColor Red
    Write-Host "Activa el hotspot del PC y vuelve a ejecutar este archivo."
    Write-Host "Interfaces IPv4 detectadas:"
    $ipAddresses | Format-Table InterfaceAlias, IPAddress, PrefixLength -AutoSize
    exit 3
}

# Detecta bloqueos que afectan a este EXE y al puerto del dashboard.
$blockingRules = @(Get-NetFirewallRule -PolicyStore ActiveStore -Direction Inbound -Enabled True -Action Block | ForEach-Object {
    $rule = $_
    $programFilter = $rule | Get-NetFirewallApplicationFilter
    if ($programFilter.Program -ieq $exePath) {
        $portFilter = $rule | Get-NetFirewallPortFilter
        $ports = @($portFilter.LocalPort)
        if (($portFilter.Protocol -eq "TCP" -or $portFilter.Protocol -eq "Any" -or $portFilter.Protocol -eq 256) -and ($ports -contains "Any" -or $ports -contains "8000" -or $ports -contains 8000)) { $rule }
    }
})

if ($CheckOnly) {
    # Un permiso existente no basta si sigue activa una regla de bloqueo del mismo EXE.
    if ($blockingRules.Count -gt 0) { exit 1 }
    $existingRules = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    foreach ($rule in $existingRules) {
        $appFilter = $rule | Get-NetFirewallApplicationFilter
        $addressFilter = $rule | Get-NetFirewallAddressFilter
        $interfaceFilter = $rule | Get-NetFirewallInterfaceFilter
        $localAddresses = @($addressFilter.LocalAddress)
        $interfaces = @($interfaceFilter.InterfaceAlias)
        if ($rule.Enabled -eq "True" -and $rule.Action -eq "Allow" -and $appFilter.Program -ieq $exePath -and ($localAddresses -contains $hotspot.IPAddress -or $localAddresses -contains "Any") -and ($interfaces -contains $hotspot.InterfaceAlias -or $interfaces -contains "Any")) { exit 0 }
    }
    exit 1
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Write-Error "Ejecuta este script como administrador."; exit 4 }

# Deshabilita solo bloqueos de entrada que apunten a este EXE y que afecten TCP 8000.
# Después se crea una regla Allow mucho más limitada a la interfaz/subred del hotspot.
if ($blockingRules.Count -gt 0) {
    Write-Host "Se encontraron bloqueos de firewall para este ejecutable. Se deshabilitarán solo esas reglas." -ForegroundColor Yellow
    $blockingRules | Format-Table DisplayName, Profile, Action -AutoSize
    foreach ($blockingRule in $blockingRules) {
        Disable-NetFirewallRule -Name $blockingRule.Name
    }
    Write-Host "Bloqueos específicos deshabilitados." -ForegroundColor Green
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$ruleParameters = @{
    DisplayName = $ruleName
    Description = "Permite el dashboard MiniSumos RC solo por la interfaz del hotspot, en TCP 8000."
    Direction = "Inbound"
    Action = "Allow"
    Program = $exePath
    Protocol = "TCP"
    LocalPort = 8000
    LocalAddress = $hotspot.IPAddress
    RemoteAddress = "LocalSubnet"
    InterfaceAlias = $hotspot.InterfaceAlias
    Profile = "Any"
    Enabled = "True"
}
New-NetFirewallRule @ruleParameters | Out-Null

Write-Host ""
Write-Host "Regla de firewall creada correctamente." -ForegroundColor Green
Write-Host "Ejecutable: $exePath"
Write-Host "Interfaz:   $($hotspot.InterfaceAlias)"
Write-Host "IP del PC:  $($hotspot.IPAddress)"
Write-Host "Puerto:     TCP 8000"
Write-Host "Desde los celulares conectados al hotspot:"
Write-Host "http://$($hotspot.IPAddress):8000" -ForegroundColor Cyan
