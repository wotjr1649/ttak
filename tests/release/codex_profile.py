"""Select only task-owned original plugins through Codex's normal configuration API.

No credentials are read or copied. An exclusive task lock prevents concurrent collectors from
changing the same profile. Native version checks protect concurrent configuration changes.
This changes no hooks, trust, permissions, providers or global profile configuration.
"""
from contextlib import contextmanager
import json
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time
import tomllib


MARKETPLACE = "ttak-release-original"
NAMES = {"ponytail", "eli5", "i-have-adhd"}


def selection_edits(config, selected):
    if not selected or not set(selected) <= NAMES:
        raise ValueError("unknown or empty original-plugin selection")
    expected = {f"{name}@{MARKETPLACE}" for name in NAMES}
    plugins = config.get("plugins", {})
    if (not isinstance(plugins, dict) or set(plugins) != expected
            or any(not isinstance(p, dict) or type(p.get("enabled")) is not bool for p in plugins.values())):
        raise ValueError("profile must explicitly configure exactly the three owned original plugins")
    edits, restore = [], []
    for name in sorted(NAMES):
        identifier = f"{name}@{MARKETPLACE}"
        key = f'plugins."{identifier}".enabled'
        edits.append({"keyPath": key, "value": name in selected, "mergeStrategy": "replace"})
        restore.append({"keyPath": key, "value": plugins[identifier]["enabled"], "mergeStrategy": "replace"})
    return edits, restore


class ConfigClient:
    def __init__(self, executable, env, cwd):
        self.process = subprocess.Popen([executable, "app-server", "--stdio"], env=env, cwd=cwd,
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.DEVNULL, text=True, encoding="utf-8")
        self.messages = queue.Queue()
        self.next_id = 0
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        try:
            for line in self.process.stdout:
                self.messages.put(json.loads(line))
        except (ValueError, OSError):
            self.messages.put(None)
        finally:
            self.messages.put(None)

    def send(self, message):
        self.process.stdin.write(json.dumps(message) + "\n")
        self.process.stdin.flush()

    def request(self, method, params):
        self.next_id += 1
        identifier = self.next_id
        self.send({"id": identifier, "method": method, "params": params})
        deadline = time.monotonic() + 20
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f"native configuration response timed out: {method}")
            try:
                row = self.messages.get(timeout=remaining)
            except queue.Empty as error:
                raise TimeoutError(f"native configuration response timed out: {method}") from error
            if row is None:
                raise ValueError("native configuration server closed before responding")
            if row.get("id") == identifier:
                if "error" in row:
                    raise ValueError(f"native configuration rejected {method}; no retry")
                return row["result"]

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=10)
            raise TimeoutError("native configuration server needed termination; inspect before continuing")
        self.reader.join(timeout=1)
        if self.process.returncode:
            raise ValueError("native configuration server exited unsuccessfully")


@contextmanager
def original_selection(profile, selected, env, task_runtime):
    profile = Path(profile).resolve(strict=True)
    if profile.name != "codex-original" or not profile.is_relative_to(Path(task_runtime).resolve()):
        raise ValueError("original selection is limited to the task-local Codex original profile")
    if env.get("CODEX_HOME") != str(profile):
        raise ValueError("native configuration destination differs from the task profile")
    executable = shutil.which("codex", path=env.get("PATH"))
    if not executable:
        raise ValueError("native Codex executable unavailable")
    lock = profile / "release-selection.lock"
    with lock.open("x", encoding="utf-8"):
        client = None
        write = None
        receipt = None
        try:
            config_path = profile / "config.toml"
            if config_path.is_symlink() or config_path.resolve(strict=True) != config_path:
                raise ValueError("task configuration must be a regular file at its owned profile path")
            before = tomllib.loads(config_path.read_text(encoding="utf-8"))
            edits, restore = selection_edits(before, selected)
            client = ConfigClient(executable, env, profile)
            client.request("initialize", {"clientInfo": {"name": "ttak_release", "version": "0.1"}})
            client.send({"method": "initialized"})
            config = client.request("config/read", {"includeLayers": True})
            layers = [r for r in config.get("layers", []) if r.get("name", {}).get("type") == "user"]
            if len(layers) != 1:
                raise ValueError("no unambiguous native user configuration layer")
            write = client.request("config/batchWrite", {"filePath": str(config_path),
                                   "expectedVersion": layers[0]["version"], "edits": edits})
            if write["status"] != "ok":
                raise ValueError("native plugin selection was overridden; do not run a trial")
            listing = subprocess.run([executable, "plugin", "list", "--json", "--marketplace", MARKETPLACE],
                                     env=env, cwd=profile, capture_output=True, text=True,
                                     encoding="utf-8", timeout=20, check=True)
            enabled = {p["name"] for p in json.loads(listing.stdout)["installed"] if p["enabled"]}
            if enabled != set(selected):
                raise ValueError("native plugin selection differs from the requested condition")
            receipt = {"method": "config/batchWrite", "enabled": sorted(enabled), "restored": False}
            yield receipt
        finally:
            try:
                if write is not None:
                    result = client.request("config/batchWrite", {"filePath": str(config_path),
                                            "expectedVersion": write["version"], "edits": restore})
                    if result["status"] != "ok":
                        raise ValueError("native original-plugin restoration was overridden")
                    after = tomllib.loads(config_path.read_text(encoding="utf-8"))
                    if after.get("plugins") != before["plugins"]:
                        raise ValueError("native original-plugin settings were not restored")
                    if receipt is not None:
                        receipt["restored"] = True
            finally:
                if client is not None:
                    client.close()
    lock.unlink()
