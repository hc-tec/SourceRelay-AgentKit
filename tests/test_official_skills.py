from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from skill_package import compute_skill_digest, load_json_without_duplicates, packaged_skills  # noqa: E402


RESOURCES = {
    "collector://release": "collector.mcp.release/v1",
    "collector://capabilities": "collector.mcp.capabilities/v1",
    "collector://bindings": "collector.mcp.bindings/v1",
    "collector://operations/{operationId}": "collector.mcp.operation/v1",
    "collector://artifacts/{artifactId}": "collector.mcp.artifact-metadata/v1",
    "collector://artifacts/{artifactId}/chunks/{cursor}": "collector.mcp.artifact-chunk/v1",
}

EXPECTED_SKILLS = {
    "use-collector-mcp": {
        "layer": "foundation",
        "version": "0.1.0",
        "tools": set(),
        "files": {
            "SKILL.md",
            "agents/openai.yaml",
            "manifest.json",
            "references/protocol.md",
        },
    },
    "collect-bilibili": {
        "layer": "platform",
        "version": "0.1.1",
        "tools": {
            "collector_bilibili_video_detail",
            "collector_bilibili_native_search",
            "collector_bilibili_native_search_batch",
            "collector_bilibili_account_profile",
            "collector_bilibili_account_inventory",
            "collector_bilibili_dynamic",
            "collector_bilibili_collection_series_overview",
            "collector_bilibili_collection_series_detail",
            "collector_bilibili_danmaku",
            "collector_bilibili_discussion",
        },
        "files": {
            "SKILL.md",
            "agents/openai.yaml",
            "manifest.json",
            "references/capabilities.md",
        },
    },
    "collect-xiaohongshu": {
        "layer": "platform",
        "version": "0.1.0",
        "tools": {
            "collector_xiaohongshu_public_notes_search",
            "collector_xiaohongshu_account_public_notes",
            "collector_xiaohongshu_note_public_detail",
            "collector_xiaohongshu_note_public_comments",
            "collector_xiaohongshu_note_public_comment_replies",
        },
        "files": {
            "SKILL.md",
            "agents/openai.yaml",
            "manifest.json",
            "references/capabilities.md",
        },
    },
    "collect-zhihu": {
        "layer": "platform",
        "version": "0.1.0",
        "tools": {
            "collector_zhihu_search_public_content",
            "collector_zhihu_hot_list_public_content",
            "collector_web_search_global_zhihu_provider",
        },
        "files": {
            "SKILL.md",
            "agents/openai.yaml",
            "manifest.json",
            "references/capabilities.md",
        },
    },
    "research-search-then-detail": {
        "layer": "intent",
        "version": "0.1.0",
        "tools": {
            "collector_bilibili_native_search",
            "collector_bilibili_native_search_batch",
            "collector_bilibili_video_detail",
            "collector_xiaohongshu_public_notes_search",
            "collector_xiaohongshu_note_public_detail",
        },
        "files": {"SKILL.md", "agents/openai.yaml", "manifest.json"},
    },
}


class OfficialSkillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.compatibility = load_json_without_duplicates(ROOT / "manifests" / "compatibility.json")
        cls.skill_schema = load_json_without_duplicates(ROOT / "contracts" / "skill-manifest.schema.json")
        cls.tools = {
            item["toolId"]: item["capabilityId"]
            for item in cls.compatibility["mcp"]["tools"]
        }

    def test_exact_official_skill_set_and_file_boundary(self) -> None:
        skills = packaged_skills(ROOT / "skills")
        self.assertEqual({skill.name for skill in skills}, set(EXPECTED_SKILLS))
        for skill in skills:
            files = {
                path.relative_to(skill).as_posix()
                for path in skill.rglob("*")
                if path.is_file()
            }
            self.assertEqual(files, EXPECTED_SKILLS[skill.name]["files"], skill.name)
            self.assertNotIn("README.md", files)

    def test_skill_creator_frontmatter_and_openai_metadata_are_complete(self) -> None:
        for skill_id in EXPECTED_SKILLS:
            skill = ROOT / "skills" / skill_id
            text = (skill / "SKILL.md").read_text(encoding="utf-8")
            self.assertNotIn("TODO", text, skill_id)
            self.assertLessEqual(len(text.splitlines()), 500, skill_id)
            frontmatter = parse_frontmatter(text)
            self.assertEqual(set(frontmatter), {"name", "description"}, skill_id)
            self.assertEqual(frontmatter["name"], skill_id)
            self.assertGreaterEqual(len(frontmatter["description"]), 80)

            metadata_text = (skill / "agents" / "openai.yaml").read_text(encoding="utf-8")
            metadata = parse_openai_yaml(metadata_text)
            self.assertEqual(set(metadata), {"display_name", "short_description", "default_prompt"})
            self.assertGreaterEqual(len(metadata["short_description"]), 25)
            self.assertLessEqual(len(metadata["short_description"]), 64)
            self.assertIn(f"${skill_id}", metadata["default_prompt"])

    def test_manifests_match_schema_core_mcp_and_declared_content(self) -> None:
        schema_required = set(self.skill_schema["required"])
        manifest_resources = set(self.compatibility["mcp"]["resources"])
        core_capabilities = set(self.compatibility["core"]["directCapabilityIds"])
        for skill_id, expected in EXPECTED_SKILLS.items():
            skill = ROOT / "skills" / skill_id
            manifest = load_json_without_duplicates(skill / "manifest.json")
            self.assertEqual(set(manifest), schema_required, skill_id)
            self.assertEqual(manifest["schemaVersion"], "collector.ai-integration.skill/v1alpha1")
            self.assertEqual(manifest["skillId"], skill_id)
            self.assertEqual(manifest["skillVersion"], expected["version"])
            self.assertEqual(manifest["layer"], expected["layer"])
            self.assertEqual(manifest["publisher"], "collector-ai-integration")
            self.assertEqual(manifest["source"], f"collector-ai-integration/skills/{skill_id}")
            self.assertEqual(manifest["license"], "Apache-2.0")
            self.assertIs(manifest["official"], True)

            requirements = manifest["requirements"]
            self.assertEqual(
                set(requirements),
                {"tools", "resources", "capabilities", "minimumOutputSchemas"},
            )
            required_tools = set(requirements["tools"])
            required_capabilities = set(requirements["capabilities"])
            self.assertEqual(len(required_tools), len(requirements["tools"]), skill_id)
            self.assertEqual(len(required_capabilities), len(requirements["capabilities"]), skill_id)
            self.assertEqual(len(set(requirements["resources"])), len(requirements["resources"]), skill_id)
            self.assertEqual(required_tools, expected["tools"], skill_id)
            self.assertTrue(required_tools <= set(self.tools), skill_id)
            self.assertEqual(
                required_capabilities,
                {self.tools[tool] for tool in required_tools},
                skill_id,
            )
            self.assertTrue(required_capabilities <= core_capabilities, skill_id)
            self.assertEqual(set(requirements["resources"]), manifest_resources, skill_id)
            self.assertEqual(requirements["minimumOutputSchemas"], RESOURCES, skill_id)

            compatibility = manifest["compatibility"]
            self.assertEqual(compatibility["mcpToolCatalogRange"], "=collector.mcp.tools/v1")
            self.assertEqual(len(compatibility["testedConfigurations"]), 1)
            tested = compatibility["testedConfigurations"][0]
            self.assertEqual(tested["level"], "l1")
            self.assertEqual(tested["toolCatalogVersion"], "collector.mcp.tools/v1")
            self.assertEqual(tested["coreRelease"], "0.7.17")
            self.assertEqual(tested["coreServiceSchema"], 3)

            effects = manifest["externalEffects"]
            self.assertIs(effects["platformReads"], True)
            self.assertIs(effects["platformWrites"], False)
            self.assertEqual(effects["localWrites"], [])
            self.assertGreaterEqual(len(effects["networkDestinations"]), 1)
            self.assertEqual(
                len(effects["networkDestinations"]),
                len(set(effects["networkDestinations"])),
            )

            declared_text = "\n".join(
                path.read_text(encoding="utf-8")
                for path in skill.rglob("*.md")
            )
            mentioned_tools = set(re.findall(
                r"collector_(?:bilibili|xiaohongshu|zhihu|web)_[a-z0-9_]+",
                declared_text,
            ))
            self.assertTrue(mentioned_tools <= required_tools, skill_id)
            self.assertNotRegex(declared_text, r"(?:cst_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{12,})")

    def test_skill_package_digests_and_compatibility_catalog_are_exact(self) -> None:
        catalog = {
            item["skillId"]: (item["skillVersion"], item["digest"])
            for item in self.compatibility["skills"]["official"]
        }
        self.assertEqual(len(catalog), len(self.compatibility["skills"]["official"]))
        self.assertEqual(set(catalog), set(EXPECTED_SKILLS))
        for skill_id in EXPECTED_SKILLS:
            skill = ROOT / "skills" / skill_id
            manifest = load_json_without_duplicates(skill / "manifest.json")
            digest = compute_skill_digest(skill)
            self.assertRegex(digest, r"^sha256:[0-9a-f]{64}$")
            self.assertEqual(manifest["digest"], digest, skill_id)
            self.assertEqual(catalog[skill_id], (manifest["skillVersion"], digest))

    def test_skill_package_digest_is_line_ending_stable(self) -> None:
        source = ROOT / "skills" / "collect-bilibili"
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory) / source.name
            shutil.copytree(source, copy)
            for path in copy.rglob("*"):
                if path.is_file() and path.suffix.lower() in {".json", ".md", ".yaml", ".yml"}:
                    path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
            self.assertEqual(compute_skill_digest(copy), compute_skill_digest(source))


def parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(?P<body>.*?)\n---\n", text, re.DOTALL)
    if match is None:
        raise AssertionError("SKILL.md frontmatter missing")
    result: dict[str, str] = {}
    for line in match.group("body").splitlines():
        key, separator, value = line.partition(":")
        if separator != ":" or not key or not value.strip():
            raise AssertionError(f"invalid SKILL.md frontmatter line: {line!r}")
        if key in result:
            raise AssertionError(f"duplicate SKILL.md frontmatter key: {key!r}")
        result[key] = value.strip()
    return result


def parse_openai_yaml(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0] != "interface:":
        raise AssertionError("agents/openai.yaml interface missing")
    result: dict[str, str] = {}
    for line in lines[1:]:
        match = re.fullmatch(r"  ([a-z_]+): (\"(?:[^\"\\]|\\.)*\")", line)
        if match is None:
            raise AssertionError(f"invalid agents/openai.yaml line: {line!r}")
        if match.group(1) in result:
            raise AssertionError(f"duplicate agents/openai.yaml key: {match.group(1)!r}")
        result[match.group(1)] = json.loads(match.group(2))
    return result


if __name__ == "__main__":
    unittest.main()
