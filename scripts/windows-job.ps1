$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false, $true)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false, $true)
try {
    $taskRequestText = [Console]::In.ReadToEnd()
    if ($taskRequestText.Length -gt 2200000) { throw 'request_too_large' }
    $taskRequest = ConvertFrom-Json -InputObject $taskRequestText
    Add-Type -Path (Join-Path $PSScriptRoot 'windows-job.cs')
    $taskResult = [TtakWindowsJob]::Run($taskRequest.executable, [string[]]$taskRequest.arguments,
        $taskRequest.cwd, $taskRequest.input, $taskRequest.timeoutMs, $taskRequest.stdoutLimit,
        $taskRequest.stderrLimit, $taskRequest.cleanupMs)
    [Console]::Out.WriteLine(($taskResult | ConvertTo-Json -Compress))
} catch {
    # Never render exception text, command arguments, prompts or environment values.
    [Console]::Out.WriteLine('{"status":"supervisor_error","cleanupVerified":false}')
    exit 1
}
