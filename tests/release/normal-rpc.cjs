'use strict';
const { spawn } = require('node:child_process');
const fs=require('node:fs'),{createHash}=require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const BINARY = 'C:/Users/js/.codex/packages/standalone/releases/0.154.0-x86_64-pc-windows-msvc/bin/codex.exe';
function connect(onEvent = () => {}, onFailure = () => {}) {
  if(createHash('sha256').update(fs.readFileSync(BINARY)).digest('hex')!=='be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde')throw new Error('native_binary_changed');
  const child = spawn(BINARY, ['app-server', '--stdio'], { cwd: process.cwd(), env: process.env,
    shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const decoder = new StringDecoder('utf8');
  let buffer = '', bytes = 0, stderr = 0, next = 0, failure = null, closing = false;
  const pending = new Map();
  const fail = code => { if(failure)return; failure = code; onFailure(code); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(code)); }
    pending.clear(); child.stdin.end(); };
  child.on('error', () => fail('rpc_launch'));
  const closed = new Promise(resolve => child.on('close', code => { if (pending.size) fail('rpc_closed'); if(!closing)onFailure('rpc_closed'); if(code!==0)onFailure('rpc_exit'); resolve(code); }));
  child.stderr.on('data', c => { if ((stderr += c.length) > 65536) fail('rpc_stderr_limit'); });
  child.stdin.on('error', () => fail('rpc_input'));
  child.stdout.on('data', c => {
    if ((bytes += c.length) > 2097152) return fail('rpc_output_limit');
    buffer += decoder.write(c); let at;
    while ((at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0,at); buffer = buffer.slice(at+1); let r;
      try { r = JSON.parse(line); } catch { fail('rpc_json'); return; }
      if (Object.hasOwn(r, 'id') && pending.has(r.id)) {
        const p = pending.get(r.id); pending.delete(r.id); clearTimeout(p.timer);
        r.error ? p.reject(new Error('rpc_rejected_' + p.method.replaceAll('/', '_'))) : p.resolve(r.result);
      } else {
        try { onEvent(r); } catch { fail('rpc_event'); }
      }
    }
  });
  const send = r => { if (failure) throw new Error(failure); child.stdin.write(JSON.stringify(r)+'\n'); };
  return { send, request(method, params) { return new Promise((resolve,reject) => {
    const id = ++next, timer = setTimeout(() => { pending.delete(id); reject(new Error('rpc_timeout')); child.stdin.end(); }, 12000);
    pending.set(id, { resolve,reject,timer,method }); send({ id,method,params });
  }); }, async close() { closing = true; child.stdin.end(); const code = await closed; if(code !== 0) throw new Error('rpc_exit'); } };
}
module.exports = { connect, BINARY };
