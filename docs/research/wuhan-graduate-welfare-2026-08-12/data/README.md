# data/ 原始接口返回数据

本目录保存 Collector MCP 采集到的**原始接口返回**，与 report.md / evidence-ledger.md 配套，防止数据丢失。

## 目录

- `raw/`：每个采集任务的原始返回
  - `<operationId>.artifact-metadata.json`：Artifact 元信息（含 SHA-256、字节数、终态）
  - `<operationId>.chunk-0.json` / `.chunk-1.json`：Artifact 分块原始 JSON（`text` 字段为完整数据，即小红书/知乎/B站搜索结果与笔记详情投影）
  - `<operationId>.index.json`：该任务的查询词、clientRequestId、终态、条目数索引

## 命名与溯源

- 文件名 = Core Operation ID，可通过 `collector://operations/<operationId>` 复核；
- 每个 index.json 记录 clientRequestId、query、terminal、itemCount、Artifact SHA-256；
- 数据全部来自 Collector MCP 实时能力（知乎官方开放平台 / 小红书扩展 / B站扩展），保留精确终态，平台不可用/部分失败均如实记录，不改写为"无结果"。

## 2026-08-12 已保存任务（第五轮，X22-X27，严格串行）

| op (文件名前缀) | 能力 | 查询词 | 终态 | 条目 |
| --- | --- | --- | --- | --- |
| 3939979e-44e5-4cff-9546-4211ea8e95f2 | xiaohongshu | 武昌英才 人才 申报 待遇 | completed | 17 |
| c0ac0d89-fb5c-4c70-9c9f-74478120b1f0 | xiaohongshu | 武汉 应届生 补贴 汇总 2026 | completed | 19 |
| 7b63022e-dcec-4a57-9369-0c4b5a175851 | xiaohongshu | 武汉 人才码 楚才卡 青年卡 福利 | completed | 18 |
| a887ea3e-cb91-4e75-b522-92d2ab28a7ba | xiaohongshu | 武汉 毕业生 免票 免费 攻略 资源 | completed | 19 |
| 4563ea31-3243-4e81-8563-814e9256cb07 | xiaohongshu | 湖北 楚才卡 申领 条件 | completed | 19 |
| 233d7334-9408-4aa3-a42d-cb5515e90321 | xiaohongshu | 武汉 技能提升补贴 申领 指南 2026 | completed | 20 |

> 第一~四轮的原始返回若需补档，可从 Core（artifact 保留策略 core_managed_local）按 evidence-ledger.md 附录 A/B/C 中的 Artifact ID 重新读取。

> 配套详细文档：detailed-guide.md（17 章完整执行版）；汇总：report.md；证据：evidence-ledger.md。