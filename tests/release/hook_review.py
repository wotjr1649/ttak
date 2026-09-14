"""Validate native hook metadata against reviewed installed definitions before trusting it."""
from pathlib import Path
import re

EVENTS = {'sessionStart': ('SessionStart', 'session_start'), 'subagentStart': ('SubagentStart', 'subagent_start'),
          'preToolUse': ('PreToolUse', 'pre_tool_use'), 'subagentStop': ('SubagentStop', 'subagent_stop'),
          'userPromptSubmit': ('UserPromptSubmit', 'user_prompt_submit'), 'postToolUse': ('PostToolUse', 'post_tool_use'),
          'sessionEnd': ('SessionEnd', 'session_end'), 'stop': ('Stop', 'stop')}


def validate_hooks(hooks, definitions, plugin_root, identifier):
    root = Path(plugin_root).resolve(strict=True)
    if set(definitions) != {event for event, _ in EVENTS.values()}:
        raise ValueError('unexpected reviewed hook definitions')
    expected_rows = {}
    for name, (event, suffix) in EVENTS.items():
        for group_index, group in enumerate(definitions[event]):
            for handler_index, definition in enumerate(group['hooks']):
                key = f'{identifier}:hooks/hooks.json:{suffix}:{group_index}:{handler_index}'
                if definition.get('type') != 'command' or definition.get('async', False):
                    raise ValueError('unsupported reviewed hook definition')
                expected_rows[key] = (name, group, definition)
    if len(hooks) != len(expected_rows) or {h.get('key') for h in hooks} != set(expected_rows):
        raise ValueError('unexpected candidate hook set')
    for hook in hooks:
        name, group, definition = expected_rows[hook['key']]
        expected = definition['command'].replace('${CLAUDE_PLUGIN_ROOT}', str(root))
        if (hook.get('pluginId') != identifier or hook.get('eventName') != name
                or hook.get('handlerType') != 'command' or hook.get('command') != expected
                or hook.get('timeoutSec') != definition['timeout'] or hook.get('async') is not False
                or hook.get('matcher') != group.get('matcher') or hook.get('source') != 'plugin'
                or hook.get('isManaged') is not False
                or Path(hook['sourcePath']).resolve(strict=True) != root / 'hooks/hooks.json'
                or not re.fullmatch(r'sha256:[0-9a-f]{64}', hook.get('currentHash', ''))):
            raise ValueError('hook differs from reviewed candidate')
    return hooks
