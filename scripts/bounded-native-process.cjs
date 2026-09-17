'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

// Timer representation limit, not a model-quality deadline. The reviewed caller
// must supply its own finite run budget; there is no default inference timeout.
const MAX_TIMEOUT_MS = 2147450000;
function checkedTimeoutMs(value) {
  if (!Number.isSafeInteger(value) || value < 50 || value > MAX_TIMEOUT_MS) {
    throw new Error('explicit_native_time_budget_required');
  }
  return value;
}

function boundedNativeProcess(request, { powershell, env }) {
  checkedTimeoutMs(request.timeoutMs);
  if (!Number.isSafeInteger(request.cleanupMs) || request.cleanupMs < 100 || request.cleanupMs > 10000) {
    throw new Error('invalid_native_cleanup_budget');
  }
  if (process.platform !== 'win32') throw new Error('windows_required');
  if (!path.isAbsolute(powershell) || !path.isAbsolute(request.executable) || !path.isAbsolute(request.cwd)) {
    throw new Error('absolute_paths_required');
  }
  const input = JSON.stringify(request);
  if (Buffer.byteLength(input) > 2200000) throw new Error('request_too_large');
  return new Promise((resolve, reject) => {
    const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File',
      path.join(__dirname, 'windows-job.ps1')], { env, cwd: request.cwd, windowsHide: true, shell: false,
      stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, errorSize = 0, stopped = false, stdinFailed = false;
    const stop = () => { stopped = true; child.kill(); };
    // Startup compilation plus worker deadline and cleanup; never assume cleanup after this watchdog fires.
    const watchdog = setTimeout(stop, request.timeoutMs + request.cleanupMs + 20000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 7000000) stop(); else chunks.push(chunk); });
    child.stderr.on('data', chunk => { errorSize += chunk.length; if (errorSize > 65536) stop(); });
    child.on('error', () => { clearTimeout(watchdog); reject(new Error('supervisor_launch_failed')); });
    child.stdin.on('error', () => { stdinFailed = true; });
    child.on('close', code => {
      clearTimeout(watchdog);
      if (stopped) return reject(new Error('supervisor_watchdog_cleanup_unverified'));
      if (stdinFailed) return reject(new Error('supervisor_input_failed_cleanup_unverified'));
      if (code !== 0) return reject(new Error('supervisor_failed_cleanup_unverified'));
      let result;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reject(new Error('invalid_supervisor_result')); }
      if (!result.cleanupVerified || !result.assignedBeforeResume || result.activeProcesses !== 0) {
        return reject(new Error('native_cleanup_unverified'));
      }
      resolve(result);
    });
    child.stdin.end(input);
  });
}
module.exports = { boundedNativeProcess, checkedTimeoutMs, MAX_TIMEOUT_MS };
