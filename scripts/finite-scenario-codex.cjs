'use strict';
// Argument construction only. Does not launch a process or change MCP/profile configuration.
const path = require('node:path');
function scenarioCodexArguments(nodeExecutable, serverScript) {
  for (const value of [nodeExecutable, serverScript]) {
    if (typeof value !== 'string' || !path.win32.isAbsolute(value) || /[\u0000-\u001f]/.test(value)) {
      throw new Error('invalid_scenario_command_path');
    }
  }
  // JSON strings with these bounded Windows paths are also valid TOML basic strings.
  const server = 'mcp_servers = { finite_scenario = { command = ' + JSON.stringify(nodeExecutable)
    + ', args = [' + JSON.stringify(serverScript) + '], env_vars = [], '
    + 'env = { OPENAI_API_KEY = "", ANTHROPIC_API_KEY = "", CLAUDE_CODE_OAUTH_TOKEN = "" }, '
    + 'enabled = true, required = true, enabled_tools = ["scenario_explain"], '
    + 'startup_timeout_sec = 10, tool_timeout_sec = 10, default_tools_approval_mode = "writes" } }';
  return ['exec', '--sandbox', 'read-only', '--model', 'gpt-5.6-luna',
    '-c', 'model_reasoning_effort="high"', '-c', 'approval_policy="never"',
    '--disable', 'shell_tool', '-c', 'web_search="disabled"', '-c', server,
    '--skip-git-repo-check', '--json', '-'];
}
module.exports = { scenarioCodexArguments };
