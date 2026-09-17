'use strict';
const { spawn } = require('node:child_process');
const mode = process.argv[2];
if (mode === 'echo') {
  let input = '';
  process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => process.stdout.write(JSON.stringify({ input, args: process.argv.slice(3) })));
} else if (mode === 'child') {
  setTimeout(() => process.exit(0), 20000);
} else if (mode === 'orphan' || mode === 'hang') {
  const child = spawn(process.execPath, [__filename, 'child'], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  process.stdout.write(String(child.pid));
  if (mode === 'hang') setTimeout(() => process.exit(0), 20000);
} else if (mode === 'stdout' || mode === 'stderr') {
  process[mode].write('x'.repeat(200000));
} else if (mode === 'exit') {
  process.exitCode = 7;
} else {
  process.exitCode = 9;
}
