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
    "package-lock.json",
    "package.json",
    "README.md",
    "SECURITY.md",
}

CANONICAL_ARCHITECTURE = {
    "collector-ai-native-target-architecture.md",
    "overall-system-consistency-audit.md",
    "overall-system-grilling-decision-log.md",
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
    ".mjs",
    ".ps1",
    ".py",
    ".toml",
    ".txt",
    ".ts",
    ".yaml",
    ".yml",
}

IGNORED_DIRECTORY_NAMES = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "runtime",
}

MCP_FOUNDATION_RESOURCES = {
    "collector://release",
    "collector://capabilities",
    "collector://bindings",
    "collector://operations/{operationId}",
    "collector://artifacts/{artifactId}",
    "collector://artifacts/{artifactId}/chunks/{cursor}",
}

REQUIRED_CORE_FEATURES = {
    "artifacts.canonical_json_utf8_window.v1",
    "artifacts.metadata.v1",
    "capabilities.direct_contracts.v1",
    "collect.client_request_id.v1",
    "operations.exact_core_state.v1",
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


def ignored(path: Path) -> bool:
    return any(part in IGNORED_DIRECTORY_NAMES for part in path.parts)


class RepositoryFoundationTests(unittest.TestCase):
    maxDiff = None

    def test_required_governance_files_exist(self) -> None:
        actual = {path.name for path in ROOT.iterdir() if path.is_file()}
        self.assertTrue(REQUIRED_ROOT_FILES <= actual)

    def test_all_repository_text_is_strict_utf8_without_bom_or_replacement(self) -> None:
        for path in ROOT.rglob("*"):
            if not path.is_file() or ignored(path):
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
            if ignored(path):
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

    def test_checkpoint3_manifest_is_truthful_and_bounded(self) -> None:
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
        self.assertEqual(manifest["product"]["version"], "0.0.0-mcp-foundation")
        self.assertEqual(manifest["product"]["phase"], "mcp_foundation")
        self.assertEqual(manifest["product"]["license"], "Apache-2.0")
        self.assertEqual(manifest["checkpoint"], {"completed": [0, 1, 2, 3], "current": None, "next": 4})

        core = manifest["core"]
        self.assertEqual(core["supportedApiSchemaRange"], "=3")
        self.assertEqual(core["supportedReleaseRange"], "=0.7.17")
        self.assertEqual(set(core["requiredFeatures"]), REQUIRED_CORE_FEATURES)
        self.assertEqual(
            core["openApiSchemaDigest"],
            "sha256:a82b2f45302998544ddd1a82c06398ede00ce7f706c8f071c77241ef93f46566",
        )
        self.assertRegex(core["capabilityCatalogDigest"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(len(core["directCapabilityIds"]), 15)
        self.assertEqual(len(set(core["directCapabilityIds"])), 15)

        mcp = manifest["mcp"]
        self.assertTrue(mcp["implemented"])
        self.assertEqual(mcp["protocolVersion"], "2025-11-25")
        self.assertEqual(mcp["defaultTransport"], "stdio")
        self.assertIsNone(mcp["toolCatalogVersion"])
        self.assertEqual(mcp["tools"], [])
        self.assertEqual(set(mcp["resources"]), MCP_FOUNDATION_RESOURCES)

        self.assertEqual(manifest["skills"]["official"], [])
        self.assertEqual(manifest["support"]["operatingSystems"], ["windows"])
        self.assertEqual(manifest["support"]["browsers"], [])
        self.assertEqual(len(manifest["support"]["verifiedConfigurations"]), 1)
        self.assertEqual(
            set(manifest["guardrails"]["forbiddenRuntimeFeatures"]),
            FORBIDDEN_RUNTIME_FEATURES,
        )
        self.assertEqual(manifest["verification"]["highestCompletedLevel"], "l2")
        evidence = {item["kind"] for item in manifest["verification"]["evidence"]}
        self.assertEqual(
            evidence,
            {
                "repository_boundary_gate",
                "mcp_l1_contract_gate",
                "packaged_mcp_real_core_stdio_l2",
            },
        )

    def test_checkpoint3_runtime_is_only_the_pinned_thin_mcp_package(self) -> None:
        root_package = load_json_without_duplicate_keys(ROOT / "package.json")
        mcp_package = load_json_without_duplicate_keys(ROOT / "packages" / "mcp-server" / "package.json")
        self.assertEqual(root_package["workspaces"], ["packages/mcp-server"])
        self.assertEqual(mcp_package["version"], "0.0.0-mcp-foundation")
        self.assertEqual(
            mcp_package["dependencies"],
            {"@modelcontextprotocol/sdk": "1.30.0", "zod": "4.4.3"},
        )
        self.assertEqual(mcp_package["bin"], {"collector-mcp": "./dist/src/cli.js"})
        self.assertTrue((ROOT / "packages" / "mcp-server" / "src" / "cli.ts").is_file())
        self.assertTrue((ROOT / "packages" / "mcp-server" / "src" / "server.ts").is_file())
        windows_files = {
            path.relative_to(ROOT / "packages" / "windows-configurator").as_posix()
            for path in (ROOT / "packages" / "windows-configurator").rglob("*")
            if path.is_file()
        }
        self.assertEqual(windows_files, {"README.md"})

        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / "packages" / "mcp-server" / "src").glob("*.ts")
        ).lower()
        for forbidden in (
            "inteligence-apps",
            "playwright",
            "puppeteer",
            "langgraph",
            "deepseek",
            "registertool(",
        ):
            self.assertNotIn(forbidden, source)

    def test_no_official_skill_or_executable_example_exists_yet(self) -> None:
        for boundary in (ROOT / "skills", ROOT / "examples"):
            files = {path.relative_to(boundary).as_posix() for path in boundary.rglob("*") if path.is_file()}
            self.assertEqual(files, {"README.md"}, boundary)

    def test_repository_contains_no_symlinks(self) -> None:
        symlinks = [path for path in ROOT.rglob("*") if not ignored(path) and path.is_symlink()]
        self.assertEqual(symlinks, [])


if __name__ == "__main__":
    unittest.main()
