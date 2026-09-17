'use strict';
// Host-owned binding at one fixed filename. Packet text never selects a path or program.
const path = require('node:path');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { checkedData, exact, checkId, checkDigest, validatePacket, digest } = require('./verification-packet.cjs');
const filename = 'verification-input.json';
function bindingFor(runId, nonce, packet) {
  checkId(runId);
  if (typeof nonce !== 'string' || !/^[a-f0-9]{32}$/.test(nonce)) throw new Error('verification_input_nonce');
  return { schema_version: 1, run_id: runId, run_nonce: nonce, packet: validatePacket(packet) };
}
function validateBinding(value, expectedHash) {
  checkDigest(expectedHash);
  const binding = checkedData(value);
  exact(binding, ['schema_version', 'run_id', 'run_nonce', 'packet']);
  if (binding.schema_version !== 1 || digest(binding) !== expectedHash) throw new Error('verification_input_binding');
  return bindingFor(binding.run_id, binding.run_nonce, binding.packet);
}
function writePinnedInput(cwd, runId, nonce, packet) {
  const binding = bindingFor(runId, nonce, packet);
  store.write(path.join(store.checkedDirectory(cwd), filename), binding);
  return digest(binding);
}
function readPinnedInput(cwd, expectedHash) {
  checkDigest(expectedHash); // Reject invalid command data before any file read.
  return validateBinding(store.read(path.join(store.checkedDirectory(cwd), filename)), expectedHash);
}
module.exports = { bindingFor, validateBinding, writePinnedInput, readPinnedInput, filename };
