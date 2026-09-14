'use strict';
// Public model-free process fixture. These records are synthetic, not native model evidence.
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
if (process.argv[2] === '--child') setTimeout(() => process.exit(0), 20000);
else {
  let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    const data = JSON.parse(input), ticketText = fs.readFileSync(path.join(data.directory, 'ticket.json'), 'utf8');
    const ticket = JSON.parse(ticketText);
    assert.equal(process.env.TTAK_VERIFICATION_TICKET_SHA256, createHash('sha256').update(ticketText.trim()).digest('hex'));
    assert.equal(process.env.TTAK_VERIFICATION_RUN_NONCE, ticket.run_nonce);
    assert.ok(fs.existsSync(path.join(data.directory, 'started/stamp.json')));
    assert.equal(process.env.OPENAI_API_KEY, undefined); assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
    const mode = process.argv[2];
    if (['hang', 'orphan'].includes(mode)) {
      const child = spawn(process.execPath, [__filename, '--child'], { windowsHide: true, detached: true, stdio: 'ignore' });
      child.unref();
    }
    if (mode === 'hang') { setTimeout(() => process.exit(0), 20000); return; }
    if (mode === 'exit') { process.exitCode = 7; return; }
    if (mode === 'malformed') { process.stdout.write('not an envelope'); return; }
    const makeRows = (id, prompt, answer) => [
      { type: 'session_meta', payload: { id, cli_version: '0.154.0' } },
      { type: 'turn_context', payload: { model: 'gpt-5.6-luna', effort: 'high' } },
      ...(id === 'Child1' ? (ticket.child_context_inputs || []).map(text => ({ type: 'response_item',
        payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })) : []),
      { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] } },
      { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: answer }] } },
      { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100,
        cached_input_tokens: 80, cache_write_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 4, total_tokens: 110 } } } },
      { type: 'event_msg', payload: { type: 'task_complete', error: null } }
    ].map(row => ({ timestamp: new Date().toISOString(), ...row }));
    const v3 = ['verification-submit-v3', 'verification-pinned-submit-v4'].includes(ticket.child_input_format);
    const submitName = 'mcp__ttak_verification__verification_submit';
    const makeClaudeRows = (id, prompt, answer) => [
      { type: 'user', uuid: id + 'User', message: { content: prompt } },
      { type: 'assistant', uuid: id + 'Assistant', message: { id: id + 'Message', model: 'claude-haiku-4-5-20251001',
        content: v3 ? [{ type: 'tool_use', id: id === 'Child1' ? 'Submit1' : 'Agent1',
          name: id === 'Child1' ? submitName : 'Agent', input: id === 'Child1' ? JSON.parse(answer) : {} }]
          : [{ type: 'text', text: answer }], usage: { input_tokens: 10, cache_creation_input_tokens: 5,
          cache_read_input_tokens: 7, output_tokens: 20, output_tokens_details: { thinking_tokens: 4 } } } },
      ...(v3 && id === 'Child1' ? [
        { type: 'user', uuid: 'ChildAck', message: { content: [{ type: 'tool_result', tool_use_id: 'Submit1',
          is_error: false, content: [{ type: 'text', text: JSON.stringify(data.submission_ack) }] }] } },
        { type: 'assistant', uuid: 'ChildFinal', message: { id: 'ChildFinalMessage', model: 'claude-haiku-4-5-20251001',
          content: [{ type: 'text', text: 'Submitted.' }], usage: { input_tokens: 10, cache_creation_input_tokens: 0,
            cache_read_input_tokens: 10, output_tokens: 2, output_tokens_details: { thinking_tokens: 0 } } } }
      ] : [])
    ].map(row => ({ timestamp: new Date().toISOString(), sessionId: 'Parent1', version: '2.1.266',
      isSidechain: id === 'Child1', ...(id === 'Child1' ? { agentId: id } : {}), ...row }));
    const records = ticket.host === 'claude' ? makeClaudeRows : makeRows;
    for (const [name, rows] of [['parent', records('Parent1', data.parent_prompt, 'Synthetic parent answer')],
      ['child', records('Child1', data.packet_text, data.result)]]) {
      fs.writeFileSync(path.join(process.cwd(), name + '.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n', { flag: 'wx' });
    }
    const result = { schema_version: 1, ticket_sha256: process.env.TTAK_VERIFICATION_TICKET_SHA256,
      run_nonce: mode === 'wrong-nonce' ? 'wrong' : ticket.run_nonce, parent_thread_id: 'Parent1', completion: 'completed',
      children: [{ thread_id: 'Child1', packet_sha256: ticket.packets[0].packet_sha256,
        spawn_mode: ticket.host === 'codex' ? 'fork_context_false' : v3 ? 'custom_verifier_foreground' : 'general_purpose_foreground', completed: true }] };
    process.stdout.write(JSON.stringify(result));
  });
}
