'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { handleEvent, takeEvidence, reconciliationReason, canonicalScenario, TOOL, TTL } = require('../hooks/scenario-evidence.cjs');
const { handle: stop } = require('../hooks/scenario-stop.cjs');
const { createDispatcher } = require('../scripts/scenario-feedback-mcp.cjs');
const runtime = path.resolve(__dirname, '../.superpowers');
fs.mkdirSync(runtime, { recursive: true });
const scenario = { initial: { PrivateAlice: true, PrivateBob: true },
  invariant: { cells: ['PrivateAlice', 'PrivateBob'], at_least: 1 },
  transactions: [
    { id: 'PrivateFirst', guard: { cells: ['PrivateAlice', 'PrivateBob'], at_least: 2 }, writes: { PrivateAlice: false } },
    { id: 'PrivateSecond', guard: { cells: ['PrivateAlice', 'PrivateBob'], at_least: 2 }, writes: { PrivateBob: false } }
  ] };
const clean = 'Each transaction reads both cells and writes its own cell. Concurrent snapshots can break the invariant. Serializable committed results match a serial order; failures require whole-transaction retry.';
const input = (event, extra = {}) => ({ hook_event_name: event, session_id: 'fixture-session', turn_id: 'fixture-turn', ...extra });
const final = (extra = {}) => input('Stop', { last_assistant_message: clean, stop_hook_active: false, ...extra });
function toolEvent(model = scenario, extra = {}) {
  const dispatch = createDispatcher();
  dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  dispatch({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const args = { scenario: model, draft: 'PrivateDraftMarker. ' + clean, language: 'en' };
  const response = dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'scenario_review', arguments: args } });
  assert.ok(response.result && !response.result.isError);
  return input('PostToolUse', { tool_name: TOOL, tool_use_id: 'tool-fixture', tool_input: args, tool_response: response.result, ...extra });
}
function fixture(body) {
  const root = fs.mkdtempSync(path.join(runtime, 'evidence-test-'));
  const options = { root, enabled: true, now: 1000000 };
  const file = path.join(root, 'scenario-evidence-v1', createHash('sha256').update('fixture-session').digest('hex') + '.json');
  const begin = () => {
    // Exercise finite-evidence consumption independently of the explanation decision.
    // Registered explanation Stop/decision integration is covered in explanation-attempt.test.cjs.
    const result = handleEvent(input('UserPromptSubmit', { prompt: 'Compute this finite concurrency model.' }), options);
    assert.equal(JSON.parse(fs.readFileSync(file)).status, 'empty');
    return result;
  };
  const record = () => assert.deepEqual(handleEvent(toolEvent(), options), {});
  try { body({ root, options, file, begin, record }); }
  finally {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(runtime));
    fs.rmSync(root, { recursive: true });
  }
}

test('actual tool output makes even a correct answer receive exactly one evidence check', () => fixture(({ options, file, begin, record }) => {
  begin(); record();
  const first = stop(final(), true, options);
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /required evidence check, not a finding/);
  assert.match(first.reason, /Preserve valid content/);
  assert.deepEqual(stop(final(), true, options), {});
  assert.deepEqual(stop(final({ stop_hook_active: true }), true, options), {});
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'consumed');
  record();
  assert.deepEqual(stop(final(), true, options), {});
}));

test('drafts, original identifiers, prompt, transcript and tool paths are not stored or reflected', () => fixture(({ options, file, begin }) => {
  begin();
  handleEvent(toolEvent(scenario, { transcript_path: 'PrivateTranscriptMarker', cwd: 'PrivatePathMarker' }), options);
  const raw = fs.readFileSync(file, 'utf8') + stop(final(), true, options).reason;
  assert.doesNotMatch(raw, /Private|fixture-session|fixture-turn|Explain this concurrency/);
  assert.match(raw, /"cross_read_write":\[\[1,2\],\[2,1\]\]/);
}));

test('other tools and OFF never trigger evidence correction or create state', () => fixture(({ options, file, begin, record }) => {
  assert.deepEqual(handleEvent(toolEvent(), { ...options, enabled: false }), {});
  assert.equal(fs.existsSync(file), false);
  begin();
  assert.deepEqual(handleEvent(toolEvent(scenario, { tool_name: 'mcp__other__scenario_review' }), options), {});
  assert.deepEqual(stop(final(), true, options), {});
  record();
  assert.deepEqual(stop(final(), false, options), {});
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'pending');
  handleEvent(input('UserPromptSubmit', { prompt: '딱 꺼' }), { ...options, enabled: false });
  assert.equal(fs.existsSync(file), false);
}));

test('session and turn isolation, new prompt and resume clear stale evidence; compact preserves it', () => fixture(({ options, begin, record }) => {
  begin(); record();
  assert.deepEqual(stop(final({ session_id: 'other-session' }), true, options), {});
  assert.deepEqual(stop(final({ turn_id: 'other-turn' }), true, options), {});
  handleEvent(input('SessionStart', { source: 'compact' }), options);
  assert.equal(takeEvidence(final(), options).status, 'ready');
  for (const event of [input('SessionStart', { source: 'resume' }), input('SessionEnd'), input('UserPromptSubmit', { prompt: 'Next task' })]) {
    begin(); record(); handleEvent(event, options);
    assert.deepEqual(stop(final(), true, options), {});
  }
}));

test('Claude payloads without turn_id use prompt lifecycle and do not reuse a consumed turn', () => fixture(({ options }) => {
  const event = input('UserPromptSubmit', { prompt: 'Compute this model.', turn_id: undefined });
  handleEvent(event, options);
  handleEvent(toolEvent(scenario, { turn_id: undefined }), options);
  assert.equal(stop(final({ turn_id: undefined }), true, options).decision, 'block');
  handleEvent(event, options);
  assert.deepEqual(stop(final({ turn_id: undefined }), true, options), {});
}));

test('expired or invalid evidence reports unavailable without a correctness verdict', () => fixture(({ options, file, begin, record }) => {
  begin(); record();
  const expired = stop(final(), true, { ...options, now: options.now + TTL + 1 });
  assert.equal(expired.continue, false); assert.match(expired.stopReason, /unavailable/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'unavailable');
  assert.equal(stop(final(), true, options).continue, false);
  begin(); fs.writeFileSync(file, '{invalid');
  assert.match(stop(final(), true, options).stopReason, /unavailable/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{invalid');
}));

test('tampered response, extra arguments and wrong turn cannot become evidence', () => fixture(({ options, begin }) => {
  begin();
  for (const mutate of [
    event => { event.tool_response.content[0].text = '{}'; },
    event => { event.tool_response.structuredContent = {}; },
    event => { event.tool_input.extra = 'unreviewed'; },
    event => { event.turn_id = 'wrong-turn'; },
    event => { event.tool_response.isError = true; }
  ]) {
    begin();
    const event = toolEvent(); mutate(event);
    assert.match(handleEvent(event, options).systemMessage, /could not record/);
    if (event.turn_id === 'wrong-turn') assert.deepEqual(stop(final(), true, options), {});
    else assert.equal(stop(final(), true, options).continue, false);
  }
}));

test('Claude content arrays and Codex full MCP results both require exactly one verified correction', () => fixture(({ options, begin }) => {
  for (const contentOnly of [false, true]) {
    begin();
    const event = toolEvent();
    if (contentOnly) event.tool_response = event.tool_response.content;
    assert.deepEqual(handleEvent(event, options), {});
    assert.equal(stop(final(), true, options).decision, 'block');
    assert.deepEqual(stop(final(), true, options), {});
  }
}));

test('normalizing a content array preserves exact-payload checks and rejects extra or corrupted blocks', () => fixture(({ options, begin }) => {
  begin();
  for (const mutate of [
    blocks => { blocks[0].text = '{}'; },
    blocks => { blocks.push({ type: 'text', text: 'unreviewed addition' }); },
    blocks => { blocks[0].type = 'image'; },
    blocks => { blocks.length = 0; },
    blocks => { const value = JSON.parse(blocks[0].text); value.computed = {}; blocks[0].text = JSON.stringify(value); }
  ]) {
    begin();
    const event = toolEvent(); event.tool_response = event.tool_response.content; mutate(event.tool_response);
    assert.match(handleEvent(event, options).systemMessage, /could not record/);
    assert.equal(stop(final(), true, options).continue, false);
  }
}));

test('an existing correction and a second Stop cannot start another continuation', () => fixture(({ options, begin, record }) => {
  begin(); record();
  assert.equal(takeEvidence(final({ stop_hook_active: true }), options).status, 'consumed');
  const bad = final({ last_assistant_message: 'Serializable requires that one transaction completes before the other begins.' });
  assert.equal(stop(bad, true, options).continue, false);
  assert.match(stop(bad, true, options).stopReason, /not verified/);
  assert.equal(stop(bad, true, options).decision, undefined);
}));

test('locked files and linked files are preserved, never followed or stolen', () => fixture(({ options, root, file, begin, record }) => {
  begin(); record();
  const lock = file.replace(/\.json$/, '.lock');
  fs.writeFileSync(lock, 'owned elsewhere');
  assert.equal(takeEvidence(final(), options).status, 'unavailable');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'owned elsewhere');
  fs.unlinkSync(lock);
  const outside = path.join(root, 'unrelated'); fs.writeFileSync(outside, 'preserve');
  fs.unlinkSync(file); fs.linkSync(outside, file);
  assert.equal(takeEvidence(final(), options).status, 'unavailable');
  assert.equal(fs.readFileSync(outside, 'utf8'), 'preserve');
}));

test('path traversal identifiers and redirected data roots cannot write outside the store', () => fixture(({ options, root, file }) => {
  assert.deepEqual(handleEvent(input('UserPromptSubmit', { session_id: '../outside', prompt: 'Explain' }), options), {});
  assert.equal(fs.existsSync(file), false);
  const target = path.join(root, 'target'), link = path.join(root, 'redirect');
  fs.mkdirSync(target); fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(handleEvent(input('UserPromptSubmit', { prompt: 'Explain' }), { ...options, root: link }).systemMessage, /could not record/);
  assert.deepEqual(fs.readdirSync(target), []);
}));

test('maximum supported scenarios fit the bounded correction payload', () => {
  const names = Array.from({ length: 16 }, (_, i) => 'Cell' + i);
  const maximum = { initial: Object.fromEntries(names.map(name => [name, true])),
    invariant: { cells: names, at_least: 0 }, transactions: Array.from({ length: 4 }, (_, i) => ({
      id: 'Transaction' + i, guard: { cells: names, at_least: 16 },
      writes: Object.fromEntries(names.map(name => [name, false]))
    })) };
  const reason = reconciliationReason(Array.from({ length: 4 }, () => canonicalScenario(maximum)));
  assert.ok(Buffer.byteLength(reason) <= 8000);
});

test('real command handles malformed and oversized payloads and keeps OFF silent', () => fixture(({ root }) => {
  const command = path.resolve(__dirname, '../hooks/scenario-evidence.cjs');
  for (const enabled of [false, true]) {
    fs.writeFileSync(path.join(root, 'state.json'), JSON.stringify({ enabled }));
    for (const value of ['{bad', 'x'.repeat(131073)]) {
      const run = spawnSync(process.execPath, [command], { input: value, encoding: 'utf8', timeout: 5000,
        maxBuffer: 16384, windowsHide: true, env: { PLUGIN_DATA: root } });
      assert.equal(run.status, enabled ? 2 : 0); assert.equal(run.stderr, '');
      if (enabled) assert.match(JSON.parse(run.stdout).systemMessage, /could not record/);
      else assert.deepEqual(JSON.parse(run.stdout), {});
    }
  }
}));

test('native JSON text receives exactly one verified evidence correction', () => fixture(({ options, begin }) => {
  begin(); const event = toolEvent(); event.tool_response = event.tool_response.content[0].text;
  assert.deepEqual(handleEvent(event, options), {});
  assert.equal(stop(final(), true, options).decision, 'block');
  assert.deepEqual(stop(final(), true, options), {});
}));

test('JSON text cannot smuggle wrappers, malformed data or a different computation into evidence', () => fixture(({ options, begin }) => {
  const original = toolEvent().tool_response;
  for (const supplied of ['{broken', '{}', original.content[0].text + ' trailing',
    JSON.stringify(original), JSON.stringify(original.content),
    JSON.stringify({ ...JSON.parse(original.content[0].text), computed: {} })]) {
    begin(); const event = toolEvent(); event.tool_response = supplied;
    assert.match(handleEvent(event, options).systemMessage, /could not record/);
    assert.equal(stop(final(), true, options).continue, false);
  }
}));

test('a rejected current-turn result persists until a new task and is not erased by a later valid tool result', () => fixture(({ options, file, begin, record }) => {
  begin(); const event = toolEvent(); event.tool_response.content[0].text = '{}';
  assert.match(handleEvent(event, options).systemMessage, /could not record/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'unavailable');
  assert.match(handleEvent(toolEvent(), options).systemMessage, /could not record/);
  for (const active of [false, true, false]) {
    const result = stop(final({ stop_hook_active: active }), true, options);
    assert.equal(result.continue, false); assert.equal(result.decision, undefined);
  }
  const next = handleEvent(input('UserPromptSubmit', { prompt: 'A new task' }), options);
  assert.match(next.hookSpecificOutput.additionalContext, /previous explanation remains unverified/);
  record();
  assert.equal(stop(final(), true, options).decision, 'block');
}));

test('an unavailable check survives session end and resume, then a new task receives its failure notice', () => fixture(({ options, file, begin }) => {
  begin(); const event = toolEvent(); event.tool_response.content[0].text = '{}';
  handleEvent(event, options);
  assert.deepEqual(handleEvent(input('SessionEnd'), options), {});
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'unavailable');
  const resumed = handleEvent(input('SessionStart', { source: 'resume' }), options);
  assert.equal(resumed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(resumed.hookSpecificOutput.additionalContext, /previous explanation remains unverified/);
  assert.equal(stop(final(), true, options).continue, false);
  const newTask = handleEvent(input('UserPromptSubmit', { prompt: 'A new independent task', turn_id: 'new-turn' }), options);
  assert.equal(newTask.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(newTask.hookSpecificOutput.additionalContext, /new request needs its own check/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'empty');
  assert.equal(takeEvidence(final(), options).status, 'absent');
  assert.doesNotMatch(JSON.stringify(newTask), /Private|fixture-session|fixture-turn/);
}));

test('a new prompt recovers malformed regular state without certifying the prior answer or reflecting rejected bytes', () => fixture(({ options, file, begin, record }) => {
  begin(); fs.writeFileSync(file, '{PrivateRejectedMarker');
  assert.equal(stop(final(), true, options).continue, false);
  for (const event of [input('SessionEnd'), input('SessionStart', { source: 'resume' })]) {
    assert.match(handleEvent(event, options).systemMessage, /could not record/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{PrivateRejectedMarker');
  }
  const next = handleEvent(input('UserPromptSubmit', { prompt: 'A new independent task' }), options);
  assert.match(next.hookSpecificOutput.additionalContext, /previous explanation remains unverified/);
  assert.doesNotMatch(JSON.stringify(next) + fs.readFileSync(file, 'utf8'), /PrivateRejectedMarker/);
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'empty');
  record();
  assert.equal(stop(final(), true, options).decision, 'block');
}));

test('new-prompt corruption recovery preserves locks, linked files and oversized state', () => fixture(({ options, root, file, begin }) => {
  begin(); const lock = file.replace(/\.json$/, '.lock');
  fs.writeFileSync(file, '{invalid'); fs.writeFileSync(lock, 'owned elsewhere');
  const next = () => handleEvent(input('UserPromptSubmit', { prompt: 'New task' }), options);
  assert.match(next().systemMessage, /could not record/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{invalid');
  assert.equal(fs.readFileSync(lock, 'utf8'), 'owned elsewhere'); fs.unlinkSync(lock);
  fs.writeFileSync(file, 'x'.repeat(32769));
  assert.match(next().systemMessage, /could not record/);
  assert.equal(fs.statSync(file).size, 32769);
  fs.unlinkSync(file); const unrelated = path.join(root, 'unrelated');
  fs.writeFileSync(unrelated, '{preserve'); fs.linkSync(unrelated, file);
  assert.match(next().systemMessage, /could not record/);
  assert.equal(fs.readFileSync(unrelated, 'utf8'), '{preserve');
  assert.equal(fs.statSync(file).nlink, 2);
}));

test('a late first result cannot turn an expired empty evidence record into an absent check', () => fixture(({ options, file, begin }) => {
  for (const now of [options.now + TTL + 1, options.now - 1]) {
    begin();
    assert.match(handleEvent(toolEvent(), { ...options, now }).systemMessage, /could not record/);
    assert.equal(JSON.parse(fs.readFileSync(file)).status, 'unavailable');
    assert.equal(stop(final(), true, { ...options, now }).continue, false);
  }
}));

test('exceeding the scenario cap preserves a failure instead of silently using the first four models', () => fixture(({ options, file, begin }) => {
  begin();
  for (let i = 0; i < 5; i++) {
    const model = structuredClone(scenario);
    model.invariant.at_least = i % 3;
    if (i >= 3) model.transactions[0].guard.at_least = 1;
    const result = handleEvent(toolEvent(model), options);
    if (i < 4) assert.deepEqual(result, {});
    else assert.match(result.systemMessage, /could not record/);
  }
  assert.equal(JSON.parse(fs.readFileSync(file)).status, 'unavailable');
  assert.equal(stop(final(), true, options).continue, false);
}));
