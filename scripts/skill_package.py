from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ALGORITHM = "sha256-skill-package-v1"
ZERO_DIGEST = "sha256:" + "0" * 64
PREFIX = b"collector-ai-integration\0sha256-skill-package-v1\0"
TEXT_SUFFIXES = {".json", ".md", ".yaml", ".yml"}


def load_json_without_duplicates(path: Path) -> dict[str, Any]:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key {key!r} in {path}")
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates)


def compute_skill_digest(skill_directory: Path) -> str:
    skill_directory = skill_directory.resolve()
    if not (skill_directory / "SKILL.md").is_file() or not (skill_directory / "manifest.json").is_file():
        raise ValueError(f"not a packaged Skill: {skill_directory}")

    files = sorted(
        (path for path in skill_directory.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(skill_directory).as_posix(),
    )
    digest = hashlib.sha256(PREFIX)
    for path in files:
        if path.is_symlink():
            raise ValueError(f"Skill package contains a symlink: {path}")
        relative = path.relative_to(skill_directory).as_posix()
        relative_bytes = relative.encode("utf-8")
        data = _digest_bytes(path, relative)
        digest.update(len(relative_bytes).to_bytes(4, "big"))
        digest.update(relative_bytes)
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return f"sha256:{digest.hexdigest()}"


def verify_skill(skill_directory: Path) -> tuple[bool, str]:
    manifest = load_json_without_duplicates(skill_directory / "manifest.json")
    actual = manifest.get("digest")
    expected = compute_skill_digest(skill_directory)
    if actual != expected:
        return False, f"{skill_directory.name}: expected {expected}, manifest has {actual}"
    return True, f"{skill_directory.name}: {expected}"


def packaged_skills(skills_root: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in skills_root.iterdir()
            if path.is_dir() and (path / "SKILL.md").is_file() and (path / "manifest.json").is_file()
        ),
        key=lambda path: path.name,
    )


def _digest_bytes(path: Path, relative: str) -> bytes:
    if relative != "manifest.json":
        data = path.read_bytes()
        if path.suffix.lower() in TEXT_SUFFIXES:
            # Git normalizes packaged text to LF. Apply the same normalization
            # before hashing so an existing Windows CRLF worktree cannot create
            # a digest that differs from a clean Linux checkout.
            return data.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")
        return data
    manifest = load_json_without_duplicates(path)
    manifest["digest"] = ZERO_DIGEST
    return json.dumps(
        manifest,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Compute or verify official Skill package digests.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    compute = subparsers.add_parser("compute")
    compute.add_argument("skill_directory", type=Path)
    verify = subparsers.add_parser("verify")
    verify.add_argument("skills_root", type=Path)
    args = parser.parse_args(argv)

    if args.command == "compute":
        print(compute_skill_digest(args.skill_directory))
        return 0

    skills = packaged_skills(args.skills_root)
    if not skills:
        print("no packaged Skills found", file=sys.stderr)
        return 1
    valid = True
    for skill in skills:
        passed, message = verify_skill(skill)
        print(message)
        valid = valid and passed
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
