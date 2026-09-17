'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { nativeRequest, nativeEnvironment, nativeArguments, parseNative, auditTranscript, possibleSecret, modelSettings } = require('../scripts/review-native-format.cjs');
const { reviewKey } = require('../scripts/review-roles.cjs');
const { findTranscript } = require('../scripts/review-native.cjs');
const packet = { task: 'Explain fixture.', draft: 'A claim.', references: [{ id: 'R1', url: 'https://example.test', summary: 'Fixture.' }] };
const session = '12345678-1234-1234-1234-123456789012';
const value = { role: 'evidence', review_key: reviewKey(packet), units: [] };
const row = () => ({ is_error: false, session_id: session, permission_denials: [],
  modelUsage: { 'claude-sonnet-5': {} }, structured_output: value, usage: { input_tokens: 10, output_tokens: 2 } });
const { pluginSelectionOverride, verifyPluginSelection } = require('../scripts/review-native-format.cjs');
test('native plugin selection rejects the observed literal-quote alias failure before any model turn', () => {
  const ids = ['ttak@old', 'ttak@candidate'];
  assert.equal(verifyPluginSelection({ 'ttak@old': { enabled: false }, 'ttak@candidate': { enabled: true } }, ids, ['ttak@candidate']), true);
  assert.throws(() => verifyPluginSelection({ 'ttak@old': { enabled: true }, '"ttak@old"': { enabled: false },
    'ttak@candidate': { enabled: true } }, ids, ['ttak@candidate']), /resolved_plugin_selection_mismatch/);
  for (const plugins of [{}, { 'ttak@old': { enabled: 'false' }, 'ttak@candidate': { enabled: true } },
    { 'ttak@old': { enabled: false }, 'ttak@candidate': { enabled: false } }]) {
    assert.throws(() => verifyPluginSelection(plugins, ids, ['ttak@candidate']));
  }
});
test('plugin override fields cannot add configuration or select an unreviewed plugin', () => {
  assert.match(pluginSelectionOverride(['ttak@old', 'ttak@candidate'], ['ttak@candidate']), /^plugins = \{ /);
  for (const [ids, selected] of [[[], []], [['ttak@old', 'ttak@old'], []], [['ttak@old'], ['other@new']],
    [['ttak@old'], ['ttak@old', 'ttak@old']], [['ttak@x" }, hooks = { enabled = false'], []]]) {
    assert.throws(() => pluginSelectionOverride(ids, selected), /invalid_plugin_selection/);
  }
});
const jsonl = rows => rows.map(x => JSON.stringify(x)).join('\n');
const codex = () => [{ type: 'thread.started', thread_id: session },
  { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(value) } },
  { type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 5 } }];

test('role prompt selects only worker data and generates separate closed schemas', () => {
  for (const role of ['evidence', 'context']) {
    const request = nativeRequest({ phase: 'review', role, packet: { ...packet, expected: 'operator-only-marker' },
      review_key: reviewKey(packet), stopOnFinding: true }, session);
    assert.equal(request.schema.additionalProperties, false);
    assert.deepEqual(request.schema.properties.role.enum, [role]);
    assert.ok(!request.prompt.includes('operator-only-marker'));
    assert.ok(!request.prompt.includes('stopOnFinding'));
    const data = JSON.parse(request.prompt.slice(request.prompt.indexOf('{')));
    assert.equal(data.units.length, 1); assert.equal(data.request_id, session);
  }
  assert.throws(() => nativeRequest({ phase: 'review', role: 'evidence', packet, review_key: 'old' }, session));
});
test('command arguments use fresh native sessions, fixed models and normal controls', () => {
  const claude = nativeArguments('claude', { type: 'object' }, 'unused');
  const codexArgs = nativeArguments('codex', { type: 'object' }, 'D:\\schema.json');
  assert.equal(claude[claude.indexOf('--tools') + 1], '');
  assert.ok(claude.includes('claude-sonnet-5')); assert.ok(codexArgs.includes('gpt-5.6-luna'));
  assert.ok(codexArgs.includes('read-only')); assert.ok(codexArgs.includes('model_reasoning_effort="high"'));
  assert.ok([...claude, ...codexArgs].every(arg => !/bypass|ignore-rules|ignore-user-config|resume/i.test(arg)));
});
test('environment excludes API credentials, fallback providers and unrelated variables', () => {
  const source = { PATH: 'runtime', SystemRoot: 'windows', OPENAI_API_KEY: 'fixture-api',
    CODEX_API_KEY: 'fixture-api', ANTHROPIC_BASE_URL: 'fixture-endpoint', UNRELATED: 'fixture-private',
    CLAUDE_CODE_OAUTH_TOKEN: 'fixture-subscription' };
  const claude = nativeEnvironment('claude', 'profile', source), codexEnv = nativeEnvironment('codex', 'profile', source);
  assert.equal(claude.CLAUDE_CODE_OAUTH_TOKEN, 'fixture-subscription');
  assert.ok(!Object.hasOwn(codexEnv, 'CLAUDE_CODE_OAUTH_TOKEN'));
  for (const env of [claude, codexEnv]) for (const key of ['OPENAI_API_KEY','CODEX_API_KEY','ANTHROPIC_BASE_URL','UNRELATED']) {
    assert.ok(!Object.hasOwn(env, key));
  }
  assert.equal(claude.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'claude-sonnet-5');
  assert.equal(claude.CLAUDE_CODE_EFFORT_LEVEL, 'medium');
  assert.equal(source.PATH, 'runtime');
});
test('native parsing rejects model drift, denials, errors, tools and ambiguous sessions', () => {
  assert.equal(parseNative('claude', JSON.stringify(row())).session, session);
  assert.equal(parseNative('codex', jsonl(codex())).session, session);
  for (const mutate of [r => r.is_error = true, r => r.permission_denials = [{}],
    r => r.modelUsage.other = {}, r => r.session_id = '../../escape', r => delete r.structured_output]) {
    const input = row(); mutate(input); assert.throws(() => parseNative('claude', JSON.stringify(input)));
  }
  for (const extra of [{ type: 'error' }, { type: 'turn.failed' }, { type: 'thread.started', thread_id: session },
    { type: 'item.completed', item: { type: 'command_execution' } }]) {
    assert.throws(() => parseNative('codex', jsonl([...codex(), extra])));
  }
  assert.throws(() => parseNative('codex', '{not json}'), /invalid_native_json/);
});
test('possible-secret contents are withheld rather than echoed in parser errors', () => {
  const fake = 'sk-' + 'x'.repeat(24);
  assert.equal(possibleSecret(fake), true);
  assert.throws(() => parseNative('claude', fake), error => error.message === 'native_content_withheld');
});
test('transcript audit uses actual role, prompt, model, effort, version and session metadata', () => {
  const claudeRows = [ { type: 'user', message: { content: [{ type: 'text', text: 'exact prompt' }] } },
    { type: 'assistant', version: '2.1.266', sessionId: session, effort: 'medium', message: { model: 'claude-sonnet-5', content: [] } } ];
  const expected = { session, version: '2.1.266', prompt: 'exact prompt' };
  assert.equal(auditTranscript('claude', jsonl(claudeRows), expected).exact_prompt_verified, true);
  for (const mutate of [r => r[1].effort = 'low', r => r[1].message.model = 'other', r => r[1].sessionId = 'other',
    r => r[1].version = 'old', r => r[0].message.content[0].text = 'other',
    r => r[1].message.content = [{ type: 'tool_use', name: 'Read' }]]) {
    const changed = structuredClone(claudeRows); mutate(changed);
    assert.throws(() => auditTranscript('claude', jsonl(changed), expected));
  }
  const codexRows = [{ type: 'session_meta', payload: { id: session, cli_version: '0.153.4' } },
    { type: 'turn_context', payload: { model: 'gpt-5.6-luna', effort: 'high' } },
    { type: 'response_item', payload: { role: 'user', content: [{ type: 'input_text', text: 'exact prompt' }] } }];
  assert.equal(auditTranscript('codex', jsonl(codexRows), { ...expected, version: '0.153.4' }).model, 'gpt-5.6-luna');
  assert.throws(() => auditTranscript('codex', jsonl([...codexRows, codexRows[1]]), { ...expected, version: '0.153.4' }));
});
test('missing native transcripts fail closed without reading unrelated files', () => {
  const root = path.resolve(__dirname, '..', '.superpowers');
  assert.ok(fs.existsSync(root));
  assert.throws(() => findTranscript(root, 'claude', session), /missing_or_ambiguous/);
});

test('Haiku study rejects model substitutions and leaves legacy selection intact', () => {
  const haiku = row(); haiku.modelUsage = { 'claude-haiku-4-5-20251001': {} };
  assert.equal(parseNative('claude', JSON.stringify(haiku), 'haiku-luna').session, session);
  assert.throws(() => parseNative('claude', JSON.stringify(haiku)));
  assert.throws(() => parseNative('claude', JSON.stringify(row()), 'haiku-luna'));
  assert.throws(() => modelSettings('claude', 'arbitrary-model'));
  assert.throws(() => modelSettings('constructor', 'haiku-luna'));
  const selected = modelSettings('claude', 'haiku-luna'); selected.model = 'other';
  assert.equal(modelSettings('claude', 'haiku-luna').model, 'claude-haiku-4-5-20251001');
  assert.equal(modelSettings('claude').model, 'claude-sonnet-5');
});

test('Haiku uses fixed thinking without unsupported effort or parent model configuration', () => {
  const args = nativeArguments('claude', { type: 'object' }, 'unused', 'haiku-luna');
  assert.ok(!args.includes('--effort'));
  assert.ok(!args.includes('--fallback-model'));
  assert.equal(args[args.indexOf('--settings') + 1], '{"alwaysThinkingEnabled":true}');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  const env = nativeEnvironment('claude', 'profile', { CLAUDE_CODE_EFFORT_LEVEL: 'max',
    MAX_THINKING_TOKENS: '99999', ANTHROPIC_API_KEY: 'fixture-key' }, 'haiku-luna');
  assert.equal(env.MAX_THINKING_TOKENS, '8192');
  assert.ok(!Object.hasOwn(env, 'CLAUDE_CODE_EFFORT_LEVEL'));
  assert.ok(!Object.hasOwn(env, 'ANTHROPIC_API_KEY'));
  assert.deepEqual(nativeArguments('codex', {}, 'schema', 'haiku-luna'), nativeArguments('codex', {}, 'schema'));
});

test('Haiku audit requires observed thinking but does not certify its requested token cap', () => {
  const records = [{ type: 'user', message: { content: 'exact prompt' } },
    { type: 'assistant', version: '2.1.266', sessionId: session,
      message: { model: 'claude-haiku-4-5-20251001', content: [{ type: 'redacted_thinking' }] } }];
  const expected = { session, version: '2.1.266', prompt: 'exact prompt' };
  const audit = auditTranscript('claude', jsonl(records), expected, 'haiku-luna');
  assert.equal(audit.thinking_observed, true);
  assert.equal(audit.requested_thinking_budget_tokens, 8192);
  assert.equal(audit.thinking_budget_verified, false);
  assert.equal(audit.effort, null);
  for (const mutate of [r => r[1].message.content = [], r => r[1].effort = 'medium',
    r => r[1].message.model = 'claude-sonnet-5', r => r[1].isSidechain = true,
    r => r[1].message.content.push({ type: 'tool_use', name: 'Read' }),
    r => r[0].message.content = 'wrong']) {
    const changed = structuredClone(records); mutate(changed);
    assert.throws(() => auditTranscript('claude', jsonl(changed), expected, 'haiku-luna'));
  }
});

test('anchor transport uses closed source IDs and repair IDs without relaxing legacy schemas', () => {
  const job = { phase: 'review', role: 'context', packet, review_key: reviewKey(packet) };
  const request = nativeRequest(job, session, 'anchors');
  const claim = request.schema.properties.units.items.properties.claims.items;
  assert.deepEqual(claim.properties.span.properties.first.enum, ['U001.A001']);
  assert.equal(claim.additionalProperties, false);
  assert.ok(!Object.hasOwn(claim.properties, 'quote'));
  assert.ok(request.prompt.includes('mechanical text boundaries'));
  const legacy = nativeRequest(job, session);
  assert.ok(Object.hasOwn(legacy.schema.properties.units.items.properties.claims.items.properties, 'quote'));
  assert.throws(() => nativeRequest(job, session, 'fuzzy'));
  const review = { units: [{ id: 'U001', assessment: 'needs_review', issues: [
    { quote: 'A claim.', kind: 'contradicted', reason: 'Synthetic error.' }] }] };
  const repair = nativeRequest({ ...job, phase: 'repair', review, reports: [{}, {}] }, session, 'anchors');
  assert.deepEqual(repair.schema.properties.patches.items.properties.target_id.enum, ['P001']);
  assert.ok(repair.prompt.includes('patch_targets'));
});
