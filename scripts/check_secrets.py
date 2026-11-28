"""Reject credential literals in the current source tree without printing their values."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = {
    "provider credential": re.compile(rb"gsk_[A-Za-z0-9]{40,}"),
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{40,}"),
    "GitHub token": re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})"),
}
SUFFIXES = {".java", ".py", ".ts", ".tsx", ".js", ".json", ".yml", ".yaml", ".properties", ".env"}


def main() -> int:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT.as_posix()}", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT, check=True, capture_output=True,
    )
    failed = False
    for name in sorted(set(result.stdout.decode().split("\0")) - {""}):
        path = ROOT / name
        if not path.is_file() or path.suffix not in SUFFIXES or path.stat().st_size > 2_000_000:
            continue
        data = path.read_bytes()
        for rule, pattern in RULES.items():
            for match in pattern.finditer(data):
                line = data[:match.start()].count(b"\n") + 1
                print(f"{name}:{line}: remove {rule} from source")
                failed = True
    print("Source credential scan failed." if failed else "Source credential scan passed (current tree only).")
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
