# Collector AI Integration

Collector AI Integration 是 Collector Core 的独立 AI-native 接入产品。它用一个薄的 MCP
协议适配器公开 Core 已登记的强类型采集能力，并用版本化 Skills 教 Agent 正确发现能力、
提交 Operation、解释终态和有界读取 raw Artifact。

## 当前状态

```text
architecture: approved
checkpoint 0: complete
checkpoint 1: complete
checkpoint 2: complete — repository foundation only
runtime MCP: not implemented
official Skills: not published
platform capability claim: none from this repository yet
```

当前仓库只有产品边界、治理文件、机器可读 manifest、合同 schema、占位包和架构门禁测试。
它还不是可安装或可运行的 MCP Server。README、manifest 或 Skill 说明永远不能替代实时
Collector Core capability catalog。

## 产品位置

```text
Agent / AI-native Application
  ├─ owns goal, reasoning, project state and output
  ├─ loads pinned versioned Skills
  └─ uses MCP Client
          ↓
Collector AI Integration
  ├─ thin typed MCP adapter
  ├─ Operation Resources
  ├─ bounded Artifact Resources
  ├─ compatibility / auth / budgets / logs
  └─ no workflow, planner, model or browser control
          ↓
Collector Core API / SDK
          ↓
Paired MV3 extension in the user's daily Chrome/Edge
```

Collector Core 位于独立仓库 `D:\AIProject\inteligence`，必须能在没有本项目时独立使用。
已冻结历史原型位于 `D:\AIProject\inteligence-apps`；本项目禁止导入、启动、转发或回退到
该原型。

## 只负责什么

- 默认 stdio 的 thin Collector MCP Server；
- Core release、OpenAPI、capability 与 binding compatibility preflight；
- 一项 direct-ready Core capability 对应一项强类型 MCP Tool；
- Core Operation 的只读 Resources；
- Core Artifact 的 metadata-first、有界 Resources；
- 最小权限 Core credential、调用预算和内容最小化日志；
- Foundation、Platform、Intent 三层版本化 Skills；
- Windows 安装、配置、升级和卸载；
- L1–L4 分层验证与公开兼容清单。

## 明确不负责什么

- Workflow Engine、Planner、Workspace/Task/Run/Step 服务；
- KnowledgePack、Evidence Workspace、Analysis API 或报告生成；
- DeepSeek、DeerFlow、DeepResearch 或任何模型 provider；
- Cookie、Profile、Storage、密码或浏览器生命周期；
- Playwright、CDP、DevTools 或任意 URL/selector/script/tab/network Tool；
- Core raw Artifact 的复制数据库；
- 对 `inteligence-apps` 的兼容层；
- 未经 Core direct-ready catalog 登记的隐藏能力。

## 仓库结构

```text
contracts/                 versioned manifest schemas
docs/architecture/         canonical approved architecture and decision record
examples/                  future AI-native examples; currently empty by contract
manifests/                 truthful machine-readable product compatibility
packages/mcp-server/       reserved runtime package boundary; no source in Checkpoint 2
packages/windows-configurator/
                            reserved installer/configurer boundary; no source yet
skills/                     future official Skills; none published in Checkpoint 2
tests/                      repository and contract architecture gates
scripts/                    dependency-free verification entrypoints
```

不存在根级 `src/`、通用 workflow 包或旧原型 adapter。选择 TypeScript/Python 和具体 MCP SDK
属于 Checkpoint 3 的小型技术调研，不在仓库基础阶段提前锁定。

## 验证当前基础

只需要 Python 3.11+ 标准库：

```powershell
Set-Location D:\AIProject\collector-ai-integration
python .\scripts\verify_repository.py
```

该命令验证 UTF-8、Apache-2.0、目录边界、canonical 文档、manifest 的保守声明，以及
Checkpoint 2 期间没有出现 MCP runtime、Tool、Resource 或官方 Skill 实现。通过这些测试
不能宣称任何真实平台能力。

## Compatibility 原则

唯一机器可读入口是：

```text
manifests/compatibility.json
```

Checkpoint 2 的 manifest 必须诚实声明：

- phase 为 `repository_foundation`；
- Core release/API schema range 尚未绑定；
- MCP protocol、transport、Tool 和 Resource 均尚未实现；
- 官方 Skills 为空；
- 支持的 OS/browser 与真实验证配置为空；
- Workflow、模型、浏览器控制和旧原型依赖均为禁止状态。

后续只有在实现和对应验证 checkpoint 同时通过后，manifest 才能扩大声明。

## 后续 Checkpoints

### Checkpoint 3 — MCP Foundation

- 小型技术调研后选择语言和官方 MCP SDK；
- stdio、Core auth、live discovery；
- Tool/Resource/error/log 合同；
- Core 前置增强：幂等、schema identity、Artifact metadata/window；
- L1 与真实进程 L2。

### Checkpoint 4 — Full Capability Parity

- 当前全部 direct-ready capability 的强类型 Tools；
- Operation/Artifact Resources；
- schema digest 与 Core/Python SDK/JavaScript SDK/MCP parity gate。

### Checkpoint 5 — Skills + Real AI Canary

- Foundation、Bilibili、Xiaohongshu 和最小 Intent Skills；
- 真实 L3 MCP canary；
- pinned-Skill L4 Agent canary。

### Checkpoint 6 — Windows User Release

- install/configure/uninstall；
- OS credential protection；
- Agent host configuration；
- release hash、SBOM 与 runbook。

## 权威架构

- [目标架构](docs/architecture/collector-ai-native-target-architecture.md)
- [一致性审计](docs/architecture/overall-system-consistency-audit.md)
- [整体决策账本](docs/architecture/overall-system-grilling-decision-log.md)

## 贡献与安全

贡献前阅读 [AGENTS.md](AGENTS.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和
[SECURITY.md](SECURITY.md)。任何真实平台验证都必须通过正式 Core capability 执行，不能把
fixture、fake Gateway 或 synthetic page 当成平台证据。

## License

Apache License 2.0，见 [LICENSE](LICENSE)。
