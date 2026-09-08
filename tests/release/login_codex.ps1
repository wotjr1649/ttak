param(
    [ValidateSet('all', 'baseline', 'original', 'ttak')]
    [string]$Condition = 'all'
)

# Run directly in the owner's interactive terminal. Native login may display authentication
# instructions; this helper must not run in a captured agent subprocess.
if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) {
    throw 'Run this helper directly in an interactive terminal, not through an agent tool.'
}

$taskRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$profilesRoot = (Resolve-Path -LiteralPath (Join-Path $taskRoot '.superpowers/release-run-03/profiles')).Path
$selectedConditions = if ($Condition -eq 'all') { @('baseline', 'original', 'ttak') } else { @($Condition) }
$originalCodexHome = $env:CODEX_HOME

try {
    foreach ($selectedCondition in $selectedConditions) {
        $profilePath = (Resolve-Path -LiteralPath (Join-Path $profilesRoot "codex-$selectedCondition")).Path
        if (-not $profilePath.StartsWith($profilesRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Unexpected profile path.'
        }
        $env:CODEX_HOME = $profilePath
        Write-Host "Sign in to the existing ChatGPT subscription for the $selectedCondition test profile."
        & codex login
        if ($LASTEXITCODE -ne 0) { throw "Native login did not complete for $selectedCondition." }
        & codex login status
        if ($LASTEXITCODE -ne 0) { throw "Native login status failed for $selectedCondition." }
    }
    if ($selectedConditions -contains 'ttak') {
        $env:CODEX_HOME = Join-Path $profilesRoot 'codex-ttak'
        Write-Host 'The candidate session will open. Review its hooks through /hooks using the normal UI.'
        Write-Host 'Enable the TTAK SessionStart, UserPromptSubmit and SubagentStart hooks, then send ttak on.'
        Write-Host 'Confirm TTAK saved setting: ON, then leave the session. No benchmark prompt is sent automatically.'
        & codex --model gpt-5.6-luna -c 'model_reasoning_effort="high"'
        if ($LASTEXITCODE -ne 0) { throw 'The native candidate session did not exit successfully.' }
    }
}
finally {
    if ($null -eq $originalCodexHome) {
        if (Test-Path Env:CODEX_HOME) { Remove-Item Env:CODEX_HOME -ErrorAction Stop }
    }
    else { $env:CODEX_HOME = $originalCodexHome }
}

Write-Host 'Native login preparation finished. The previous CODEX_HOME value has been restored.'
Write-Host 'Tell the agent whether all three logins and the candidate hook review completed.'
