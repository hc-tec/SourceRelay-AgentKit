from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_ROOT_FILES = {
    ".editorconfig",
    ".gitattributes",
    ".gitignore",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "SECURITY.md",
}

CANONICAL_ARCHITECTURE = {
    "collector-ai-native-target-architecture.md",
    "overall-system-consistency-audit.md",
    "overall-system-grilling-decision-log.md",
}

FORBIDDEN_FOUNDATION_MANIFESTS = {
    "Cargo.toml",
    "go.mod",
    "package.json",
    "pnpm-workspace.yaml",
    "pyproject.toml",
    "requirements.txt",
}

FORBIDDEN_RUNTIME_FEATURES = {
    "arbitrary_browser_control",
    "browser_profile_lifecycle",
    "deepresearch_or_model_provider",
    "inteligence_apps_runtime_dependency",
    "knowledge_pack_or_analysis_service",
    "unbounded_artifact_access",
    "workflow_planner_task_run_service",
}

TEXT_SUFFIXES = {
    ".cfg",
    ".ini",
    ".json",
    ".md",
    ".ps1",
    ".py",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}


def load_json_without_duplicate_keys(path: Path) -> dict[str, object]:
    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        value: dict[str, object] = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate JSON key {key!r} in {path}")
            value[key] = item
        return value

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates)


class RepositoryFoundationTests(unittest.TestCase):
    maxDiff = None

    def test_required_governance_files_exist(self) -> None:
        actual = {path.name for path in ROOT.iterdir() if path.is_file()}
        self.assertTrue(REQUIRED_ROOT_FILES <= actual)

    def test_all_repository_text_is_strict_utf8_without_bom_or_replacement(self) -> None:
        for path in ROOT.rglob("*"):
            if not path.is_file() or ".git" in path.parts:
                continue
            if path.name not in REQUIRED_ROOT_FILES and path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            raw = path.read_bytes()
            self.assertFalse(raw.startswith(b"\xef\xbb\xbf"), path)
            text = raw.decode("utf-8", errors="strict")
            self.assertNotIn("\ufffd", text, path)

    def test_apache_2_license_is_complete_enough_to_identify(self) -> None:
        license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")
        self.assertIn("Apache License", license_text)
        self.assertIn("Version 2.0, January 2004", license_text)
        self.assertIn("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION", license_text)
        self.assertIn("END OF TERMS AND CONDITIONS", license_text)

    def test_canonical_architecture_documents_are_present(self) -> None:
        architecture_dir = ROOT / "docs" / "architecture"
        actual = {path.name for path in architecture_dir.glob("*.md")}
        self.assertTrue(CANONICAL_ARCHITECTURE <= actual)
        target = (architecture_dir / "collector-ai-native-target-architecture.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("Approved — Architecture Freeze complete", target)
        self.assertIn("Checkpoint 2", target)
        self.assertNotIn("临时文档位置", target)

    def test_relative_markdown_links_resolve_inside_the_repository(self) -> None:
        link_pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
        for path in ROOT.rglob("*.md"):
            if ".git" in path.parts:
                continue
            text = path.read_text(encoding="utf-8")
            for raw_target in link_pattern.findall(text):
                target = raw_target.strip().strip("<>")
                if target.startswith(("#", "http://", "https://", "mailto:")):
                    continue
                target_path = target.split("#", 1)[0]
                self.assertTrue((path.parent / target_path).resolve().exists(), f"{path}: {target}")

    def test_json_contracts_parse_without_duplicate_keys(self) -> None:
        for path in (ROOT / "contracts").glob("*.json"):
            parsed = load_json_without_duplicate_keys(path)
            self.assertEqual(parsed.get("$schema"), "https://json-schema.org/draft/2020-12/schema")
            self.assertEqual(parsed.get("type"), "object")
            self.assertFalse(parsed.get("additionalProperties"))

    def test_foundation_manifest_is_truthful_and_empty(self) -> None:
        manifest_path = ROOT / "manifests" / "compatibility.json"
        manifest = load_json_without_duplicate_keys(manifest_path)
        schema_path = (manifest_path.parent / str(manifest["$schema"])).resolve()
        self.assertEqual(schema_path, (ROOT / "contracts" / "compatibility-manifest.schema.json").resolve())
        self.assertTrue(schema_path.is_file())

        self.assertEqual(
            set(manifest),
            {
                "$schema",
                "schemaVersion",
                "product",
                "checkpoint",
                "core",
                "mcp",
                "skills",
                "support",
                "guardrails",
                "verification",
            },
        )
        self.assertEqual(manifest["schemaVersion"], "collector.ai-integration.compatibility/v1alpha1")
        self.assertEqual(manifest["product"]["phase"], "repository_foundation")
        self.assertEqual(manifest["product"]["license"], "Apache-2.0")
        self.assertEqual(manifest["checkpoint"], {"completed": [0, 1, 2], "current": None, "next": 3})

        core = manifest["core"]
        self.assertIsNone(core["supportedApiSchemaRange"])
        self.assertIsNone(core["supportedReleaseRange"])
        self.assertIsNone(core["capabilityCatalogDigest"])
        self.assertEqual(core["requiredFeatures"], [])
        self.assertEqual(core["directCapabilityIds"], [])

        mcp = manifest["mcp"]
        self.assertFalse(mcp["implemented"])
        self.assertIsNone(mcp["protocolVersion"])
        self.assertIsNone(mcp["defaultTransport"])
        self.assertIsNone(mcp["toolCatalogVersion"])
        self.assertEqual(mcp["tools"], [])
        self.assertEqual(mcp["resources"], [])

        self.assertEqual(manifest["skills"]["official"], [])
        self.assertEqual(manifest["support"]["operatingSystems"], [])
        self.assertEqual(manifest["support"]["browsers"], [])
        self.assertEqual(manifest["support"]["verifiedConfigurations"], [])
        self.assertEqual(
            set(manifest["guardrails"]["forbiddenRuntimeFeatures"]),
            FORBIDDEN_RUNTIME_FEATURES,
        )
        self.assertEqual(manifest["verification"]["highestCompletedLevel"], "repository_foundation")

    def test_runtime_language_and_framework_are_not_selected_early(self) -> None:
        actual = {path.name for path in ROOT.rglob("*") if path.is_file()}
        self.assertTrue(FORBIDDEN_FOUNDATION_MANIFESTS.isdisjoint(actual))

        runtime_suffixes = {".cjs", ".go", ".js", ".mjs", ".py", ".rs", ".ts", ".tsx"}
        for package in (ROOT / "packages").iterdir():
            files = {path.relative_to(package).as_posix() for path in package.rglob("*") if path.is_file()}
            self.assertEqual(files, {"README.md"}, package)
            self.assertFalse(any(path.suffix in runtime_suffixes for path in package.rglob("*")))

    def test_no_official_skill_or_executable_example_exists_yet(self) -> None:
        for boundary in (ROOT / "skills", ROOT / "examples"):
            files = {path.relative_to(boundary).as_posix() for path in boundary.rglob("*") if path.is_file()}
            self.assertEqual(files, {"README.md"}, boundary)

    def test_repository_contains_no_symlinks(self) -> None:
        symlinks = [path for path in ROOT.rglob("*") if ".git" not in path.parts and path.is_symlink()]
        self.assertEqual(symlinks, [])


if __name__ == "__main__":
    unittest.main()
